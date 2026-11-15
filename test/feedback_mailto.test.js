import { describe, expect, it } from 'vitest';
import {
  buildDeveloperContactMailto,
  FEEDBACK_EMAIL,
  MAX_FEEDBACK_MESSAGE,
  MAX_FEEDBACK_SUBJECT
} from '../src/saas/feedback.js';

describe('Spark Free feedback mailto boundary', () => {
  it('builds a properly encoded mailto URI and clamps subject and message length', () => {
    const uri = buildDeveloperContactMailto({
      subject: `  ${'S'.repeat(150)}  `,
      message: `  ${'M'.repeat(3200)}  `
    });
    expect(uri.startsWith(`mailto:${FEEDBACK_EMAIL}?subject=`)).toBe(true);
    const parsed = new URL(uri);
    expect(parsed.searchParams.get('subject')?.length).toBe(MAX_FEEDBACK_SUBJECT);
    expect(parsed.searchParams.get('body')?.length).toBe(MAX_FEEDBACK_MESSAGE);
  });

  it('rejects blank fields and enforces submit cooldown', () => {
    expect(() => buildDeveloperContactMailto({ subject: '   ', message: 'Hello' })).toThrow(/required/);
    expect(() => buildDeveloperContactMailto({ subject: 'Bug', message: '' })).toThrow(/required/);
    expect(() => buildDeveloperContactMailto({
      subject: 'Bug',
      message: 'Details',
      lastSentAt: 10_000,
      now: 14_000,
      cooldownMs: 15_000
    })).toThrow(/11s/);
  });
});
