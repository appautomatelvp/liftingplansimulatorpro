import { test, expect } from '@playwright/test';

/** Check that an element is actually visible and not clipped or covered. */
async function assertTrulyVisibleAndClickable(page, selector, label = selector) {
  const result = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { ok: false, reason: 'Element not found in DOM' };
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
      return { ok: false, reason: `Hidden by style (display=${style.display}, visibility=${style.visibility}, opacity=${style.opacity})` };
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return { ok: false, reason: `Zero size (${rect.width}x${rect.height})` };
    if (rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1) {
      return { ok: false, reason: `Out of viewport: rect=(${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.right)},${Math.round(rect.bottom)}) vs viewport=${innerWidth}x${innerHeight}` };
    }
    let parent = el.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      const ps = getComputedStyle(parent);
      const pr = parent.getBoundingClientRect();
      const clipsX = ['hidden', 'clip', 'auto', 'scroll'].includes(ps.overflowX);
      const clipsY = ['hidden', 'clip', 'auto', 'scroll'].includes(ps.overflowY);
      if (clipsY && (rect.bottom > pr.bottom + 2 || rect.top < pr.top - 2)) {
        return { ok: false, reason: `Clipped vertically by ancestor #${parent.id || parent.className}` };
      }
      if (clipsX && (rect.right > pr.right + 2 || rect.left < pr.left - 2)) {
        return { ok: false, reason: `Clipped horizontally by ancestor #${parent.id || parent.className}` };
      }
      parent = parent.parentElement;
    }
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (!hit) return { ok: false, reason: 'elementFromPoint returned null' };
    if (hit !== el && !el.contains(hit) && !hit.contains(el)) {
      return { ok: false, reason: `Occluded by <${hit.tagName.toLowerCase()} id="${hit.id}" class="${hit.className}">` };
    }
    return { ok: true, rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } };
  }, selector);
  expect(result.ok, `[${label}] ${result.reason || 'OK'}`).toBe(true);
  return result.rect;
}

