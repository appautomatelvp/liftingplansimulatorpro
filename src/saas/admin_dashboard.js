import { getLang, setLang } from '../i18n/index.js';
import { saasT } from './i18n.js';
import { listUsersPage, setUserAccess } from './firebase_data.js';
import { getSessionErrorSummary, normalizeFeatureFlags, readFeatureFlags, saveFeatureFlags } from './telemetry_usage.js';
import {
  appendAuditLog,
  canAccessCms,
  canEditUsersAndFlags,
  canManageCatalog,
  canReadUsersAndAudit,
  deleteCatalogItem,
  listAuditLogs,
  listCatalogItems,
  saveCatalogItem
} from './cms_data.js';

const EMPTY_CATALOG_DRAFT = () => ({
  id: '',
  kind: 'hardware',
  title: '',
  category: '',
  wllT: '',
  massKg: '',
  tier: 'free',
  enabled: true,
  notes: ''
});

function formatAuditTime(ts) {
  if (!ts) return '—';
  const date = typeof ts?.toDate === 'function'
    ? ts.toDate()
    : (typeof ts?.seconds === 'number' ? new Date(ts.seconds * 1000) : new Date(ts));
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString().replace('T', ' ').slice(0, 19);
}

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
      root.innerHTML = `<section class="saas-admin-card"><div class="saas-auth-brand"><img class="saas-auth-mark" src="/safelift3d-icons/branding/main-logo.svg" alt="SafeLift3D — Heavy Rigging & Lift Planner"></div><h1>${tr('adminRequiredTitle')}</h1><p>${tr('adminRequiredBody')}</p><div class="saas-admin-actions"><a href="/">${tr('adminReturnWorkspace')}</a><button type="button" data-action="signout">${tr('adminSignOut')}</button></div></section>`;
      root.querySelector('[data-action="signout"]')?.addEventListener('click', signOut);
      return;
    }

    const usersSection = canViewUsersAudit ? `
      <section class="saas-admin-card">
        <div class="saas-admin-title-row"><div><div class="saas-auth-kicker">${tr('adminAccessKicker')}</div><h1>${tr('adminUsersTitle')}</h1><p>${tr('adminUsersSubtitle')}</p></div><button type="button" class="saas-secondary-button" data-action="refresh" ${loading ? 'disabled' : ''}>${loading ? tr('adminLoading') : tr('adminRefresh')}</button></div>
        ${canEditUsers ? '' : `<div class="saas-admin-notice" role="note">${tr('adminReadOnlyHint')}</div>`}
        <div class="saas-admin-stats"><div><span>${tr('adminStatUsers')}</span><strong>${users.length}</strong></div><div><span>${tr('adminStatActive')}</span><strong>${users.filter((u) => u.status === 'active').length}</strong></div><div><span>${tr('adminStatPremium')}</span><strong>${users.filter((u) => u.tier === 'premium').length}</strong></div></div>
        <form class="saas-admin-search" data-action="search-form"><label for="admin-user-search">${tr('adminSearchLabel')}</label><div><input id="admin-user-search" type="search" maxlength="254" autocomplete="off" placeholder="${tr('adminSearchPlaceholder')}" value="${escapeHtml(emailPrefix)}"><button type="submit" class="saas-secondary-button">${tr('adminSearchButton')}</button><button type="button" class="saas-secondary-button" data-action="clear-search" ${emailPrefix ? '' : 'disabled'}>${tr('adminClearButton')}</button></div><small>${tr('adminSearchHint')}</small></form>
        <div class="saas-table-wrap"><table class="saas-users-table"><thead><tr><th>${tr('adminColUser')}</th><th>${tr('adminColRole')}</th><th>${tr('adminColTier')}</th><th>${tr('adminColStatus')}</th><th>${tr('adminColActions')}</th></tr></thead><tbody>
          ${users.map((user) => {
            const actionDisabled = !canEditUsers;
            const selfLocked = actionDisabled || user.uid === authUser.uid;
            const selfSuspendAttr = user.uid === authUser.uid ? `title="${escapeHtml(tr('adminSelfSuspendTitle'))}"` : '';
            const selfBanAttr = user.uid === authUser.uid ? `title="${escapeHtml(tr('adminSelfBanTitle'))}"` : '';
            return `<tr><td><strong>${escapeHtml(user.displayName || user.email || user.uid)}</strong><small>${escapeHtml(user.email || user.uid)}</small></td><td>${escapeHtml(user.role || 'user')}</td><td><span class="saas-pill tier-${user.tier === 'premium' ? 'premium' : 'free'}">${escapeHtml(user.tier || 'free')}</span></td><td><span class="saas-pill status-${escapeHtml(user.status || 'unknown')}">${escapeHtml(user.status || 'unknown')}</span></td><td><div class="saas-row-actions"><button type="button" data-tier="${user.tier === 'premium' ? 'free' : 'premium'}" data-uid="${escapeHtml(user.uid)}" ${actionDisabled ? 'disabled' : ''}>${user.tier === 'premium' ? tr('adminSetFree') : tr('adminSetPremium')}</button><button type="button" data-status="${user.status === 'active' ? 'locked' : 'active'}" data-uid="${escapeHtml(user.uid)}" ${selfLocked ? 'disabled' : ''} ${selfSuspendAttr}>${user.status === 'active' ? tr('adminSuspend') : tr('adminActivate')}</button><button type="button" class="saas-danger-button" data-status="banned" data-uid="${escapeHtml(user.uid)}" ${selfLocked ? 'disabled' : ''} ${selfBanAttr}>${tr('adminBan')}</button></div></td></tr>`;
          }).join('')}
          ${users.length ? '' : `<tr><td colspan="5" class="saas-empty-row">${loading ? tr('adminLoadingUsers') : tr('adminNoUsers')}</td></tr>`}
        </tbody></table></div>
        <nav class="saas-admin-pagination" aria-label="${tr('adminPagesAria')}"><span>${tr('adminPageNumber', { page: pageIndex + 1 })}</span><div><button type="button" class="saas-secondary-button" data-action="previous" ${pageIndex === 0 || loading ? 'disabled' : ''}>${tr('adminPrevious')}</button><button type="button" class="saas-secondary-button" data-action="next" ${!hasMore || loading ? 'disabled' : ''}>${tr('adminNext')}</button></div></nav>
      </section>
      <section class="saas-admin-card">
        <div class="saas-admin-title-row"><div><h2>${tr('adminFlagsTitle')}</h2><p>${tr('adminFlagsSubtitle')}</p></div></div>
        <form class="saas-admin-search" data-action="flags-form">
          <label><input type="checkbox" name="maintenanceMode" ${flags.maintenanceMode ? 'checked' : ''} ${canEditUsers ? '' : 'disabled'}> ${tr('adminMaintenanceLabel')}</label>
          <label>${tr('adminMaintenanceMsgLabel')}<input type="text" name="maintenanceMessage" maxlength="300" value="${escapeHtml(flags.maintenanceMessage)}" ${canEditUsers ? '' : 'disabled'}></label>
          <label>${tr('adminFreeLimitLabel')}<input type="number" name="freePlanLimit" min="1" max="200" value="${escapeHtml(flags.freePlanLimit)}" ${canEditUsers ? '' : 'disabled'}></label>
          <label>${tr('adminDisabledModulesLabel')}<input type="text" name="disabledModules" maxlength="400" value="${escapeHtml(flags.disabledModules.join(', '))}" ${canEditUsers ? '' : 'disabled'}></label>
          <div><button type="submit" class="saas-secondary-button" ${flagsBusy || !canEditUsers ? 'disabled' : ''}>${tr('adminSaveFlags')}</button></div>
        </form>
        <small>${tr('adminSessionErrorsLabel', { count: errorSummary.totalCount })}</small>
      </section>
      <section class="saas-admin-card">
        <div class="saas-admin-title-row"><div><h2>${tr('adminAuditTitle')}</h2><p>${tr('adminAuditSubtitle')}</p></div><button type="button" class="saas-secondary-button" data-action="refresh-audit" ${auditLoading ? 'disabled' : ''}>${auditLoading ? tr('adminLoading') : tr('adminRefresh')}</button></div>
        <div class="saas-table-wrap"><table class="saas-users-table"><thead><tr><th>${tr('adminAuditColTime')}</th><th>${tr('adminAuditColActor')}</th><th>${tr('adminAuditColAction')}</th><th>${tr('adminAuditColTarget')}</th><th>${tr('adminAuditColSummary')}</th></tr></thead><tbody>
          ${auditLogs.map((entry) => `<tr><td>${escapeHtml(formatAuditTime(entry.createdAt))}</td><td><small>${escapeHtml(entry.actorUid || '')}</small></td><td><span class="saas-pill">${escapeHtml(entry.action || '')}</span></td><td>${escapeHtml(`${entry.targetType || ''}:${entry.targetId || ''}`)}</td><td>${escapeHtml(entry.summary || '')}</td></tr>`).join('')}
          ${auditLogs.length ? '' : `<tr><td colspan="5" class="saas-empty-row">${auditLoading ? tr('adminLoading') : tr('adminAuditEmpty')}</td></tr>`}
        </tbody></table></div>
      </section>` : '';

    const catalogSection = canEditCatalog ? `
      <section class="saas-admin-card">
        <div class="saas-admin-title-row"><div><h2>${tr('adminCatalogTitle')}</h2><p>${tr('adminCatalogSubtitle')}</p></div><button type="button" class="saas-secondary-button" data-action="refresh-catalog" ${catalogLoading ? 'disabled' : ''}>${catalogLoading ? tr('adminLoading') : tr('adminRefresh')}</button></div>
        <form class="saas-admin-search" data-action="catalog-form">
          <label>${tr('adminCatalogIdLabel')}<input type="text" name="id" required maxlength="64" pattern="[a-z0-9_-]{2,64}" value="${escapeHtml(catalogDraft.id)}" ${catalogBusy ? 'disabled' : ''}></label>
          <label>${tr('adminCatalogKindLabel')}<select name="kind" ${catalogBusy ? 'disabled' : ''}>${['cargo', 'beam', 'sling', 'hardware'].map((kind) => `<option value="${kind}" ${catalogDraft.kind === kind ? 'selected' : ''}>${kind}</option>`).join('')}</select></label>
          <label>${tr('adminCatalogTitleLabel')}<input type="text" name="title" required maxlength="100" value="${escapeHtml(catalogDraft.title)}" ${catalogBusy ? 'disabled' : ''}></label>
          <label>${tr('adminCatalogCategoryLabel')}<input type="text" name="category" maxlength="60" value="${escapeHtml(catalogDraft.category)}" ${catalogBusy ? 'disabled' : ''}></label>
          <label>${tr('adminCatalogWllLabel')}<input type="number" name="wllT" min="0" max="100000" step="any" value="${escapeHtml(catalogDraft.wllT)}" ${catalogBusy ? 'disabled' : ''}></label>
          <label>${tr('adminCatalogMassLabel')}<input type="number" name="massKg" min="0" max="10000000" step="any" value="${escapeHtml(catalogDraft.massKg)}" ${catalogBusy ? 'disabled' : ''}></label>
          <label>${tr('adminCatalogTierLabel')}<select name="tier" ${catalogBusy ? 'disabled' : ''}>${['free', 'premium'].map((tier) => `<option value="${tier}" ${catalogDraft.tier === tier ? 'selected' : ''}>${tier}</option>`).join('')}</select></label>
          <label><input type="checkbox" name="enabled" ${catalogDraft.enabled ? 'checked' : ''} ${catalogBusy ? 'disabled' : ''}> ${tr('adminCatalogEnabledLabel')}</label>
          <label>${tr('adminCatalogNotesLabel')}<input type="text" name="notes" maxlength="300" value="${escapeHtml(catalogDraft.notes)}" ${catalogBusy ? 'disabled' : ''}></label>
          <div class="saas-row-actions"><button type="submit" class="saas-secondary-button" ${catalogBusy ? 'disabled' : ''}>${tr('adminCatalogSaveBtn')}</button><button type="button" class="saas-secondary-button" data-action="reset-catalog" ${catalogBusy ? 'disabled' : ''}>${tr('adminCatalogResetBtn')}</button></div>
        </form>
        <div class="saas-table-wrap"><table class="saas-users-table"><thead><tr><th>${tr('adminCatalogColId')}</th><th>${tr('adminCatalogColKind')}</th><th>${tr('adminCatalogColSpecs')}</th><th>${tr('adminCatalogColState')}</th><th>${tr('adminColActions')}</th></tr></thead><tbody>
          ${catalogItems.map((item) => `<tr><td><strong>${escapeHtml(item.title || item.id)}</strong><small>${escapeHtml(item.id)} · ${escapeHtml(item.category || '—')}</small></td><td>${escapeHtml(item.kind)} · <span class="saas-pill tier-${item.tier === 'premium' ? 'premium' : 'free'}">${escapeHtml(item.tier || 'free')}</span></td><td><small>WLL: ${item.wllT ?? '—'} t · Mass: ${item.massKg ?? '—'} kg</small></td><td><span class="saas-pill">${item.enabled ? tr('adminCatalogEnabled') : tr('adminCatalogDisabled')}</span></td><td><div class="saas-row-actions"><button type="button" data-catalog-edit="${escapeHtml(item.id)}">${tr('adminCatalogEditBtn')}</button><button type="button" class="saas-danger-button" data-catalog-delete="${escapeHtml(item.id)}" ${catalogBusy ? 'disabled' : ''}>${tr('adminCatalogDeleteBtn')}</button></div></td></tr>`).join('')}
          ${catalogItems.length ? '' : `<tr><td colspan="5" class="saas-empty-row">${catalogLoading ? tr('adminLoading') : tr('adminCatalogEmpty')}</td></tr>`}
        </tbody></table></div>
      </section>` : '';

    root.innerHTML = `
      <header class="saas-admin-header">
        <div class="saas-auth-brand"><img class="saas-auth-mark" src="/safelift3d-icons/branding/main-logo.svg" alt="SafeLift3D — Heavy Rigging & Lift Planner"><span>${escapeHtml(tr('adminRoleLabel', { role: profile.role }))}</span></div>
        <div class="saas-admin-actions"><a href="/">${tr('adminWorkspaceLink')}</a><button type="button" data-action="language">${tr('adminToggleLang')}</button><button type="button" data-action="signout">${tr('adminSignOut')}</button></div>
      </header>
      ${status ? `<div class="saas-admin-notice ${error ? 'is-error' : ''}" role="status">${escapeHtml(status)}</div>` : ''}
      ${usersSection}
      ${catalogSection}`;

    root.querySelector('[data-action="signout"]')?.addEventListener('click', signOut);
    root.querySelector('[data-action="language"]')?.addEventListener('click', () => { setLang(lang === 'en' ? 'vi' : 'en'); render(); });
    root.querySelector('[data-action="refresh"]')?.addEventListener('click', loadUsers);
    root.querySelector('[data-action="refresh-audit"]')?.addEventListener('click', loadAudit);
    root.querySelector('[data-action="refresh-catalog"]')?.addEventListener('click', loadCatalog);
    root.querySelector('[data-action="flags-form"]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (flagsBusy || !canEditUsers) return;
      const form = new FormData(event.currentTarget);
      flagsBusy = true;
      render();
      try {
        flags = await saveFeatureFlags(db, authUser.uid, {
          maintenanceMode: form.get('maintenanceMode') === 'on',
          maintenanceMessage: form.get('maintenanceMessage') || '',
          freePlanLimit: Number(form.get('freePlanLimit') || 20),
          disabledModules: form.get('disabledModules') || ''
        });
        await appendAuditLog(db, {
          actorUid: authUser.uid,
          action: 'FLAGS_UPDATE',
          targetType: 'config',
          targetId: 'featureFlags',
          summary: `maintenance=${flags.maintenanceMode}, freeLimit=${flags.freePlanLimit}`
        }).catch(() => {});
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
    root.querySelector('[data-action="search-form"]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      emailPrefix = root.querySelector('#admin-user-search')?.value.trim().toLowerCase() || '';
      pageIndex = 0;
      pageCursors = [null];
      loadUsers();
    });
    root.querySelector('[data-action="clear-search"]')?.addEventListener('click', () => {
      emailPrefix = '';
      pageIndex = 0;
      pageCursors = [null];
      loadUsers();
    });
    root.querySelector('[data-action="previous"]')?.addEventListener('click', () => {
      if (pageIndex > 0) { pageIndex -= 1; loadUsers(); }
    });
    root.querySelector('[data-action="next"]')?.addEventListener('click', () => {
      if (hasMore && nextCursor) { pageCursors[pageIndex + 1] = nextCursor; pageIndex += 1; loadUsers(); }
    });
    root.querySelectorAll('[data-tier], [data-status]').forEach((button) => button.addEventListener('click', async () => {
      if (!canEditUsers) return;
      const update = button.dataset.tier ? { tier: button.dataset.tier } : { status: button.dataset.status };
      const targetUid = button.dataset.uid;
      button.disabled = true;
      try {
        await setUserAccess(db, targetUid, update);
        await appendAuditLog(db, {
          actorUid: authUser.uid,
          action: 'USER_ACCESS_UPDATE',
          targetType: 'user',
          targetId: targetUid,
          summary: JSON.stringify(update)
        }).catch(() => {});
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
    root.querySelector('[data-action="reset-catalog"]')?.addEventListener('click', () => {
      catalogDraft = EMPTY_CATALOG_DRAFT();
      render();
    });
    root.querySelector('[data-action="catalog-form"]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (catalogBusy || !canEditCatalog) return;
      const form = new FormData(event.currentTarget);
      catalogBusy = true;
      render();
      try {
        const saved = await saveCatalogItem(db, authUser.uid, {
          id: form.get('id'),
          kind: form.get('kind'),
          title: form.get('title'),
          category: form.get('category'),
          wllT: form.get('wllT'),
          massKg: form.get('massKg'),
          tier: form.get('tier'),
          enabled: form.get('enabled') === 'on',
          notes: form.get('notes')
        });
        status = saasT('adminCatalogSaved', { id: saved.id });
        error = false;
        catalogDraft = EMPTY_CATALOG_DRAFT();
        await loadCatalog(false);
        if (canViewUsersAudit) loadAudit();
      } catch {
        status = saasT('adminCatalogSaveError');
        error = true;
      } finally {
        catalogBusy = false;
        render();
      }
    });
    root.querySelectorAll('[data-catalog-edit]').forEach((button) => button.addEventListener('click', () => {
      const match = catalogItems.find((item) => item.id === button.dataset.catalogEdit);
      if (!match) return;
      catalogDraft = {
        id: match.id || '',
        kind: match.kind || 'hardware',
        title: match.title || '',
        category: match.category || '',
        wllT: match.wllT ?? '',
        massKg: match.massKg ?? '',
        tier: match.tier || 'free',
        enabled: match.enabled !== false,
        notes: match.notes || ''
      };
      render();
    }));
    root.querySelectorAll('[data-catalog-delete]').forEach((button) => button.addEventListener('click', async () => {
      if (catalogBusy || !canEditCatalog) return;
      const itemId = button.dataset.catalogDelete;
      catalogBusy = true;
      render();
      try {
        await deleteCatalogItem(db, authUser.uid, itemId);
        status = saasT('adminCatalogDeleted', { id: itemId });
        error = false;
        if (catalogDraft.id === itemId) catalogDraft = EMPTY_CATALOG_DRAFT();
        await loadCatalog(false);
        if (canViewUsersAudit) loadAudit();
      } catch {
        status = saasT('adminCatalogDeleteError');
        error = true;
      } finally {
        catalogBusy = false;
        render();
      }
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

  async function loadAudit(showLoading = true) {
    if (!canViewUsersAudit || auditLoading) return;
    auditLoading = showLoading;
    if (showLoading) render();
    try {
      auditLogs = await listAuditLogs(db, 20);
    } catch {
      auditLogs = [];
    } finally {
      auditLoading = false;
      render();
    }
  }

  async function loadCatalog(showLoading = true) {
    if (!canEditCatalog || catalogLoading) return;
    catalogLoading = showLoading;
    if (showLoading) render();
    try {
      catalogItems = await listCatalogItems(db, 30);
    } catch {
      catalogItems = [];
    } finally {
      catalogLoading = false;
      render();
    }
  }

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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
