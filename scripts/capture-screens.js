import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('docs/ui-after');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const viewports = [
  { name: '1280x720-hd', width: 1280, height: 720 },
  { name: '1366x768-laptop', width: 1366, height: 768 },
  { name: '1920x1080-fhd', width: 1920, height: 1080 },
  { name: '2560x1440-qhd', width: 2560, height: 1440 }
];

async function main() {
  const browser = await chromium.launch();
  
  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height }
    });
    
    await page.goto('http://localhost:5174/');
    await page.waitForSelector('#bottom-dock-bar', { timeout: 15000 });
    // Wait for 3D scene to settle
    await page.waitForTimeout(2000);

    // 1. Capture with drawer open (default state on boot)
    await page.screenshot({
      path: path.join(outDir, `${vp.name}-drawer-open.png`),
      fullPage: false
    });
    console.log(`Captured: ${vp.name}-drawer-open.png`);

    // 2. Close drawer and capture clean canvas view
    await page.locator('#btn-close-drawer').click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(outDir, `${vp.name}-drawer-closed.png`),
      fullPage: false
    });
    console.log(`Captured: ${vp.name}-drawer-closed.png`);

    await page.close();
  }

  await browser.close();
  console.log('All screenshots captured successfully into docs/ui-after/!');
}

main().catch(err => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
