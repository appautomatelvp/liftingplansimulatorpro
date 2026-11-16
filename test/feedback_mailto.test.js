import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildDeveloperContactMailto,
  createContactChallenge,
  FEEDBACK_RATE_KEY,
  MAX_FEEDBACK_MESSAGE,
  MAX_FEEDBACK_SUBJECT,
  recordFeedbackSubmission,
  resolveFeedbackEmail,
  verifyContactChallenge
} from '../src/saas/feedback.js';
import * as feedbackModule from '../src/saas/feedback.js';

describe('Developer feedback anti-spam and dynamic mailto boundary', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(FEEDBACK_RATE_KEY);
  });

  it('does not expose raw FEEDBACK_EMAIL constant and builds clamped mailto URI after challenge', () => {
    expect('FEEDBACK_EMAIL' in feedbackModule).toBe(false);
    const challenge = createContactChallenge(() => 0.25);
    expect(verifyContactChallenge(challenge, String(challenge.expected))).toBe(true);

    const uri = buildDeveloperContactMailto({
      category: 'bug',
      subject: `  ${'S'.repeat(150)}  `,
      message: `  ${'M'.repeat(3200)}  `,
      challenge,
      challengeAnswer: String(challenge.expected),
      openedAt: 10_000,
      now: 14_000
    });
    expect(uri.startsWith(`mailto:${resolveFeedbackEmail()}?subject=`)).toBe(true);
    const parsed = new URL(uri);
    expect(parsed.searchParams.get('subject')?.startsWith('[Bug Report] ')).toBe(true);
    expect(parsed.searchParams.get('subject')?.length).toBe(MAX_FEEDBACK_SUBJECT);
    expect(parsed.searchParams.get('body')?.length).toBe(MAX_FEEDBACK_MESSAGE);
  });

  it('blocks honeypot, too-fast bot submits, wrong human verification, short/link spam, and cooldowns', () => {
    const challenge = { a: 3, b: 4, prompt: '3 + 4 = ?', expected: 7 };
    expect(() => buildDeveloperContactMailto({
      subject: 'Question',
      message: 'Valid detailed engineering inquiry here.',
      honeypot: 'http://spam.example',
      challenge,
      challengeAnswer: '7'
    })).toThrow(/Automated/);

    expect(() => buildDeveloperContactMailto({
      subject: 'Question',
      message: 'Valid detailed engineering inquiry here.',
      openedAt: 10_000,
      now: 11_000,
      challenge,
      challengeAnswer: '7'
    })).toThrow(/review your message/i);

    expect(() => buildDeveloperContactMailto({
      subject: 'Question',
      message: 'Valid detailed engineering inquiry here.',
      openedAt: 10_000,
      now: 15_000,
      challenge,
      challengeAnswer: '9'
    })).toThrow(/Verification/);

    expect(() => buildDeveloperContactMailto({
      subject: '   ',
      message: 'Valid detailed message',
      challenge,
      challengeAnswer: '7'
    })).toThrow(/required/);

    expect(() => buildDeveloperContactMailto({
      subject: 'Bug',
      message: 'short',
      challenge,
      challengeAnswer: '7'
    })).toThrow(/at least 10/);

    expect(() => buildDeveloperContactMailto({
      subject: 'Promo',
      message: 'Check https://a.com https://b.com https://c.com right now!',
      challenge,
      challengeAnswer: '7'
    })).toThrow(/Too many links/);

    expect(() => buildDeveloperContactMailto({
      subject: 'Bug',
      message: 'Detailed rigging feedback message.',
      lastSentAt: 10_000,
      now: 14_000,
      cooldownMs: 30_000,
      challenge,
      challengeAnswer: '7'
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
      const challenge = { a: 2, b: 5, prompt: '2 + 5 = ?', expected: 7 };
      recordFeedbackSubmission(1_000);
      recordFeedbackSubmission(40_000);
      recordFeedbackSubmission(80_000);
      expect(() => buildDeveloperContactMailto({
        subject: 'Fourth inquiry',
        message: 'Trying to flood the feedback channel repeatedly.',
        now: 120_000,
        challenge,
        challengeAnswer: '7'
      })).toThrow(/Hourly feedback limit/);
    } finally {
      delete globalThis.localStorage;
    }
  });
});
