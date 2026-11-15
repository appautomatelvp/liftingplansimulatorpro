export const FEEDBACK_EMAIL = 'levietphuong.hcmutrans@gmail.com';
export const MAX_FEEDBACK_SUBJECT = 120;
export const MAX_FEEDBACK_MESSAGE = 3000;
export const FEEDBACK_COOLDOWN_MS = 15_000;

/**
 * Build a validated `mailto:` feedback URI for the Spark Free tier
 * (no Cloud Functions or paid mail relay backend required).
 */
export function buildDeveloperContactMailto({
  subject,
  message,
  lastSentAt = 0,
  now = Date.now(),
  cooldownMs = FEEDBACK_COOLDOWN_MS
} = {}) {
  const cleanSubject = String(subject ?? '').trim().slice(0, MAX_FEEDBACK_SUBJECT);
  const cleanMessage = String(message ?? '').trim().slice(0, MAX_FEEDBACK_MESSAGE);
  if (!cleanSubject || !cleanMessage) {
    throw new Error('Subject and message are required.');
  }
  const elapsed = now - Number(lastSentAt || 0);
  if (lastSentAt > 0 && elapsed < cooldownMs) {
    const retryAfterSec = Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000));
    const err = new Error(`Please wait ${retryAfterSec}s before sending another feedback email.`);
    err.code = 'safelift/feedback-cooldown';
    err.retryAfterSec = retryAfterSec;
    throw err;
  }
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(cleanSubject)}&body=${encodeURIComponent(cleanMessage)}`;
}
