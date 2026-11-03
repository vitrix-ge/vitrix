import { API_DATA, expect, memberToken, test } from './fixtures';

const API = 'https://vitrix-api.onrender.com';
const IDENTITY = 'https://vitrix-identity-24j8.onrender.com';
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

test('when the session cannot be renewed, the member is logged out and sent to log in', async ({
  page,
  signIn,
}) => {
  await signIn();
  await page.route(`${API}/api/me/**`, (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({ status: 401, headers: cors, body: '' }),
  );
  await page.goto('my-courses');
  await expect(page).toHaveURL(/\/login\?redirect=%2Fmy-courses/);
  await expect(page.locator('.toast')).toContainText('Your session has ended');
  await expect(page.locator('.avatar-btn')).toHaveCount(0);
});

test('an expired token is renewed once and the request repeated', async ({ page }) => {
  // Saved session with a refresh token; the server first answers 401, then accepts the new token.
  await page.addInitScript((t) => {
    localStorage.setItem(
      'vitrix.session',
      JSON.stringify({ accessToken: t, refreshToken: 'refresh-1', expiresAt: 4102444800000 }),
    );
  }, memberToken());
  let refreshed = 0;
  await page.route(`${IDENTITY}/connect/token`, (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors });
    refreshed++;
    return route.fulfill({
      headers: cors,
      json: {
        access_token: memberToken({ name: 'Nino Renewed' }),
        refresh_token: 'refresh-2',
        expires_in: 1800,
      },
    });
  });
  let calls = 0;
  await page.route(`${API}/api/me/courses`, (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors });
    calls++;
    return calls === 1
      ? route.fulfill({ status: 401, headers: cors, body: '' })
      : route.fulfill({ headers: cors, json: API_DATA['/api/me/courses'] });
  });
  await page.goto('my-courses');
  await expect(page.locator('.my-course')).toContainText('Advanced Trauma Life Support');
  await expect(page).toHaveURL(/\/my-courses/);
  expect(refreshed).toBe(1);
});
