import { expect } from '@playwright/test';

export const PROJECT_ID = 'safelift3d-rules-test';
export const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
export const FIRESTORE_EMULATOR_URL = 'http://127.0.0.1:8080';
export const EMULATOR_ACTIVE = process.env.VITE_USE_EMULATORS === 'true';

export async function clearEmulators(request) {
  await request.delete(`${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`);
  await request.delete(`${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`);
}

export async function verifyEmailInEmulator(request, email) {
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

export async function createAndVerifyAccount(page, request, { displayName, email, password }) {
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

export async function openWorkspaceDialog(page) {
  await page.evaluate(() => {
    document.querySelector('#saas-account-widget [data-action="workspace"]')?.click();
  });
  await expect(page.locator('#saas-workspace-backdrop')).toBeVisible({ timeout: 10_000 });
}

export async function promoteUserRole(request, uid, role) {
  const res = await request.patch(
    `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=role`,
    {
      headers: { Authorization: 'Bearer owner' },
      data: { fields: { role: { stringValue: role } } }
    }
  );
  expect(res.ok()).toBeTruthy();
}
