/**
 * Verify production dist/ output does not expose JavaScript/CSS source maps.
 */
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
if (!fs.existsSync(distDir)) {
  console.error('FAIL: dist/ directory does not exist. Run npm run build first.');
  process.exit(1);
}

const mapFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.map')) mapFiles.push(path.relative(distDir, full));
  }
}

walk(distDir);

if (mapFiles.length > 0) {
  console.error(`FAIL: source maps found in production dist/: ${mapFiles.join(', ')}`);
  process.exit(1);
}

console.log('OK: no .map files in dist/');
