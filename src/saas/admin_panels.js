// @purpose: Các hàm dựng HTML giao diện Enterprise Command Center và đọc dữ liệu form cho bảng quản trị CMS
import {
  CMS_CONTROLLABLE_MODULES, QUICK_AUDIT_REASONS, computeAdminKpiSummary,
  filterUsersList
} from './admin_helpers.js';
import { escapeHtml } from './session_ui_bindings.js';
import {
  formatAuditTime, renderAuditSection, renderCatalogSection, renderUserDetailModal
} from './admin_catalog_audit_panels.js';

export { escapeHtml, formatAuditTime, renderAuditSection, renderCatalogSection, renderUserDetailModal };

export const EMPTY_CATALOG_DRAFT = () => ({
  id: '', kind: 'hardware', title: '', category: '', wllT: '', massKg: '', tier: 'free', enabled: true, notes: ''
});

export function catalogDraftFromItem(match) {
  return {
    id: match.id || '', kind: match.kind || 'hardware', title: match.title || '', category: match.category || '',
    wllT: match.wllT ?? '', massKg: match.massKg ?? '', tier: match.tier || 'free',
    enabled: match.enabled !== false, notes: match.notes || ''
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
    id: form.get('id'), kind: form.get('kind'), title: form.get('title'), category: form.get('category'),
    wllT: form.get('wllT'), massKg: form.get('massKg'), tier: form.get('tier'),
    enabled: form.get('enabled') === 'on', notes: form.get('notes')
  };
}

export function renderUnauthorizedAdminCard(tr) {
  return `<section class="saas-admin-card"><div class="saas-cms-brand"><img class="saas-cms-brand-logo" src="/brand/safelift3d-lockup.png" alt="SafeLift3D"></div><h1>${tr('adminRequiredTitle')}</h1><p>${tr('adminRequiredBody')}</p><div class="saas-admin-actions"><a href="/">${tr('adminReturnWorkspace')}</a><button type="button" data-action="signout">${tr('adminSignOut')}</button></div></section>`;
}

export function renderKpiRibbon({ tr, kpi }) {
  return `<section class="saas-cms-kpi-grid" aria-label="KPI">
    <article class="saas-cms-kpi-card"><span>${tr('cmsKpiTotalLabel')}</span><strong>${kpi.totalUsers}</strong><small>${tr('cmsKpiRolesHint', { admin: kpi.adminCount, support: kpi.supportCount, editor: kpi.editorCount })}</small></article>
    <article class="saas-cms-kpi-card"><span>${tr('cmsKpiActiveLabel')}</span><strong>${kpi.activeUsers}</strong><small>${tr('cmsKpiActiveRatio', { pct: kpi.activePct, locked: kpi.lockedOrBannedUsers })}</small></article>
    <article class="saas-cms-kpi-card"><span>${tr('cmsKpiPremiumLabel')}</span><strong>${kpi.premiumPct}%</strong><small>${tr('cmsKpiPremiumRatio', { count: kpi.premiumUsers, pct: kpi.premiumPct })}</small></article>
    <article class="saas-cms-kpi-card"><span>${tr('cmsKpiCatalogLabel')}</span><strong>${kpi.activeCatalog}</strong><small>${tr('cmsKpiCatalogRatio', { active: kpi.activeCatalog, total: kpi.totalCatalog, premium: kpi.premiumCatalog })}</small></article>
    <article class="saas-cms-kpi-card"><span>${tr('cmsKpiFlagsLabel')}</span><strong>${tr('cmsKpiFlagsValue', { limit: kpi.freePlanLimit })}</strong><small>${tr('cmsKpiFlagsHint', { disabled: kpi.disabledModulesCount })}</small></article>
    <article class="saas-cms-kpi-card"><span>${tr('cmsKpiHealthLabel')}</span><strong>${kpi.sessionErrors}</strong><small>${tr('cmsKpiHealthHint', { errors: kpi.sessionErrors, audits: kpi.auditCount })}</small></article>
  </section>`;
}

