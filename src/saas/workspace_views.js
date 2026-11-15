// @purpose: Các hàm dựng HTML, hộp thoại chọn phụ trợ và di trú dữ liệu rig cũ cho Workspace SaaS
import { safeReadLocalStore, safeWriteLocalStore } from '../utils/localDataStore.js';
import { trapDialogFocus } from './dialog_accessibility.js';

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export function readLegacyRigs() {
  const value = safeReadLocalStore('lp-user-rigs', []);
  return Array.isArray(value) ? value.filter((rig) => rig && typeof rig === 'object' && rig.id != null).slice(0, 24) : [];
}

export function readMigratedRigIds(uid) {
  const value = safeReadLocalStore(`lp-user-rigs-migrated:${uid}`, []);
  return Array.isArray(value) ? value.map(String).slice(0, 24) : [];
}

export function hasPendingLegacyRigs(legacyRigs, migratedRigIds) {
  return legacyRigs.some((rig) => !migratedRigIds.includes(String(rig.id)));
}

export function downloadJsonFile(filename, payload) {
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createWorkspaceSubModal(backdrop, { html, closeSelector, initialFocusSelector, onEscape = null }) {
  const layer = document.createElement('div');
  layer.className = 'saas-workspace-form-backdrop';
  layer.innerHTML = html;
  backdrop.append(layer);
  const releaseFocus = trapDialogFocus(layer.querySelector('[role="dialog"]'), {
    initialFocus: layer.querySelector(initialFocusSelector) || (closeSelector ? layer.querySelector(closeSelector) : null)
  });
  const close = () => { layer.remove(); releaseFocus(); };
  layer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (onEscape) onEscape(); else close();
    }
  });
  layer.addEventListener('click', (event) => {
    if (event.target === layer || (closeSelector && event.target.closest(closeSelector))) {
      if (onEscape) onEscape(); else close();
    }
  });
  return { layer, close };
}

export function renderWorkspaceDialogHtml({ tr, slotLimit, showLegacyImport }) {
  return `<section class="saas-workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="saas-workspace-title">
      <header class="saas-workspace-header"><div><span class="saas-workspace-kicker">SAFELIFT3D · PERSONAL LIBRARY</span><h2 id="saas-workspace-title">${tr('wsTitle')}</h2><p>${tr('wsSubtitle')}</p></div><button type="button" class="saas-workspace-close" data-action="close" aria-label="${tr('saasClose')}">×</button></header>
      <nav class="saas-workspace-tabs"><button type="button" data-tab="liftPlans">${tr('wsTabPlans')}</button><button type="button" data-tab="equipment">${tr('wsTabEquipment')}</button></nav>
      <div class="saas-workspace-toolbar"><label class="saas-workspace-search"><span>⌕</span><input type="search" data-search placeholder="${tr('wsSearchPlaceholder')}"></label><button type="button" class="saas-workspace-secondary" data-action="export-all">${tr('wsExportAllJson')}</button><button type="button" class="saas-workspace-secondary" data-action="import-legacy" ${showLegacyImport ? '' : 'hidden'}>${tr('wsImportTitle')}</button><button type="button" class="saas-workspace-secondary" data-action="from-catalog" hidden>＋ ${tr('wsAddFromCatalog')}</button><button type="button" class="saas-workspace-primary" data-action="create">＋ ${tr('wsSaveCurrentPlan')}</button></div>
      <div class="saas-workspace-notice" data-notice hidden></div><div class="saas-workspace-list" data-list aria-live="polite"></div>
      <footer class="saas-workspace-footer"><span data-count></span><button type="button" data-action="more" hidden>${tr('wsLoadMore')}</button></footer>
      <small class="saas-workspace-quota">${tr('wsQuotaNote', { limit: slotLimit })}</small>
    </section>`;
}

