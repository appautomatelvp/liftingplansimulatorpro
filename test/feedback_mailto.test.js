import { beforeEach, describe, expect, it } from 'vitest';
import { CONTACT_KEYS } from '../src/i18n/contact_keys.js';
import { saasT } from '../src/saas/i18n.js';
import {
  buildDeveloperContactMailto,
  createContactChallenge,
  FEEDBACK_RATE_KEY,
  MAX_FEEDBACK_MESSAGE,
  MAX_FEEDBACK_SUBJECT,
  recordFeedbackSubmission,
  resolveFeedbackEmail,
  sealGestureProof,
  verifyContactChallenge
} from '../src/saas/feedback.js';
import * as feedbackModule from '../src/saas/feedback.js';

describe('Developer feedback behavioral interlock and dynamic mailto boundary', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(FEEDBACK_RATE_KEY);
  });

  it('does not expose raw FEEDBACK_EMAIL constant and seals/verifies human gesture trajectory proofs', () => {
    expect('FEEDBACK_EMAIL' in feedbackModule).toBe(false);
    const challenge = createContactChallenge(() => 0.42);

    // Instant 1-step jump or too-short duration is rejected
    expect(sealGestureProof(challenge, { progress: 100, steps: 1, durationMs: 500 })).toBe('');
    expect(sealGestureProof(challenge, { progress: 100, steps: 10, durationMs: 50 })).toBe('');

    const validProof = sealGestureProof(challenge, { progress: 100, steps: 12, durationMs: 680 });
    expect(validProof).toBeTruthy();
    expect(verifyContactChallenge(challenge, validProof)).toBe(true);
    expect(verifyContactChallenge(challenge, `${validProof}tampered`)).toBe(false);

    const uri = buildDeveloperContactMailto({
      category: 'bug',
      subject: `  ${'S'.repeat(150)}  `,
      message: `  ${'M'.repeat(3200)}  `,
      challenge,
      challengeAnswer: validProof,
      openedAt: 10_000,
      now: 14_000
    });
    expect(uri.startsWith(`mailto:${resolveFeedbackEmail()}?subject=`)).toBe(true);
    const parsed = new URL(uri);
    expect(parsed.searchParams.get('subject')?.startsWith('[Bug Report] ')).toBe(true);
    expect(parsed.searchParams.get('subject')?.length).toBe(MAX_FEEDBACK_SUBJECT);
    expect(parsed.searchParams.get('body')?.length).toBe(MAX_FEEDBACK_MESSAGE);
  });

  it('blocks honeypot, too-fast bot submits, unverified interlocks, short/link spam, and cooldowns', () => {
    const challenge = createContactChallenge(() => 0.15);
    const validProof = sealGestureProof(challenge, { progress: 100, steps: 9, durationMs: 520 });

    expect(() => buildDeveloperContactMailto({
      subject: 'Question',
      message: 'Valid detailed engineering inquiry here.',
      honeypot: 'http://spam.example',
      challenge,
      challengeAnswer: validProof
    })).toThrow(/Automated/);

    expect(() => buildDeveloperContactMailto({
      subject: 'Question',
      message: 'Valid detailed engineering inquiry here.',
      openedAt: 10_000,
      now: 11_000,
      challenge,
      challengeAnswer: validProof
    })).toThrow(/review your message/i);

    expect(() => buildDeveloperContactMailto({
      subject: 'Question',
      message: 'Valid detailed engineering inquiry here.',
      openedAt: 10_000,
      now: 15_000,
      challenge,
      challengeAnswer: '100.12.520.deadbeef'
    })).toThrow(/interlock/i);

    expect(() => buildDeveloperContactMailto({
      subject: '   ',
      message: 'Valid detailed message',
      challenge,
      challengeAnswer: validProof
    })).toThrow(/required/);

    expect(() => buildDeveloperContactMailto({
      subject: 'Bug',
      message: 'short',
      challenge,
      challengeAnswer: validProof
    })).toThrow(/at least 10/);

    expect(() => buildDeveloperContactMailto({
      subject: 'Promo',
      message: 'Check https://a.com https://b.com https://c.com right now!',
      challenge,
      challengeAnswer: validProof
    })).toThrow(/Too many links/);

    expect(() => buildDeveloperContactMailto({
      subject: 'Bug',
      message: 'Detailed rigging feedback message.',
      lastSentAt: 10_000,
      now: 14_000,
      cooldownMs: 30_000,
      challenge,
      challengeAnswer: validProof
    })).toThrow(/26s/);
  });

  it('enforces rolling hourly feedback quota via localStorage when available', () => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    };
    try {
      const challenge = createContactChallenge(() => 0.33);
      const validProof = sealGestureProof(challenge, { progress: 100, steps: 8, durationMs: 480 });
      recordFeedbackSubmission(1_000);
      recordFeedbackSubmission(40_000);
      recordFeedbackSubmission(80_000);
      expect(() => buildDeveloperContactMailto({
        subject: 'Fourth inquiry',
        message: 'Trying to flood the feedback channel repeatedly.',
        now: 120_000,
        challenge,
        challengeAnswer: validProof
      })).toThrow(/Hourly feedback limit/);
    } finally {
      delete globalThis.localStorage;
    }
  });

  it('keeps CONTACT_KEYS symmetric across VI and EN and omits amateur anti-spam bragging copy', () => {
    expect(Object.keys(CONTACT_KEYS.en).sort()).toEqual(Object.keys(CONTACT_KEYS.vi).sort());
    expect(JSON.stringify(CONTACT_KEYS)).not.toMatch(/chống spam|anti-spam|ẩn email/i);
    expect(saasT('contactErrCooldown', { sec: 12 }, 'en')).toBe('Please wait 12s before submitting another inquiry.');
    expect(saasT('contactErrHourly', { min: 45 }, 'vi')).toContain('45 phút');
  });
});