test.describe('SafeLift3D - Layout & Collision Avoidance E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to simulator app
    await page.goto('/');
    // Wait for the main canvas or bottom dock to be visible
    await expect(page.locator('#bottom-dock-bar')).toBeVisible({ timeout: 15000 });
  });

  test('UI-001: No page-level overflow scrollbars', async ({ page }) => {
    const isOverflowing = await page.evaluate(() => {
      return {
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        overflowY: document.documentElement.scrollHeight > window.innerHeight
      };
    });
    expect(isOverflowing.overflowX).toBe(false);
    expect(isOverflowing.overflowY).toBe(false);
  });

  test('UI-008: Safety HUD stays top-left and yields to adjustment editor', async ({ page }) => {
    const hud = page.locator('#dock-hud');
    await expect(hud).toBeVisible();
    const box = await hud.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeLessThanOrEqual(12);
    expect(box.y).toBeGreaterThanOrEqual(44);
    await assertTrulyVisibleAndClickable(page, '#dock-hud', 'Safety HUD');

    // The editor's open state is shared by both cable and cargo item editors.
    await page.evaluate(() => document.body.classList.add('gear-editor-open'));
    await expect(hud).toBeHidden();
    await page.evaluate(() => document.body.classList.remove('gear-editor-open'));
    await expect(hud).toBeVisible();
  });

  test('UI-010: Zero duplicate IDs in DOM', async ({ page }) => {
    const duplicates = await page.evaluate(() => {
      const allElements = document.querySelectorAll('[id]');
      const idMap = new Map();
      const dupes = [];
      allElements.forEach(el => {
        const id = el.id;
        if (!id) return;
        const count = idMap.get(id) || 0;
        idMap.set(id, count + 1);
        if (count === 1) dupes.push(id);
      });
      return dupes;
    });
    expect(duplicates).toEqual([]);
  });

  test('UI-003: Drawer opens and switches all 6 tabs cleanly', async ({ page }) => {
    const drawer = page.locator('#right-side-drawer');
    const drawerToggleBtn = page.locator('#btn-toggle-drawer');
    const drawerCloseBtn = page.locator('#btn-close-drawer');

    // Drawer starts open on boot (tab 3: Rig)
    await expect(drawer).toHaveClass(/drawer-open/);

    // Close drawer via close button
    await drawerCloseBtn.click();
    await expect(drawer).toHaveClass(/drawer-closed/);
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);

    // Reopen drawer via toggle button
    await drawerToggleBtn.click();
    await expect(drawer).toHaveClass(/drawer-open/);
    await expect(page.locator('body')).toHaveClass(/drawer-open/);
    // Wait for drawer slide-in transition to complete
    await page.waitForTimeout(350);

    // Test switching tabs: 1. Cargo, 2. Lugs, 3. Rig, 4. Gear, 5. Crane, 6. Site
    const tabs = [
      { id: 'tab-cargo', page: 'drawer-page-cargo' },
      { id: 'tab-lugs', page: 'drawer-page-lugs' },
      { id: 'tab-rig', page: 'drawer-page-rig' },
      { id: 'tab-gear', page: 'drawer-page-gear' },
      { id: 'tab-crane', page: 'drawer-page-crane' },
      { id: 'tab-site', page: 'drawer-page-site' }
    ];

    for (const t of tabs) {
      const tabBtn = page.locator(`[data-testid="${t.id}"]`);
      await tabBtn.click();
      await expect(tabBtn).toHaveClass(/active/);
      await expect(page.locator(`#${t.page}`)).toHaveClass(/active/);
    }

    // Verify Tab 5 (crane) and Tab 6 (site) do NOT leak section 4.2/4.3 elements
    const gearLoadSummary = page.locator('#gear-load-summary');
    const skewStatusBadge = page.locator('#skew-status-badge');

    // Switch to Crane tab (Tab 5)
    await page.locator('[data-testid="tab-crane"]').click();
    await expect(gearLoadSummary).not.toBeVisible();
    await expect(skewStatusBadge).not.toBeVisible();

    // Switch to Site tab (Tab 6)
    await page.locator('[data-testid="tab-site"]').click();
    await expect(gearLoadSummary).not.toBeVisible();
    await expect(skewStatusBadge).not.toBeVisible();

    // Switch to Gear tab (Tab 4) -> both should be visible inside Tab 4
    await page.locator('[data-testid="tab-gear"]').click();
    await expect(gearLoadSummary).toBeVisible();
    await expect(skewStatusBadge).toBeVisible();

    // Verify drawer doesn't collide with bottom dock bar
    const drawerBox = await drawer.boundingBox();
    const dockBox = await page.locator('#bottom-dock-bar').boundingBox();

    expect(drawerBox).not.toBeNull();
    expect(dockBox).not.toBeNull();

    // The dock right edge is kept left of the drawer
    const dockRightEdge = dockBox.x + dockBox.width;
    const drawerLeftEdge = drawerBox.x;
    expect(dockRightEdge).toBeLessThanOrEqual(drawerLeftEdge + 5);
  });

  test('UI-005: Dropdown menus mutual exclusivity and click outside / Esc dismiss', async ({ page }) => {
    const menuCamera = page.locator('#menu-camera');
    const btnCamera = page.locator('#btn-menu-camera');
    const panelCamera = page.locator('#dropdown-panel-camera');

    const menuDisplay = page.locator('#menu-display');
    const btnDisplay = page.locator('#btn-display-options');
    const panelDisplay = page.locator('#display-options-popover');

    // Click camera menu
    await btnCamera.click();
    await expect(menuCamera).toHaveClass(/open/);
    await expect(panelCamera).toBeVisible();
    await expect(menuDisplay).not.toHaveClass(/open/);

    // Click display menu -> camera closes automatically
    await btnDisplay.click();
    await expect(menuDisplay).toHaveClass(/open/);
    await expect(panelDisplay).toBeVisible();
    await expect(menuCamera).not.toHaveClass(/open/);
    await expect(panelCamera).toBeHidden();

    // Press Escape -> closes open dropdown menu
    await page.keyboard.press('Escape');
    await expect(menuDisplay).not.toHaveClass(/open/);
    await expect(panelDisplay).toBeHidden();
  });

  test('UI-007: Compliance HUD panel opens on left and does not collide with drawer', async ({ page }) => {
    const drawer = page.locator('#right-side-drawer');
    // Ensure drawer is open
    const isDrawerOpen = await drawer.evaluate(el => el.classList.contains('drawer-open'));
    if (!isDrawerOpen) {
      await page.locator('#btn-toggle-drawer').click();
    }
    await expect(drawer).toHaveClass(/drawer-open/);

    // Open Docs menu and click Compliance item
    await page.locator('#btn-menu-docs').click();
    await page.locator('#btn-open-compliance').click();

    const compHud = page.locator('#compliance-hud-panel');
    await expect(compHud).toBeVisible();

    const compBox = await compHud.boundingBox();
    const drawerBox = await drawer.boundingBox();

    // Compliance HUD is anchored to the left, drawer is on the right -> strictly separated!
    const compRightEdge = compBox.x + compBox.width;
    const drawerLeftEdge = drawerBox.x;
    expect(compRightEdge).toBeLessThan(drawerLeftEdge);

    // Close via close button
    await page.locator('#btn-close-compliance-hud').click();
    await expect(compHud).toBeHidden();
  });

  test('UI-014: Keyboard hotkeys 1-6 switch drawer tabs and Esc closes layer by layer', async ({ page }) => {
    const drawer = page.locator('#right-side-drawer');

    // Press '1' to open Tab 1 (Cargo)
    await page.keyboard.press('1');
    await expect(drawer).toHaveClass(/drawer-open/);
    await expect(page.locator('#drawer-page-cargo')).toHaveClass(/active/);

    // Press '3' to switch to Tab 3 (Rig)
    await page.keyboard.press('3');
    await expect(page.locator('#drawer-page-rig')).toHaveClass(/active/);

    // Press '4' to switch to Tab 4 (Gear)
    await page.keyboard.press('4');
    await expect(page.locator('#drawer-page-gear')).toHaveClass(/active/);

    // Open Camera Menu
    await page.locator('#btn-menu-camera').click();
    await expect(page.locator('#menu-camera')).toHaveClass(/open/);

    // First Esc closes menu
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-camera')).not.toHaveClass(/open/);
    await expect(drawer).toHaveClass(/drawer-open/);

    // Second Esc closes drawer
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveClass(/drawer-closed/);
  });

  test('UI-009: Design tokens z-index ordering', async ({ page }) => {
    const zIndexValues = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        canvas: parseInt(style.getPropertyValue('--z-canvas')),
        hud: parseInt(style.getPropertyValue('--z-hud')),
        dock: parseInt(style.getPropertyValue('--z-dock')),
        drawer: parseInt(style.getPropertyValue('--z-drawer')),
        topbar: parseInt(style.getPropertyValue('--z-topbar')),
        popover: parseInt(style.getPropertyValue('--z-popover')),
        modal: parseInt(style.getPropertyValue('--z-modal')),
        toast: parseInt(style.getPropertyValue('--z-toast'))
      };
    });

    expect(zIndexValues.canvas).toBeLessThan(zIndexValues.hud);
    expect(zIndexValues.hud).toBeLessThan(zIndexValues.dock);
    expect(zIndexValues.dock).toBeLessThan(zIndexValues.drawer);
    expect(zIndexValues.drawer).toBeLessThan(zIndexValues.topbar);
    expect(zIndexValues.topbar).toBeLessThan(zIndexValues.popover);
    expect(zIndexValues.popover).toBeLessThan(zIndexValues.modal);
    expect(zIndexValues.modal).toBeLessThan(zIndexValues.toast);
  });

  test('UI-015: Gear editor opens with exactly 4 sliders, auto calculated SWL and Mass, and fits viewport without truncation', async ({ page }) => {
    // Open gear editor for LP1
    await page.evaluate(() => {
      if (typeof state !== 'undefined' && typeof openGearEditor === 'function') {
        state.gear.selection = [{ kind: 'sling', role: 'leg', index: 0 }];
        openGearEditor();
      }
    });

    const editor = page.locator('#gear-editor');
    await expect(editor).toBeVisible();

    // Product decision (13/11/2026): the gear editor MUST expose exactly 4 range sliders.
    const sliderCount = await page.locator('#gear-editor input[type="range"]').count();
    expect(sliderCount).toBe(4);

    // Verify Auto badges for SWL and Mass
    const autoBadges = page.locator('#gear-editor span:text("Auto")');
    expect(await autoBadges.count()).toBeGreaterThanOrEqual(2);

    // Verify buttons are visible and not clipped
    const autoBtn = page.locator('#gear-editor-auto');
    const cutBtn = page.locator('#gear-editor-cut');
    const clearBtn = page.locator('#gear-editor-clear');

    await expect(autoBtn).toBeVisible();
    await expect(cutBtn).toBeVisible();
    await expect(clearBtn).toBeVisible();

    // Verify bounding box does not overlap bottom dock
    const box = await editor.boundingBox();
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThanOrEqual(48); // below nav
    expect(box.y + box.height).toBeLessThanOrEqual(1080 - 45); // above bottom dock

    // Take verification screenshot
    await page.screenshot({ path: 'docs/ui-after/gear-editor-inspector.png' });
  });
});
