import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('public/_headers security policy', () => {
  const raw = readFileSync(path.resolve('public/_headers'), 'utf8');

  it('includes baseline hardening headers and keeps COOP for Google popup auth', () => {
    expect(raw).toContain('Cross-Origin-Opener-Policy: same-origin-allow-popups');
    expect(raw).toContain('X-Content-Type-Options: nosniff');
    expect(raw).toContain('Referrer-Policy: strict-origin-when-cross-origin');
    expect(raw).toContain('Permissions-Policy: camera=(), microphone=(), geolocation=()');
  });

  it('configures CSP in Report-Only mode with Firebase, Rapier WASM, worker, and framing protections', () => {
    const cspLine = raw
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith('Content-Security-Policy-Report-Only:'));
    expect(cspLine).toBeTruthy();
    expect(cspLine).toContain("frame-ancestors 'none'");
    expect(cspLine).toContain("'wasm-unsafe-eval'");
    expect(cspLine).toContain('worker-src');
    expect(cspLine).toContain('blob:');
    expect(cspLine).toContain('https://apis.google.com');
    expect(cspLine).toContain('https://*.firebaseapp.com');
    expect(cspLine).toContain('https://*.googleapis.com');
    expect(cspLine).toContain('https://www.google.com/recaptcha/');
    expect(cspLine).toContain("object-src 'none'");
  });

  it('sets immutable caching for hashed assets and bounded caching for 3D models', () => {
    expect(raw).toContain('/assets/*');
    expect(raw).toContain('Cache-Control: public, max-age=31536000, immutable');
    expect(raw).toContain('/assets/models/*');
    expect(raw).toContain('Cache-Control: public, max-age=86400');
  });
});
