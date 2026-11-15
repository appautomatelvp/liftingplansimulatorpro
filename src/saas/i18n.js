import { getLang, t } from '../i18n/index.js';

/** Format a localized template key from `src/i18n/keys.js` with optional `{var}` substitutions. */
export function saasT(key, vars = null, lang = getLang()) {
  let text = t(key, lang);
  if (vars && typeof vars === 'object') {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value ?? ''));
    }
  }
  return text;
}
