import { API_DATA, expect, test } from './fixtures';

const API = 'https://vitrix-api.onrender.com';
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

test('a slow server shows a spinner, then the content', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(`${API}/api/courses/acls`, async (route) => {
    await held;
    await route.fulfill({ headers: cors, json: API_DATA['/api/courses/acls'] });
  });
  await page.goto('courses/acls');
  await expect(page.locator('.top-progress.is-on')).toBeVisible();
  release();
  await expect(page.locator('.course-facts')).toContainText('16 hours');
  await expect(page.locator('.top-progress.is-on')).toHaveCount(0);
});

test('a button shows it is working while the form is sent', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(`${API}/api/contact`, async (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors });
    await held;
    await route.fulfill({ headers: cors, json: { sent: true } });
  });
  await page.goto('contact');
  await page.locator('input[formcontrolname="name"]').fill('Test Person');
  await page.locator('input[formcontrolname="email"]').fill('test@example.com');
  await page
    .locator('textarea[formcontrolname="message"]')
    .fill('A question about the ACLS course.');
  await page.waitForTimeout(200);
  const button = page.locator('form button[type="submit"]');
  await button.click();
  await expect(button).toHaveClass(/is-busy/);
  await expect(button).toBeDisabled();
  release();
  await expect(page.getByRole('heading', { name: 'Message sent' })).toBeVisible();
});
