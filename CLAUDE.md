# VITRIX — project notes

VITRIX is a website for an emergency-medicine training institute (Tbilisi, Georgia).
Medical students and clinicians browse courses (ACLS, ATLS, PHTLS, BLS, Critical Care,
Simulation), apply, and — eventually — buy courses and see them in their account.

The site is a **static Angular app** published on **GitHub Pages**
(<https://vitrix-ge.github.io/vitrix/>, from the `gh-pages` branch). Accounts come from the
separate **identity-api** server (repo `vitrix-ge/identity-api`), deployed on Render at
<https://vitrix-identity-24j8.onrender.com> with a Neon Postgres database. Courses, lessons, Q&A,
tests and student progress come from **vitrix-api** (repo `vitrix-ge/vitrix-api`, deployed on
Render at <https://vitrix-api.onrender.com>, same database, schema `vitrix`). Apply/Contact forms have no backend yet.

## Commands

```bash
npm install       # once
npm start         # dev server at http://localhost:4200
npm run build     # production build into dist/vitrix/browser
```

No test files exist yet (`skipTests: true` in angular.json).

## Stack and conventions

- Angular 21, standalone components, **signals** for state, reactive forms, lazy-loaded routes.
- File naming: `pages/<name>/<name>.ts` + `<name>.html`, class name `PascalCase` without a
  `Component` suffix (e.g. `Login`, `Account`).
- Almost all CSS lives in [src/styles.scss](src/styles.scss) (global). Components rarely have
  their own styles. Reuse existing classes: `page-hero`, `page-section`, `wrap`, `split`,
  `form`, `notice`, `btn btn-red`, `btn btn-ghost`, `eyebrow`, `lede`, `course-row`, `info-card`.
- Design "clinical blue" (from the brand artwork): light blue-grey pages (`--bg`), white surfaces
  (`--surface`) with soft shadows, navy text (`--heading`, `--navy`), VITRIX red (`--red`) for
  actions; navy footer. Headings in Montserrat (uppercase, wide like the wordmark), body Manrope.
  Use the color variables in `:root` of styles.scss, not hard-coded colors. Logo (`mark.ts`):
  graphite stroke + red stroke; the wordmark's X is fully red.
  Mobile breakpoints at 1100px, 860px, 640px.
- Formatting: Prettier (`.prettierrc`), single quotes, 100-char lines.
- Images live in `public/media/` and are referenced as `media/x.jpg` (no leading slash) so they
  work on GitHub Pages.

## Map of the code

| Path | What it is |
| --- | --- |
| [src/app/app.routes.ts](src/app/app.routes.ts) | All routes. `data.title` sets the browser tab title. |
| [src/app/site-data.ts](src/app/site-data.ts) | All content: nav, courses, faculty, partners, stats. Edit text here. |
| [src/app/auth.ts](src/app/auth.ts) | `Auth` service (login / register / logout, current member signal) and `authGuard`. |
| [src/app/auth.config.ts](src/app/auth.config.ts) | Identity server URL, client id `vitrix`, scopes, and when login is switched on. |
| [src/app/pages/privacy/](src/app/pages/privacy/) | Privacy policy page (`/privacy`, linked in the footer and on sign-up). Contact email: `PRIVACY_CONTACT_EMAIL` in `site-data.ts`. |
| [src/app/content/](src/app/content/) | Courses/tests data layer: `content.models.ts` (the API contract), `content.api.ts` (all vitrix-api calls), `content.config.ts` (API URL), `catalog.ts` (course list with built-in fallback), `roles.ts` (admin/editor + `roleGuard`), `i18n.ts` (`LText` EN/KA + `tr` pipe), `youtube.ts`. |
| [src/app/pages/admin/](src/app/pages/admin/) | Admin panel `/admin`: courses, lessons, tests/questions, Q&A (admin + editor); students, results and team roles (admin only; team calls identity-api `/api/admin/users`). |
| [src/app/confirm-email-notice.ts](src/app/confirm-email-notice.ts) | "Confirm your email" box (resend / "I've confirmed it") for signed-in members with an unconfirmed email; used on account, apply and course pages. |
| [src/app/notify.ts](src/app/notify.ts) | `Notify` service: short toast messages (`success`, `info`, `error`), shown by the app shell. |
| [src/app/layout/](src/app/layout/) | Header (nav, search, login link, mobile menu) and footer. |
| [src/app/mark.ts](src/app/mark.ts) | The VITRIX logo as an SVG component. |
| `src/app/pages/*` | One folder per page: home, about, courses, simulation, faculty, partners, contact, apply, login, account, privacy, course (`/courses/:slug`), quiz (`/tests/:id`), faq, confirm-email, reset-password. |

## Login (current state)

Accounts live on **identity-api** (ASP.NET Core Identity + OpenIddict, one instance per project).
VITRIX shows its **own login form** — visitors never leave the site:

- Log in: `POST {IDENTITY_URL}/connect/token` with `grant_type=password` (client `vitrix`).
- Create account: `POST {IDENTITY_URL}/api/account/register` (`name`, `email`, `password`),
  then the same login call.
- The server returns a 30-minute access token (a JWT — `Auth` reads the member from it) and a
  refresh token. Both are kept in `localStorage` (`vitrix.session`); the access token is
  refreshed a minute before it expires, so members stay signed in across visits.
- Server rules: passwords need 8+ characters with upper and lower case, a number and a symbol;
  5 wrong passwords lock the account for 15 minutes; max 5 new accounts per hour per IP.
  Error texts come from the server.

Privacy and spam protection:

- **Consent:** Create account requires ticking "I agree to the privacy policy"
  (`acceptPrivacy`); the server refuses sign-ups without it and records the time.
- **Honeypot:** the sign-up form has a hidden `website` field (class `.trap`, off-screen,
  `aria-hidden`). People never fill it; bots do, and the server then silently creates nothing.
  Don't remove it or make it visible.
- **Delete account:** My account → Delete account (asks for the password) calls
  `DELETE {IDENTITY_URL}/api/account` and signs out. It removes the user and all their tokens.
- If bot sign-ups ever get through anyway, the next step is Cloudflare Turnstile (free CAPTCHA).

Email confirmation and password reset (identity-api sends the emails through **Brevo**'s HTTPS API
from `vitrix.contact1@gmail.com`, a verified Brevo sender; key on Render as `Email__BrevoApiKey`.
Render's free plan blocks SMTP ports, so Gmail SMTP does not work there. Free: 300 emails/day):

- Sign-up sends a confirmation link: `{site}/confirm-email?user=…&token=…` → page posts it to
  `POST /api/account/confirm-email`. Links work for 24 hours.
- Members can log in **before** confirming. The token has `email_verified` (`Member.emailVerified`).
  Unconfirmed members see `<app-confirm-email-notice>` (resend → `POST /api/account/resend-confirmation`;
  "I've confirmed it" refreshes the token) and **cannot apply or open enrolled courses**
  (vitrix-api also refuses lessons/tests and returns `needsEmailConfirmation` on the course).
  Enrollment is by email, so this stops someone from claiming another person's courses.
- Forgot password: login page → "Forgot password?" (`/login?mode=forgot`) → `POST /api/account/forgot-password`
  (same answer whether or not the account exists) → email link `{site}/reset-password?user=…&token=…`
  → new password (`POST /api/account/reset-password`), which signs out all other sessions, confirms
  the email and unlocks the account; the page then logs in with the new password.
- Locally (no SMTP settings) identity-api writes the links to its console log instead of sending.

**Continue with Google** (`google-button.ts`, shown when `GOOGLE_CLIENT_ID` in `auth.config.ts` is
set): Google's script (loaded only on the login page) returns an ID token → `Auth.loginWithGoogle`
posts it to `/connect/token` with grant `urn:vitrix:params:oauth:grant-type:google`. No account yet →
the server answers `consent_required` and the login page shows a "Create your account" step with the
privacy checkbox, then sends the token again with `accept_privacy=true`. Google accounts are confirmed
and have no password (`Member.hasPassword` false): "Delete account" asks for the email instead, and
"Forgot password" can add a password. Google Cloud OAuth client (Web): authorized JavaScript origins
`https://vitrix-ge.github.io` and `http://localhost:4200`; the same client id is `Google__ClientId`
on Render.

Pages:

- `/login` — two tabs, **Log in** and **Create account**. Creating an account signs the member
  in straight away; both then go to the `?redirect=` URL or `/account` with a toast ("Account
  created. Welcome…" / "Welcome back…"). Logging out shows "You have been logged out.".
- `/account` and `/apply` — protected by `authGuard` (not signed in → `/login?redirect=...`).
  Apply is pre-filled with the member's name and email.
- Header shows "Log in" or the member's name; mobile menu shows "Log in" / "My account".
- `Auth.accessToken()` gives the Bearer token for calling VITRIX APIs later.
- `Member.courses` is a list of course `id`s from `COURSES`. Nothing fills it yet — that is the
  job of the future purchase flow (an API that validates the identity server's tokens).

**Which server:** on `localhost` the site uses the identity server from docker compose
(`http://localhost:8080`); the published site uses `https://vitrix-identity-24j8.onrender.com`
(`PRODUCTION_IDENTITY_URL` in `auth.config.ts`; set it to `''` to switch login off there —
links hidden, pages open). The Render server allows requests from `https://vitrix-ge.github.io`
(CORS, set in identity-api's `render.yaml`). On Render's free plan the server sleeps after 15
minutes idle, so the first login after a quiet period takes about a minute.

### Publishing the site

GitHub Pages serves the `gh-pages` branch. Build with the `/vitrix/` base path and publish the
contents of `dist/vitrix/browser` (plus a copy of `index.html` as `404.html`, so deep links like
`/vitrix/login` work):

```bash
NG_CLI_ANALYTICS=false npx ng build --base-href /vitrix/
cp dist/vitrix/browser/index.html dist/vitrix/browser/404.html
# real pages (HTTP 200, not the 404 fallback) for links Google's sign-in setup and search engines check
for r in privacy login courses; do mkdir -p dist/vitrix/browser/$r && cp dist/vitrix/browser/index.html dist/vitrix/browser/$r/; done
# then commit the contents of dist/vitrix/browser to the gh-pages branch
```

### Running locally with login

1. In `identity-api`: `docker compose up --build` (first time: `.\scripts\generate-dev-certs.ps1`).
2. Here: `npm start`, open <http://localhost:4200>. Dev admin: `admin@example.com` / `Admin123!`.

Port 4200 is also used by `identity-web` (the test client); run one of them at a time.

## Courses, tests and admin (vitrix-api)

- **Content is bilingual:** every visitor-facing text is an `LText` `{ en, ka }`. Show it with the
  `tr` pipe (`{{ course.title | tr }}`), which uses the current `lang` signal (English for now)
  and falls back to the other language. Admin forms use `<app-ltext-field>` (EN | KA side by side).
- **Roles** (from the identity token): `admin` = everything; `editor` = courses, lessons, Q&A,
  tests. Students and results are admin-only. The API enforces this; `/admin` routes use `roleGuard`.
- **Public:** `/courses` (published courses), `/courses/:slug` (overview, lesson titles, Q&A),
  `/faq` (general Q&A).
- **Lessons in order + lesson quizzes:** students open lessons one by one (a lesson is `locked`
  until the previous one is completed; staff see everything). A lesson can have one **lesson quiz**
  (admin → course → lesson row → "+ Add quiz"; `POST /api/admin/lessons/{id}/quiz`): it runs inline
  under the lesson (`<app-quiz-runner mode="lesson">`, unlimited tries, explanations shown) and
  passing it completes the lesson. Lessons without a quiz have "Mark as completed".
- **Final exam:** quizzes not attached to a lesson (`lessonId: null`, admin → course → "Final exam").
  They open after every lesson is completed and run at `/tests/:id` (`mode="exam"`, attempts/timer).
- **Students:** enrolled members see lessons with the YouTube video (`youtube-nocookie.com`
  embed), complete lessons, and take the final exam at `/tests/:id`. Starting a test creates an
  attempt on the server (attempt limit, timer); scoring happens on the server and correct answers
  are never sent before submitting. My account shows course progress and test results.
- **Enrollment** is by email (admin → Students), so it works before the person has an account.
- **Team** (admin → Team) gives people the `editor`/`admin` role on identity-api; it applies at their next login.
- **Deleting an account** also calls `DELETE /api/me` on vitrix-api (progress, results, enrollments).
- **Videos:** YouTube, uploaded as *Unlisted*; only the 11-character id is stored and validated.
- **Server:** `PRODUCTION_CONTENT_URL` in `content/content.config.ts` is
  `https://vitrix-api.onrender.com`; locally vitrix-api runs on `http://localhost:8082`. Set it to
  `''` to fall back to the built-in list in `site-data.ts` (lessons/tests/admin then hidden).
  On Render's free plan it sleeps after 15 minutes idle like the identity server.

## Roadmap / not done yet

1. ~~Deploy identity-api~~ done (Render + Neon). Consider Render's paid plan so it never sleeps.
2. ~~Deploy vitrix-api~~ done. Assign the editor role to content staff (admin → Team).
3. Course purchase: a "Buy" button on each course → payment (e.g. Stripe Checkout or a Georgian
   bank gateway such as TBC / Bank of Georgia) → webhook writes the enrollment. Payments need a
   server-side piece (provider function / edge function); never trust the browser to mark a
   course as paid.
4. Language switch in the header (sets `lang` to `ka`), certificates (PDF) after passing a test,
   and removing a student's progress/results in vitrix-api when they delete their account.
5. Connect Apply and Contact forms to a real inbox (they currently only show a confirmation).
6. ~~Password reset and email verification~~ done (Brevo). With a domain (e.g. vitrix.ge),
   verify the domain in Brevo and send from e.g. `no-reply@vitrix.ge` for better delivery
   (only `Email__From` changes).
7. ~~Set `PRIVACY_CONTACT_EMAIL`~~ done: `vitrix.contact1@gmail.com`.
8. Self-host the Google Fonts (privacy: Google currently receives visitors' IP addresses).

Update this file when you finish a roadmap item or change how something works.
