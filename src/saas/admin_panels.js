// @purpose: Các hàm dựng HTML và đọc dữ liệu form cho bảng quản trị CMS
export const EMPTY_CATALOG_DRAFT = () => ({
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

export function catalogDraftFromItem(match) {
  return {
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
}

export function readFlagsFormPayload(form) {
  return {
    maintenanceMode: form.get('maintenanceMode') === 'on',
    maintenanceMessage: form.get('maintenanceMessage') || '',
    freePlanLimit: Number(form.get('freePlanLimit') || 20),
    disabledModules: form.get('disabledModules') || ''
  };
}

export function readCatalogFormPayload(form) {
  return {
    id: form.get('id'),
    kind: form.get('kind'),
    title: form.get('title'),
    category: form.get('category'),
    wllT: form.get('wllT'),
    massKg: form.get('massKg'),
    tier: form.get('tier'),
    enabled: form.get('enabled') === 'on',
    notes: form.get('notes')
  };
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function formatAuditTime(ts) {
  if (!ts) return '—';
  const date = typeof ts?.toDate === 'function'
    ? ts.toDate()
    : (typeof ts?.seconds === 'number' ? new Date(ts.seconds * 1000) : new Date(ts));
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString().replace('T', ' ').slice(0, 19);
}

export function renderUnauthorizedAdminCard(tr) {
  return `<section class="saas-admin-card"><div class="saas-auth-brand"><img class="saas-auth-mark" src="/safelift3d-icons/branding/main-logo.svg" alt="SafeLift3D — Heavy Rigging & Lift Planner"></div><h1>${tr('adminRequiredTitle')}</h1><p>${tr('adminRequiredBody')}</p><div class="saas-admin-actions"><a href="/">${tr('adminReturnWorkspace')}</a><button type="button" data-action="signout">${tr('adminSignOut')}</button></div></section>`;
}

function renderUserRow(tr, user, canEditUsers, currentUid) {
  const actionDisabled = !canEditUsers;
  const selfLocked = actionDisabled || user.uid === currentUid;
  const selfSuspendAttr = user.uid === currentUid ? `title="${escapeHtml(tr('adminSelfSuspendTitle'))}"` : '';
  const selfBanAttr = user.uid === currentUid ? `title="${escapeHtml(tr('adminSelfBanTitle'))}"` : '';
  return `<tr><td><strong>${escapeHtml(user.displayName || user.email || user.uid)}</strong><small>${escapeHtml(user.email || user.uid)}</small></td><td>${escapeHtml(user.role || 'user')}</td><td><span class="saas-pill tier-${user.tier === 'premium' ? 'premium' : 'free'}">${escapeHtml(user.tier || 'free')}</span></td><td><span class="saas-pill status-${escapeHtml(user.status || 'unknown')}">${escapeHtml(user.status || 'unknown')}</span></td><td><div class="saas-row-actions"><button type="button" data-tier="${user.tier === 'premium' ? 'free' : 'premium'}" data-uid="${escapeHtml(user.uid)}" ${actionDisabled ? 'disabled' : ''}>${user.tier === 'premium' ? tr('adminSetFree') : tr('adminSetPremium')}</button><button type="button" data-status="${user.status === 'active' ? 'locked' : 'active'}" data-uid="${escapeHtml(user.uid)}" ${selfLocked ? 'disabled' : ''} ${selfSuspendAttr}>${user.status === 'active' ? tr('adminSuspend') : tr('adminActivate')}</button><button type="button" class="saas-danger-button" data-status="banned" data-uid="${escapeHtml(user.uid)}" ${selfLocked ? 'disabled' : ''} ${selfBanAttr}>${tr('adminBan')}</button></div></td></tr>`;
}

export function renderUsersAndFlagsSections({
  tr, loading, canEditUsers, users, emailPrefix, accessReason, authUser,
  pageIndex, hasMore, flags, flagsReason, flagsBusy, errorSummary, auditLoading, auditLogs
}) {
  return `
      <section class="saas-admin-card">
        <div class="saas-admin-title-row"><div><div class="saas-auth-kicker">${tr('adminAccessKicker')}</div><h1>${tr('adminUsersTitle')}</h1><p>${tr('adminUsersSubtitle')}</p></div><button type="button" class="saas-secondary-button" data-action="refresh" ${loading ? 'disabled' : ''}>${loading ? tr('adminLoading') : tr('adminRefresh')}</button></div>
        ${canEditUsers ? '' : `<div class="saas-admin-notice" role="note">${tr('adminReadOnlyHint')}</div>`}
        <div class="saas-admin-stats"><div><span>${tr('adminStatUsers')}</span><strong>${users.length}</strong></div><div><span>${tr('adminStatActive')}</span><strong>${users.filter((u) => u.status === 'active').length}</strong></div><div><span>${tr('adminStatPremium')}</span><strong>${users.filter((u) => u.tier === 'premium').length}</strong></div></div>
        <form class="saas-admin-search" data-action="search-form"><label for="admin-user-search">${tr('adminSearchLabel')}</label><div><input id="admin-user-search" type="search" maxlength="254" autocomplete="off" placeholder="${tr('adminSearchPlaceholder')}" value="${escapeHtml(emailPrefix)}"><button type="submit" class="saas-secondary-button">${tr('adminSearchButton')}</button><button type="button" class="saas-secondary-button" data-action="clear-search" ${emailPrefix ? '' : 'disabled'}>${tr('adminClearButton')}</button></div><small>${tr('adminSearchHint')}</small></form>
        ${canEditUsers ? `<div class="saas-admin-search"><label for="admin-access-reason">${tr('adminAccessReasonLabel')}<input id="admin-access-reason" type="text" maxlength="200" placeholder="${escapeHtml(tr('adminAccessReasonPlaceholder'))}" value="${escapeHtml(accessReason)}"></label></div>` : ''}
        <div class="saas-table-wrap"><table class="saas-users-table"><thead><tr><th>${tr('adminColUser')}</th><th>${tr('adminColRole')}</th><th>${tr('adminColTier')}</th><th>${tr('adminColStatus')}</th><th>${tr('adminColActions')}</th></tr></thead><tbody>
          ${users.map((user) => renderUserRow(tr, user, canEditUsers, authUser.uid)).join('')}
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
          <label>${tr('adminFlagsReasonLabel')}<input id="admin-flags-reason" type="text" name="flagsReason" maxlength="200" placeholder="${escapeHtml(tr('adminFlagsReasonPlaceholder'))}" value="${escapeHtml(flagsReason)}" ${canEditUsers ? '' : 'disabled'}></label>
          <div><button type="submit" class="saas-secondary-button" ${flagsBusy || !canEditUsers ? 'disabled' : ''}>${tr('adminSaveFlags')}</button></div>
        </form>
        <small>${tr('adminSessionErrorsLabel', { count: errorSummary.totalCount })}</small>
      </section>
      <section class="saas-admin-card">
        <div class="saas-admin-title-row"><div><h2>${tr('adminAuditTitle')}</h2><p>${tr('adminAuditSubtitle')}</p></div><button type="button" class="saas-secondary-button" data-action="refresh-audit" ${auditLoading ? 'disabled' : ''}>${auditLoading ? tr('adminLoading') : tr('adminRefresh')}</button></div>
        <div class="saas-table-wrap"><table class="saas-users-table"><thead><tr><th>${tr('adminAuditColTime')}</th><th>${tr('adminAuditColActor')}</th><th>${tr('adminAuditColAction')}</th><th>${tr('adminAuditColTarget')}</th><th>${tr('adminAuditColReason')}</th><th>${tr('adminAuditColDiff')}</th><th>${tr('adminAuditColSummary')}</th></tr></thead><tbody>
          ${auditLogs.map((entry) => {
            const diffText = entry.before || entry.after ? `${entry.before || '∅'} → ${entry.after || '∅'}` : '—';
            return `<tr><td>${escapeHtml(formatAuditTime(entry.createdAt))}</td><td><small>${escapeHtml(entry.actorUid || '')}</small></td><td><span class="saas-pill">${escapeHtml(entry.action || '')}</span></td><td>${escapeHtml(`${entry.targetType || ''}:${entry.targetId || ''}`)}</td><td>${escapeHtml(entry.reason || '—')}</td><td><small>${escapeHtml(diffText)}</small></td><td>${escapeHtml(entry.summary || '')}</td></tr>`;
          }).join('')}
          ${auditLogs.length ? '' : `<tr><td colspan="7" class="saas-empty-row">${auditLoading ? tr('adminLoading') : tr('adminAuditEmpty')}</td></tr>`}
        </tbody></table></div>
      </section>`;
}

export function renderCatalogSection({ tr, catalogLoading, catalogDraft, catalogBusy, catalogItems }) {
  return `
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
      </section>`;
}

export function renderAdminShell({ tr, profile, status, error, usersSection, catalogSection }) {
  return `
      <header class="saas-admin-header">
        <div class="saas-auth-brand"><img class="saas-auth-mark" src="/safelift3d-icons/branding/main-logo.svg" alt="SafeLift3D — Heavy Rigging & Lift Planner"><span>${escapeHtml(tr('adminRoleLabel', { role: profile.role }))}</span></div>
        <div class="saas-admin-actions"><a href="/">${tr('adminWorkspaceLink')}</a><button type="button" data-action="language">${tr('adminToggleLang')}</button><button type="button" data-action="signout">${tr('adminSignOut')}</button></div>
      </header>
      ${status ? `<div class="saas-admin-notice ${error ? 'is-error' : ''}" role="status">${escapeHtml(status)}</div>` : ''}
      ${usersSection}
      ${catalogSection}`;
}
