import { test, expect } from '@playwright/test';
import {
  clearEmulators,
  createAndVerifyAccount,
  EMULATOR_ACTIVE,
  promoteUserRole
} from './emulator_helpers.js';

test.describe('CMS granular roles and audit log UI on Emulator', () => {
  test.skip(!EMULATOR_ACTIVE, 'Requires Firebase Auth + Firestore Emulators (npm run test:e2e:auth)');

  test.beforeEach(async ({ request }) => {
    await clearEmulators(request);
  });

  test('enforces standard user block, support read-only view, catalog-editor scope, and admin tier update with reason & audit row', async ({ page, request, context }) => {
    // 1. Standard user is denied /admin access
    await createAndVerifyAccount(page, request, {
      displayName: 'Target Standard User',
      email: 'target-role@safelift3d.test',
      password: 'Password123!'
    });
    await page.goto('/admin');
    await expect(page.locator('.saas-admin-card h1')).toContainText(/Cần quyền quản trị viên|Admin(?:istrator)? access required/i, { timeout: 15_000 });
    await expect(page.locator('[data-action="search-form"]')).toHaveCount(0);
    await expect(page.locator('[data-action="catalog-form"]')).toHaveCount(0);
    await expect(page.locator('[data-action="flags-form"]')).toHaveCount(0);

    // 2. Support role sees users + audit with mutation buttons disabled and no catalog CMS
    const supportPage = await (await context.browser().newContext()).newPage();
    try {
      await createAndVerifyAccount(supportPage, request, {
        displayName: 'Support Agent',
        email: 'support-role@safelift3d.test',
        password: 'Password123!'
      });
      const supportUid = await supportPage.evaluate(() => window.SafeLift?.saas?.authUser?.uid);
      await promoteUserRole(request, supportUid, 'support');

      await supportPage.goto('/admin');
      await expect(supportPage.locator('[data-action="search-form"]')).toBeVisible({ timeout: 15_000 });
      await expect(supportPage.locator('[data-action="refresh-audit"]')).toBeVisible();
      await expect(supportPage.locator('[data-action="catalog-form"]')).toHaveCount(0);
      await expect(supportPage.locator('#admin-access-reason')).toHaveCount(0);

      const targetTierBtn = supportPage.locator('.saas-users-table tbody tr', { hasText: 'target-role@safelift3d.test' }).locator('[data-tier]');
      await expect(targetTierBtn).toBeDisabled();
      await expect(supportPage.locator('[data-action="flags-form"] button[type="submit"]')).toBeDisabled();
    } finally {
      await supportPage.context().close();
    }

    // 3. Catalog-editor sees only Catalog CMS, never Users, Flags, or Audit
    const editorPage = await (await context.browser().newContext()).newPage();
    try {
      await createAndVerifyAccount(editorPage, request, {
        displayName: 'Catalog Role User',
        email: 'editor-role@safelift3d.test',
        password: 'Password123!'
      });
      const editorUid = await editorPage.evaluate(() => window.SafeLift?.saas?.authUser?.uid);
      await promoteUserRole(request, editorUid, 'catalog-editor');

      await editorPage.goto('/admin');
      await expect(editorPage.locator('[data-action="catalog-form"]')).toBeVisible({ timeout: 15_000 });
      await expect(editorPage.locator('[data-action="search-form"]')).toHaveCount(0);
      await expect(editorPage.locator('[data-action="flags-form"]')).toHaveCount(0);
      await expect(editorPage.locator('[data-action="refresh-audit"]')).toHaveCount(0);
    } finally {
      await editorPage.context().close();
    }

    // 4. Admin requires a reason and atomically writes an audit row with before/after diff on tier change
    const adminPage = await (await context.browser().newContext()).newPage();
    try {
      await createAndVerifyAccount(adminPage, request, {
        displayName: 'Lead Admin',
        email: 'admin-role@safelift3d.test',
        password: 'Password123!'
      });
      const adminUid = await adminPage.evaluate(() => window.SafeLift?.saas?.authUser?.uid);
      await promoteUserRole(request, adminUid, 'admin');

      await adminPage.goto('/admin');
      await expect(adminPage.locator('#admin-access-reason')).toBeVisible({ timeout: 15_000 });

      const targetRow = adminPage.locator('.saas-users-table tbody tr', { hasText: 'target-role@safelift3d.test' }).first();
      await expect(targetRow).toBeVisible();
      await targetRow.locator('[data-tier]').click();
      await expect(adminPage.locator('.saas-admin-notice.is-error')).toBeVisible();
      await expect(targetRow).toContainText('free');

      await adminPage.locator('#admin-access-reason').fill('Audit Check T07');
      await targetRow.locator('[data-tier]').click();
      await expect(targetRow).toContainText('premium', { timeout: 10_000 });

      const auditTable = adminPage.locator('[data-action="refresh-audit"]').locator('xpath=ancestor::section[1]');
      await expect(auditTable).toContainText('USER_ACCESS_UPDATE', { timeout: 10_000 });
      await expect(auditTable).toContainText('Audit Check T07');
      await expect(auditTable).toContainText('free');
      await expect(auditTable).toContainText('premium');
    } finally {
      await adminPage.context().close();
    }
  });
});
