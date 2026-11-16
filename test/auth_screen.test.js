import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUTH_COPY } from '../src/saas/auth_rate_limit.js';
import { restoreAuthActions } from '../src/saas/auth_screen.js';
import { COPYRIGHT } from '../src/saas/branding.js';
import { KEYS } from '../src/i18n/keys.js';

describe('authentication action recovery', () => {
  it('restores labels and enables buttons after a failed sign-in', () => {
    const submit = { disabled: true, textContent: 'Vui lòng đợi…' };
    const google = { disabled: true };
    const root = { querySelector: (selector) => selector === '.saas-primary-button' ? submit : google };

    restoreAuthActions(root, 'sign-in', { signIn: 'Đăng nhập', create: 'Tạo tài khoản' });

    expect(submit).toEqual({ disabled: false, textContent: 'Đăng nhập' });
    expect(google.disabled).toBe(false);
  });

  it('uses the current locale and create mode after a failed registration', () => {
    const submit = { disabled: true, textContent: 'Please wait…' };
    const root = { querySelector: () => submit };

    restoreAuthActions(root, 'create', { signIn: 'Sign in', create: 'Create account' });

    expect(submit).toEqual({ disabled: false, textContent: 'Create account' });
  });

  it('provides sanitized account-verification fallback copy without exposing rules internals', () => {
    expect(KEYS.en.authVerifyAccountError).not.toMatch(/firestore|rules/i);
    expect(KEYS.vi.authVerifyAccountError).not.toMatch(/firestore|rules/i);
  });

  it('hides personal phone and raw email from public branding, splash HTML, and auth screens', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const authSrc = readFileSync(new URL('../src/saas/auth_screen.js', import.meta.url), 'utf8');
    const paywallSrc = readFileSync(new URL('../src/saas/feature_access_ui.js', import.meta.url), 'utf8');
    const contactSrc = readFileSync(new URL('../src/saas/contact_dialog.js', import.meta.url), 'utf8');
    for (const content of [html, authSrc, paywallSrc, contactSrc, JSON.stringify(COPYRIGHT), JSON.stringify(AUTH_COPY)]) {
      expect(content).not.toMatch(/968\s*051\s*697/);
      expect(content).not.toMatch(/levietphuong\.hcmutrans/i);
    }
    expect(COPYRIGHT.developer).toBe('Lê Việt Phương (Mr)');
    expect(authSrc).toContain('data-action="contact-developer"');
  });
});
