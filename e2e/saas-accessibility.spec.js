import { test, expect } from '@playwright/test';

test.describe('SafeLift3D dialog accessibility', () => {
  test('traps keyboard focus and restores it when released', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.evaluate(async () => {
      const { trapDialogFocus } = await import('/src/saas/dialog_accessibility.js');
      document.body.insertAdjacentHTML('beforeend', '<button id="dialog-trigger">Open</button><section id="test-dialog" role="dialog" aria-modal="true" aria-label="Test dialog" style="position:fixed;inset:0;background:#111"><button id="first">First</button><button id="last">Last</button></section>');
      const trigger = document.querySelector('#dialog-trigger');
      const dialog = document.querySelector('#test-dialog');
      trigger.focus();
      window.__releaseDialogFocusTrap = trapDialogFocus(dialog, { initialFocus: document.querySelector('#first') });
    });

    await expect(page.locator('#first')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#last')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#first')).toBeFocused();
    await page.evaluate(() => window.__releaseDialogFocusTrap());
    await expect(page.locator('#dialog-trigger')).toBeFocused();
  });

  test('honors reduced-motion preferences for workspace dialogs', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    const transitionDuration = await page.evaluate(() => {
      const dialog = document.createElement('section');
      dialog.className = 'saas-workspace-dialog';
      document.body.append(dialog);
      const duration = getComputedStyle(dialog).transitionDuration;
      dialog.remove();
      return duration;
    });
    expect(transitionDuration.split(',').every((duration) => parseFloat(duration) <= 0.001)).toBe(true);
  });

  test('imports a saved local rig only after the lift plan save succeeds', async ({ page }) => {
    const legacyRig = {
      id: 'legacy-rig-1', name: 'Legacy spreader', beamType: 'spreader', slingType: 'wire', hwType: 'bow_shackle',
      slingLength: 8, rigFit: 'fixed', members: { main: { lengthM: 8 } }, extraCables: []
    };
    await page.addInitScript((rig) => localStorage.setItem('lp-user-rigs', JSON.stringify([rig])), legacyRig);
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.evaluate(async () => {
      const [{ mountWorkspaceDashboard }, workspaceData] = await Promise.all([
        import('/src/saas/workspace_dashboard.js'), import('/src/saas/workspace_data.js')
      ]);
      const plans = [];
      let allowSave = false;
      window.__workspacePlans = plans;
      const liftState = { cargoType: 'container', weight: 24, gear: { members: {}, extraCables: [] } };
      window.__liftState = liftState;
      window.__rebuildCount = 0;
      window.__LIFTING_RUNTIME__ = { api: { getState: () => liftState, rebuildCargoAndRig: () => { window.__rebuildCount += 1; } } };
      const dataService = {
        ...workspaceData,
        async listWorkspacePage(_db, _uid, type) { return { items: type === 'liftPlans' ? [...plans] : [], cursor: null, hasMore: false }; },
        async createLiftPlan(_db, profile, input) {
          if (!allowSave) throw new Error('Temporary save failure');
          const plan = { ...input, id: String(plans.length + 1), ownerUid: profile.uid, schemaVersion: 1, revision: 1, solverVersion: '5.0', archived: false, updatedAt: new Date() };
          plans.push(plan);
          return plan.id;
        }
      };
      window.__allowWorkspaceSave = () => { allowSave = true; };
      mountWorkspaceDashboard({ db: null, profile: { uid: 'owner-1', tier: 'free' }, dataService });
    });

    await page.locator('#saas-workspace-backdrop [data-action="import-legacy"]').click();
    const picker = page.locator('.saas-workspace-form[role="dialog"]');
    const importButton = picker.locator('[data-import-rig="legacy-rig-1"]');
    await expect(importButton).toBeVisible();
    await importButton.click();
    await expect(picker.locator('[data-import-error]')).toContainText('Temporary save failure');
    await expect(page.locator('#saas-workspace-backdrop [data-list]')).not.toContainText('Legacy spreader');
    expect(await page.evaluate(() => localStorage.getItem('lp-user-rigs-migrated:owner-1'))).toBeNull();
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('lp-user-rigs')))).toHaveLength(1);

    await page.evaluate(() => window.__allowWorkspaceSave());
    await importButton.click();
    await expect(page.locator('#saas-workspace-backdrop [data-list]')).toContainText('Legacy spreader');
    await expect(picker).toHaveCount(0);
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('lp-user-rigs-migrated:owner-1')))).toEqual(['legacy-rig-1']);
    const migrated = await page.evaluate(() => JSON.parse(window.__workspacePlans[0].snapshot));
    expect(migrated.inputs).toMatchObject({ cargoType: 'container', beamType: 'spreader', slingType: 'wire', hwType: 'bow_shackle', slingLength: 8 });
    expect(await page.evaluate(() => localStorage.getItem('lp-user-rigs'))).toContain('Legacy spreader');

    await page.locator('#saas-workspace-backdrop [data-list] [data-action="apply"]').click();
    await expect(page.locator('#saas-workspace-backdrop')).toHaveCount(0);
    expect(await page.evaluate(() => window.__liftState)).toMatchObject({ cargoType: 'container', beamType: 'spreader', slingType: 'wire', hwType: 'bow_shackle', slingLength: 8 });
    expect(await page.evaluate(() => window.__rebuildCount)).toBe(1);
  });

  test('switches visible application text and accessibility labels to English', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('safelift3d.lang', 'vi'));
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.locator('#btn-menu-system').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#btn-menu-system').click();
    await page.locator('#btn-lang').click();
    const result = await page.evaluate(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const vietnamese = /[áàảãạăắằẳẵặâấầẩẫậđéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ]/iu;
      const isVisible = (element) => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && Boolean(element.getClientRects().length);
      };
      const scan = () => {
        const leaks = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const value = node.nodeValue.trim().replace(/\s+/g, ' ');
          if (!value || !vietnamese.test(value) || !isVisible(node.parentElement)) continue;
          if (/Lê Việt Phương/.test(value)) continue;
          leaks.push({ type: 'text', value });
        }
        document.querySelectorAll('body *').forEach((element) => {
          if (!isVisible(element)) return;
          for (const attribute of ['title', 'aria-label', 'placeholder']) {
            const value = element.getAttribute(attribute);
            if (value && vietnamese.test(value) && !/Lê Việt Phương/.test(value)) leaks.push({ type: attribute, value });
          }
        });
        return leaks;
      };
      const areas = [];
      for (const tab of document.querySelectorAll('.drawer-inner-tab-btn')) {
        tab.click();
        await wait(350);
        areas.push({ section: tab.dataset.drawerTab, leaks: scan() });
      }
      for (const menuId of ['btn-menu-camera', 'btn-menu-docs', 'btn-menu-system']) {
        const menu = document.getElementById(menuId);
        if (!menu || !isVisible(menu)) continue;
        menu.click();
        await wait(350);
        areas.push({ section: menuId, leaks: scan() });
      }
      return { lang: window.SafeLift?.i18n?.getLang?.(), simulatorLang: window.__LIFTING_RUNTIME__?.state?.lang, areas };
    });
    expect(result.lang).toBe('en');
    expect(result.simulatorLang).toBe('en');
    const leaks = result.areas.flatMap((area) => area.leaks.map((leak) => ({ section: area.section, ...leak })));
    expect(result.areas.map((area) => area.section)).toContain('site');
    expect(leaks, JSON.stringify(leaks, null, 2)).toEqual([]);
  });
});
