import { expect, memberToken, test } from './fixtures';

const IDENTITY = 'https://vitrix-identity-24j8.onrender.com';
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

test('login asks for the authenticator code when two-step login is on', async ({ page }) => {
  await page.route(`${IDENTITY}/connect/token`, async (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors });
    const form = new URLSearchParams(route.request().postData() ?? '');
    const otp = form.get('otp');
    if (!otp || otp === '000000') {
      return route.fulfill({
        status: 400,
        headers: cors,
        json: {
          error: 'two_factor_required',
          error_description: otp
            ? 'The code is not correct. Check the time on your phone and try again.'
            : 'Enter the 6-digit code from your authenticator app.',
        },
      });
    }
    return route.fulfill({
      headers: cors,
      json: { access_token: memberToken(), refresh_token: 'r', expires_in: 1800 },
    });
  });

  await page.goto('login');
  await page.locator('input[formcontrolname="email"]').fill('nino@example.com');
  await page.locator('input[formcontrolname="password"]').fill('Secret123!');
  await page.locator('form button[type="submit"]').click();

  await expect(page.getByRole('heading', { name: 'Two-step login' })).toBeVisible();
  await page.locator('.otp-input').fill('000000');
  await page.locator('.two-step button[type="submit"]').click();
  await expect(page.getByRole('alert')).toContainText('The code is not correct');

  await page.locator('.otp-input').fill('123 456');
  await page.locator('.two-step button[type="submit"]').click();
  await expect(page).toHaveURL(/\/my-courses/);
});

test('turning on two-step login shows a QR code, then the recovery codes', async ({
  page,
  signIn,
}) => {
  let enabled = false;
  await page.route(`${IDENTITY}/api/account/two-factor**`, async (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors });
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/setup')) {
      return route.fulfill({
        headers: cors,
        json: {
          key: 'JBSWY3DPEHPK3PXP',
          uri: 'otpauth://totp/VITRIX%3Anino%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=VITRIX&digits=6',
        },
      });
    }
    if (path.endsWith('/enable')) {
      enabled = true;
      return route.fulfill({
        headers: cors,
        json: { recoveryCodes: Array.from({ length: 10 }, (_, i) => `code-${i}`) },
      });
    }
    return route.fulfill({ headers: cors, json: { enabled, recoveryCodesLeft: enabled ? 10 : 0 } });
  });
  await signIn({ two_factor: false });
  await page.goto('account');

  await page.getByRole('button', { name: 'Turn on two-step login' }).click();
  await expect(page.locator('.qr-box img')).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.locator('.secret-key')).toHaveText('JBSW Y3DP EHPK 3PXP');

  await page.locator('.code-form input').fill('123456');
  await page.locator('.code-form button').click();
  await expect(page.locator('.recovery-codes li')).toHaveCount(10);
  await page.getByRole('button', { name: 'I have saved them' }).click();
  await expect(page.locator('.two-factor .tag')).toHaveText('On');
});

test('staff without two-step login are asked to turn it on', async ({ page, signIn }) => {
  await signIn({ role: ['admin'], two_factor: false });
  await page.goto('admin');
  await expect(page.locator('.two-factor-nudge')).toBeVisible();
});

test('staff with two-step login see no reminder', async ({ page, signIn }) => {
  await signIn({ role: ['admin'], two_factor: true });
  await page.goto('admin');
  await expect(page.locator('.admin-nav')).toBeVisible();
  await expect(page.locator('.two-factor-nudge')).toHaveCount(0);
});
