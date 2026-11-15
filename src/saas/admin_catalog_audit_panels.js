// @purpose: Dựng giao diện phân hệ Catalog thiết bị 3 cột, Nhật ký Kiểm toán Diff và Modal chi tiết người dùng
import { CATALOG_QUICK_TEMPLATES, filterAuditLogs, filterCatalogList } from './admin_helpers.js';
import { escapeHtml } from './session_ui_bindings.js';

export function formatAuditTime(ts) {
  if (!ts) return '—';
  const date = typeof ts?.toDate === 'function'
    ? ts.toDate()
    : (typeof ts?.seconds === 'number' ? new Date(ts.seconds * 1000) : new Date(ts));
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString().replace('T', ' ').slice(0, 19);
}

export function renderCatalogSection({
  tr, catalogLoading, catalogDraft, catalogBusy, catalogItems,
  catalogFilters = { kind: 'all', tier: 'all', query: '' }
}) {
  const visibleItems = filterCatalogList(catalogItems, catalogFilters);
  const editingExisting = Boolean(catalogDraft.id && catalogItems.some((item) => item.id === catalogDraft.id));
  return `<section class="saas-admin-card" data-section="catalog">
    <div class="saas-admin-title-row"><div><div class="saas-auth-kicker">${tr('cmsCatalogKicker')}</div><h2>${tr('adminCatalogTitle')}</h2><p>${tr('adminCatalogSubtitle')}</p></div>
      <button type="button" class="saas-secondary-button" data-action="refresh-catalog" ${catalogLoading ? 'disabled' : ''}>${catalogLoading ? tr('adminLoading') : tr('adminRefresh')}</button>
    </div>
    <div class="saas-cms-chips"><span>${tr('cmsCatalogTemplatesLabel')}</span>${CATALOG_QUICK_TEMPLATES.map((tpl) => `<button type="button" class="saas-cms-chip" data-catalog-template="${tpl.id}" ${catalogBusy ? 'disabled' : ''}>${escapeHtml(tpl.templateLabel)}</button>`).join('')}</div>
    ${editingExisting ? `<div class="saas-admin-notice">${escapeHtml(tr('cmsCatalogEditBanner', { id: catalogDraft.id }))}</div>` : ''}
    <form class="saas-admin-search" data-action="catalog-form"><div class="saas-cms-form-grid">
      <label class="saas-cms-field">${tr('adminCatalogIdLabel')}<input type="text" name="id" required maxlength="64" pattern="[a-z0-9_-]{2,64}" value="${escapeHtml(catalogDraft.id)}" ${catalogBusy ? 'disabled' : ''}></label>
      <label class="saas-cms-field">${tr('adminCatalogKindLabel')}<select name="kind" ${catalogBusy ? 'disabled' : ''}>${['cargo', 'beam', 'sling', 'hardware'].map((kind) => `<option value="${kind}" ${catalogDraft.kind === kind ? 'selected' : ''}>${kind}</option>`).join('')}</select></label>
      <label class="saas-cms-field">${tr('adminCatalogTitleLabel')}<input type="text" name="title" required maxlength="100" value="${escapeHtml(catalogDraft.title)}" ${catalogBusy ? 'disabled' : ''}></label>
      <label class="saas-cms-field">${tr('adminCatalogCategoryLabel')}<input type="text" name="category" maxlength="60" value="${escapeHtml(catalogDraft.category)}" ${catalogBusy ? 'disabled' : ''}></label>
      <label class="saas-cms-field">${tr('adminCatalogWllLabel')}<input type="number" name="wllT" min="0" max="100000" step="any" value="${escapeHtml(catalogDraft.wllT)}" ${catalogBusy ? 'disabled' : ''}></label>
      <label class="saas-cms-field">${tr('adminCatalogMassLabel')}<input type="number" name="massKg" min="0" max="10000000" step="any" value="${escapeHtml(catalogDraft.massKg)}" ${catalogBusy ? 'disabled' : ''}></label>
      <label class="saas-cms-field">${tr('adminCatalogTierLabel')}<select name="tier" ${catalogBusy ? 'disabled' : ''}>${['free', 'premium'].map((tier) => `<option value="${tier}" ${catalogDraft.tier === tier ? 'selected' : ''}>${tier}</option>`).join('')}</select></label>
      <label class="saas-cms-checkbox-row"><input type="checkbox" name="enabled" ${catalogDraft.enabled ? 'checked' : ''} ${catalogBusy ? 'disabled' : ''}> ${tr('adminCatalogEnabledLabel')}</label>
      <label class="saas-cms-field saas-cms-span-2">${tr('adminCatalogNotesLabel')}<input type="text" name="notes" maxlength="300" value="${escapeHtml(catalogDraft.notes)}" ${catalogBusy ? 'disabled' : ''}></label>
    </div><div class="saas-cms-btn-row"><button type="submit" class="saas-secondary-button saas-cms-primary-btn" ${catalogBusy ? 'disabled' : ''}>${tr('adminCatalogSaveBtn')}</button><button type="button" class="saas-secondary-button" data-action="reset-catalog" ${catalogBusy ? 'disabled' : ''}>${tr('adminCatalogResetBtn')}</button></div></form>
    <div class="saas-cms-toolbar-3">
      <label class="saas-cms-field">${tr('cmsCatalogSearchLabel')}<input type="search" data-catalog-search maxlength="80" value="${escapeHtml(catalogFilters.query)}" placeholder="shackle, sts, 55t…"></label>
      <label class="saas-cms-field">${tr('cmsCatalogFilterKind')}<select data-catalog-filter-kind>${['all', 'cargo', 'beam', 'sling', 'hardware'].map((v) => `<option value="${v}" ${catalogFilters.kind === v ? 'selected' : ''}>${v === 'all' ? tr('cmsFilterAll') : v}</option>`).join('')}</select></label>
      <label class="saas-cms-field">${tr('cmsCatalogFilterTier')}<select data-catalog-filter-tier>${['all', 'free', 'premium'].map((v) => `<option value="${v}" ${catalogFilters.tier === v ? 'selected' : ''}>${v === 'all' ? tr('cmsFilterAll') : v}</option>`).join('')}</select></label>
    </div>
    <div class="saas-admin-search"><small>${tr('cmsShowingCount', { shown: visibleItems.length, total: catalogItems.length })}</small></div>
    <div class="saas-table-wrap"><table class="saas-users-table"><thead><tr><th>${tr('adminCatalogColId')}</th><th>${tr('adminCatalogColKind')}</th><th>${tr('adminCatalogColSpecs')}</th><th>${tr('adminCatalogColState')}</th><th>${tr('adminColActions')}</th></tr></thead><tbody>
      ${visibleItems.map((item) => `<tr><td><strong>${escapeHtml(item.title || item.id)}</strong><small>${escapeHtml(item.id)} · ${escapeHtml(item.category || '—')}</small></td><td>${escapeHtml(item.kind)} · <span class="saas-pill tier-${item.tier === 'premium' ? 'premium' : 'free'}">${escapeHtml(item.tier || 'free')}</span></td><td><small>WLL: ${item.wllT ?? '—'} t · Mass: ${item.massKg ?? '—'} kg</small></td><td><span class="saas-pill ${item.enabled ? 'status-active' : 'status-locked'}">${item.enabled ? tr('adminCatalogEnabled') : tr('adminCatalogDisabled')}</span></td><td><div class="saas-row-actions"><button type="button" data-catalog-edit="${escapeHtml(item.id)}">${tr('adminCatalogEditBtn')}</button><button type="button" class="saas-danger-button" data-catalog-delete="${escapeHtml(item.id)}" ${catalogBusy ? 'disabled' : ''}>${tr('adminCatalogDeleteBtn')}</button></div></td></tr>`).join('')}
      ${visibleItems.length ? '' : `<tr><td colspan="5" class="saas-empty-row">${catalogLoading ? tr('adminLoading') : (catalogItems.length ? tr('cmsNoMatchingFilter') : tr('adminCatalogEmpty'))}</td></tr>`}
    </tbody></table></div>
  </section>`;
}

