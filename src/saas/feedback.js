// @purpose: Giải mã động địa chỉ nhận góp ý và bảo vệ hộp thoại gửi email khỏi bot/spam 5 lớp
import { safeReadLocalStore, safeWriteLocalStore } from '../utils/localDataStore.js';

export const MAX_FEEDBACK_SUBJECT = 120;
export const MAX_FEEDBACK_MESSAGE = 3000;
export const MIN_FEEDBACK_MESSAGE = 10;
export const MAX_FEEDBACK_LINKS = 2;
export const FEEDBACK_COOLDOWN_MS = 30_000;
export const FEEDBACK_HOUR_LIMIT = 3;
export const FEEDBACK_HOUR_WINDOW_MS = 3_600_000;
export const MIN_INTERACTION_MS = 2_500;
export const FEEDBACK_RATE_KEY = 'safelift.feedback.rate.v1';

const RECIPIENT_MASK = Object.freeze([23, 41, 13, 59, 31]);
const RECIPIENT_CHUNKS = Object.freeze([
  123, 77, 125, 85, 126, 104, 95, 101, 79, 114, 124,
  82, 40, 89, 124, 123, 94, 124, 77, 131, 127, 90,
  78, 94, 117, 122, 69, 103, 21, 125, 122, 71
]);

const CATEGORY_TAGS = Object.freeze({
  feedback: 'Feedback',
  bug: 'Bug Report',
  enterprise: 'Enterprise / License',
  other: 'Support'
});

function feedbackError(code, message, extra = {}) {
  const err = new Error(message);
  err.code = code;
  return Object.assign(err, extra);
}

/** Resolve recipient only in memory at send time so bots cannot scrape raw strings from HTML/JS. */
export function resolveFeedbackEmail() {
  return RECIPIENT_CHUNKS
    .map((code, idx) => String.fromCharCode((code - (idx % 7)) ^ RECIPIENT_MASK[idx % RECIPIENT_MASK.length]))
    .join('');
}

export function createContactChallenge(rng = Math.random) {
  const a = 2 + (Math.floor(rng() * 8) % 8);
  const b = 2 + (Math.floor(rng() * 8) % 8);
  return { a, b, prompt: `${a} + ${b} = ?`, expected: a + b };
}

export function verifyContactChallenge(challenge, answer) {
  if (!challenge || !Number.isInteger(challenge.expected)) return false;
  const parsed = Number(String(answer ?? '').trim());
  return Number.isInteger(parsed) && parsed === challenge.expected;
}

function readStoredAttempts(now) {
  if (typeof localStorage === 'undefined') return [];
  const raw = safeReadLocalStore(FEEDBACK_RATE_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((ts) => Number.isFinite(ts) && ts <= now && now - ts < FEEDBACK_HOUR_WINDOW_MS);
}

export function checkFeedbackRateLimit(now = Date.now(), {
  lastSentAt = 0,
  cooldownMs = FEEDBACK_COOLDOWN_MS,
  hourLimit = FEEDBACK_HOUR_LIMIT
} = {}) {
  const recent = readStoredAttempts(now);
  const latest = Math.max(Number(lastSentAt || 0), recent.length ? recent[recent.length - 1] : 0);
  const elapsed = now - latest;
  if (latest > 0 && elapsed < cooldownMs) {
    const retryAfterSec = Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000));
    throw feedbackError('safelift/feedback-cooldown', `Please wait ${retryAfterSec}s before sending another feedback email.`, { retryAfterSec });
  }
  if (recent.length >= hourLimit) {
    const retryAfterMin = Math.max(1, Math.ceil((FEEDBACK_HOUR_WINDOW_MS - (now - recent[0])) / 60_000));
    throw feedbackError('safelift/feedback-hourly-limit', `Hourly feedback limit (${hourLimit}/h) reached. Try again in ${retryAfterMin}m.`, { retryAfterMin });
  }
}

export function recordFeedbackSubmission(now = Date.now()) {
  if (typeof localStorage === 'undefined') return;
  const next = [...readStoredAttempts(now), now].slice(-FEEDBACK_HOUR_LIMIT);
  safeWriteLocalStore(FEEDBACK_RATE_KEY, next);
}

function countUrls(text) {
  return (String(text || '').match(/https?:\/\/\S+/gi) || []).length;
}

/**
 * Validate anti-spam checks and compose a `mailto:` handoff URI only on verified submit.
 */
export function buildDeveloperContactMailto({
  category = '',
  subject,
  message,
  senderContact = '',
  honeypot = '',
  openedAt = 0,
  challenge = null,
  challengeAnswer = '',
  lastSentAt = 0,
  now = Date.now(),
  cooldownMs = FEEDBACK_COOLDOWN_MS,
  minInteractionMs = MIN_INTERACTION_MS,
  appMeta = null
} = {}) {
  if (String(honeypot ?? '').trim() !== '') {
    throw feedbackError('safelift/feedback-bot-blocked', 'Automated submission blocked.');
  }
  if (Number.isFinite(openedAt) && openedAt > 0 && now - openedAt < minInteractionMs) {
    const retryAfterSec = Math.max(1, Math.ceil((minInteractionMs - (now - openedAt)) / 1000));
    throw feedbackError('safelift/feedback-too-fast', `Please review your message (${retryAfterSec}s) before sending.`, { retryAfterSec });
  }
  if (challenge && !verifyContactChallenge(challenge, challengeAnswer)) {
    throw feedbackError('safelift/feedback-challenge-failed', 'Verification answer is incorrect.');
  }

  const tag = CATEGORY_TAGS[category] ? `[${CATEGORY_TAGS[category]}] ` : '';
  const rawSubject = String(subject ?? '').trim();
  const rawMessage = String(message ?? '').trim();
  if (!rawSubject || !rawMessage) {
    throw feedbackError('safelift/feedback-required', 'Subject and message are required.');
  }
  if (rawMessage.length < MIN_FEEDBACK_MESSAGE) {
    throw feedbackError('safelift/feedback-too-short', `Please enter at least ${MIN_FEEDBACK_MESSAGE} characters.`);
  }
  if (countUrls(rawMessage) > MAX_FEEDBACK_LINKS) {
    throw feedbackError('safelift/feedback-spam-links', 'Too many links in message.');
  }

  checkFeedbackRateLimit(now, { lastSentAt, cooldownMs });

  const cleanSubject = `${tag}${rawSubject}`.slice(0, MAX_FEEDBACK_SUBJECT);
  const cleanSender = String(senderContact ?? '').trim().slice(0, 120);
  const metaParts = [];
  if (cleanSender) metaParts.push(`Reply-To: ${cleanSender}`);
  if (appMeta && typeof appMeta === 'object') {
    if (appMeta.version) metaParts.push(`App: ${String(appMeta.version).slice(0, 24)}`);
    if (appMeta.lang) metaParts.push(`Lang: ${String(appMeta.lang).slice(0, 10)}`);
  }
  const footer = metaParts.length ? `\n\n---\n${metaParts.join(' · ')}` : '';
  const cleanMessage = `${rawMessage}${footer}`.slice(0, MAX_FEEDBACK_MESSAGE);

  return `mailto:${resolveFeedbackEmail()}?subject=${encodeURIComponent(cleanSubject)}&body=${encodeURIComponent(cleanMessage)}`;
}
