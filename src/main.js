import './styles/app.css';
import './styles/tablet.css';
import './saas/saas.css';
import { applyDocumentBrand, BRAND, COPYRIGHT } from './saas/branding.js';
import { createI18nApi, getLang, setLang } from './i18n/index.js';
import { bootApp } from './app/boot.js';
import { installUiControllers } from './ui/controllers/index.js';
import { createUiServices } from './ui/services/index.js';
import { installSaasSession } from './saas/session.js';

const i18n = createI18nApi();
applyDocumentBrand(getLang());
window.SafeLift = {
  brand: BRAND,
  copyright: COPYRIGHT,
  i18n,
  saas: { profile: null, authUser: null, db: null, canAccessFeature: () => false }
};

// Align sim state.lang with persisted preference before the authenticated workspace boots.
window.__SAFELIFT_BOOT_LANG__ = getLang();

let runtime = null;
let services = null;
let controllers = null;
let saasSession = null;

function startAuthorizedWorkspace({ profile }) {
  if (runtime) return;
  document.body.classList.add('saas-workspace-authorized');
  document.body.classList.remove('saas-locked');
  runtime = bootApp();
  services = createUiServices(runtime);
  controllers = installUiControllers(runtime, services);
  const state = runtime?.state || runtime?.api?.getState?.();
  if (state && typeof state === 'object') state.lang = getLang();
  console.info(`[${BRAND.name}] Authenticated workspace boot complete`, {
    uid: profile.uid,
    tier: profile.tier,
    role: profile.role,
    lang: getLang(),
    CAE: Object.keys(runtime.deps.CAE || {}),
    GFX: Object.keys(runtime.deps.GFX || {}),
    experimentalPhysicsWorld: runtime.flags.experimentalPhysicsWorld,
    scenarios: runtime.scenarios?.list?.()?.map((scenario) => scenario.id),
    physicsPort: !!runtime.physicsPort
  });
}

function onProfileChange(profile) {
  if (!profile) return;
  document.body.classList.add('saas-workspace-authorized');
  document.body.classList.remove('saas-locked');
  setLang(getLang());
}

function onSignedOut() {
  document.body.classList.add('saas-locked');
}

saasSession = installSaasSession({
  onWorkspaceAuthorized: startAuthorizedWorkspace,
  onProfileChange,
  onSignedOut
});

export { setLang, getLang, i18n, saasSession };
