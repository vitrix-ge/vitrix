import { ACLS, expect, expectNoSidewaysScroll, test } from './fixtures';

/** Public pages: they open, have a heading, break no security rule and fit the screen. */
const PUBLIC_PAGES = [
  '',
  'about',
  'courses',
  'courses/acls',
  'simulation',
  'faculty',
  'partners',
  'faq',
  'contact',
  'login',
  'privacy',
  'certificates',
];

for (const path of PUBLIC_PAGES) {
  test(`page /${path} opens cleanly`, async ({ page, problems }) => {
    await page.goto(path);
    await expect(page.locator('main h1').first()).toBeVisible();
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });
}

test('home page in both languages', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const headerSwitch = page.locator('.header-actions .lang-switch button[lang="ka"]');
  if (await headerSwitch.isVisible()) {
    await headerSwitch.click();
  } else {
    // Phones: the language switch lives in the menu.
    await page.locator('.menu-btn').click();
    await page.locator('.mobile-nav .lang-switch button[lang="ka"]').click();
  }
  await expect(page.locator('html')).toHaveAttribute('lang', 'ka');
});

test('course list comes from the course server', async ({ page }) => {
  await page.goto('courses');
  await expect(
    page.getByRole('heading', { name: 'Advanced Cardiovascular Life Support' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Advanced Trauma Life Support' })).toBeVisible();
});

test('course page shows the facts and an Apply link for visitors', async ({ page }) => {
  await page.goto('courses/acls');
  await expect(page.locator('.course-facts')).toContainText('16 hours');
  await expect(page.locator('.outcomes li')).toHaveCount(2);
  const apply = page.locator('main a[href*="apply"]').first();
  await expect(apply).toHaveAttribute('href', /course=acls/);
});

test('unknown address shows the not-found page', async ({ page }) => {
  const response = await page.goto('main-q231829');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('Apply asks visitors to log in first', async ({ page }) => {
  await page.goto('apply');
  await expect(page).toHaveURL(/\/login\?redirect=/);
});

test('login form checks the email and shows server errors', async ({ page, sent }) => {
  await page.goto('login');
  await page.locator('input[formcontrolname="email"]').fill('not-an-email');
  await page.locator('input[formcontrolname="password"]').fill('Secret123!');
  await page.locator('form button[type="submit"]').click();
  expect(sent).toEqual([]);
  await page.locator('input[formcontrolname="email"]').fill('nino@example.com');
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.');
});

test('create account needs the privacy consent', async ({ page }) => {
  await page.goto('login?mode=register');
  await expect(page.locator('input[formcontrolname="acceptPrivacy"]')).toBeVisible();
  // The honeypot field is in the form but hidden from people.
  await expect(page.locator('input[formcontrolname="website"]')).not.toBeInViewport();
});

test('contact form sends the message with the not-a-robot token and an empty honeypot', async ({
  page,
  sent,
}) => {
  await page.goto('contact');
  await page.locator('input[formcontrolname="name"]').fill('Test Person');
  await page.locator('input[formcontrolname="email"]').fill('test@example.com');
  await page
    .locator('textarea[formcontrolname="message"]')
    .fill('A question about the ACLS course.');
  await page.waitForTimeout(200); // Turnstile token
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole('heading', { name: 'Message sent' })).toBeVisible();
  const message = sent.find((s) => s.path === '/api/contact');
  expect(message?.body).toMatchObject({ name: 'Test Person', website: '', captcha: 'test-token' });
});

test.describe('signed in', () => {
  test('My courses shows the course and where to continue', async ({ page, signIn, problems }) => {
    await signIn();
    await page.goto('my-courses');
    await expect(page.locator('.resume-card')).toContainText('Airway');
    await expect(page.locator('.my-course')).toContainText('Advanced Trauma Life Support');
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });

  test('an enrolled course shows progress and lessons', async ({ page, signIn }) => {
    await signIn();
    await page.goto('courses/atls');
    await expect(page.locator('.progress-card')).toContainText('1 of 2 lessons completed');
    await expect(page.locator('.lesson-list > li')).toHaveCount(2);
  });

  test('Apply does not offer a course the member already has', async ({ page, signIn }) => {
    await signIn();
    await page.goto('apply?course=atls');
    await expect(page.getByRole('heading', { name: 'You already have this course' })).toBeVisible();
  });

  test('the account menu has My courses and Log out', async ({ page, signIn }) => {
    await signIn();
    await page.goto('about');
    // Members don't get the header's "Apply now" button; visitors do (checked after logging out).
    await expect(page.locator('.header-actions .apply-btn')).toHaveCount(0);
    await page.locator('.avatar-btn').click();
    const menu = page.locator('#user-menu');
    await expect(menu.getByRole('menuitem', { name: 'My courses' })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page.locator('.avatar-btn')).toHaveCount(0);
    await expect(page.locator('.header-actions .apply-btn')).toHaveCount(1);
  });

  test('students cannot open the admin panel', async ({ page, signIn }) => {
    await signIn();
    await page.goto('admin');
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("admins can save the site's Georgian into courses", async ({ page, signIn, sent }) => {
    await signIn({ role: ['admin'] });
    await page.goto('admin/courses');
    await page.getByRole('button', { name: 'Fill in Georgian' }).click();
    await expect.poll(() => sent.filter((s) => s.method === 'PUT').length).toBe(2);
    const acls = sent.find((s) => s.path.endsWith(ACLS.id))?.body as { title: { ka: string } };
    expect(acls.title.ka).not.toBe('');
  });

  test("removing a student asks in the site's own dialog", async ({ page, signIn, sent }) => {
    await signIn({ role: ['admin'] });
    await page.goto('admin/students');
    const dialog = page.locator('dialog.confirm-dialog');

    await page.getByRole('button', { name: 'Remove' }).first().click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('student@example.com');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    expect(sent.filter((s) => s.method === 'DELETE')).toEqual([]);

    await page.getByRole('button', { name: 'Remove' }).first().click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(sent.filter((s) => s.method === 'DELETE')).toEqual([]);

    await page.getByRole('button', { name: 'Remove' }).first().click();
    await dialog.getByRole('button', { name: 'Remove' }).click();
    await expect.poll(() => sent.filter((s) => s.method === 'DELETE').length).toBe(1);
  });
});
