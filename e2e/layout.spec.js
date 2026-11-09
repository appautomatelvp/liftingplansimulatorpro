import { test, expect } from '@playwright/test';

test.describe('Lifting Plan Simulator - Layout & Collision Avoidance E2E', () => {

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
      await tabBtn.click({ force: true });
      await expect(tabBtn).toHaveClass(/active/);
      await expect(page.locator(`#${t.page}`)).toHaveClass(/active/);
    }

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
});
