import { test, expect } from '@playwright/test';

const PROJECT_ID = 'safelift3d-rules-test';
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR_URL = 'http://127.0.0.1:8080';
const EMULATOR_ACTIVE = process.env.VITE_USE_EMULATORS === 'true';

async function clearEmulators(request) {
  await request.delete(`${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`);
  await request.delete(`${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`);
}

async function verifyEmailInEmulator(request, email) {
  const res = await request.get(`${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const match = (body.oobCodes || [])
    .filter((entry) => entry.email === email && entry.requestType === 'VERIFY_EMAIL')
    .pop();
  expect(match?.oobLink, `Expected verification oobLink for ${email}`).toBeTruthy();
  const verifyRes = await request.get(match.oobLink);
  expect(verifyRes.ok()).toBeTruthy();
}

async function createAndVerifyAccount(page, request, { displayName, email, password }) {
  await page.goto('/');
  await expect(page.locator('#saas-root')).toBeVisible();
  await page.locator('#saas-root [data-action="mode"]').click();
  await page.locator('#saas-root input[name="displayName"]').fill(displayName);
  await page.locator('#saas-root input[name="email"]').fill(email);
  await page.locator('#saas-root input[name="password"]').fill(password);
  await page.locator('#saas-root button[type="submit"]').click();

  await expect(page.locator('#saas-root [data-action="verify-check"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#saas-account-widget')).toHaveCount(0);

  // Clicking check before verification stays on verification-pending UI with an error status.
  await page.locator('#saas-root [data-action="verify-check"]').click();
  await expect(page.locator('#saas-root .saas-auth-status')).toHaveClass(/is-error/);
  await expect(page.locator('#saas-root [data-action="verify-check"]')).toBeVisible();

  await verifyEmailInEmulator(request, email);
  await page.locator('#saas-root [data-action="verify-check"]').click();

  await expect(page.locator('#saas-account-widget')).toBeAttached({ timeout: 15_000 });
  await expect(page.locator('#saas-root')).toBeHidden();
}

async function openWorkspaceDialog(page) {
  await page.evaluate(() => {
    document.querySelector('#saas-account-widget [data-action="workspace"]')?.click();
  });
  await expect(page.locator('#saas-workspace-backdrop')).toBeVisible({ timeout: 10_000 });
}

test.describe('Firebase Auth & Firestore Emulator SaaS flows', () => {
  test.skip(!EMULATOR_ACTIVE, 'Requires Firebase Auth + Firestore Emulators (npm run test:e2e:auth)');

  test.beforeEach(async ({ request }) => {
    await clearEmulators(request);
  });

  test('signup verification, workspace CRUD persistence, reload, sign-out, wrong password, and cross-user isolation', async ({ page, request, context }) => {
    await createAndVerifyAccount(page, request, {
      displayName: 'Engineer Alpha',
      email: 'alpha@safelift3d.test',
      password: 'Password123!'
    });

    await page.waitForFunction(() => Boolean(window.__LIFTING_RUNTIME__?.api?.getState?.()), null, { timeout: 20_000 });

    // Create equipment item in Firestore Emulator
    await openWorkspaceDialog(page);
    await page.locator('#saas-workspace-backdrop [data-tab="equipment"]').click();
    await page.locator('#saas-workspace-backdrop [data-action="create"]').click();
    await page.locator('#saas-workspace-backdrop input[name="name"]').fill('Shackle 25T');
    await page.locator('#saas-workspace-backdrop input[name="manufacturer"]').fill('Crosby');
    await page.locator('#saas-workspace-backdrop input[name="wllT"]').fill('25');
    await page.locator('#saas-workspace-backdrop form button[type="submit"]').click();
    await expect(page.locator('#saas-workspace-backdrop [data-list]')).toContainText('Shackle 25T', { timeout: 10_000 });

    // Create lift plan linked to equipment via prompts + attachment modal
    await page.locator('#saas-workspace-backdrop [data-tab="liftPlans"]').click();
    const promptAnswers = ['Gantry Lift Plan A', 'Emulator E2E note'];
    const dialogHandler = async (dialog) => {
      await dialog.accept(promptAnswers.shift() ?? '');
    };
    page.on('dialog', dialogHandler);
    await page.locator('#saas-workspace-backdrop [data-action="create"]').click();

    await expect(page.locator('#saas-workspace-backdrop .saas-workspace-link-picker')).toBeVisible({ timeout: 10_000 });
    await page.locator('#saas-workspace-backdrop input[name="equipmentIds"]').first().check();
    await page.locator('#saas-workspace-backdrop .saas-workspace-link-picker button[type="submit"]').click();
    page.off('dialog', dialogHandler);

    await expect(page.locator('#saas-workspace-backdrop [data-list]')).toContainText('Gantry Lift Plan A', { timeout: 10_000 });

    // Reload and verify Firebase Auth session + Firestore records persist
    await page.reload();
    await expect(page.locator('#saas-account-widget')).toBeAttached({ timeout: 15_000 });
    await openWorkspaceDialog(page);
    await expect(page.locator('#saas-workspace-backdrop [data-list]')).toContainText('Gantry Lift Plan A', { timeout: 10_000 });
    await page.locator('#saas-workspace-backdrop [data-tab="equipment"]').click();
    await expect(page.locator('#saas-workspace-backdrop [data-list]')).toContainText('Shackle 25T', { timeout: 10_000 });
    await page.locator('#saas-workspace-backdrop [data-action="close"]').click();

    // Sign out and verify wrong-password error recovery + valid re-login
    await page.evaluate(() => {
      document.querySelector('#saas-account-widget [data-action="signout"]')?.click();
    });
    await expect(page.locator('#saas-root input[name="email"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('#saas-root input[name="email"]').fill('alpha@safelift3d.test');
    await page.locator('#saas-root input[name="password"]').fill('WrongPass999!');
    await page.locator('#saas-root button[type="submit"]').click();
    await expect(page.locator('#saas-root .saas-auth-status')).toHaveClass(/is-error/, { timeout: 10_000 });
    await expect(page.locator('#saas-root button[type="submit"]')).toBeEnabled();

    await page.locator('#saas-root input[name="email"]').fill('alpha@safelift3d.test');
    await page.locator('#saas-root input[name="password"]').fill('Password123!');
    await page.locator('#saas-root button[type="submit"]').click();
    await expect(page.locator('#saas-account-widget')).toBeAttached({ timeout: 15_000 });

    // Cross-user isolation: fresh session for User B must not see User A's plans/equipment
    const pageB = await (await context.browser().newContext()).newPage();
    try {
      await createAndVerifyAccount(pageB, request, {
        displayName: 'Engineer Beta',
        email: 'beta@safelift3d.test',
        password: 'Password123!'
      });
      await openWorkspaceDialog(pageB);
      await expect(pageB.locator('#saas-workspace-backdrop [data-list]')).not.toContainText('Gantry Lift Plan A');
      await expect(pageB.locator('#saas-workspace-backdrop .saas-workspace-empty')).toBeVisible({ timeout: 10_000 });
    } finally {
      await pageB.context().close();
    }
  });

  test('blocks locked accounts and recovers cleanly from network auth errors', async ({ page, request }) => {
    await createAndVerifyAccount(page, request, {
      displayName: 'Locked User',
      email: 'locked@safelift3d.test',
      password: 'Password123!'
    });

    const uid = await page.evaluate(() => window.SafeLift?.saas?.authUser?.uid);
    expect(uid).toBeTruthy();

    // Suspend user directly in Firestore Emulator using emulator admin owner token
    const patchRes = await request.patch(
      `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=status`,
      {
        headers: { Authorization: 'Bearer owner' },
        data: { fields: { status: { stringValue: 'locked' } } }
      }
    );
    expect(patchRes.ok()).toBeTruthy();

    // Realtime snapshot listener logs the suspended user out immediately
    await expect(page.locator('#saas-root input[name="email"]')).toBeVisible({ timeout: 15_000 });

    // Logging in again as locked account denies workspace entry
    await page.locator('#saas-root input[name="email"]').fill('locked@safelift3d.test');
    await page.locator('#saas-root input[name="password"]').fill('Password123!');
    await page.locator('#saas-root button[type="submit"]').click();
    await expect(page.locator('#saas-root .saas-auth-status')).toHaveClass(/is-error/, { timeout: 10_000 });
    await expect(page.locator('#saas-account-widget')).toHaveCount(0);

    // Network outage during auth recovers action button without hanging
    await page.route('**/identitytoolkit.googleapis.com/**', (route) => route.abort('failed'));
    await page.route('**/*accounts:signInWithPassword*', (route) => route.abort('failed'));
    await page.locator('#saas-root input[name="email"]').fill('locked@safelift3d.test');
    await page.locator('#saas-root input[name="password"]').fill('Password123!');
    await page.locator('#saas-root button[type="submit"]').click();
    await expect(page.locator('#saas-root .saas-auth-status')).toHaveClass(/is-error/, { timeout: 10_000 });
    await expect(page.locator('#saas-root button[type="submit"]')).toBeEnabled();
  });

  test('enforces maintenance feature flag banner and workspace block for standard users while admin clears it', async ({ page, request, context }) => {
    await createAndVerifyAccount(page, request, {
      displayName: 'Site Admin',
      email: 'admin-flags@safelift3d.test',
      password: 'Password123!'
    });
    const adminUid = await page.evaluate(() => window.SafeLift?.saas?.authUser?.uid);
    expect(adminUid).toBeTruthy();

    const promoteRes = await request.patch(
      `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${adminUid}?updateMask.fieldPaths=role`,
      {
        headers: { Authorization: 'Bearer owner' },
        data: { fields: { role: { stringValue: 'admin' } } }
      }
    );
    expect(promoteRes.ok()).toBeTruthy();

    await page.goto('/admin');
    const flagsForm = page.locator('[data-action="flags-form"]');
    await expect(flagsForm).toBeVisible({ timeout: 15_000 });
    await flagsForm.locator('input[name="maintenanceMode"]').check();
    await flagsForm.locator('input[name="maintenanceMessage"]').fill('Emulator maintenance active');
    await flagsForm.locator('button[type="submit"]').click();
    await expect(page.locator('.saas-admin-notice')).toBeVisible({ timeout: 10_000 });

    const viewerPage = await (await context.browser().newContext()).newPage();
    try {
      await createAndVerifyAccount(viewerPage, request, {
        displayName: 'Standard Viewer',
        email: 'viewer-flags@safelift3d.test',
        password: 'Password123!'
      });
      await expect(viewerPage.locator('#saas-maintenance-banner')).toBeVisible({ timeout: 10_000 });
      await expect(viewerPage.locator('#saas-maintenance-banner')).toContainText('Emulator maintenance active');
      await expect(viewerPage.locator('#saas-account-widget [data-action="workspace"]')).toBeDisabled();
      await expect(viewerPage.locator('#saas-workspace-backdrop')).toHaveCount(0);

      // Admin disables maintenance mode and viewer sees normal workspace on reload
      await flagsForm.locator('input[name="maintenanceMode"]').uncheck();
      await flagsForm.locator('button[type="submit"]').click();
      await expect(page.locator('.saas-admin-notice')).toBeVisible({ timeout: 10_000 });

      await viewerPage.reload();
      await expect(viewerPage.locator('#saas-account-widget')).toBeAttached({ timeout: 15_000 });
      await expect(viewerPage.locator('#saas-maintenance-banner')).toHaveCount(0);
      await openWorkspaceDialog(viewerPage);
      await expect(viewerPage.locator('#saas-workspace-backdrop')).toBeVisible();
    } finally {
      await viewerPage.context().close();
    }
  });
});
