import { test as base, expect, Page } from '@playwright/test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const DIST = join(__dirname, '..', 'dist', 'vitrix', 'browser');
const API = 'https://vitrix-api.onrender.com';
const IDENTITY = 'https://vitrix-identity-24j8.onrender.com';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.ico': 'image/x-icon',
};

const L = (en: string, ka = '') => ({ en, ka });
const now = new Date().toISOString();

export const ACLS = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'acls',
  code: 'ACLS',
  title: L('Advanced Cardiovascular Life Support'),
  summary: L('Team response for cardiac arrest.'),
  description: L('Practice the rhythm of a resuscitation team.'),
  imageUrl: 'media/acls.jpg',
  price: 450,
  published: true,
  order: 1,
  format: L('2 days, hands-on'),
  duration: L('16 hours'),
  outcomes: L('Lead a resuscitation team\nUse a defibrillator safely'),
  nextStart: '2026-12-05',
};
export const ATLS = {
  ...ACLS,
  id: '00000000-0000-0000-0000-000000000002',
  slug: 'atls',
  code: 'ATLS',
  title: L('Advanced Trauma Life Support'),
  price: null,
  nextStart: null,
};

/** Test data for vitrix-api, by path. */
export const API_DATA: Record<string, unknown> = {
  '/api/courses': [ACLS, ATLS],
  '/api/courses/acls': {
    course: ACLS,
    lessons: [],
    faqs: [],
    quizzes: [],
    enrolled: false,
    needsEmailConfirmation: false,
  },
  '/api/courses/atls': {
    course: ATLS,
    lessons: [
      {
        id: 'l1',
        courseId: ATLS.id,
        order: 1,
        title: L('Primary survey'),
        durationMinutes: 12,
        body: L('ABCDE'),
        youtubeId: null,
        hasVideo: false,
        published: true,
        completed: true,
        locked: false,
      },
      {
        id: 'l2',
        courseId: ATLS.id,
        order: 2,
        title: L('Airway'),
        durationMinutes: 15,
        body: L('Airway basics'),
        youtubeId: null,
        hasVideo: false,
        published: true,
        completed: false,
        locked: false,
      },
    ],
    faqs: [],
    quizzes: [],
    enrolled: true,
    needsEmailConfirmation: false,
  },
  '/api/faq': [],
  '/api/admin/courses': [ACLS, ATLS],
  '/api/admin/enrollments': [
    {
      id: 'e1',
      courseId: ACLS.id,
      courseTitle: ACLS.title,
      email: 'student@example.com',
      createdAt: now,
    },
  ],
  '/api/me/courses': [
    {
      course: ATLS,
      lessonsTotal: 2,
      lessonsCompleted: 1,
      quizzesTotal: 0,
      quizzesPassed: 0,
      nextLessonId: 'l2',
      nextLessonTitle: L('Airway'),
    },
  ],
  '/api/me/applications': [],
  '/api/me/attempts': [],
  '/api/me/certificates': [],
};

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
/** A signed-in member's access token (the site only reads it; the test servers don't check it). */
export const memberToken = (claims: Record<string, unknown> = {}) =>
  `${b64({ alg: 'none' })}.${b64({ sub: 'u1', email: 'nino@example.com', name: 'Nino Beridze', email_verified: true, two_factor: true, exp: 4102444800, ...claims })}.x`;

type Fixtures = {
  /** Everything the page sent to the servers: method, path and body. */
  sent: { method: string; path: string; body: unknown }[];
  /** Content Security Policy violations and uncaught errors in the page. */
  problems: string[];
  signIn: (claims?: Record<string, unknown>) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  sent: async ({}, use) => use([]),
  problems: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    page.on('console', (m) => {
      if (m.text().startsWith('CSP violation')) problems.push(m.text());
    });
    await use(problems);
  },
  page: async ({ page, sent }, use) => {
    // English interface (the tests read English text); report security-policy violations.
    await page.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('e2e.lang-set')) {
          localStorage.setItem('vitrix.lang', 'en');
          sessionStorage.setItem('e2e.lang-set', '1');
        }
      } catch {}
      document.addEventListener('securitypolicyviolation', (e) =>
        console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`),
      );
    });
    // The site, from the built files, at its real address (so the real CSP applies).
    await page.route('https://vitrix-ge.github.io/**', (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/vitrix/, '') || '/';
      let file = join(DIST, decodeURIComponent(path));
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!existsSync(file)) {
        return route.fulfill({
          status: 404,
          body: readFileSync(join(DIST, '404.html')),
          contentType: TYPES['.html'],
        });
      }
      return route.fulfill({
        status: 200,
        body: readFileSync(file),
        contentType: TYPES[extname(file)] ?? 'application/octet-stream',
      });
    });
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
    };
    await page.route(`${API}/**`, (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const path = new URL(req.url()).pathname;
      if (req.method() !== 'GET') {
        sent.push({ method: req.method(), path, body: req.postDataJSON() });
        return route.fulfill({ headers: cors, json: { sent: true } });
      }
      const data = API_DATA[path];
      return data === undefined
        ? route.fulfill({ status: 404, headers: cors, json: { errors: ['Not found.'] } })
        : route.fulfill({ headers: cors, json: data });
    });
    await page.route(`${IDENTITY}/**`, (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      sent.push({ method: req.method(), path: new URL(req.url()).pathname, body: req.postData() });
      return route.fulfill({
        status: 400,
        headers: cors,
        json: { error: 'invalid_grant', error_description: 'Email or password is incorrect.' },
      });
    });
    // Outside services: Cloudflare Turnstile answers at once; Google and YouTube are not needed.
    await page.route('https://challenges.cloudflare.com/**', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: 'window.turnstile={render(el,o){setTimeout(()=>o.callback("test-token"),50);return "w"},reset(){},remove(){}};',
      }),
    );
    await page.route(/accounts\.google\.com|youtube-nocookie\.com/, (route) => route.abort());
    await use(page);
  },
  signIn: async ({ page }, use) => {
    await use(async (claims = {}) => {
      const token = memberToken(claims);
      await page.addInitScript((t) => {
        localStorage.setItem(
          'vitrix.session',
          JSON.stringify({ accessToken: t, refreshToken: null, expiresAt: 4102444800000 }),
        );
      }, token);
    });
  },
});

export { expect };

/** The page is never wider than the screen (no sideways scrolling on phones). */
export async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(extra, 'page is wider than the screen').toBeLessThanOrEqual(1);
}
