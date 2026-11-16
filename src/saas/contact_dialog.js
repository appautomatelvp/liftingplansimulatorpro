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

const COPY = {
  vi: {
    kicker: 'SAFELIFT3D · HỖ TRỢ & GÓP Ý',
    title: 'Gửi góp ý cho nhà phát triển',
    shieldBadge: 'Bảo vệ chống spam · Ẩn email công khai',
    categoryLabel: 'Chủ đề hỗ trợ',
    categories: {
      feedback: 'Góp ý cải tiến sản phẩm',
      bug: 'Báo lỗi kỹ thuật / 3D',
      enterprise: 'Tư vấn gói Enterprise / Mở khóa tính năng',
      other: 'Hợp tác & Trao đổi khác'
    },
    subjectLabel: 'Tiêu đề',
    subjectDefault: 'Góp ý SafeLift3D',
    senderLabel: 'Email hoặc tên liên hệ của bạn (tùy chọn)',
    senderPlaceholder: 'Để lại email hoặc công ty nếu muốn được phản hồi…',
    messageLabel: 'Nội dung chi tiết',
    messagePlaceholder: 'Mô tả góp ý, tình huống nâng hạ hoặc vấn đề bạn gặp phải (tối thiểu 10 ký tự)…',
    verifyLabel: 'Xác minh người thật',
    verifyPlaceholder: 'Nhập kết quả',
    refreshChallenge: 'Đổi câu hỏi',
    hint: 'Email nhà phát triển được ẩn để chống bot tự động và chỉ chuyển sang ứng dụng email của bạn sau khi xác minh.',
    submit: 'Xác minh & Mở ứng dụng email',
    close: 'Đóng',
    sentTitle: 'Đã sẵn sàng gửi qua ứng dụng email của bạn',
    sentHint: 'Nếu trình duyệt chưa tự mở hộp thư, bạn có thể bấm mở lại hoặc sao chép địa chỉ nhận bên dưới:',
    reopenMail: 'Mở lại ứng dụng email',
    copyEmail: 'Sao chép địa chỉ email',
    copied: 'Đã sao chép địa chỉ email!',
    doneClose: 'Đóng hộp thoại',
    errors: {
      'safelift/feedback-bot-blocked': 'Yêu cầu không hợp lệ đã bị chặn bởi bộ lọc tự động.',
      'safelift/feedback-too-fast': 'Vui lòng kiểm tra kỹ nội dung thêm vài giây trước khi gửi.',
      'safelift/feedback-challenge-failed': 'Đáp án xác minh chưa đúng. Vui lòng tính lại câu hỏi mới.',
      'safelift/feedback-required': 'Vui lòng nhập đầy đủ tiêu đề và nội dung.',
      'safelift/feedback-too-short': 'Nội dung cần tối thiểu 10 ký tự có nghĩa.',
      'safelift/feedback-spam-links': 'Nội dung chứa quá nhiều liên kết (tối đa 2 link).',
      'safelift/feedback-cooldown': 'Vui lòng chờ thêm {sec} giây trước khi gửi tiếp.',
      'safelift/feedback-hourly-limit': 'Bạn đã đạt giới hạn 3 lần gửi/giờ. Thử lại sau {min} phút.'
    }
  },
  en: {
    kicker: 'SAFELIFT3D · FEEDBACK & SUPPORT',
    title: 'Send Feedback to Developer',
    shieldBadge: 'Anti-Spam Protected · Private Address',
    categoryLabel: 'Topic',
    categories: {
      feedback: 'Product improvement feedback',
      bug: 'Technical / 3D issue report',
      enterprise: 'Enterprise plan / Feature access',
      other: 'Partnership & other inquiries'
    },
    subjectLabel: 'Subject',
    subjectDefault: 'SafeLift3D feedback',
    senderLabel: 'Your reply email or company (optional)',
    senderPlaceholder: 'Optional email or company for follow-up…',
    messageLabel: 'Message details',
    messagePlaceholder: 'Describe your lifting scenario, feedback, or issue (minimum 10 characters)…',
    verifyLabel: 'Human verification',
    verifyPlaceholder: 'Answer',
    refreshChallenge: 'New question',
    hint: 'Developer contact details stay hidden from scrapers and open in your mail client only after verification.',
    submit: 'Verify & Open Email Client',
    close: 'Close',
    sentTitle: 'Ready to send in your email client',
    sentHint: 'If your mail app did not open automatically, reopen it or copy the verified support address below:',
    reopenMail: 'Open email client again',
    copyEmail: 'Copy support email',
    copied: 'Support email copied!',
    doneClose: 'Close dialog',
    errors: {
      'safelift/feedback-bot-blocked': 'Automated submission was blocked by anti-spam protection.',
      'safelift/feedback-too-fast': 'Please take a moment to review your message before sending.',
      'safelift/feedback-challenge-failed': 'Incorrect verification answer. Please solve the refreshed question.',
      'safelift/feedback-required': 'Please fill in both subject and message.',
      'safelift/feedback-too-short': 'Please enter at least 10 characters in your message.',
      'safelift/feedback-spam-links': 'Too many URLs detected in message (maximum 2 links).',
      'safelift/feedback-cooldown': 'Please wait {sec}s before sending another message.',
      'safelift/feedback-hourly-limit': 'Hourly limit (3 messages/hour) reached. Try again in {min}m.'
    }
  }
};