export function renderAuditSection({
  tr, auditLoading, auditLogs, auditFilters = { action: 'all', query: '' }
}) {
  const visibleLogs = filterAuditLogs(auditLogs, auditFilters);
  return `<section class="saas-admin-card" data-section="audit">
    <div class="saas-admin-title-row"><div><div class="saas-auth-kicker">${tr('cmsAuditKicker')}</div><h2>${tr('adminAuditTitle')}</h2><p>${tr('adminAuditSubtitle')}</p></div>
      <div class="saas-cms-header-actions"><button type="button" class="saas-secondary-button" data-action="export-audit-csv" ${visibleLogs.length ? '' : 'disabled'}>${tr('cmsExportAuditCsv')}</button><button type="button" class="saas-secondary-button" data-action="refresh-audit" ${auditLoading ? 'disabled' : ''}>${auditLoading ? tr('adminLoading') : tr('adminRefresh')}</button></div>
    </div>
    <div class="saas-cms-toolbar-3">
      <label class="saas-cms-field">${tr('cmsAuditSearchLabel')}<input type="search" data-audit-search maxlength="100" value="${escapeHtml(auditFilters.query)}" placeholder="UID, user, reason…"></label>
      <label class="saas-cms-field">${tr('cmsAuditFilterAction')}<select data-audit-filter-action>${['all', 'USER_ACCESS_UPDATE', 'FLAGS_UPDATE', 'CATALOG_UPSERT', 'CATALOG_DELETE'].map((v) => `<option value="${v}" ${auditFilters.action === v ? 'selected' : ''}>${v === 'all' ? tr('cmsFilterAll') : v}</option>`).join('')}</select></label>
      <div class="saas-admin-search"><small>${tr('cmsShowingCount', { shown: visibleLogs.length, total: auditLogs.length })}</small></div>
    </div>
    <div class="saas-table-wrap"><table class="saas-users-table"><thead><tr><th>${tr('adminAuditColTime')}</th><th>${tr('adminAuditColActor')}</th><th>${tr('adminAuditColAction')}</th><th>${tr('adminAuditColTarget')}</th><th>${tr('adminAuditColReason')}</th><th>${tr('adminAuditColDiff')}</th><th>${tr('adminAuditColSummary')}</th></tr></thead><tbody>
      ${visibleLogs.map((entry) => {
        const diffText = entry.before || entry.after ? `${entry.before || '∅'} → ${entry.after || '∅'}` : '—';
        return `<tr><td><small>${escapeHtml(formatAuditTime(entry.createdAt))}</small></td><td><small>${escapeHtml(entry.actorUid || '')}</small></td><td><span class="saas-pill">${escapeHtml(entry.action || '')}</span></td><td>${escapeHtml(`${entry.targetType || ''}:${entry.targetId || ''}`)}</td><td>${escapeHtml(entry.reason || '—')}</td><td><span class="saas-cms-diff">${escapeHtml(diffText)}</span></td><td>${escapeHtml(entry.summary || '')}</td></tr>`;
      }).join('')}
      ${visibleLogs.length ? '' : `<tr><td colspan="7" class="saas-empty-row">${auditLoading ? tr('adminLoading') : (auditLogs.length ? tr('cmsNoMatchingFilter') : tr('adminAuditEmpty'))}</td></tr>`}
    </tbody></table></div>
  </section>`;
}

