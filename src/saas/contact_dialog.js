// @purpose: Hộp thoại gửi email góp ý & hỗ trợ chống bot/spam đa lớp, ẩn email cho tới khi khách xác minh gửi
import { getLang } from '../i18n/index.js';
import { BRAND, COPYRIGHT } from './branding.js';
import { trapDialogFocus } from './dialog_accessibility.js';
import {
  buildDeveloperContactMailto,
  createContactChallenge,
  recordFeedbackSubmission,
  resolveFeedbackEmail
} from './feedback.js';
import { saasT } from './i18n.js';

const CATEGORY_KEYS = [
  ['feedback', 'contactCatFeedback'],
  ['bug', 'contactCatBug'],
  ['enterprise', 'contactCatEnterprise'],
  ['other', 'contactCatOther']
];

const ERROR_KEY_MAP = {
  'safelift/feedback-bot-blocked': 'contactErrBot',
  'safelift/feedback-too-fast': 'contactErrFast',
  'safelift/feedback-challenge-failed': 'contactErrChallenge',
  'safelift/feedback-required': 'contactErrRequired',
  'safelift/feedback-too-short': 'contactErrShort',
  'safelift/feedback-spam-links': 'contactErrLinks',
  'safelift/feedback-cooldown': 'contactErrCooldown',
  'safelift/feedback-hourly-limit': 'contactErrHourly'
};

function escapeAttr(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

let lastFeedbackAt = 0;

export function openDeveloperContact({ category = 'feedback', subject = '' } = {}) {
  const lang = getLang();
  const tr = (key, vars = null) => saasT(key, vars, lang);
  const openedAt = Date.now();
  let challenge = createContactChallenge();

  document.getElementById('saas-contact-dialog')?.remove();
  const dialog = document.createElement('div');
  dialog.id = 'saas-contact-dialog';
  dialog.className = 'saas-contact-backdrop';

  const catOptions = CATEGORY_KEYS
    .map(([val, labelKey]) => `<option value="${val}" ${val === category ? 'selected' : ''}>${escapeAttr(tr(labelKey))}</option>`)
    .join('');

  dialog.innerHTML = `<section class="saas-contact-dialog" role="dialog" aria-modal="true" aria-labelledby="saas-contact-title">
    <button type="button" class="saas-contact-close" aria-label="${escapeAttr(tr('saasClose'))}" data-contact-close>×</button>
    <div class="saas-contact-kicker">${tr('contactKicker')}</div>
    <h2 id="saas-contact-title">${tr('contactTitle')}</h2>
    <div class="saas-contact-identity">
      <p class="saas-contact-person">${escapeAttr(COPYRIGHT.developer)}</p>
      <span class="saas-contact-shield">${tr('contactShieldBadge')}</span>
    </div>
    <form class="saas-contact-form" novalidate>
      <label>${tr('contactCategoryLabel')}<select name="category">${catOptions}</select></label>
      <label>${tr('contactSubjectLabel')}<input name="subject" maxlength="120" required value="${escapeAttr(subject || tr('contactSubjectDefault'))}"></label>
      <label>${tr('contactSenderLabel')}<input name="senderContact" maxlength="120" placeholder="${escapeAttr(tr('contactSenderPlaceholder'))}"></label>
      <label>${tr('contactMessageLabel')}<textarea name="message" maxlength="3000" minlength="10" rows="4" required placeholder="${escapeAttr(tr('contactMessagePlaceholder'))}"></textarea></label>
      <div class="saas-hp-field" aria-hidden="true"><label>Website<input name="website" type="text" tabindex="-1" autocomplete="off"></label></div>
      <div class="saas-contact-verify-row">
        <label class="saas-contact-verify-field">${tr('contactVerifyLabel')}: <strong data-challenge-prompt>${escapeAttr(challenge.prompt)}</strong>
          <input name="challengeAnswer" inputmode="numeric" maxlength="6" autocomplete="off" required placeholder="${escapeAttr(tr('contactVerifyPlaceholder'))}">
        </label>
        <button type="button" class="saas-secondary-button" data-refresh-challenge>${tr('contactRefreshChallenge')}</button>
      </div>
      <div class="saas-contact-status" role="status" aria-live="polite" hidden></div>
      <small>${tr('contactPrivacyHint')}</small>
      <button type="submit" class="saas-primary-button">${tr('contactSubmit')}</button>
    </form>
  </section>`;

  let releaseFocusTrap = () => {};
  const close = () => {
    dialog.remove();
    releaseFocusTrap();
  };

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target.closest('[data-contact-close]')) close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  const formEl = dialog.querySelector('form');
  const statusEl = dialog.querySelector('.saas-contact-status');
  const promptEl = dialog.querySelector('[data-challenge-prompt]');
  const answerEl = dialog.querySelector('[name="challengeAnswer"]');

  const setStatus = (msg, isError) => {
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg;
    statusEl.classList.toggle('is-error', Boolean(isError));
    statusEl.classList.toggle('is-ok', !isError && Boolean(msg));
  };

  const rotateChallenge = () => {
    challenge = createContactChallenge();
    if (promptEl) promptEl.textContent = challenge.prompt;
    if (answerEl) answerEl.value = '';
  };

  dialog.querySelector('[data-refresh-challenge]')?.addEventListener('click', () => rotateChallenge());

  formEl?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const now = Date.now();
    try {
      const href = buildDeveloperContactMailto({
        category: String(form.get('category') || ''),
        subject: form.get('subject'),
        senderContact: form.get('senderContact'),
        message: form.get('message'),
        honeypot: form.get('website'),
        openedAt,
        challenge,
        challengeAnswer: form.get('challengeAnswer'),
        lastSentAt: lastFeedbackAt,
        now,
        appMeta: { version: BRAND.versionLabel, lang }
      });
      lastFeedbackAt = now;
      recordFeedbackSubmission(now);
      const revealedEmail = resolveFeedbackEmail();

      formEl.innerHTML = `<div class="saas-contact-status is-ok" role="status"><strong>${tr('contactSentTitle')}</strong><p>${tr('contactSentHint')}</p><code data-verified-email></code></div>
        <div class="saas-contact-post-actions">
          <a class="saas-primary-button" data-reopen-mail>${tr('contactReopenMail')}</a>
          <button type="button" class="saas-secondary-button" data-copy-email>${tr('contactCopyEmail')}</button>
          <button type="button" class="saas-secondary-button" data-contact-close>${tr('contactDoneClose')}</button>
        </div>`;
      const emailCode = formEl.querySelector('[data-verified-email]');
      if (emailCode) emailCode.textContent = revealedEmail;
      const reopenLink = formEl.querySelector('[data-reopen-mail]');
      if (reopenLink) reopenLink.setAttribute('href', href);
      formEl.querySelector('[data-copy-email]')?.addEventListener('click', async (btnEv) => {
        try {
          await navigator.clipboard?.writeText(revealedEmail);
          btnEv.currentTarget.textContent = tr('contactCopied');
        } catch {
          /* Clipboard unavailable in non-HTTPS contexts; visible <code> remains selectable. */
        }
      });
      window.location.href = href;
    } catch (err) {
      const key = ERROR_KEY_MAP[err?.code] || 'contactErrRequired';
      setStatus(tr(key, { sec: err?.retryAfterSec ?? 1, min: err?.retryAfterMin ?? 1 }), true);
      if (err?.code === 'safelift/feedback-challenge-failed') rotateChallenge();
    }
  });

  document.body.append(dialog);
  releaseFocusTrap = trapDialogFocus(dialog.querySelector('[role="dialog"]'), {
    initialFocus: dialog.querySelector('[name="message"]')
  });
}