export function renderPlanCard(item, { dataService, tr, timestamp }) {
  const snapshot = (() => { try { return dataService.parsePlanSnapshot(item.snapshot); } catch { return null; } })();
  const migration = snapshot && typeof dataService.migrateSnapshot === 'function'
    ? dataService.migrateSnapshot(snapshot, snapshot.solverVersion || item.solverVersion)
    : null;
  const input = snapshot?.inputs || {};
  const dims = [input.L, input.W, input.H].every(Number.isFinite) ? `${input.L} × ${input.W} × ${input.H} m` : '';
  const status = snapshot?.analysis?.overallStatus;
  const statusLabel = status ? `${tr('wsSavedAssessment')}: ${status}` : '';
  const equipmentCount = Array.isArray(item.equipmentIds) ? item.equipmentIds.length : 0;
  const versionWarning = migration && !migration.compatible
    ? `<em>${tr('wsSolverUnknownWarning')}</em>`
    : (snapshot?.solverVersion !== '5.0' ? `<em>${tr('wsSolverVersionWarning')}</em>` : '');
  return `<article class="saas-workspace-card ${item.archived ? 'is-archived' : ''}"><div class="saas-workspace-card-icon">⌖</div><div class="saas-workspace-card-main"><div class="saas-workspace-card-title"><strong>${escapeHtml(item.title)}</strong><span class="saas-workspace-version">r${Number(item.revision) || 1}</span>${status ? `<span class="saas-workspace-status status-${escapeHtml(status.toLowerCase())}">${escapeHtml(status)}</span>` : ''}${item.archived ? `<span class="saas-workspace-archived">${tr('wsArchived')}</span>` : ''}</div><small>${escapeHtml(item.description || dims || tr('wsPlanDefault'))} · ${tr('wsSolverLabel')} ${escapeHtml(item.solverVersion || '?')} · ${escapeHtml(timestamp(item.updatedAt))}${statusLabel ? ` · ${escapeHtml(statusLabel)}` : ''}${equipmentCount ? ` · ${equipmentCount} ${tr('wsLinkedEquipment')}` : ''}</small>${versionWarning}</div><div class="saas-workspace-card-actions"><button type="button" data-action="apply" data-id="${escapeHtml(item.id)}" ${item.archived ? 'disabled' : ''}>${tr('wsOpen')}</button><button type="button" data-action="duplicate" data-id="${escapeHtml(item.id)}">${tr('wsCopy')}</button><button type="button" data-action="export" data-id="${escapeHtml(item.id)}">${tr('wsExportJson')}</button><button type="button" data-action="archive" data-id="${escapeHtml(item.id)}" data-archived="${!item.archived}">${item.archived ? tr('wsRestore') : tr('wsArchive')}</button><button type="button" class="is-danger" data-action="delete" data-id="${escapeHtml(item.id)}">${tr('wsDelete')}</button></div></article>`;
}

export function renderEquipmentCard(item, { tr }) {
  return `<article class="saas-workspace-card"><div class="saas-workspace-card-icon">⚙</div><div class="saas-workspace-card-main"><div class="saas-workspace-card-title"><strong>${escapeHtml(item.name)}</strong><span class="saas-workspace-version">${escapeHtml(item.category)}</span></div><small>${escapeHtml([item.manufacturer, item.model, item.wllT != null ? `${item.wllT} t WLL` : '', item.lengthM != null ? `${item.lengthM} m` : ''].filter(Boolean).join(' · ') || tr('wsNoSpecs'))}</small>${item.certificateNo || item.inspectionExpiry ? `<small>${tr('wsCertificate')}: ${escapeHtml(item.certificateNo || '—')} · ${tr('wsInspectionExpiry')}: ${escapeHtml(item.inspectionExpiry || '—')}</small>` : ''}</div><div class="saas-workspace-card-actions"><button type="button" data-action="edit" data-id="${escapeHtml(item.id)}">${tr('wsEdit')}</button><button type="button" class="is-danger" data-action="delete" data-id="${escapeHtml(item.id)}">${tr('wsDelete')}</button></div></article>`;
}

export function renderEquipmentFormHtml(item, { tr }) {
  const categories = ['hook', 'sling', 'chain', 'shackle', 'spreader', 'lifting_beam', 'crane', 'other'];
  const field = (name, label, value = '', type = 'text', max = 80) => `<label>${label}<input name="${name}" type="${type}" maxlength="${max}" value="${escapeHtml(value)}" ${name === 'name' ? 'required' : ''}></label>`;
  return `<form class="saas-workspace-form" role="dialog" aria-modal="true" aria-labelledby="saas-equipment-form-title"><button type="button" data-form-close class="saas-workspace-close" aria-label="${tr('saasClose')}">×</button><span class="saas-workspace-kicker">${tr('wsUserDataKicker')}</span><h3 id="saas-equipment-form-title">${item ? tr('wsEditEquipment') : tr('wsAddEquipmentTitle')}</h3><p>${tr('wsUserDataDisclaimer')}</p><div class="saas-workspace-form-error" data-form-error hidden></div>${field('name', tr('wsEquipNameLabel'), item?.name || '', 'text', 80)}<label>${tr('wsEquipTypeLabel')}<select name="category">${categories.map((category) => `<option value="${category}" ${item?.category === category ? 'selected' : ''}>${category.replace('_', ' ')}</option>`).join('')}</select></label>${field('manufacturer', tr('wsManufacturerLabel'), item?.manufacturer)}${field('model', tr('wsModelLabel'), item?.model)}<div class="saas-workspace-form-grid">${field('wllT', 'WLL (t)', item?.wllT ?? '', 'number')}${field('lengthM', tr('wsLengthLabel'), item?.lengthM ?? '', 'number')}${field('massKg', tr('wsMassLabel'), item?.massKg ?? '', 'number')}${field('safetyFactor', tr('wsSafetyFactorLabel'), item?.safetyFactor ?? '', 'number')}</div>${field('certificateNo', tr('wsCertNoLabel'), item?.certificateNo || '')}${field('inspectionExpiry', tr('wsExpiryLabel'), item?.inspectionExpiry || '', 'date', 10)}<label>${tr('wsNotesLabel')}<textarea name="notes" maxlength="500" rows="3">${escapeHtml(item?.notes || '')}</textarea></label><div class="saas-workspace-form-actions"><button type="button" data-form-close>${tr('wsCancel')}</button><button type="submit" class="saas-workspace-primary">${tr('wsSaveEquipment')}</button></div><small>${tr('wsNotesLimitHint')}</small></form>`;
}

