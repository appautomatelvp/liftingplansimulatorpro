import { describe, expect, it } from 'vitest';
import { restoreAuthActions } from '../src/saas/auth_screen.js';
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
});
