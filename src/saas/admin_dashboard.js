import { getLang, setLang } from '../i18n/index.js';
import { saasT } from './i18n.js';
import { listUsersPage } from './firebase_data.js';
import { getSessionErrorSummary, normalizeFeatureFlags, readFeatureFlags } from './telemetry_usage.js';
import {
  canAccessCms, canEditUsersAndFlags, canManageCatalog, canReadUsersAndAudit,
  deleteCatalogItem, listAuditLogs, listCatalogItems, saveCatalogItem,
  saveFeatureFlagsWithAudit, setUserAccessWithAudit
} from './cms_data.js';
import {
  CATALOG_QUICK_TEMPLATES, buildAuditCsv, buildUsersCsv, computeAdminKpiSummary,
  filterAuditLogs, filterCatalogList, filterUsersList, toggleModuleInList, triggerCsvDownload
} from './admin_helpers.js';
import {
  EMPTY_CATALOG_DRAFT, catalogDraftFromItem, readCatalogFormPayload, readFlagsFormPayload,
  renderAdminShell, renderAuditSection, renderCatalogSection, renderFlagsSection,
  renderKpiRibbon, renderUnauthorizedAdminCard, renderUserDetailModal, renderUsersSection
} from './admin_panels.js';

export function mountAdminDashboard(container, { db, profile, authUser, signOut }) {
  const root = document.createElement('main');
  root.className = 'saas-admin-screen';
  container.replaceChildren(root);
  let users = []; let nextCursor = null; let pageCursors = [null]; let pageIndex = 0; let hasMore = false;
  let emailPrefix = ''; let loading = false; let status = ''; let error = false;
  let accessReason = ''; let flagsReason = ''; let flags = normalizeFeatureFlags({}); let flagsBusy = false;
  let auditLogs = []; let auditLoading = false; let catalogItems = []; let catalogLoading = false; let catalogBusy = false;
  let catalogDraft = EMPTY_CATALOG_DRAFT();
  let activeSection = 'all'; let inspectedUser = null;
  let userFilters = { role: 'all', tier: 'all', status: 'all' };
  let catalogFilters = { kind: 'all', tier: 'all', query: '' };
  let auditFilters = { action: 'all', query: '' };

  const hasCmsAccess = canAccessCms(profile);
  const canViewUsersAudit = canReadUsersAndAudit(profile);
  const canEditUsers = canEditUsersAndFlags(profile);
  const canEditCatalog = canManageCatalog(profile);
  const envLabel = import.meta.env.VITE_APP_ENV || 'development';

  const preserveFocusRender = (selector) => {
    const active = root.querySelector(selector);
    const pos = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
    render();
    const next = root.querySelector(selector);
    if (next) {
      next.focus();
      if (pos !== null && typeof next.setSelectionRange === 'function') next.setSelectionRange(pos, pos);
    }
  };

  const render = () => {
    const lang = getLang();
    const tr = (key, vars) => saasT(key, vars, lang);
    const errorSummary = getSessionErrorSummary();
    if (!hasCmsAccess) {
      root.innerHTML = renderUnauthorizedAdminCard(tr);
      root.querySelector('[data-action="signout"]')?.addEventListener('click', signOut);
      return;
    }

    const kpi = computeAdminKpiSummary({ users, catalogItems, flags, errorSummary, auditLogs });
    const kpiSection = renderKpiRibbon({ tr, kpi });
    const usersSection = canViewUsersAudit ? [
      activeSection === 'all' || activeSection === 'users'
        ? renderUsersSection({ tr, lang, loading, canEditUsers, users, emailPrefix, accessReason, authUser, pageIndex, hasMore, userFilters }) : '',
      activeSection === 'all' || activeSection === 'config'
        ? renderFlagsSection({ tr, canEditUsers, flags, flagsReason, flagsBusy, errorSummary }) : '',
      activeSection === 'all' || activeSection === 'audit'
        ? renderAuditSection({ tr, auditLoading, auditLogs, auditFilters }) : ''
    ].join('') : '';
    const catalogSection = canEditCatalog && (activeSection === 'all' || activeSection === 'catalog')
      ? renderCatalogSection({ tr, catalogLoading, catalogDraft, catalogBusy, catalogItems, catalogFilters }) : '';
    root.innerHTML = renderAdminShell({
      tr, profile, status, error, usersSection, catalogSection, kpiSection,
      activeSection, flags, envLabel, canViewUsersAudit, canEditCatalog,
      modalHtml: renderUserDetailModal({ tr, user: inspectedUser })
    });

    const on = (sel, evt, fn) => root.querySelector(sel)?.addEventListener(evt, fn);
    const onAll = (sel, evt, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener(evt, (e) => fn(el, e)));
    on('[data-action="signout"]', 'click', signOut);
    on('[data-action="language"]', 'click', () => { setLang(lang === 'en' ? 'vi' : 'en'); render(); });
    onAll('[data-nav-section]', 'click', (btn) => { activeSection = btn.dataset.navSection || 'all'; render(); });
    on('[data-action="refresh"]', 'click', loadUsers);
    on('[data-action="refresh-audit"]', 'click', loadAudit);
    on('[data-action="refresh-catalog"]', 'click', loadCatalog);
    on('#admin-access-reason', 'input', (e) => { accessReason = e.currentTarget.value; });
    on('#admin-flags-reason', 'input', (e) => { flagsReason = e.currentTarget.value; });
    on('[data-filter-role]', 'change', (e) => { userFilters = { ...userFilters, role: e.currentTarget.value }; render(); });
    on('[data-filter-tier]', 'change', (e) => { userFilters = { ...userFilters, tier: e.currentTarget.value }; render(); });
    on('[data-filter-status]', 'change', (e) => { userFilters = { ...userFilters, status: e.currentTarget.value }; render(); });
    on('[data-catalog-search]', 'input', (e) => { catalogFilters = { ...catalogFilters, query: e.currentTarget.value }; preserveFocusRender('[data-catalog-search]'); });
    on('[data-catalog-filter-kind]', 'change', (e) => { catalogFilters = { ...catalogFilters, kind: e.currentTarget.value }; render(); });
    on('[data-catalog-filter-tier]', 'change', (e) => { catalogFilters = { ...catalogFilters, tier: e.currentTarget.value }; render(); });
    on('[data-audit-search]', 'input', (e) => { auditFilters = { ...auditFilters, query: e.currentTarget.value }; preserveFocusRender('[data-audit-search]'); });
    on('[data-audit-filter-action]', 'change', (e) => { auditFilters = { ...auditFilters, action: e.currentTarget.value }; render(); });
    onAll('[data-quick-reason]', 'click', (btn) => {
      accessReason = btn.dataset.quickReason || '';
      const input = root.querySelector('#admin-access-reason');
      if (input) { input.value = accessReason; input.focus(); }
    });
    onAll('[data-inspect-uid]', 'click', (btn) => {
      inspectedUser = users.find((u) => (u.uid || u.id) === btn.dataset.inspectUid) || null;
      render();
    });
    onAll('[data-action="close-user-modal"]', 'click', () => { inspectedUser = null; render(); });
    on('[data-user-modal-backdrop]', 'click', (e) => { if (e.target === e.currentTarget) { inspectedUser = null; render(); } });
    on('[data-copy-uid]', 'click', async (e) => {
      try { await navigator.clipboard?.writeText(e.currentTarget.dataset.copyUid || ''); } catch { /* clipboard optional */ }
      status = tr('cmsUidCopied'); error = false; render();
    });
    on('[data-action="export-users-csv"]', 'click', () => {
      const visible = filterUsersList(users, userFilters);
      triggerCsvDownload('safelift3d-users.csv', buildUsersCsv(visible));
      status = tr('cmsCsvExported', { count: visible.length }); error = false; render();
    });
    on('[data-action="export-audit-csv"]', 'click', () => {
      const visible = filterAuditLogs(auditLogs, auditFilters);
      triggerCsvDownload('safelift3d-audit-logs.csv', buildAuditCsv(visible));
      status = tr('cmsCsvExported', { count: visible.length }); error = false; render();
    });
    onAll('[data-limit-preset]', 'click', (btn) => {
      const formEl = root.querySelector('[data-action="flags-form"]');
      if (formEl) flags = normalizeFeatureFlags(readFlagsFormPayload(new FormData(formEl)));
      flags = { ...flags, freePlanLimit: Number(btn.dataset.limitPreset || 20) };
      render();
    });
    onAll('[data-toggle-module]', 'click', (btn) => {
      const formEl = root.querySelector('[data-action="flags-form"]');
      const draft = formEl ? normalizeFeatureFlags(readFlagsFormPayload(new FormData(formEl))) : flags;
      const toggled = toggleModuleInList(draft.disabledModules, btn.dataset.toggleModule);
      flags = { ...draft, disabledModules: toggled.list };
      render();
    });
    on('[data-action="flags-form"]', 'submit', async (event) => {
      event.preventDefault();
      if (flagsBusy || !canEditUsers) return;
      const form = new FormData(event.currentTarget);
      const reasonInput = String(form.get('flagsReason') || flagsReason || '').trim();
      const beforeFlags = { ...flags };
      flagsBusy = true; render();
      try {
        flags = await saveFeatureFlagsWithAudit(db, authUser.uid, readFlagsFormPayload(form), { reason: reasonInput, beforeFlags });
        flagsReason = ''; status = saasT('adminFlagsSaved'); error = false; loadAudit();
      } catch {
        status = saasT('adminFlagsError'); error = true;
      } finally {
        flagsBusy = false; render();
      }
    });
    on('[data-action="search-form"]', 'submit', (event) => {
      event.preventDefault();
      emailPrefix = root.querySelector('#admin-user-search')?.value.trim().toLowerCase() || '';
      pageIndex = 0; pageCursors = [null]; loadUsers();
    });
    on('[data-action="clear-search"]', 'click', () => {
      emailPrefix = ''; userFilters = { role: 'all', tier: 'all', status: 'all' };
      pageIndex = 0; pageCursors = [null]; loadUsers();
    });
    on('[data-action="previous"]', 'click', () => { if (pageIndex > 0) { pageIndex -= 1; loadUsers(); } });
    on('[data-action="next"]', 'click', () => { if (hasMore && nextCursor) { pageCursors[pageIndex + 1] = nextCursor; pageIndex += 1; loadUsers(); } });
    onAll('[data-tier], [data-status]', 'click', async (button) => {
      if (!canEditUsers) return;
      const cleanReason = String(root.querySelector('#admin-access-reason')?.value || accessReason || '').trim();
      if (!cleanReason) {
        status = saasT('adminReasonRequired'); error = true; render();
        root.querySelector('#admin-access-reason')?.focus(); return;
      }
      const update = button.dataset.tier ? { tier: button.dataset.tier } : { status: button.dataset.status };
      const targetUid = button.dataset.uid;
      const targetUser = users.find((u) => u.uid === targetUid || u.id === targetUid) || null;
      if ((update.status === 'locked' || update.status === 'banned') && typeof window.confirm === 'function') {
        if (!window.confirm(saasT('adminConfirmDangerousStatus', { status: update.status, target: targetUser?.email || targetUid }))) return;
      }
      button.disabled = true;
      try {
        await setUserAccessWithAudit(db, authUser.uid, targetUid, update, { reason: cleanReason, beforeUser: targetUser });
        accessReason = ''; status = saasT('adminAccessUpdated'); error = false;
        await loadUsers(false); loadAudit();
      } catch (e) {
        status = e?.code === 'permission-denied' ? saasT('adminUpdateDenied') : saasT('adminUpdateFailed');
        error = true; render();
      }
    });
    onAll('[data-catalog-template]', 'click', (btn) => {
      const tpl = CATALOG_QUICK_TEMPLATES.find((item) => item.id === btn.dataset.catalogTemplate);
      if (!tpl) return;
      catalogDraft = { id: tpl.id, kind: tpl.kind, title: tpl.title, category: tpl.category, wllT: tpl.wllT, massKg: tpl.massKg, tier: tpl.tier, enabled: tpl.enabled, notes: tpl.notes };
      render();
    });
    on('[data-action="reset-catalog"]', 'click', () => { catalogDraft = EMPTY_CATALOG_DRAFT(); render(); });
    const runCatalogAction = async (errorKey, task) => {
      if (catalogBusy || !canEditCatalog) return;
      catalogBusy = true; render();
      try { await task(); } catch { status = saasT(errorKey); error = true; } finally { catalogBusy = false; render(); }
    };
    on('[data-action="catalog-form"]', 'submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const id = String(form.get('id') || '').trim().toLowerCase();
      const existingItem = catalogItems.find((item) => item.id === id) || null;
      await runCatalogAction('adminCatalogSaveError', async () => {
        const saved = await saveCatalogItem(db, authUser.uid, readCatalogFormPayload(form), { beforeItem: existingItem });
        status = saasT('adminCatalogSaved', { id: saved.id }); error = false;
        catalogDraft = EMPTY_CATALOG_DRAFT(); await loadCatalog(false);
        if (canViewUsersAudit) loadAudit();
      });
    });
    onAll('[data-catalog-edit]', 'click', (button) => {
      const match = catalogItems.find((item) => item.id === button.dataset.catalogEdit);
      if (!match) return;
      catalogDraft = catalogDraftFromItem(match); render();
    });
    onAll('[data-catalog-delete]', 'click', async (button) => {
      const itemId = button.dataset.catalogDelete;
      const existingItem = catalogItems.find((item) => item.id === itemId) || null;
      await runCatalogAction('adminCatalogDeleteError', async () => {
        await deleteCatalogItem(db, authUser.uid, itemId, { beforeItem: existingItem });
        status = saasT('adminCatalogDeleted', { id: itemId }); error = false;
        if (catalogDraft.id === itemId) catalogDraft = EMPTY_CATALOG_DRAFT();
        await loadCatalog(false); if (canViewUsersAudit) loadAudit();
      });
    });
  };

  async function loadUsers(showLoading = true) {
    if (!canViewUsersAudit || loading) return;
    loading = showLoading; if (showLoading) render();
    try {
      const page = await listUsersPage(db, { cursor: pageCursors[pageIndex], emailPrefix });
      users = page.users; nextCursor = page.cursor; hasMore = page.hasMore; error = false;
      if (!status) status = '';
    } catch (e) {
      users = []; nextCursor = null; hasMore = false; error = true;
      status = e?.code === 'permission-denied' ? saasT('adminLoadDenied') : saasT('adminLoadFailed');
    } finally { loading = false; render(); }
  }
  async function runSafeLoad(allowed, isBusy, setBusy, fetchFn, applyFn, showLoading) {
    if (!allowed || isBusy()) return;
    setBusy(showLoading); if (showLoading) render();
    try { applyFn(await fetchFn()); } catch { applyFn([]); } finally { setBusy(false); render(); }
  }
  const loadAudit = (show = true) => runSafeLoad(canViewUsersAudit, () => auditLoading, (v) => { auditLoading = v; }, () => listAuditLogs(db, 20), (rows) => { auditLogs = rows; }, show);
  const loadCatalog = (show = true) => runSafeLoad(canEditCatalog, () => catalogLoading, (v) => { catalogLoading = v; }, () => listCatalogItems(db, 30), (rows) => { catalogItems = rows; }, show);

  render();
  if (canViewUsersAudit) { loadUsers(); loadAudit(); readFeatureFlags(db).then((loaded) => { flags = loaded; render(); }).catch(() => {}); }
  if (canEditCatalog) loadCatalog();
  return { dispose() { root.remove(); } };
}