export function openLegacyRigMigrationPicker({ backdrop, legacyRigs, migratedRigIds, profile, db, activeFlags, dataService, tr, loadPage, notice }) {
  const pending = legacyRigs.filter((rig) => !migratedRigIds.includes(String(rig.id)));
  if (!pending.length) return;
  const html = `<section class="saas-workspace-form saas-workspace-link-picker" role="dialog" aria-modal="true" aria-label="${tr('wsImportTitle')}"><button type="button" data-picker-close class="saas-workspace-close" aria-label="${tr('saasClose')}">×</button><span class="saas-workspace-kicker">${tr('wsImportKicker')}</span><h3>${tr('wsImportTitle')}</h3><p>${tr('wsImportDesc')}</p><div class="saas-workspace-form-error" data-import-error hidden></div><div class="saas-workspace-link-list">${pending.map((rig) => `<label><span><strong>${escapeHtml(rig.name || tr('wsUnnamedRig'))}</strong><small>${(Array.isArray(rig.extraCables) ? rig.extraCables.length : 0)} ${tr('wsAdditionalCables')}</small></span><button type="button" data-import-rig="${escapeHtml(rig.id)}">${tr('wsImportBtn')}</button></label>`).join('')}</div><small>${tr('wsImportLimitNote')}</small></section>`;
  const { layer, close } = createWorkspaceSubModal(backdrop, { html, closeSelector: '[data-picker-close]', initialFocusSelector: '[data-import-rig]' });
  layer.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-import-rig]');
    if (!button || button.disabled) return;
    const rig = pending.find((item) => String(item.id) === button.dataset.importRig);
    if (!rig) return;
    button.disabled = true;
    try {
      const state = window.__LIFTING_RUNTIME__?.api?.getState?.();
      if (!state) throw new Error(tr('wsSimNotReadyImport'));
      await dataService.createLiftPlan(db, profile, {
        title: String(rig.name || tr('wsSavedRigDefault')).slice(0, 100),
        description: tr('wsImportedDesc'),
        snapshot: dataService.makeLegacyRigSnapshot(state, rig),
        flags: activeFlags
      });
      migratedRigIds.push(String(rig.id));
      safeWriteLocalStore(`lp-user-rigs-migrated:${profile.uid}`, migratedRigIds.slice(-24));
      button.closest('label')?.remove();
      notice(tr('wsImportedNotice', { name: rig.name || 'Rig' }));
      await loadPage(true);
      if (!hasPendingLegacyRigs(legacyRigs, migratedRigIds)) {
        backdrop.querySelector('[data-action="import-legacy"]')?.setAttribute('hidden', '');
        close();
      }
    } catch (error) {
      console.error('[SafeLift3D] Legacy rig migration failed', error);
      const errorBox = layer.querySelector('[data-import-error]');
      if (errorBox) { errorBox.hidden = false; errorBox.textContent = error.message || tr('wsImportFailed'); }
      button.disabled = false;
    }
  });
}

