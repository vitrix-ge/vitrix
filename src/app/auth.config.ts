/**
 * Accounts live on the identity-api server. VITRIX shows its own login / sign-up form and talks
 * to the server directly (OAuth password grant + POST /api/account/register), so visitors never
 * leave the site.
 *
 * Locally (localhost) the site uses the identity server from docker compose; the published site
 * (GitHub Pages) uses the deployed one on Render. Set PRODUCTION_IDENTITY_URL to '' to switch
 * login off on the published site (links hidden, pages open to everyone).
 */
const LOCAL_IDENTITY_URL: string = 'http://localhost:8080';
const PRODUCTION_IDENTITY_URL: string = 'https://vitrix-identity-24j8.onrender.com'; // Render (identity-api)

const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const IDENTITY_URL: string = isLocal ? LOCAL_IDENTITY_URL : PRODUCTION_IDENTITY_URL;
export const AUTH_ENABLED = IDENTITY_URL !== '';

/** Registered in identity-api (appsettings.Development.json) with the "password" grant. */
export const CLIENT_ID = 'vitrix';

/**
 * "Continue with Google": the OAuth client id from Google Cloud (public; the same id is set on
 * identity-api as Google:ClientId). '' = Google button hidden.
 */
export const GOOGLE_CLIENT_ID: string =
  '837354581289-5lr4palm86u3i9p0460av6mm3q2ii9ns.apps.googleusercontent.com';

/**
 * "I'm not a robot" check (Cloudflare Turnstile) on Create account, Forgot password and Contact:
 * the widget's site key from dash.cloudflare.com → Turnstile (public). The matching secret key goes
 * on Render as Turnstile__SecretKey for identity-api and vitrix-api. '' = check off.
 */
export const TURNSTILE_SITE_KEY: string = '0x4AAAAAAFx7zOU0PvpNjJHI';

/** The identity server's grant type for Google ID tokens (identity-api: External/GoogleSignIn.cs). */
export const GOOGLE_GRANT = 'urn:vitrix:params:oauth:grant-type:google';

/** offline_access gives a refresh token, so members stay signed in. */
export const SCOPE = 'openid profile email roles api offline_access';
