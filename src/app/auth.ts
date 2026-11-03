import { HttpClient, HttpErrorResponse, HttpInterceptorFn, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import {
  Observable,
  catchError,
  firstValueFrom,
  from,
  map,
  of,
  shareReplay,
  switchMap,
  throwError,
} from 'rxjs';
import { AUTH_ENABLED, CLIENT_ID, GOOGLE_GRANT, IDENTITY_URL, SCOPE } from './auth.config';
import { t } from './content/i18n';
import { Notify } from './notify';

export interface Member {
  id: string;
  name: string;
  email: string;
  roles: string[];
  /** True once the member clicked the link in the confirmation email. */
  emailVerified: boolean;
  /** False for accounts made with "Continue with Google" only (no VITRIX password). */
  hasPassword: boolean;
  /** Two-step login (authenticator app) is on. */
  twoFactor: boolean;
  /** Course ids from COURSES. Filled by the future purchase flow (from an API). */
  courses: string[];
}

interface Tokens {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds when the access token expires. */
  expiresAt: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

const TOKENS_KEY = 'vitrix.session';

/**
 * Current member + login / register / logout, backed by the identity-api server.
 * The login form posts the email and password straight to the server (OAuth password grant);
 * the server returns a short-lived access token (30 min) and a refresh token that keeps the member
 * signed in. Pages and the guard only use this public API.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  /** A refresh already on its way (several requests can get 401 at the same time). */
  private refreshing: Promise<boolean> | null = null;
  private readonly current = signal<Member | null>(null);
  private tokens: Tokens | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  /** False on the published site until the identity server is deployed (see auth.config.ts). */
  readonly enabled = AUTH_ENABLED;
  readonly user = this.current.asReadonly();
  readonly signedIn = computed(() => this.current() !== null);

  /** Restores a saved session (refreshing it if needed). Shared by the app shell and the guard. */
  readonly ready$: Observable<boolean> = AUTH_ENABLED
    ? from(this.restore()).pipe(shareReplay(1))
    : of(false);

  /** Called once on startup by the app shell. */
  init(): void {
    this.ready$.subscribe();
  }

  /**
   * Throws TwoFactorRequired when the account has two-step login: ask for the authenticator code
   * (or a recovery code), then call again with `otp`.
   */
  async login(email: string, password: string, otp?: string): Promise<void> {
    this.assertEnabled();
    await this.requestTokens({
      grant_type: 'password',
      username: email.trim(),
      password,
      scope: SCOPE,
      ...(otp ? { otp: otp.trim() } : {}),
    });
  }

  /**
   * "Continue with Google" with the ID token from Google's button. Throws GoogleConsentRequired when
   * there is no account yet: ask for the privacy consent, then call again with acceptPrivacy = true.
   */
  async loginWithGoogle(idToken: string, acceptPrivacy = false, otp?: string): Promise<void> {
    this.assertEnabled();
    await this.requestTokens({
      grant_type: GOOGLE_GRANT,
      id_token: idToken,
      accept_privacy: acceptPrivacy ? 'true' : 'false',
      scope: SCOPE,
      ...(otp ? { otp: otp.trim() } : {}),
    });
  }

  // ------------------------------------------------------------------ two-step login (Account settings)

  twoFactorStatus(): Promise<TwoFactorStatus> {
    return this.accountCall('GET', '/api/account/two-factor');
  }
  /** A new secret for the authenticator app: show `uri` as a QR code, `key` for typing in. */
  twoFactorSetup(): Promise<{ key: string; uri: string }> {
    return this.accountCall('POST', '/api/account/two-factor/setup');
  }
  /** Turns it on with the first code from the app; returns the one-time recovery codes. */
  async twoFactorEnable(code: string): Promise<string[]> {
    const result = await this.accountCall<{ recoveryCodes: string[] }>(
      'POST',
      '/api/account/two-factor/enable',
      { code },
    );
    await this.reloadMember();
    return result.recoveryCodes;
  }
  async twoFactorDisable(code: string): Promise<void> {
    await this.accountCall('POST', '/api/account/two-factor/disable', { code });
    await this.reloadMember();
  }
  async twoFactorNewRecoveryCodes(code: string): Promise<string[]> {
    const result = await this.accountCall<{ recoveryCodes: string[] }>(
      'POST',
      '/api/account/two-factor/recovery-codes',
      { code },
    );
    return result.recoveryCodes;
  }

  private async accountCall<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    this.assertEnabled();
    const token = this.accessToken();
    if (!token) {
      throw new Error(t('Your session has expired. Please log in again.'));
    }
    try {
      return await firstValueFrom(
        this.http.request<T>(method, `${IDENTITY_URL}${path}`, {
          body,
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
    } catch (error) {
      throw new Error(describeError(error));
    }
  }

  /**
   * Creates the account only; call login() afterwards to sign the new member in.
   * `acceptPrivacy` must be true (the server refuses otherwise). `website` is the hidden honeypot
   * field from the form: people leave it empty, bots fill it in.
   */
  async register(
    name: string,
    email: string,
    password: string,
    options: { acceptPrivacy: boolean; website?: string; captcha?: string },
  ): Promise<void> {
    this.assertEnabled();
    try {
      await firstValueFrom(
        this.http.post(`${IDENTITY_URL}/api/account/register`, {
          name: name.trim(),
          email: email.trim(),
          password,
          acceptPrivacy: options.acceptPrivacy,
          website: options.website ?? '',
          captcha: options.captcha ?? '',
        }),
      );
    } catch (error) {
      throw new Error(describeError(error));
    }
  }

  /**
   * Confirms the email address with the user id and token from the link in the confirmation email.
   * If someone is signed in, their token is refreshed so the change shows straight away.
   * Returns the confirmed email address.
   */
  async confirmEmail(userId: string, token: string): Promise<string> {
    this.assertEnabled();
    let email: string;
    try {
      ({ email } = await firstValueFrom(
        this.http.post<{ email: string }>(`${IDENTITY_URL}/api/account/confirm-email`, {
          userId,
          token,
        }),
      ));
    } catch (error) {
      throw new Error(describeError(error));
    }
    await this.reloadMember();
    return email;
  }

  /** Sends the confirmation email again to the signed-in member. */
  async resendConfirmation(): Promise<void> {
    this.assertEnabled();
    const token = this.accessToken();
    if (!token) {
      throw new Error(t('Your session has expired. Please log in again.'));
    }
    try {
      const result = await firstValueFrom(
        this.http.post<{ alreadyConfirmed: boolean }>(
          `${IDENTITY_URL}/api/account/resend-confirmation`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      if (result.alreadyConfirmed) {
        await this.reloadMember();
      }
    } catch (error) {
      throw new Error(describeError(error));
    }
  }

  /**
   * Gets a fresh token, so changes made elsewhere (email confirmed in another tab, new role)
   * show up. Does nothing when nobody is signed in.
   */
  async reloadMember(): Promise<void> {
    const refreshToken = this.tokens?.refreshToken;
    if (!refreshToken) {
      return;
    }
    try {
      await this.refresh(refreshToken);
    } catch (error) {
      console.warn('VITRIX: could not refresh the session.', error);
    }
  }

  /** Emails a password reset link. The server answers the same whether or not the account exists. */
  async forgotPassword(email: string, captcha = ''): Promise<void> {
    this.assertEnabled();
    try {
      await firstValueFrom(
        this.http.post(`${IDENTITY_URL}/api/account/forgot-password`, {
          email: email.trim(),
          captcha,
        }),
      );
    } catch (error) {
      throw new Error(describeError(error));
    }
  }

  /**
   * Sets a new password with the user id and token from the reset email. The server signs the
   * account out everywhere, so this also clears the local session. Returns the account's email.
   */
  async resetPassword(userId: string, token: string, password: string): Promise<string> {
    this.assertEnabled();
    let email: string;
    try {
      ({ email } = await firstValueFrom(
        this.http.post<{ email: string }>(`${IDENTITY_URL}/api/account/reset-password`, {
          userId,
          token,
          password,
        }),
      ));
    } catch (error) {
      throw new Error(describeError(error));
    }
    this.logout();
    return email;
  }

  /**
   * Permanently deletes the signed-in member's account, then signs out. Confirmed with the password,
   * or (accounts without a password) with the email address typed again.
   * `afterDeleted` runs while the token is still in hand, e.g. to delete course progress elsewhere.
   */
  async deleteAccount(
    confirmation: { password?: string; email?: string },
    afterDeleted?: () => Promise<void>,
  ): Promise<void> {
    this.assertEnabled();
    const token = this.accessToken();
    if (!token) {
      throw new Error(t('Your session has expired. Please log in again.'));
    }
    try {
      await firstValueFrom(
        this.http.request('DELETE', `${IDENTITY_URL}/api/account`, {
          body: confirmation,
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
    } catch (error) {
      throw new Error(describeError(error));
    }
    if (afterDeleted) {
      await afterDeleted().catch((e) => console.warn('VITRIX: could not remove related data.', e));
    }
    this.logout();
  }

  logout(): void {
    clearTimeout(this.refreshTimer);
    this.tokens = null;
    write(null);
    this.current.set(null);
  }

  /** For calling VITRIX APIs later: `Authorization: Bearer <token>`. */
  accessToken(): string | null {
    return this.tokens && this.tokens.expiresAt > Date.now() ? this.tokens.accessToken : null;
  }

  // ------------------------------------------------------------------------------------------

  private async restore(): Promise<boolean> {
    const saved = read();
    if (!saved) {
      return false;
    }
    if (saved.expiresAt > Date.now() + 30_000) {
      this.start(saved);
      return true;
    }
    if (saved.refreshToken) {
      try {
        await this.refresh(saved.refreshToken);
        return true;
      } catch (error) {
        console.warn('VITRIX: could not restore the session.', error);
      }
    }
    this.logout();
    return false;
  }

  /**
   * A server said 401 to a request that carried our token: try one refresh (the token may have just
   * expired, e.g. after the computer slept). True = there is a fresh token to retry with.
   */
  refreshAfter401(): Promise<boolean> {
    const refreshToken = this.tokens?.refreshToken;
    if (!refreshToken) {
      return Promise.resolve(false);
    }
    this.refreshing ??= this.refresh(refreshToken)
      .then(() => true)
      .catch(() => false)
      .finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  /**
   * The session can't be renewed (signed out elsewhere, password changed, account removed…):
   * sign out here too and go to the login page, which brings the member back afterwards.
   */
  sessionExpired(): void {
    if (!this.current()) {
      return;
    }
    this.logout();
    this.notify.info(t('Your session has ended. Please log in again.'));
    const here = this.router.url;
    void this.router.navigate(['/login'], {
      queryParams: here.startsWith('/login') ? {} : { redirect: here },
    });
  }

  private refresh(refreshToken: string): Promise<void> {
    return this.requestTokens({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  private async requestTokens(params: Record<string, string>): Promise<void> {
    const body = new HttpParams({ fromObject: { client_id: CLIENT_ID, ...params } });
    let response: TokenResponse;
    try {
      response = await firstValueFrom(
        this.http.post<TokenResponse>(`${IDENTITY_URL}/connect/token`, body),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.error?.error === 'consent_required') {
        throw new GoogleConsentRequired(describeError(error));
      }
      if (error instanceof HttpErrorResponse && error.error?.error === 'two_factor_required') {
        throw new TwoFactorRequired(describeError(error));
      }
      throw new Error(describeError(error));
    }
    this.start({
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? params['refresh_token'] ?? null,
      expiresAt: Date.now() + response.expires_in * 1000,
    });
  }

  private start(tokens: Tokens): void {
    const member = toMember(tokens.accessToken);
    if (!member) {
      this.logout();
      return;
    }
    this.tokens = tokens;
    write(tokens);
    this.current.set(member);

    // Get a fresh access token a minute before this one expires.
    clearTimeout(this.refreshTimer);
    if (tokens.refreshToken) {
      const refreshToken = tokens.refreshToken;
      // (Capped: browsers fire longer setTimeout delays than ~24 days at once.)
      const delay = Math.min(Math.max(tokens.expiresAt - Date.now() - 60_000, 5_000), 2 ** 31 - 1);
      this.refreshTimer = setTimeout(() => {
        this.refresh(refreshToken).catch(() => this.sessionExpired());
      }, delay);
    }
  }

  private assertEnabled(): void {
    if (!AUTH_ENABLED) {
      throw new Error(t('Student accounts are not open on this site yet.'));
    }
  }
}

/** "Continue with Google" for someone without an account yet: they must accept the privacy policy. */
export class GoogleConsentRequired extends Error {}

/** The password (or Google) was right; the account also needs its two-step login code. */
export class TwoFactorRequired extends Error {}

export interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesLeft: number;
}

/**
 * A signed-in member's request got 401: refresh the login once and retry; if that doesn't help, the
 * session is over (sign out, go to /login, come back after logging in).
 */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/connect/token')) {
    return next(req);
  }
  const auth = inject(Auth);
  return next(req).pipe(
    catchError((error: unknown) => {
      // Only for members: a visitor's 401 (e.g. a members-only page) is handled by that page.
      // (A request can lack the token when it expired while the computer slept: refresh fixes that.)
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !auth.user()) {
        return throwError(() => error);
      }
      return from(auth.refreshAfter401()).pipe(
        switchMap((renewed) => {
          const token = renewed ? auth.accessToken() : null;
          if (!token) {
            auth.sessionExpired();
            return throwError(() => error);
          }
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
            catchError((again: unknown) => {
              if (again instanceof HttpErrorResponse && again.status === 401) {
                auth.sessionExpired();
              }
              return throwError(() => again);
            }),
          );
        }),
      );
    }),
  );
};

/** Members only. Visitors who are not signed in go to /login and come back afterwards. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!auth.enabled) {
    return true; // published site: no accounts yet, keep pages open
  }
  // Wait for the saved session to be restored on first load, then check the live state
  // (the member may have logged in since the site loaded).
  return auth.ready$.pipe(
    map(() =>
      auth.signedIn()
        ? true
        : router.createUrlTree(['/login'], { queryParams: { redirect: state.url } }),
    ),
  );
};

// ---------------------------------------------------------------------------------------------

function read(): Tokens | null {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

function write(tokens: Tokens | null): void {
  try {
    if (tokens) {
      localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    } else {
      localStorage.removeItem(TOKENS_KEY);
    }
  } catch {
    // Storage blocked (private mode); the session just won't survive a reload.
  }
}

/** Reads the member from the access token (a signed JWT issued by identity-api). */
function toMember(accessToken: string): Member | null {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const email = String(claims['email'] ?? '');
    const rawName = String(claims['name'] ?? '');
    const roles = claims['role'];
    const verified = claims['email_verified'];
    const hasPassword = claims['has_password'];
    const twoFactor = claims['two_factor'];
    return {
      id: String(claims['sub'] ?? ''),
      email,
      // Accounts made without a name use the email as name; show the part before "@" instead.
      name: rawName && !rawName.includes('@') ? rawName : email.split('@')[0] || 'Member',
      roles: Array.isArray(roles) ? roles.map(String) : roles ? [String(roles)] : [],
      emailVerified: verified === true || verified === 'true',
      // Older tokens don't have the claim: those accounts all have a password.
      hasPassword: !(hasPassword === false || hasPassword === 'false'),
      twoFactor: twoFactor === true || twoFactor === 'true',
      courses: [],
    };
  } catch {
    return null;
  }
}

/** Turns server responses into a sentence the login form can show. */
function describeError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return t('Something went wrong. Please try again.');
  }
  if (error.status === 0) {
    return t('The account server is not reachable. Please try again later.');
  }
  if (error.status === 429) {
    return t('Too many attempts. Please wait a minute and try again.');
  }
  const body = error.error as
    { error_description?: string; errors?: string[] | Record<string, string[]> } | null | undefined;
  if (body?.error_description) {
    return t(body.error_description);
  }
  if (Array.isArray(body?.errors)) {
    return body.errors.map((e) => t(e)).join(' ');
  }
  if (body?.errors && typeof body.errors === 'object') {
    return Object.values(body.errors)
      .flat()
      .map((e) => t(e))
      .join(' ');
  }
  return t('Something went wrong. Please try again.');
}