function renderUserRow(tr, user, canEditUsers, currentUid) {
  const uid = user.uid || user.id || '';
  const selfLocked = !canEditUsers || uid === currentUid;
  const label = user.displayName || user.email || uid;
  const initial = escapeHtml((label || 'U').trim().charAt(0).toUpperCase());
  const selfBadge = uid === currentUid ? `<span class="saas-cms-badge">${escapeHtml(tr('cmsSelfProtected'))}</span>` : '';
  return `<tr>
    <td><div class="saas-cms-user-cell"><span class="saas-cms-avatar">${initial}</span><div class="saas-cms-user-meta"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(user.email || uid)}</small>${selfBadge}</div></div></td>
    <td><span class="saas-pill">${escapeHtml(user.role || 'user')}</span></td>
    <td><span class="saas-pill tier-${user.tier === 'premium' ? 'premium' : 'free'}">${escapeHtml(user.tier || 'free')}</span></td>
    <td><span class="saas-pill status-${escapeHtml(user.status || 'unknown')}">${escapeHtml(user.status || 'unknown')}</span></td>
    <td><small>${escapeHtml(formatAuditTime(user.createdAt).slice(0, 10))}</small></td>
    <td><small>${escapeHtml(formatAuditTime(user.lastLogin))}</small></td>
    <td><div class="saas-row-actions">
      <button type="button" data-tier="${user.tier === 'premium' ? 'free' : 'premium'}" data-uid="${escapeHtml(uid)}" ${!canEditUsers ? 'disabled' : ''}>${user.tier === 'premium' ? tr('adminSetFree') : tr('adminSetPremium')}</button>
      <button type="button" data-status="${user.status === 'active' ? 'locked' : 'active'}" data-uid="${escapeHtml(uid)}" ${selfLocked ? 'disabled' : ''} ${uid === currentUid ? `title="${escapeHtml(tr('adminSelfSuspendTitle'))}"` : ''}>${user.status === 'active' ? tr('adminSuspend') : tr('adminActivate')}</button>
      <button type="button" class="saas-danger-button" data-status="banned" data-uid="${escapeHtml(uid)}" ${selfLocked ? 'disabled' : ''} ${uid === currentUid ? `title="${escapeHtml(tr('adminSelfBanTitle'))}"` : ''}>${tr('adminBan')}</button>
      <button type="button" data-inspect-uid="${escapeHtml(uid)}">${tr('cmsInspectBtn')}</button>
    </div></td>
  </tr>`;
}

export function renderUsersSection({
  tr, lang = 'vi', loading, canEditUsers, users, emailPrefix, accessReason, authUser,
  pageIndex, hasMore, userFilters = { role: 'all', tier: 'all', status: 'all' }
}) {
  const visibleUsers = filterUsersList(users, userFilters);
  const reasonChips = canEditUsers ? `<div class="saas-cms-chips"><span>${tr('cmsQuickReasonsLabel')}</span>${QUICK_AUDIT_REASONS.map((r) => {
    const text = r.label[lang] || r.label.en;
    return `<button type="button" class="saas-cms-chip" data-quick-reason="${escapeHtml(text)}">${escapeHtml(text)}</button>`;
  }).join('')}</div>` : '';
  return `<section class="saas-admin-card" data-section="users">
    <div class="saas-admin-title-row"><div><div class="saas-auth-kicker">${tr('adminAccessKicker')}</div><h1>${tr('adminUsersTitle')}</h1><p>${tr('adminUsersSubtitle')}</p></div>
      <div class="saas-cms-header-actions"><button type="button" class="saas-secondary-button" data-action="export-users-csv" ${visibleUsers.length ? '' : 'disabled'}>${tr('cmsExportUsersCsv')}</button><button type="button" class="saas-secondary-button" data-action="refresh" ${loading ? 'disabled' : ''}>${loading ? tr('adminLoading') : tr('adminRefresh')}</button></div>
    </div>
    ${canEditUsers ? '' : `<div class="saas-admin-notice" role="note">${tr('adminReadOnlyHint')}</div>`}
    <form class="saas-admin-search" data-action="search-form"><div class="saas-cms-toolbar">
      <label class="saas-cms-field">${tr('adminSearchLabel')}<input id="admin-user-search" type="search" maxlength="254" autocomplete="off" placeholder="${tr('adminSearchPlaceholder')}" value="${escapeHtml(emailPrefix)}"></label>
      <label class="saas-cms-field">${tr('cmsFilterRoleLabel')}<select data-filter-role>${['all', 'admin', 'support', 'catalog-editor', 'user'].map((v) => `<option value="${v}" ${userFilters.role === v ? 'selected' : ''}>${v === 'all' ? tr('cmsFilterAll') : v}</option>`).join('')}</select></label>
      <label class="saas-cms-field">${tr('cmsFilterTierLabel')}<select data-filter-tier>${['all', 'free', 'premium'].map((v) => `<option value="${v}" ${userFilters.tier === v ? 'selected' : ''}>${v === 'all' ? tr('cmsFilterAll') : v}</option>`).join('')}</select></label>
      <label class="saas-cms-field">${tr('cmsFilterStatusLabel')}<select data-filter-status>${['all', 'active', 'locked', 'banned'].map((v) => `<option value="${v}" ${userFilters.status === v ? 'selected' : ''}>${v === 'all' ? tr('cmsFilterAll') : v}</option>`).join('')}</select></label>
      <div class="saas-cms-btn-row"><button type="submit" class="saas-secondary-button saas-cms-primary-btn">${tr('adminSearchButton')}</button><button type="button" class="saas-secondary-button" data-action="clear-search" ${emailPrefix || userFilters.role !== 'all' || userFilters.tier !== 'all' || userFilters.status !== 'all' ? '' : 'disabled'}>${tr('adminClearButton')}</button></div>
    </div><small>${tr('adminSearchHint')} · ${tr('cmsShowingCount', { shown: visibleUsers.length, total: users.length })}</small></form>
    ${canEditUsers ? `<div class="saas-admin-search"><label class="saas-cms-field" for="admin-access-reason">${tr('adminAccessReasonLabel')}<input id="admin-access-reason" type="text" maxlength="200" placeholder="${escapeHtml(tr('adminAccessReasonPlaceholder'))}" value="${escapeHtml(accessReason)}"></label>${reasonChips}</div>` : ''}
    <div class="saas-table-wrap"><table class="saas-users-table"><thead><tr><th>${tr('adminColUser')}</th><th>${tr('adminColRole')}</th><th>${tr('adminColTier')}</th><th>${tr('adminColStatus')}</th><th>${tr('cmsColCreated')}</th><th>${tr('cmsColLastLogin')}</th><th>${tr('adminColActions')}</th></tr></thead><tbody>
      ${visibleUsers.map((user) => renderUserRow(tr, user, canEditUsers, authUser.uid)).join('')}
      ${visibleUsers.length ? '' : `<tr><td colspan="7" class="saas-empty-row">${loading ? tr('adminLoadingUsers') : (users.length ? tr('cmsNoMatchingFilter') : tr('adminNoUsers'))}</td></tr>`}
    </tbody></table></div>
    <nav class="saas-admin-pagination" aria-label="${tr('adminPagesAria')}"><span>${tr('adminPageNumber', { page: pageIndex + 1 })}</span><div><button type="button" class="saas-secondary-button" data-action="previous" ${pageIndex === 0 || loading ? 'disabled' : ''}>${tr('adminPrevious')}</button><button type="button" class="saas-secondary-button" data-action="next" ${!hasMore || loading ? 'disabled' : ''}>${tr('adminNext')}</button></div></nav>
  </section>`;
}