export async function chooseEquipmentLinksPicker({ backdrop, db, profile, dataService, tr }) {
  let page = await dataService.listWorkspacePage(db, profile.uid, 'equipment');
  const equipment = [...page.items];
  while (page.hasMore) {
    page = await dataService.listWorkspacePage(db, profile.uid, 'equipment', { cursor: page.cursor });
    equipment.push(...page.items);
    if (equipment.length >= 200) break;
  }
  if (!equipment.length) return [];
  return new Promise((resolve) => {
    const html = `<form class="saas-workspace-form saas-workspace-link-picker" role="dialog" aria-modal="true" aria-labelledby="saas-equipment-picker-title"><button type="button" data-picker-cancel class="saas-workspace-close" aria-label="${tr('saasClose')}">×</button><span class="saas-workspace-kicker">${tr('wsEquipKicker')}</span><h3 id="saas-equipment-picker-title">${tr('wsEquipAttachTitle')}</h3><p>${tr('wsEquipAttachHint')}</p><div class="saas-workspace-link-list">${equipment.map((item) => `<label><input type="checkbox" name="equipmentIds" value="${escapeHtml(item.id)}"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml([item.category, item.model, item.wllT != null ? `${item.wllT} t WLL` : ''].filter(Boolean).join(' · '))}</small></span></label>`).join('')}</div><div class="saas-workspace-form-actions"><button type="button" data-picker-cancel>${tr('wsSkip')}</button><button type="submit" class="saas-workspace-primary">${tr('wsAttachToPlan')}</button></div></form>`;
    let closeModal = () => {};
    const finish = (value) => { closeModal(); resolve(value); };
    const { layer, close } = createWorkspaceSubModal(backdrop, { html, closeSelector: '[data-picker-cancel]', initialFocusSelector: '[data-picker-cancel]', onEscape: () => finish([]) });
    closeModal = close;
    layer.querySelectorAll('[name="equipmentIds"]').forEach((cb) => cb.addEventListener('change', () => {
      if (layer.querySelectorAll('[name="equipmentIds"]:checked').length > 20) cb.checked = false;
    }));
    layer.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      finish(Array.from(layer.querySelectorAll('[name="equipmentIds"]:checked')).map((input) => input.value));
    });
  });
}

export async function openCatalogItemPicker({ backdrop, db, profile, activeFlags, dataService, catalogService, tr, loadPage, notice }) {
  const html = `<div class="saas-workspace-form" role="dialog" aria-modal="true" aria-labelledby="saas-catalog-picker-title"><button type="button" data-form-close class="saas-workspace-close" aria-label="${tr('wsCatalogClose')}">×</button><span class="saas-workspace-kicker">${tr('wsUserDataKicker')}</span><h3 id="saas-catalog-picker-title">${tr('wsCatalogModalTitle')}</h3><p>${tr('wsCatalogModalSubtitle')}</p><div class="saas-workspace-form-error" data-form-error hidden></div><div class="saas-workspace-list" data-catalog-list>${tr('saasLoading')}</div><div class="saas-workspace-form-actions"><button type="button" data-form-close>${tr('wsCatalogClose')}</button></div></div>`;
  const { layer, close } = createWorkspaceSubModal(backdrop, { html, closeSelector: '[data-form-close]', initialFocusSelector: '[data-form-close]' });
  const listEl = layer.querySelector('[data-catalog-list]');
  const catalogItems = await catalogService.loadCatalogForUser(db, profile);
  if (!layer.isConnected || !listEl) return;
  if (!catalogItems.length) {
    listEl.innerHTML = `<div class="saas-workspace-empty"><span>▱</span><strong>${tr('wsCatalogEmpty')}</strong></div>`;
    return;
  }
  listEl.innerHTML = catalogItems.map((catItem) => {
    const specs = [catItem.kind, catItem.category, catItem.wllT != null ? `${catItem.wllT} t WLL` : '', catItem.massKg != null ? `${catItem.massKg} kg` : '', catItem.tier].filter(Boolean).join(' · ');
    return `<article class="saas-workspace-card"><div class="saas-workspace-card-icon">⚙</div><div class="saas-workspace-card-main"><div class="saas-workspace-card-title"><strong>${escapeHtml(catItem.title || catItem.id)}</strong><span class="saas-workspace-version">${escapeHtml(catItem.tier || 'free')}</span></div><small>${escapeHtml(specs)}</small>${catItem.notes ? `<small>${escapeHtml(catItem.notes)}</small>` : ''}</div><div class="saas-workspace-card-actions"><button type="button" class="saas-workspace-primary" data-add-catalog="${escapeHtml(catItem.id)}">${tr('wsCatalogAddItem')}</button></div></article>`;
  }).join('');
  listEl.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-add-catalog]');
    if (!btn || btn.disabled) return;
    const catItem = catalogItems.find((entry) => entry.id === btn.dataset.addCatalog);
    if (!catItem) return;
    btn.disabled = true;
    try {
      await dataService.createEquipment(db, profile, catalogService.mapCatalogItemToEquipmentInput(catItem), { flags: activeFlags });
      close();
      await loadPage(true);
      notice(tr('wsCatalogAdded', { title: catItem.title || catItem.id }));
    } catch (error) {
      const formError = layer.querySelector('[data-form-error]');
      if (formError) { formError.hidden = false; formError.textContent = error.message || tr('wsEquipmentSaveError'); }
      if (btn.isConnected) btn.disabled = false;
    }
  });
}
