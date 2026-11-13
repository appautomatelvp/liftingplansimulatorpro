import { getLang, setLang } from '../i18n/index.js';
import { saasT } from './i18n.js';
import { listUsersPage, setUserAccess } from './firebase_data.js';

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
  const isAdmin = profile.role === 'admin';

  const render = () => {
    const lang = getLang();
    const tr = (key, vars) => saasT(key, vars, lang);
    if (!isAdmin) {
      root.innerHTML = `<section class="saas-admin-card"><div class="saas-auth-brand"><img class="saas-auth-mark" src="/safelift3d-icons/branding/main-logo.svg" alt="SafeLift3D — Heavy Rigging & Lift Planner"></div><h1>${tr('adminRequiredTitle')}</h1><p>${tr('adminRequiredBody')}</p><div class="saas-admin-actions"><a href="/">${tr('adminReturnWorkspace')}</a><button type="button" data-action="signout">${tr('adminSignOut')}</button></div></section>`;
      root.querySelector('[data-action="signout"]')?.addEventListener('click', signOut);
      return;
    }
    root.innerHTML = `
      <header class="saas-admin-header">
        <div class="saas-auth-brand"><img class="saas-auth-mark" src="/safelift3d-icons/branding/main-logo.svg" alt="SafeLift3D — Heavy Rigging & Lift Planner"><span>ADMIN CMS</span></div>
        <div class="saas-admin-actions"><a href="/">${tr('adminWorkspaceLink')}</a><button type="button" data-action="language">${tr('adminToggleLang')}</button><button type="button" data-action="signout">${tr('adminSignOut')}</button></div>
      </header>
      <section class="saas-admin-card">
        <div class="saas-admin-title-row"><div><div class="saas-auth-kicker">${tr('adminAccessKicker')}</div><h1>${tr('adminUsersTitle')}</h1><p>${tr('adminUsersSubtitle')}</p></div><button type="button" class="saas-secondary-button" data-action="refresh" ${loading ? 'disabled' : ''}>${loading ? tr('adminLoading') : tr('adminRefresh')}</button></div>
        <div class="saas-admin-stats"><div><span>${tr('adminStatUsers')}</span><strong>${users.length}</strong></div><div><span>${tr('adminStatActive')}</span><strong>${users.filter((u) => u.status === 'active').length}</strong></div><div><span>${tr('adminStatPremium')}</span><strong>${users.filter((u) => u.tier === 'premium').length}</strong></div></div>
        ${status ? `<div class="saas-admin-notice ${error ? 'is-error' : ''}" role="status">${escapeHtml(status)}</div>` : ''}
        <form class="saas-admin-search" data-action="search-form"><label for="admin-user-search">${tr('adminSearchLabel')}</label><div><input id="admin-user-search" type="search" maxlength="254" autocomplete="off" placeholder="${tr('adminSearchPlaceholder')}" value="${escapeHtml(emailPrefix)}"><button type="submit" class="saas-secondary-button">${tr('adminSearchButton')}</button><button type="button" class="saas-secondary-button" data-action="clear-search" ${emailPrefix ? '' : 'disabled'}>${tr('adminClearButton')}</button></div><small>${tr('adminSearchHint')}</small></form>
        <div class="saas-table-wrap"><table class="saas-users-table"><thead><tr><th>${tr('adminColUser')}</th><th>${tr('adminColRole')}</th><th>${tr('adminColTier')}</th><th>${tr('adminColStatus')}</th><th>${tr('adminColActions')}</th></tr></thead><tbody>
          ${users.map((user) => `<tr><td><strong>${escapeHtml(user.displayName || user.email || user.uid)}</strong><small>${escapeHtml(user.email || user.uid)}</small></td><td>${escapeHtml(user.role || 'user')}</td><td><span class="saas-pill tier-${user.tier === 'premium' ? 'premium' : 'free'}">${escapeHtml(user.tier || 'free')}</span></td><td><span class="saas-pill status-${escapeHtml(user.status || 'unknown')}">${escapeHtml(user.status || 'unknown')}</span></td><td><div class="saas-row-actions"><button type="button" data-tier="${user.tier === 'premium' ? 'free' : 'premium'}" data-uid="${escapeHtml(user.uid)}">${user.tier === 'premium' ? tr('adminSetFree') : tr('adminSetPremium')}</button><button type="button" data-status="${user.status === 'active' ? 'locked' : 'active'}" data-uid="${escapeHtml(user.uid)}" ${user.uid === authUser.uid ? `disabled title="${escapeHtml(tr('adminSelfSuspendTitle'))}"` : ''}>${user.status === 'active' ? tr('adminSuspend') : tr('adminActivate')}</button><button type="button" class="saas-danger-button" data-status="banned" data-uid="${escapeHtml(user.uid)}" ${user.uid === authUser.uid ? `disabled title="${escapeHtml(tr('adminSelfBanTitle'))}"` : ''}>${tr('adminBan')}</button></div></td></tr>`).join('')}
          ${users.length ? '' : `<tr><td colspan="5" class="saas-empty-row">${loading ? tr('adminLoadingUsers') : tr('adminNoUsers')}</td></tr>`}
        </tbody></table></div>
        <nav class="saas-admin-pagination" aria-label="${tr('adminPagesAria')}"><span>${tr('adminPageNumber', { page: pageIndex + 1 })}</span><div><button type="button" class="saas-secondary-button" data-action="previous" ${pageIndex === 0 || loading ? 'disabled' : ''}>${tr('adminPrevious')}</button><button type="button" class="saas-secondary-button" data-action="next" ${!hasMore || loading ? 'disabled' : ''}>${tr('adminNext')}</button></div></nav>
      </section>`;
    root.querySelector('[data-action="signout"]')?.addEventListener('click', signOut);
    root.querySelector('[data-action="language"]')?.addEventListener('click', () => { setLang(lang === 'en' ? 'vi' : 'en'); render(); });
    root.querySelector('[data-action="refresh"]')?.addEventListener('click', loadUsers);
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
      const update = button.dataset.tier ? { tier: button.dataset.tier } : { status: button.dataset.status };
      button.disabled = true;
      try {
        await setUserAccess(db, button.dataset.uid, update);
        status = saasT('adminAccessUpdated');
        error = false;
        await loadUsers(false);
      } catch (e) {
        status = e?.code === 'permission-denied'
          ? saasT('adminUpdateDenied')
          : saasT('adminUpdateFailed');
        error = true;
        render();
      }
    }));
  };

  async function loadUsers(showLoading = true) {
    if (!isAdmin || loading) return;
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

  render();
  if (isAdmin) loadUsers();
  return { dispose() { root.remove(); } };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