export function renderFlagsSection({ tr, canEditUsers, flags, flagsReason, flagsBusy, errorSummary }) {
  const paused = new Set(Array.isArray(flags.disabledModules) ? flags.disabledModules : []);
  const recentErrors = Array.isArray(errorSummary?.recent) ? errorSummary.recent : [];
  return `<section class="saas-admin-card" data-section="config">
    <div class="saas-admin-title-row"><div><div class="saas-auth-kicker">${tr('cmsConfigKicker')}</div><h2>${tr('adminFlagsTitle')}</h2><p>${tr('adminFlagsSubtitle')}</p></div></div>
    <form class="saas-admin-search" data-action="flags-form"><div class="saas-cms-form-grid">
      <label class="saas-cms-checkbox-row"><input type="checkbox" name="maintenanceMode" ${flags.maintenanceMode ? 'checked' : ''} ${canEditUsers ? '' : 'disabled'}> ${tr('adminMaintenanceLabel')}</label>
      <label class="saas-cms-field">${tr('adminFreeLimitLabel')}<input type="number" name="freePlanLimit" min="1" max="200" value="${escapeHtml(flags.freePlanLimit)}" ${canEditUsers ? '' : 'disabled'}></label>
      <label class="saas-cms-field saas-cms-span-2">${tr('adminMaintenanceMsgLabel')}<input type="text" name="maintenanceMessage" maxlength="300" value="${escapeHtml(flags.maintenanceMessage)}" ${canEditUsers ? '' : 'disabled'}></label>
      <label class="saas-cms-field saas-cms-span-2">${tr('adminDisabledModulesLabel')}<input type="text" name="disabledModules" maxlength="400" value="${escapeHtml(flags.disabledModules.join(', '))}" ${canEditUsers ? '' : 'disabled'}></label>
      <label class="saas-cms-field saas-cms-span-2">${tr('adminFlagsReasonLabel')}<input id="admin-flags-reason" type="text" name="flagsReason" maxlength="200" placeholder="${escapeHtml(tr('adminFlagsReasonPlaceholder'))}" value="${escapeHtml(flagsReason)}" ${canEditUsers ? '' : 'disabled'}></label>
    </div>
    ${canEditUsers ? `<div class="saas-cms-chips"><span>${tr('cmsFreePresetsLabel')}</span>${[20, 50, 100].map((v) => `<button type="button" class="saas-cms-chip" data-limit-preset="${v}">${v}</button>`).join('')}</div>` : ''}
    <div class="saas-cms-field"><span>${tr('cmsModuleSwitchesLabel')}</span><small>${tr('cmsModuleSwitchesHint')}</small><div class="saas-cms-switch-grid">
      ${CMS_CONTROLLABLE_MODULES.map((m) => `<button type="button" class="saas-cms-switch ${paused.has(m.id) ? 'is-paused' : ''}" data-toggle-module="${m.id}" ${canEditUsers ? '' : 'disabled'}><span>${escapeHtml(tr(m.labelKey))}</span><span class="saas-pill ${paused.has(m.id) ? 'status-locked' : 'status-active'}">${paused.has(m.id) ? 'OFF' : 'ON'}</span></button>`).join('')}
    </div></div>
    <div class="saas-cms-btn-row"><button type="submit" class="saas-secondary-button saas-cms-primary-btn" ${flagsBusy || !canEditUsers ? 'disabled' : ''}>${tr('adminSaveFlags')}</button></div></form>
    <div class="saas-admin-search"><small>${tr('cmsErrorsTableTitle')} · ${tr('adminSessionErrorsLabel', { count: errorSummary.totalCount })}</small>
      <div class="saas-table-wrap"><table class="saas-users-table"><thead><tr><th>${tr('cmsErrColTime')}</th><th>${tr('cmsErrColSource')}</th><th>${tr('cmsErrColMessage')}</th></tr></thead><tbody>
        ${recentErrors.map((err) => `<tr><td><small>${escapeHtml(formatAuditTime(err.at))}</small></td><td><span class="saas-pill">${escapeHtml(err.source)}</span></td><td>${escapeHtml(err.message)}</td></tr>`).join('')}
        ${recentErrors.length ? '' : `<tr><td colspan="3" class="saas-empty-row">${tr('cmsErrorsEmpty')}</td></tr>`}
      </tbody></table></div>
    </div>
  </section>`;
}

