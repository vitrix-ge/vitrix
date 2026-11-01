import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DestroyRef } from '@angular/core';
import { GOOGLE_CLIENT_ID } from './auth.config';
import { TPipe, lang } from './content/i18n';

/** Minimal typing for Google Identity Services (https://accounts.google.com/gsi/client). */
interface GoogleIdentity {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        ux_mode?: 'popup' | 'redirect';
        auto_select?: boolean;
        context?: 'signin' | 'signup' | 'use';
        itp_support?: boolean;
      }): void;
      renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
      cancel(): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let loading: Promise<GoogleIdentity> | null = null;

/** Loads Google's sign-in script once, only on pages that show the button (privacy: not site-wide). */
function loadGoogle(): Promise<GoogleIdentity> {
  loading ??= new Promise<GoogleIdentity>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error('no google')));
    script.onerror = () => {
      loading = null;
      reject(new Error('Google sign-in could not load.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Google's "Continue with Google" button. Emits the ID token (a JWT signed by Google) that
 * identity-api checks and exchanges for VITRIX tokens. Shows nothing when GOOGLE_CLIENT_ID is empty.
 */
@Component({
  selector: 'app-google-button',
  imports: [TPipe],
  template: `
    <div #host class="google-btn"></div>
    @if (failed()) {
      <p class="hint">
        {{ 'Google sign-in could not load. Check your connection or use your email.' | t }}
      </p>
    }
  `,
})
export class GoogleButton {
  readonly credential = output<string>();
  readonly failed = signal(false);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (!GOOGLE_CLIENT_ID) {
        return;
      }
      loadGoogle()
        .then((google) => {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response) => this.credential.emit(response.credential),
            ux_mode: 'popup',
            auto_select: false,
            context: 'signin',
            itp_support: true,
          });
          const el = this.host().nativeElement;
          google.accounts.id.renderButton(el, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'center',
            locale: lang() === 'ka' ? 'ka' : 'en',
            width: Math.max(200, Math.min(400, el.clientWidth || 320)),
          });
          destroyRef.onDestroy(() => google.accounts.id.cancel());
        })
        .catch(() => this.failed.set(true));
    });
  }
}

/** Reads name/email from Google's ID token for display only (identity-api verifies the token). */
export function googleProfile(idToken: string): { email: string; name: string } {
  try {
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    return { email: String(claims['email'] ?? ''), name: String(claims['name'] ?? '') };
  } catch {
    return { email: '', name: '' };
  }
}
