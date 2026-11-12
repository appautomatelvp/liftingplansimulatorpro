/**
 * CI gate: ADR-002 freeze — legacy god-files must remain thin shims.
 * Also verifies manifest parts exist on disk.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve('.');
const simDir = path.join(root, 'src/sim');
const shims = ['physics.js', 'session.js', 'cargo.js', 'library.js', 'gear.js', 'rigging.js'];
const MAX_SHIM_LINES = 40;

let failed = false;

for (const name of shims) {
  const full = path.join(simDir, name);
  if (!fs.existsSync(full)) {
    console.error(`FAIL: missing shim ${name}`);
    failed = true;
    continue;
  }
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('*') && !l.trim().startsWith('/*') && !l.trim().startsWith('//'));
  // Count non-comment non-blank roughly
  const all = fs.readFileSync(full, 'utf8').split(/\r?\n/).length;
  if (all > MAX_SHIM_LINES) {
    console.error(`FAIL: ${name} has ${all} lines (max ${MAX_SHIM_LINES}) — do not grow god-files`);
    failed = true;
  } else {
    console.log(`OK shim ${name} (${all} lines)`);
  }
}

const { SIM_PARTS } = await import(pathToFileURL(path.join(simDir, 'manifest.js')).href);
for (const part of SIM_PARTS) {
  const full = path.join(simDir, part);
  if (!fs.existsSync(full)) {
    console.error(`FAIL: manifest part missing: ${part}`);
    failed = true;
  }
}
console.log(`OK manifest (${SIM_PARTS.length} parts)`);

if (failed) process.exit(1);
console.log('architecture-gate passed');