export function renderUsersAndFlagsSections(props) {
  return `${renderUsersSection(props)}${renderFlagsSection(props)}${renderAuditSection(props)}`;
}

export function renderAdminShell({
  tr, profile, status, error, usersSection = '', catalogSection = '', kpiSection = '',
  activeSection = 'all', flags = null, envLabel = 'development', canViewUsersAudit = true, canEditCatalog = true,
  modalHtml = ''
}) {
  const navItems = [{ id: 'all', label: tr('cmsNavAll') }];
  if (canViewUsersAudit) navItems.push({ id: 'users', label: tr('cmsNavUsers') }, { id: 'config', label: tr('cmsNavConfig') }, { id: 'audit', label: tr('cmsNavAudit') });
  if (canEditCatalog) navItems.push({ id: 'catalog', label: tr('cmsNavCatalog') });
  const maint = Boolean(flags?.maintenanceMode);
  const kpiHtml = kpiSection || renderKpiRibbon({ tr, kpi: computeAdminKpiSummary({ flags: flags || {} }) });
  return `<header class="saas-admin-header">
    <div class="saas-cms-header-top">
      <div class="saas-cms-brand"><img class="saas-cms-brand-logo" src="/brand/safelift3d-lockup.png" alt="SafeLift3D"><div class="saas-cms-title-stack"><strong>${tr('cmsCommandTitle')}</strong><div class="saas-cms-badges"><span class="saas-cms-badge">${escapeHtml(tr('adminRoleLabel', { role: profile.role }))}</span><span class="saas-cms-badge is-env">${escapeHtml(tr('cmsEnvBadge', { env: String(envLabel).toUpperCase() }))}</span><span class="saas-cms-badge ${maint ? 'is-maint' : 'is-live'}">${maint ? tr('cmsStatusMaint') : tr('cmsStatusLive')}</span></div></div></div>
      <div class="saas-admin-actions"><a href="/">${tr('adminWorkspaceLink')}</a><button type="button" data-action="language">${tr('adminToggleLang')}</button><button type="button" data-action="signout">${tr('adminSignOut')}</button></div>
    </div>
    <nav class="saas-cms-nav">${navItems.map((n) => `<button type="button" class="saas-cms-nav-btn ${activeSection === n.id ? 'is-active' : ''}" data-nav-section="${n.id}">${n.label}</button>`).join('')}</nav>
  </header>
  ${status ? `<div class="saas-admin-notice ${error ? 'is-error' : ''}" role="status">${escapeHtml(status)}</div>` : ''}
  <div class="saas-cms-container">${kpiHtml}${usersSection}${catalogSection}</div>
  ${modalHtml}`;
}