export function renderUserDetailModal({ tr, user }) {
  if (!user) return '';
  const uid = user.uid || user.id || '';
  return `<div class="saas-cms-modal-backdrop" data-user-modal-backdrop="true"><section class="saas-cms-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(tr('cmsModalKicker'))}">
    <div class="saas-admin-title-row"><div><div class="saas-auth-kicker">${tr('cmsModalKicker')}</div><h2>${escapeHtml(user.displayName || user.email || uid)}</h2></div><button type="button" class="saas-secondary-button" data-action="close-user-modal">${tr('saasClose')}</button></div>
    <div class="saas-cms-detail-grid">
      <div class="saas-cms-detail-item"><span>${tr('cmsModalUid')}</span><strong>${escapeHtml(uid)}</strong></div>
      <div class="saas-cms-detail-item"><span>${tr('cmsModalEmail')}</span><strong>${escapeHtml(user.email || '—')}</strong></div>
      <div class="saas-cms-detail-item"><span>${tr('cmsModalName')}</span><strong>${escapeHtml(user.displayName || '—')}</strong></div>
      <div class="saas-cms-detail-item"><span>${tr('cmsModalRole')}</span><strong>${escapeHtml(user.role || 'user')}</strong></div>
      <div class="saas-cms-detail-item"><span>${tr('cmsModalTier')}</span><strong>${escapeHtml(user.tier || 'free')}</strong></div>
      <div class="saas-cms-detail-item"><span>${tr('cmsModalStatus')}</span><strong>${escapeHtml(user.status || 'active')}</strong></div>
      <div class="saas-cms-detail-item"><span>${tr('cmsModalCreated')}</span><strong>${escapeHtml(formatAuditTime(user.createdAt))}</strong></div>
      <div class="saas-cms-detail-item"><span>${tr('cmsModalLastLogin')}</span><strong>${escapeHtml(formatAuditTime(user.lastLogin))}</strong></div>
    </div>
    <div class="saas-cms-btn-row"><button type="button" class="saas-secondary-button saas-cms-primary-btn" data-copy-uid="${escapeHtml(uid)}">${tr('cmsCopyUid')}</button><button type="button" class="saas-secondary-button" data-action="close-user-modal">${tr('saasClose')}</button></div>
  </section></div>`;
}
