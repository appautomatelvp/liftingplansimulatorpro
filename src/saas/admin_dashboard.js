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
  EMPTY_CATALOG_DRAFT, catalogDraftFromItem, readCatalogFormPayload, readFlagsFormPayload,
  renderAdminShell, renderCatalogSection, renderUnauthorizedAdminCard, renderUsersAndFlagsSections
} from './admin_panels.js';

export function mountAdminDashboard(container, { db, profile, authUser, signOut }) {
  const root = document.createElement('main');
  root.className = 'saas-admin-screen';
  container.replaceChildren(root);
  let users = [];
  let nextCursor = null;
  let pageCursors = [null];
  let pageIndex = 0;
  let hasMore = false;
  let emailPrefix = '';
  let loading = false;
  let status = '';
  let error = false;
  let accessReason = '';
  let flagsReason = '';
  let flags = normalizeFeatureFlags({});
  let flagsBusy = false;
  let auditLogs = [];
  let auditLoading = false;
  let catalogItems = [];
  let catalogLoading = false;
  let catalogBusy = false;
  let catalogDraft = EMPTY_CATALOG_DRAFT();

  const hasCmsAccess = canAccessCms(profile);
  const canViewUsersAudit = canReadUsersAndAudit(profile);
  const canEditUsers = canEditUsersAndFlags(profile);
  const canEditCatalog = canManageCatalog(profile);

  const render = () => {
    const lang = getLang();
    const tr = (key, vars) => saasT(key, vars, lang);
    const errorSummary = getSessionErrorSummary();
    if (!hasCmsAccess) {
      root.innerHTML = renderUnauthorizedAdminCard(tr);
      root.querySelector('[data-action="signout"]')?.addEventListener('click', signOut);
      return;
    }

    const usersSection = canViewUsersAudit ? renderUsersAndFlagsSections({
      tr, loading, canEditUsers, users, emailPrefix, accessReason, authUser,
      pageIndex, hasMore, flags, flagsReason, flagsBusy, errorSummary, auditLoading, auditLogs
    }) : '';
    const catalogSection = canEditCatalog
      ? renderCatalogSection({ tr, catalogLoading, catalogDraft, catalogBusy, catalogItems })
      : '';
    root.innerHTML = renderAdminShell({ tr, profile, status, error, usersSection, catalogSection });

    const on = (selector, eventName, handler) => root.querySelector(selector)?.addEventListener(eventName, handler);
    on('[data-action="signout"]', 'click', signOut);
    on('[data-action="language"]', 'click', () => { setLang(lang === 'en' ? 'vi' : 'en'); render(); });
    on('[data-action="refresh"]', 'click', loadUsers);
    on('[data-action="refresh-audit"]', 'click', loadAudit);
    on('[data-action="refresh-catalog"]', 'click', loadCatalog);
    on('#admin-access-reason', 'input', (event) => { accessReason = event.currentTarget.value; });
    on('#admin-flags-reason', 'input', (event) => { flagsReason = event.currentTarget.value; });
    on('[data-action="flags-form"]', 'submit', async (event) => {
      event.preventDefault();
      if (flagsBusy || !canEditUsers) return;
      const form = new FormData(event.currentTarget);
      const reasonInput = String(form.get('flagsReason') || flagsReason || '').trim();
      const beforeFlags = { ...flags };
      flagsBusy = true;
      render();
      try {
        flags = await saveFeatureFlagsWithAudit(db, authUser.uid, readFlagsFormPayload(form), { reason: reasonInput, beforeFlags });
        flagsReason = '';
        status = saasT('adminFlagsSaved');
        error = false;
        loadAudit();
      } catch {
        status = saasT('adminFlagsError');
        error = true;
      } finally {
        flagsBusy = false;
        render();
      }
    });
    on('[data-action="search-form"]', 'submit', (event) => {
      event.preventDefault();
      emailPrefix = root.querySelector('#admin-user-search')?.value.trim().toLowerCase() || '';
      pageIndex = 0;
      pageCursors = [null];
      loadUsers();
    });
    on('[data-action="clear-search"]', 'click', () => {
      emailPrefix = '';
      pageIndex = 0;
      pageCursors = [null];
      loadUsers();
    });
    on('[data-action="previous"]', 'click', () => {
      if (pageIndex > 0) { pageIndex -= 1; loadUsers(); }
    });
    on('[data-action="next"]', 'click', () => {
      if (hasMore && nextCursor) { pageCursors[pageIndex + 1] = nextCursor; pageIndex += 1; loadUsers(); }
    });
    root.querySelectorAll('[data-tier], [data-status]').forEach((button) => button.addEventListener('click', async () => {
      if (!canEditUsers) return;
      const cleanReason = String(root.querySelector('#admin-access-reason')?.value || accessReason || '').trim();
      if (!cleanReason) {
        status = saasT('adminReasonRequired');
        error = true;
        render();
        root.querySelector('#admin-access-reason')?.focus();
        return;
      }
      const update = button.dataset.tier ? { tier: button.dataset.tier } : { status: button.dataset.status };
      const targetUid = button.dataset.uid;
      const targetUser = users.find((u) => u.uid === targetUid || u.id === targetUid) || null;
      if ((update.status === 'locked' || update.status === 'banned') && typeof window.confirm === 'function') {
        const confirmed = window.confirm(saasT('adminConfirmDangerousStatus', {
          status: update.status,
          target: targetUser?.email || targetUid
        }));
        if (!confirmed) return;
      }
      button.disabled = true;
      try {
        await setUserAccessWithAudit(db, authUser.uid, targetUid, update, {
          reason: cleanReason,
          beforeUser: targetUser
        });
        accessReason = '';
        status = saasT('adminAccessUpdated');
        error = false;
        await loadUsers(false);
        loadAudit();
      } catch (e) {
        status = e?.code === 'permission-denied'
          ? saasT('adminUpdateDenied')
          : saasT('adminUpdateFailed');
        error = true;
        render();
      }
    }));
    on('[data-action="reset-catalog"]', 'click', () => {
      catalogDraft = EMPTY_CATALOG_DRAFT();
      render();
    });
    const runCatalogAction = async (errorKey, task) => {
      if (catalogBusy || !canEditCatalog) return;
      catalogBusy = true;
      render();
      try {
        await task();
      } catch {
        status = saasT(errorKey);
        error = true;
      } finally {
        catalogBusy = false;
        render();
      }
    };
    on('[data-action="catalog-form"]', 'submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const id = String(form.get('id') || '').trim().toLowerCase();
      const existingItem = catalogItems.find((item) => item.id === id) || null;
      await runCatalogAction('adminCatalogSaveError', async () => {
        const saved = await saveCatalogItem(db, authUser.uid, readCatalogFormPayload(form), { beforeItem: existingItem });
        status = saasT('adminCatalogSaved', { id: saved.id });
        error = false;
        catalogDraft = EMPTY_CATALOG_DRAFT();
        await loadCatalog(false);
        if (canViewUsersAudit) loadAudit();
      });
    });
    root.querySelectorAll('[data-catalog-edit]').forEach((button) => button.addEventListener('click', () => {
      const match = catalogItems.find((item) => item.id === button.dataset.catalogEdit);
      if (!match) return;
      catalogDraft = catalogDraftFromItem(match);
      render();
    }));
    root.querySelectorAll('[data-catalog-delete]').forEach((button) => button.addEventListener('click', async () => {
      const itemId = button.dataset.catalogDelete;
      const existingItem = catalogItems.find((item) => item.id === itemId) || null;
      await runCatalogAction('adminCatalogDeleteError', async () => {
        await deleteCatalogItem(db, authUser.uid, itemId, { beforeItem: existingItem });
        status = saasT('adminCatalogDeleted', { id: itemId });
        error = false;
        if (catalogDraft.id === itemId) catalogDraft = EMPTY_CATALOG_DRAFT();
        await loadCatalog(false);
        if (canViewUsersAudit) loadAudit();
      });
    }));
  };

  async function loadUsers(showLoading = true) {
    if (!canViewUsersAudit || loading) return;
    loading = showLoading;
    if (showLoading) render();
    try {
      const page = await listUsersPage(db, { cursor: pageCursors[pageIndex], emailPrefix });
      users = page.users;
      nextCursor = page.cursor;
      hasMore = page.hasMore;
      error = false;
      if (!status) status = '';
    } catch (e) {
      users = [];
      nextCursor = null;
      hasMore = false;
      error = true;
      status = e?.code === 'permission-denied'
        ? saasT('adminLoadDenied')
        : saasT('adminLoadFailed');
    } finally {
      loading = false;
      render();
    }
  }

  async function runSafeLoad(allowed, isBusy, setBusy, fetchFn, applyFn, showLoading) {
    if (!allowed || isBusy()) return;
    setBusy(showLoading);
    if (showLoading) render();
    try { applyFn(await fetchFn()); } catch { applyFn([]); } finally { setBusy(false); render(); }
  }
  const loadAudit = (show = true) => runSafeLoad(
    canViewUsersAudit, () => auditLoading, (v) => { auditLoading = v; },
    () => listAuditLogs(db, 20), (rows) => { auditLogs = rows; }, show
  );
  const loadCatalog = (show = true) => runSafeLoad(
    canEditCatalog, () => catalogLoading, (v) => { catalogLoading = v; },
    () => listCatalogItems(db, 30), (rows) => { catalogItems = rows; }, show
  );

  render();
  if (canViewUsersAudit) {
    loadUsers();
    loadAudit();
    readFeatureFlags(db).then((loaded) => { flags = loaded; render(); }).catch(() => {});
  }
  if (canEditCatalog) {
    loadCatalog();
  }
  return { dispose() { root.remove(); } };
}
