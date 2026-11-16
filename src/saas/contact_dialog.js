// @purpose: Hộp thoại Liên hệ & Góp ý kỹ thuật chuẩn Enterprise với khóa trượt xác nhận hành vi chống bot
import { getLang } from '../i18n/index.js';
import { BRAND, COPYRIGHT } from './branding.js';
import { trapDialogFocus } from './dialog_accessibility.js';
import {
  buildDeveloperContactMailto,
  createContactChallenge,
  recordFeedbackSubmission,
  resolveFeedbackEmail,
  sealGestureProof
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
  let proofToken = '';
  let gestureStart = 0;
  let gestureSteps = 0;
  let lastProgress = 0;
  let holdRaf = 0;

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
      <span class="saas-contact-role">${tr('contactRoleBadge')}</span>
    </div>
    <form class="saas-contact-form" novalidate>
      <label>${tr('contactCategoryLabel')}<select name="category">${catOptions}</select></label>
      <label>${tr('contactSubjectLabel')}<input name="subject" maxlength="120" required value="${escapeAttr(subject || tr('contactSubjectDefault'))}"></label>
      <label>${tr('contactSenderLabel')}<input name="senderContact" maxlength="120" placeholder="${escapeAttr(tr('contactSenderPlaceholder'))}"></label>
      <label>${tr('contactMessageLabel')}<textarea name="message" maxlength="3000" minlength="10" rows="4" required placeholder="${escapeAttr(tr('contactMessagePlaceholder'))}"></textarea></label>
      <div class="saas-hp-field" aria-hidden="true"><label>Website<input name="website" type="text" tabindex="-1" autocomplete="off"></label></div>
      <div class="saas-interlock-wrap">
        <span class="saas-interlock-caption">${tr('contactVerifyLabel')}</span>
        <div class="saas-interlock" data-interlock>
          <div class="saas-interlock-fill" data-interlock-fill></div>
          <span class="saas-interlock-text" data-interlock-text>${tr('contactSlidePrompt')}</span>
          <div class="saas-interlock-thumb" data-interlock-thumb aria-hidden="true">⇥</div>
          <input type="range" name="interlockSlider" min="0" max="100" value="0" aria-label="${escapeAttr(tr('contactSlidePrompt'))}">
        </div>
      </div>
      <div class="saas-contact-status" role="status" aria-live="polite" hidden></div>
      <small>${tr('contactPrivacyHint')}</small>
      <button type="submit" class="saas-primary-button">${tr('contactSubmit')}</button>
    </form>
  </section>`;

  let releaseFocusTrap = () => {};
  const close = () => {
    if (holdRaf) cancelAnimationFrame(holdRaf);
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
  const interlockEl = dialog.querySelector('[data-interlock]');
  const fillEl = dialog.querySelector('[data-interlock-fill]');
  const textEl = dialog.querySelector('[data-interlock-text]');
  const thumbEl = dialog.querySelector('[data-interlock-thumb]');
  const sliderEl = dialog.querySelector('input[name="interlockSlider"]');

  const setStatus = (msg, isError) => {
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg;
    statusEl.classList.toggle('is-error', Boolean(isError));
    statusEl.classList.toggle('is-ok', !isError && Boolean(msg));
  };

  const updateSliderVisual = (pct) => {
    const clamped = Math.max(0, Math.min(100, pct));
    if (fillEl) fillEl.style.width = `${clamped}%`;
    if (thumbEl) thumbEl.style.left = `calc(${clamped}% - ${(clamped / 100) * 42}px)`;
  };

  const resetInterlock = () => {
    challenge = createContactChallenge();
    proofToken = '';
    gestureStart = 0;
    gestureSteps = 0;
    lastProgress = 0;
    if (sliderEl) {
      sliderEl.disabled = false;
      sliderEl.value = '0';
    }
    interlockEl?.classList.remove('is-verified');
    if (textEl) textEl.textContent = tr('contactSlidePrompt');
    if (thumbEl) thumbEl.textContent = '⇥';
    updateSliderVisual(0);
  };

  const processSlideStep = (nextVal) => {
    if (proofToken) return;
    const now = Date.now();
    if (!gestureStart || nextVal <= 4) {
      gestureStart = now;
      gestureSteps = 0;
      lastProgress = 0;
    }
    const delta = nextVal - lastProgress;
    if (delta > 48 && gestureSteps < 2) {
      resetInterlock();
      return;
    }
    if (nextVal > lastProgress) {
      gestureSteps += 1;
      lastProgress = nextVal;
    }
    updateSliderVisual(nextVal);
    if (nextVal >= 96) {
      const token = sealGestureProof(challenge, {
        progress: nextVal,
        steps: gestureSteps,
        durationMs: Math.max(240, now - gestureStart)
      });
      if (token) {
        proofToken = token;
        if (sliderEl) {
          sliderEl.value = '100';
          sliderEl.disabled = true;
        }
        updateSliderVisual(100);
        interlockEl?.classList.add('is-verified');
        if (textEl) textEl.textContent = tr('contactSlideVerified');
        if (thumbEl) thumbEl.textContent = '✓';
        setStatus('', false);
      } else {
        resetInterlock();
      }
    }
  };

  sliderEl?.addEventListener('input', () => processSlideStep(Number(sliderEl.value || 0)));
  sliderEl?.addEventListener('change', () => {
    if (!proofToken) resetInterlock();
  });
  sliderEl?.addEventListener('keydown', (ev) => {
    if (proofToken || (ev.key !== ' ' && ev.key !== 'Enter')) return;
    ev.preventDefault();
    if (holdRaf) return;
    const tick = () => {
      if (proofToken) { holdRaf = 0; return; }
      const next = Math.min(100, lastProgress + 6);
      if (sliderEl) sliderEl.value = String(next);
      processSlideStep(next);
      if (!proofToken) holdRaf = requestAnimationFrame(tick);
      else holdRaf = 0;
    };
    holdRaf = requestAnimationFrame(tick);
  });
  sliderEl?.addEventListener('keyup', () => {
    if (holdRaf) { cancelAnimationFrame(holdRaf); holdRaf = 0; }
    if (!proofToken) resetInterlock();
  });

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
        challengeAnswer: proofToken,
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
      if (err?.code === 'safelift/feedback-challenge-failed') resetInterlock();
    }
  });

  document.body.append(dialog);
  releaseFocusTrap = trapDialogFocus(dialog.querySelector('[role="dialog"]'), {
    initialFocus: dialog.querySelector('[name="message"]')
  });
}
