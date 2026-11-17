// @purpose: Định dạng khóa ngôn ngữ SaaS và hộp thoại góp ý theo ngôn ngữ hiện tại
import { CONTACT_KEYS } from '../i18n/contact_keys.js';
import { TRIAL_CMS_KEYS } from '../i18n/trial_cms_keys.js';
import { getLang, t } from '../i18n/index.js';

/** Format a localized template key from centralized i18n dictionaries with optional `{var}` substitutions. */
export function saasT(key, vars = null, lang = getLang()) {
  const locale = lang === 'vi' ? 'vi' : 'en';
  let text = TRIAL_CMS_KEYS[locale]?.[key] ?? CONTACT_KEYS[locale]?.[key] ?? t(key, locale);
  if (vars && typeof vars === 'object') {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value ?? ''));
    }
  }
  return text;
}