function escapeAttr(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function formatError(err, copy) {
  const tpl = copy.errors[err?.code] || err?.message || copy.errors['safelift/feedback-required'];
  return tpl
    .replaceAll('{sec}', String(err?.retryAfterSec ?? 1))
    .replaceAll('{min}', String(err?.retryAfterMin ?? 1));
}

let lastFeedbackAt = 0;

export function openDeveloperContact({ category = 'feedback', subject = '' } = {}) {
  const lang = getLang() === 'en' ? 'en' : 'vi';
  const copy = COPY[lang];
  const openedAt = Date.now();
  let challenge = createContactChallenge();

  document.getElementById('saas-contact-dialog')?.remove();
  const dialog = document.createElement('div');
  dialog.id = 'saas-contact-dialog';
  dialog.className = 'saas-contact-backdrop';

  const catOptions = Object.entries(copy.categories)
    .map(([key, label]) => `<option value="${key}" ${key === category ? 'selected' : ''}>${escapeAttr(label)}</option>`)
    .join('');

  dialog.innerHTML = `<section class="saas-contact-dialog" role="dialog" aria-modal="true" aria-labelledby="saas-contact-title">
    <button type="button" class="saas-contact-close" aria-label="${escapeAttr(copy.close)}" data-contact-close>×</button>
    <div class="saas-contact-kicker">${copy.kicker}</div>
    <h2 id="saas-contact-title">${copy.title}</h2>
    <div class="saas-contact-identity">
      <p class="saas-contact-person">${escapeAttr(COPYRIGHT.developer)}</p>
      <span class="saas-contact-shield">${copy.shieldBadge}</span>
    </div>
    <form class="saas-contact-form" novalidate>
      <label>${copy.categoryLabel}<select name="category">${catOptions}</select></label>
      <label>${copy.subjectLabel}<input name="subject" maxlength="120" required value="${escapeAttr(subject || copy.subjectDefault)}"></label>
      <label>${copy.senderLabel}<input name="senderContact" maxlength="120" placeholder="${escapeAttr(copy.senderPlaceholder)}"></label>
      <label>${copy.messageLabel}<textarea name="message" maxlength="3000" minlength="10" rows="4" required placeholder="${escapeAttr(copy.messagePlaceholder)}"></textarea></label>
      <div class="saas-hp-field" aria-hidden="true"><label>Website<input name="website" type="text" tabindex="-1" autocomplete="off"></label></div>
      <div class="saas-contact-verify-row">
        <label class="saas-contact-verify-field">${copy.verifyLabel}: <strong data-challenge-prompt>${escapeAttr(challenge.prompt)}</strong>
          <input name="challengeAnswer" inputmode="numeric" maxlength="6" autocomplete="off" required placeholder="${escapeAttr(copy.verifyPlaceholder)}">
        </label>
        <button type="button" class="saas-secondary-button" data-refresh-challenge>${copy.refreshChallenge}</button>
      </div>
      <div class="saas-contact-status" role="status" aria-live="polite" hidden></div>
      <small>${copy.hint}</small>
      <button type="submit" class="saas-primary-button">${copy.submit}</button>
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

      formEl.innerHTML = `<div class="saas-contact-status is-ok" role="status"><strong>${copy.sentTitle}</strong><p>${copy.sentHint}</p><code data-verified-email></code></div>
        <div class="saas-contact-post-actions">
          <a class="saas-primary-button" data-reopen-mail>${copy.reopenMail}</a>
          <button type="button" class="saas-secondary-button" data-copy-email>${copy.copyEmail}</button>
          <button type="button" class="saas-secondary-button" data-contact-close>${copy.doneClose}</button>
        </div>`;
      const emailCode = formEl.querySelector('[data-verified-email]');
      if (emailCode) emailCode.textContent = revealedEmail;
      const reopenLink = formEl.querySelector('[data-reopen-mail]');
      if (reopenLink) reopenLink.setAttribute('href', href);
      formEl.querySelector('[data-copy-email]')?.addEventListener('click', async (btnEv) => {
        try {
          await navigator.clipboard?.writeText(revealedEmail);
          btnEv.currentTarget.textContent = copy.copied;
        } catch {
          /* Clipboard unavailable in non-HTTPS contexts; visible <code> remains selectable. */
        }
      });
      window.location.href = href;
    } catch (err) {
      setStatus(formatError(err, copy), true);
      if (err?.code === 'safelift/feedback-challenge-failed') rotateChallenge();
    }
  });

  document.body.append(dialog);
  releaseFocusTrap = trapDialogFocus(dialog.querySelector('[role="dialog"]'), {
    initialFocus: dialog.querySelector('[name="message"]')
  });
}
