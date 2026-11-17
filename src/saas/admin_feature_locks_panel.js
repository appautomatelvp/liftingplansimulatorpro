// @purpose: Giao diện tab "Feature & 3D Asset Matrix" trong /admin để Admin bật/khóa/bảo trì 3 trạng thái tức thì
import { CMS_LOCK_ITEMS, LOCK_STATES, normalizeFeatureLocksDoc } from './feature_locks_cms.js';
import { escapeHtml } from './session_ui_bindings.js';

function renderMatrixRow({ item, currentState, canEditUsers, busy, tr }) {
  const states = [
    { id: LOCK_STATES.ACTIVE, label: tr('cmsStateActive'), cls: 'is-active-state' },
    { id: LOCK_STATES.TIER_LOCKED, label: tr('cmsStateTierLocked'), cls: 'is-tier-state' },
    { id: LOCK_STATES.UPGRADING, label: tr('cmsStateUpgrading'), cls: 'is-upgrading-state' }
  ];
  const buttons = states.map((s) => {
    const selected = currentState === s.id;
    return `<button type="button" class="saas-cms-state-btn ${s.cls} ${selected ? 'is-selected' : ''}" data-lock-item="${escapeHtml(item.id)}" data-lock-state="${s.id}" ${!canEditUsers || busy ? 'disabled' : ''} aria-pressed="${selected}">${s.label}</button>`;
  }).join('');

  return `<div class="saas-cms-lock-row" data-lock-row="${escapeHtml(item.id)}">
    <div class="saas-cms-lock-meta">
      <strong>${escapeHtml(item.label)}</strong>
      <small>${escapeHtml(item.id)}${item.featureId ? ` · ${escapeHtml(item.featureId)}` : ''}</small>
    </div>
    <div class="saas-cms-lock-pills" role="group" aria-label="${escapeHtml(item.label)}">${buttons}</div>
  </div>`;
}

export function renderFeatureLocksSection({ tr, canEditUsers, featureLocks, locksBusy = false }) {
  const doc = normalizeFeatureLocksDoc(featureLocks);
  const assets = CMS_LOCK_ITEMS.filter((item) => item.group === 'asset');
  const features = CMS_LOCK_ITEMS.filter((item) => item.group === 'feature');

  return `<section class="saas-admin-card" data-section="locks">
    <div class="saas-admin-toolbar">
      <div>
        <h2>${tr('cmsMatrixTitle')}</h2>
        <p class="saas-admin-note">${tr('cmsMatrixDesc')}</p>
      </div>
      <div class="saas-admin-toolbar-actions">
        <button type="button" class="saas-workspace-primary" data-action="save-locks" ${!canEditUsers || locksBusy ? 'disabled' : ''}>${tr('cmsSaveLocks')}</button>
      </div>
    </div>
    <div class="saas-cms-lock-matrix">
      <h3>${tr('cmsGroupAssets')}</h3>
      <div class="saas-cms-lock-list">
        ${assets.map((item) => renderMatrixRow({ item, currentState: doc.locks[item.id], canEditUsers, busy: locksBusy, tr })).join('')}
      </div>
      <h3>${tr('cmsGroupFeatures')}</h3>
      <div class="saas-cms-lock-list">
        ${features.map((item) => renderMatrixRow({ item, currentState: doc.locks[item.id], canEditUsers, busy: locksBusy, tr })).join('')}
      </div>
    </div>
  </section>`;
}
