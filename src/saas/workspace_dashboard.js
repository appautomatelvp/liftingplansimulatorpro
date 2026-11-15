import * as workspaceData from './workspace_data.js';
import * as catalogClient from './catalog_client.js';
import { getTierSlotLimit } from './runtime_flags.js';
import { getLang } from '../i18n/index.js';
import { trapDialogFocus } from './dialog_accessibility.js';
import { saasT } from './i18n.js';
import {
  chooseEquipmentLinksPicker, createWorkspaceSubModal, downloadJsonFile,
  hasPendingLegacyRigs, openCatalogItemPicker, openLegacyRigMigrationPicker,
  readLegacyRigs, readMigratedRigIds, renderEquipmentCard,
  renderEquipmentFormHtml, renderPlanCard, renderWorkspaceDialogHtml
} from './workspace_views.js';

export function mountWorkspaceDashboard({ db, profile, flags = null, dataService = workspaceData, catalogService = catalogClient }) {
  const activeFlags = flags || (typeof window !== 'undefined' ? window.SafeLift?.saas?.flags : null) || null;
  const slotLimit = getTierSlotLimit(profile, activeFlags);
  document.getElementById('saas-workspace-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.id = 'saas-workspace-backdrop';
  backdrop.className = 'saas-workspace-backdrop';
  let tab = 'liftPlans';
  let cursor = null;
  let hasMore = false;
  let busy = false;
  let searchText = '';
  let items = [];
  let pendingTabReload = false;
  let lastExportAt = 0;
  let usageQuota = null;
  let releaseWorkspaceFocus = () => {};
  let onKey = null;
  const legacyRigs = readLegacyRigs();
  const migratedRigIds = readMigratedRigIds(profile.uid);
  const tr = (key, vars = null) => saasT(key, vars, getLang());
  const timestamp = (value) => value?.toDate ? value.toDate().toLocaleDateString({ en: 'en-US', vi: 'vi-VN' }[getLang()] || 'vi-VN') : '';
  const closeWorkspace = () => {
    if (onKey) document.removeEventListener('keydown', onKey);
    backdrop.remove();
    releaseWorkspaceFocus();
  };

  const openLegacyRigPicker = () => openLegacyRigMigrationPicker({ backdrop, legacyRigs, migratedRigIds, profile, db, activeFlags, dataService, tr, loadPage, notice });

  const template = () => {
    backdrop.innerHTML = renderWorkspaceDialogHtml({ tr, slotLimit, showLegacyImport: hasPendingLegacyRigs(legacyRigs, migratedRigIds) });
    paintTab();
  };

  const notice = (message, error = false) => {
    const element = backdrop.querySelector('[data-notice]');
    if (!element) return;
    element.hidden = !message;
    element.classList.toggle('is-error', error);
    element.textContent = message || '';
  };

  function paintTab() {
    backdrop.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === tab));
    const create = backdrop.querySelector('[data-action="create"]');
    if (create) create.textContent = tab === 'liftPlans' ? `＋ ${tr('wsSaveCurrentPlan')}` : `＋ ${tr('wsAddEquipment')}`;
    const fromCatalog = backdrop.querySelector('[data-action="from-catalog"]');
    if (fromCatalog) fromCatalog.hidden = tab !== 'equipment';
    loadPage(true);
  }

  function render() {
    const list = backdrop.querySelector('[data-list]');
    if (!list) return;
    const filtered = items.filter((item) => `${item.title || item.name || ''} ${item.description || ''} ${item.manufacturer || ''} ${item.model || ''}`.toLowerCase().includes(searchText.toLowerCase()));
    if (!filtered.length) {
      list.innerHTML = `<div class="saas-workspace-empty"><span>▱</span><strong>${tr('wsEmptyTitle')}</strong><small>${tr('wsEmptyHint')}</small></div>`;
    } else {
      list.innerHTML = filtered.map((item) => tab === 'liftPlans' ? renderPlanCard(item, { dataService, tr, timestamp }) : renderEquipmentCard(item, { tr })).join('');
    }
    backdrop.querySelector('[data-count]').textContent = tr('wsPageCount', { count: items.length });
    backdrop.querySelector('[data-action="more"]').hidden = !hasMore;
    const quotaEl = backdrop.querySelector('.saas-workspace-quota');
    if (quotaEl) {
      const baseQuota = tr('wsQuotaNote', { limit: slotLimit });
      quotaEl.textContent = usageQuota
        ? `${baseQuota} · ${tr('wsDailyQuotaHint', { used: usageQuota.writesToday, limit: usageQuota.limit, plans: usageQuota.plansCount, equipment: usageQuota.equipmentCount })}`
        : baseQuota;
    }
  }

  const chooseEquipmentLinks = () => chooseEquipmentLinksPicker({ backdrop, db, profile, dataService, tr });

  async function loadPage(reset = false) {
    if (busy) { pendingTabReload = true; return; }
    pendingTabReload = false;
    const requestedTab = tab;
    if (reset) { cursor = null; hasMore = false; items = []; }
    busy = true;
    const list = backdrop.querySelector('[data-list]');
    if (!items.length && list) list.innerHTML = `<div class="saas-workspace-loading">${tr('wsLoadingLibrary')}</div>`;
    try {
      const [page, quota] = await Promise.all([
        dataService.listWorkspacePage(db, profile.uid, requestedTab, { cursor }),
        db && typeof dataService.readUsageQuota === 'function' ? dataService.readUsageQuota(db, profile.uid).catch(() => null) : Promise.resolve(null)
      ]);
      if (requestedTab !== tab) return;
      if (quota) usageQuota = quota;
      items = reset ? page.items : [...items, ...page.items];
      cursor = page.cursor;
      hasMore = page.hasMore;
      notice('');
      render();
    } catch (error) {
      console.error('[SafeLift3D] Workspace library could not be loaded', error);
      notice(tr('wsLoadError'), true);
      if (!items.length && list) list.innerHTML = '';
    } finally {
      busy = false;
      if (pendingTabReload) loadPage(true);
    }
  }

  async function savePlan() {
    const runtime = window.__LIFTING_RUNTIME__;
    const state = runtime?.api?.getState?.();
    if (!state) throw new Error(tr('wsSimNotReadySave'));
    const title = window.prompt(tr('wsPromptPlanName'), `${state.cargoType || 'Lift plan'} · ${new Date().toLocaleDateString()}`);
    if (!title?.trim()) return;
    const description = window.prompt(tr('wsPromptNotes'), '') || '';
    const equipmentIds = await chooseEquipmentLinks();
    const analysis = runtime.api.getCurrentLiftPlanSummary?.() || null;
    await dataService.createLiftPlan(db, profile, { title, description, equipmentIds, snapshot: dataService.makePlanSnapshot(state, analysis), flags: activeFlags });
    notice(tr('wsPlanSaved'));
    await loadPage(true);
  }

  async function openEquipmentForm(item = null) {
    const { layer: formLayer, close } = createWorkspaceSubModal(backdrop, {
      html: renderEquipmentFormHtml(item, { tr }),
      closeSelector: '[data-form-close]',
      initialFocusSelector: 'input[name="name"]'
    });
    formLayer.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      const submit = event.currentTarget.querySelector('[type="submit"]');
      try {
        submit.disabled = true;
        if (item) await dataService.updateEquipment(db, profile.uid, item.id, values);
        else await dataService.createEquipment(db, profile, values, { flags: activeFlags });
        close();
        await loadPage(true);
        notice(tr('wsEquipmentSaved'));
      } catch (error) {
        console.error('[SafeLift3D] Equipment save failed', error);
        const formError = formLayer.querySelector('[data-form-error]');
        formError.hidden = false;
        formError.textContent = error.message || tr('wsEquipmentSaveError');
        if (submit) submit.disabled = false;
      }
    });
  }

  const openCatalogPicker = () => openCatalogItemPicker({ backdrop, db, profile, activeFlags, dataService, catalogService, tr, loadPage, notice });

  async function applyPlan(item) {
    const runtime = window.__LIFTING_RUNTIME__;
    const state = runtime?.api?.getState?.();
    if (!state) throw new Error(tr('wsSimNotReadyOpen'));
    const parsed = dataService.parsePlanSnapshot(item.snapshot);
    const migration = typeof dataService.migrateSnapshot === 'function'
      ? dataService.migrateSnapshot(parsed, parsed.solverVersion || item.solverVersion)
      : { snapshot: parsed, migrated: false, compatible: true, fromVersion: parsed.solverVersion, toVersion: '5.0' };
    const snapshot = migration.snapshot;
    for (const [key, value] of Object.entries(snapshot.inputs)) {
      if (key === 'lugs') continue;
      state[key] = value;
    }
    if (snapshot.inputs.lugs && runtime.deps?.THREE?.Vector3) {
      state.lugs = snapshot.inputs.lugs.map((lug) => new runtime.deps.THREE.Vector3(lug.x, lug.y, lug.z));
    }
    state.pendingConform = 'skip';
    runtime.api.rebuildCargoAndRig?.(false);
    closeWorkspace();
    notice(
      !migration.compatible
        ? tr('wsPlanUnknownVersionNotice', { from: migration.fromVersion })
        : (migration.migrated ? tr('wsPlanMigratedNotice', { from: migration.fromVersion, to: migration.toVersion }) : '')
    );
  }

  async function action(event) {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const actionName = button.dataset.action;
    const id = button.dataset.id;
    const item = items.find((record) => record.id === id);
    try {
      if (actionName === 'close') { closeWorkspace(); return; }
      if (actionName === 'create') { if (tab === 'equipment') await openEquipmentForm(); else await savePlan(); return; }
      if (actionName === 'from-catalog') { await openCatalogPicker(); return; }
      if (actionName === 'import-legacy') { openLegacyRigPicker(); return; }
      if (actionName === 'export-all') {
        button.disabled = true;
        const now = Date.now();
        const bundle = await dataService.exportAllWorkspaceData({ db, profile, lastExportAt, now });
        lastExportAt = now;
        downloadJsonFile(`safelift3d-workspace-${new Date(now).toISOString().slice(0, 10)}.json`, JSON.stringify(bundle, null, 2));
        notice(tr('wsExportAllSuccess', { plans: bundle.liftPlans.length, equipment: bundle.equipment.length }));
        return;
      }
      if (actionName === 'more') { await loadPage(false); return; }
      if (!item) return;
      button.disabled = true;
      if (actionName === 'apply') { await applyPlan(item); return; }
      if (actionName === 'export') {
        const data = JSON.stringify({ schemaVersion: item.schemaVersion, title: item.title, description: item.description, revision: item.revision, solverVersion: item.solverVersion, equipmentIds: item.equipmentIds || [], snapshot: dataService.parsePlanSnapshot(item.snapshot) }, null, 2);
        downloadJsonFile(`${String(item.title || 'safelift3d-lift-plan').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60)}.json`, data);
        return;
      }
      if (actionName === 'edit') { await openEquipmentForm(item); return; }
      if (actionName === 'delete') {
        if (!window.confirm(tr('wsConfirmDelete', { name: item.title || item.name }))) return;
        await dataService.deleteWorkspaceItem(db, profile.uid, tab, id);
      } else if (actionName === 'archive') {
        await dataService.updateLiftPlan(db, profile.uid, id, { archived: button.dataset.archived === 'true' });
      } else if (actionName === 'duplicate') {
        await dataService.createLiftPlan(db, profile, { title: `${item.title} (${tr('wsCopySuffix')})`.slice(0, 100), description: item.description, equipmentIds: item.equipmentIds || [], snapshot: item.snapshot, flags: activeFlags });
      }
      await loadPage(true);
    } catch (error) {
      if (error?.code === 'safelift/export-cooldown') {
        notice(tr('wsExportCooldown', { seconds: error.retryAfterSec }), true);
        return;
      }
      console.error('[SafeLift3D] Workspace action failed', error);
      notice(error.message || tr('wsActionFailed'), true);
    } finally { if (button.isConnected) button.disabled = false; }
  }

  template();
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) { closeWorkspace(); return; }
    const button = event.target.closest('[data-tab]');
    if (button && button.dataset.tab !== tab) {
      tab = button.dataset.tab;
      searchText = '';
      backdrop.querySelector('[data-search]').value = '';
      paintTab();
      return;
    }
    action(event);
  });
  backdrop.addEventListener('input', (event) => {
    if (event.target.matches('[data-search]')) { searchText = event.target.value.trim().toLowerCase(); render(); }
  });
  onKey = (event) => { if (event.key === 'Escape') closeWorkspace(); };
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  releaseWorkspaceFocus = trapDialogFocus(backdrop.querySelector('[role="dialog"]'), { initialFocus: backdrop.querySelector('[data-search]') });
  return { dispose: closeWorkspace };
}
