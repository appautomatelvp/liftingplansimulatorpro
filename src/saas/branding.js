/**
 * SafeLift3D — product identity & ownership (Phase 1 SaaS shell).
 * Keep UI/code copyright consistent with this module.
 */

export const BRAND = {
  name: 'SafeLift3D',
  nameUpper: 'SAFELIFT3D',
  tagline: {
    en: 'Heavy Rigging & Lift Planner · CAE Digital Twin',
    vi: 'Mô phỏng nâng hạ & lập phương án · Digital Twin CAE'
  },
  shortTagline: {
    en: 'Professional lifting plan simulator',
    vi: 'Phần mềm mô phỏng phương án nâng hạ chuyên nghiệp'
  },
  domain: 'safelift3d.com',
  versionLabel: 'V5.0',
  standardsLine: 'ASME P30.1 · B30.9 / B30.20 · BTH-1'
};

export const COPYRIGHT = {
  developer: 'Lê Việt Phương (Mr)',
  line(year = new Date().getFullYear()) {
    return `© ${year} ${BRAND.name} · Developed by ${this.developer}`;
  }
};

export function applyDocumentBrand(lang = 'en') {
  if (typeof document === 'undefined') return;
  const locale = lang === 'vi' ? 'vi' : 'en';
  const tagline = BRAND.shortTagline[locale];
  const developedBy = locale === 'vi' ? 'Phát triển bởi' : 'Developed by';
  document.documentElement.lang = locale;
  document.title = `${BRAND.name} — ${tagline}`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute(
      'content',
      `${BRAND.name}: ${tagline}. ${developedBy} ${COPYRIGHT.developer}.`
    );
  }
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', BRAND.name);
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) ogDescription.setAttribute('content', BRAND.tagline[locale]);
  const ogLocale = document.querySelector('meta[property="og:locale"]');
  if (ogLocale) ogLocale.setAttribute('content', locale === 'vi' ? 'vi_VN' : 'en_US');
}
