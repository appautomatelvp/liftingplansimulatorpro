import * as workspaceData from './workspace_data.js';
import { getLang } from '../i18n/index.js';
import { trapDialogFocus } from './dialog_accessibility.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function mountWorkspaceDashboard({ db, profile, dataService = workspaceData }) {
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
  let releaseWorkspaceFocus = () => {};
  let onKey = null;
  const legacyRigs = readLegacyRigs();
  const migratedRigIds = readMigratedRigIds();
  const en = () => getLang() === 'en';
  const copy = (vi, english) => en() ? english : vi;
  const timestamp = (value) => value?.toDate ? value.toDate().toLocaleDateString(en() ? 'en-US' : 'vi-VN') : '';
  const closeWorkspace = () => {
    if (onKey) document.removeEventListener('keydown', onKey);
    backdrop.remove();
    releaseWorkspaceFocus();
  };

  function readLegacyRigs() {
    try {
      const value = JSON.parse(localStorage.getItem('lp-user-rigs') || '[]');
      return Array.isArray(value) ? value.filter((rig) => rig && typeof rig === 'object' && rig.id != null).slice(0, 24) : [];
    } catch { return []; }
  }

  function readMigratedRigIds() {
    try {
      const value = JSON.parse(localStorage.getItem(`lp-user-rigs-migrated:${profile.uid}`) || '[]');
      return Array.isArray(value) ? value.map(String).slice(0, 24) : [];
    } catch { return []; }
  }

  function openLegacyRigPicker() {
    const pending = legacyRigs.filter((rig) => !migratedRigIds.includes(String(rig.id)));
    if (!pending.length) return;
    const layer = document.createElement('div');
    layer.className = 'saas-workspace-form-backdrop';
    layer.innerHTML = `<section class="saas-workspace-form saas-workspace-link-picker" role="dialog" aria-modal="true" aria-label="${copy('Nhập rig đã lưu', 'Import saved rigs')}"><button type="button" data-picker-close class="saas-workspace-close" aria-label="${copy('Đóng', 'Close')}">×</button><span class="saas-workspace-kicker">${copy('MIGRATION DỮ LIỆU CỤC BỘ', 'LOCAL DATA MIGRATION')}</span><h3>${copy('Nhập rig đã lưu', 'Import saved rigs')}</h3><p>${copy('Chọn từng rig để lưu thành lift plan trên tài khoản. Dữ liệu cục bộ chỉ bị đánh dấu đã nhập sau khi lưu thành công.', 'Import rigs one at a time as account lift plans. A local rig is marked imported only after the cloud save succeeds.')}</p><div class="saas-workspace-form-error" data-import-error hidden></div><div class="saas-workspace-link-list">${pending.map((rig) => `<label><span><strong>${esc(rig.name || copy('Rig chưa đặt tên', 'Unnamed rig'))}</strong><small>${(Array.isArray(rig.extraCables) ? rig.extraCables.length : 0)} ${copy('cáp bổ sung', 'additional cables')}</small></span><button type="button" data-import-rig="${esc(rig.id)}">${copy('Nhập', 'Import')}</button></label>`).join('')}</div><small>${copy('Mỗi phương án giữ giới hạn dữ liệu 48 KB; không nhập tệp mô hình.', 'Each plan keeps the 48 KB data limit; model files are not imported.')}</small></section>`;
    backdrop.append(layer);
    const releasePickerFocus = trapDialogFocus(layer.querySelector('[role="dialog"]'), { initialFocus: layer.querySelector('[data-import-rig]') || layer.querySelector('[data-picker-close]') });
    const closePicker = () => { layer.remove(); releasePickerFocus(); };
    layer.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); closePicker(); } });
    layer.addEventListener('click', async (event) => {
      if (event.target === layer || event.target.closest('[data-picker-close]')) { closePicker(); return; }
      const button = event.target.closest('[data-import-rig]');
      if (!button || button.disabled) return;
      const rig = pending.find((item) => String(item.id) === button.dataset.importRig);
      if (!rig) return;
      button.disabled = true;
      try {
        const state = window.__LIFTING_RUNTIME__?.api?.getState?.();
        if (!state) throw new Error(copy('Mô phỏng chưa sẵn sàng để nhập rig.', 'The simulator is not ready to import this rig.'));
        await dataService.createLiftPlan(db, profile, {
          title: String(rig.name || copy('Rig đã lưu', 'Saved rig')).slice(0, 100),
          description: copy('Đã nhập từ thư viện rig cục bộ.', 'Imported from the local rig library.'),
          snapshot: dataService.makeLegacyRigSnapshot(state, rig)
        });
        migratedRigIds.push(String(rig.id));
        try { localStorage.setItem(`lp-user-rigs-migrated:${profile.uid}`, JSON.stringify(migratedRigIds.slice(-24))); } catch { /* Keep current-session migration state if storage is unavailable. */ }
        button.closest('label')?.remove();
        notice(copy(`Đã nhập “${rig.name || 'Rig'}” vào lift plan.`, `Imported “${rig.name || 'Rig'}” into lift plans.`));
        await loadPage(true);
        if (!legacyRigs.some((item) => !migratedRigIds.includes(String(item.id)))) {
          backdrop.querySelector('[data-action="import-legacy"]')?.setAttribute('hidden', '');
          closePicker();
        }
      } catch (error) {
        console.error('[SafeLift3D] Legacy rig migration failed', error);
        const errorBox = layer.querySelector('[data-import-error]');
        if (errorBox) { errorBox.hidden = false; errorBox.textContent = error.message || copy('Không nhập được rig này.', 'Could not import this rig.'); }
        button.disabled = false;
      }
    });
  }

  const template = () => {
    backdrop.innerHTML = `<section class="saas-workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="saas-workspace-title">
      <header class="saas-workspace-header"><div><span class="saas-workspace-kicker">SAFELIFT3D · PERSONAL LIBRARY</span><h2 id="saas-workspace-title">${copy('Kho làm việc của tôi', 'My workspace')}</h2><p>${copy('Lưu cấu hình kỹ thuật gọn nhẹ để dùng lại. Không tải tệp mô hình 3D lên Firebase.', 'Save lightweight engineering configurations for reuse. 3D model files are never uploaded to Firebase.')}</p></div><button type="button" class="saas-workspace-close" data-action="close" aria-label="${copy('Đóng', 'Close')}">×</button></header>
      <nav class="saas-workspace-tabs"><button type="button" data-tab="liftPlans">${copy('Phương án nâng', 'Lift plans')}</button><button type="button" data-tab="equipment">${copy('Kho dụng cụ', 'My equipment')}</button></nav>
      <div class="saas-workspace-toolbar"><label class="saas-workspace-search"><span>⌕</span><input type="search" data-search placeholder="${copy('Tìm trong trang hiện tại…', 'Search this page…')}"></label><button type="button" class="saas-workspace-secondary" data-action="import-legacy" ${legacyRigs.some((rig) => !migratedRigIds.includes(String(rig.id))) ? '' : 'hidden'}>${copy('Nhập rig đã lưu', 'Import saved rigs')}</button><button type="button" class="saas-workspace-primary" data-action="create">＋ ${copy('Lưu phương án hiện tại', 'Save current plan')}</button></div>
      <div class="saas-workspace-notice" data-notice hidden></div><div class="saas-workspace-list" data-list aria-live="polite"></div>
      <footer class="saas-workspace-footer"><span data-count></span><button type="button" data-action="more" hidden>${copy('Tải thêm', 'Load more')}</button></footer>
      <small class="saas-workspace-quota">${copy(`Giới hạn hiện tại: ${profile.tier === 'premium' || profile.tier === 'admin' ? 200 : 20} phương án và dụng cụ mỗi loại.`, `Current limit: ${profile.tier === 'premium' || profile.tier === 'admin' ? 200 : 20} plans and equipment items per type.`)}</small>
    </section>`;
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
    if (create) create.textContent = tab === 'liftPlans' ? `＋ ${copy('Lưu phương án hiện tại', 'Save current plan')}` : `＋ ${copy('Thêm dụng cụ', 'Add equipment')}`;
    loadPage(true);
  }

  function render() {
    const list = backdrop.querySelector('[data-list]');
    if (!list) return;
    const filtered = items.filter((item) => `${item.title || item.name || ''} ${item.description || ''} ${item.manufacturer || ''} ${item.model || ''}`.toLowerCase().includes(searchText.toLowerCase()));
    if (!filtered.length) {
      list.innerHTML = `<div class="saas-workspace-empty"><span>▱</span><strong>${copy('Chưa có dữ liệu trong mục này', 'Nothing saved here yet')}</strong><small>${copy('Tạo mục đầu tiên để dùng lại ở các lần làm việc sau.', 'Create your first item to reuse it in future work.')}</small></div>`;
    } else {
      list.innerHTML = filtered.map((item) => tab === 'liftPlans' ? renderPlan(item) : renderEquipment(item)).join('');
    }
    backdrop.querySelector('[data-count]').textContent = copy(`${items.length} mục trên trang này`, `${items.length} items on this page`);
    backdrop.querySelector('[data-action="more"]').hidden = !hasMore;
  }

  function renderPlan(item) {
    const snapshot = (() => { try { return dataService.parsePlanSnapshot(item.snapshot); } catch { return null; } })();
    const input = snapshot?.inputs || {};
    const dims = [input.L, input.W, input.H].every(Number.isFinite) ? `${input.L} × ${input.W} × ${input.H} m` : '';
    const status = snapshot?.analysis?.overallStatus;
    const statusLabel = status ? `${copy('Đánh giá lúc lưu', 'Saved assessment')}: ${status}` : '';
    const equipmentCount = Array.isArray(item.equipmentIds) ? item.equipmentIds.length : 0;
    return `<article class="saas-workspace-card ${item.archived ? 'is-archived' : ''}"><div class="saas-workspace-card-icon">⌖</div><div class="saas-workspace-card-main"><div class="saas-workspace-card-title"><strong>${esc(item.title)}</strong><span class="saas-workspace-version">r${Number(item.revision) || 1}</span>${status ? `<span class="saas-workspace-status status-${esc(status.toLowerCase())}">${esc(status)}</span>` : ''}${item.archived ? `<span class="saas-workspace-archived">${copy('Đã lưu trữ', 'Archived')}</span>` : ''}</div><small>${esc(item.description || dims || copy('Phương án nâng', 'Lift plan'))} · ${copy('bộ giải', 'solver')} ${esc(item.solverVersion || '?')} · ${esc(timestamp(item.updatedAt))}${statusLabel ? ` · ${esc(statusLabel)}` : ''}${equipmentCount ? ` · ${equipmentCount} ${copy('dụng cụ liên kết', 'linked equipment')}` : ''}</small>${snapshot?.solverVersion !== '5.0' ? `<em>${copy('Cảnh báo: phương án lưu bằng phiên bản bộ giải khác.', 'Warning: this plan was saved with a different solver version.')}</em>` : ''}</div><div class="saas-workspace-card-actions"><button type="button" data-action="apply" data-id="${esc(item.id)}" ${item.archived ? 'disabled' : ''}>${copy('Mở', 'Open')}</button><button type="button" data-action="duplicate" data-id="${esc(item.id)}">${copy('Sao chép', 'Copy')}</button><button type="button" data-action="export" data-id="${esc(item.id)}">${copy('Xuất JSON', 'Export JSON')}</button><button type="button" data-action="archive" data-id="${esc(item.id)}" data-archived="${!item.archived}">${item.archived ? copy('Khôi phục', 'Restore') : copy('Lưu trữ', 'Archive')}</button><button type="button" class="is-danger" data-action="delete" data-id="${esc(item.id)}">${copy('Xóa', 'Delete')}</button></div></article>`;
  }

  async function chooseEquipmentLinks() {
    let page = await dataService.listWorkspacePage(db, profile.uid, 'equipment');
    const equipment = [...page.items];
    while (page.hasMore) {
      page = await dataService.listWorkspacePage(db, profile.uid, 'equipment', { cursor: page.cursor });
      equipment.push(...page.items);
      if (equipment.length >= 200) break;
    }
    if (!equipment.length) return [];
    return new Promise((resolve) => {
      const layer = document.createElement('div');
      layer.className = 'saas-workspace-form-backdrop';
      layer.innerHTML = `<form class="saas-workspace-form saas-workspace-link-picker" role="dialog" aria-modal="true" aria-labelledby="saas-equipment-picker-title"><button type="button" data-picker-cancel class="saas-workspace-close" aria-label="${copy('Đóng', 'Close')}">×</button><span class="saas-workspace-kicker">${copy('LIÊN KẾT KHO DỤNG CỤ', 'EQUIPMENT LIBRARY')}</span><h3 id="saas-equipment-picker-title">${copy('Gắn dụng cụ vào phương án?', 'Attach equipment to this plan?')}</h3><p>${copy('Chọn tối đa 20 mục. Đây là liên kết tham chiếu; thông số trong kho dụng cụ không tự xác nhận khả năng chịu tải.', 'Select up to 20 items. These are references; library data does not certify load capacity.')}</p><div class="saas-workspace-link-list">${equipment.map((item) => `<label><input type="checkbox" name="equipmentIds" value="${esc(item.id)}"><span><strong>${esc(item.name)}</strong><small>${esc([item.category, item.model, item.wllT != null ? `${item.wllT} t WLL` : ''].filter(Boolean).join(' · '))}</small></span></label>`).join('')}</div><div class="saas-workspace-form-actions"><button type="button" data-picker-cancel>${copy('Bỏ qua', 'Skip')}</button><button type="submit" class="saas-workspace-primary">${copy('Gắn vào phương án', 'Attach to plan')}</button></div></form>`;
      backdrop.append(layer);
      const releasePickerFocus = trapDialogFocus(layer.querySelector('[role="dialog"]'), { initialFocus: layer.querySelector('[data-picker-cancel]') });
      const finish = (value) => { layer.remove(); releasePickerFocus(); resolve(value); };
      layer.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { event.stopPropagation(); finish([]); }
      });
      layer.addEventListener('click', (event) => { if (event.target === layer || event.target.closest('[data-picker-cancel]')) finish([]); });
      layer.querySelectorAll('[name="equipmentIds"]').forEach((checkbox) => checkbox.addEventListener('change', () => {
        if (layer.querySelectorAll('[name="equipmentIds"]:checked').length > 20) checkbox.checked = false;
      }));
      layer.querySelector('form').addEventListener('submit', (event) => {
        event.preventDefault();
        finish(Array.from(layer.querySelectorAll('[name="equipmentIds"]:checked')).map((input) => input.value));
      });
    });
  }

  function renderEquipment(item) {
    return `<article class="saas-workspace-card"><div class="saas-workspace-card-icon">⚙</div><div class="saas-workspace-card-main"><div class="saas-workspace-card-title"><strong>${esc(item.name)}</strong><span class="saas-workspace-version">${esc(item.category)}</span></div><small>${esc([item.manufacturer, item.model, item.wllT != null ? `${item.wllT} t WLL` : '', item.lengthM != null ? `${item.lengthM} m` : ''].filter(Boolean).join(' · ') || copy('Thông số chưa khai báo', 'No specifications added'))}</small>${item.certificateNo || item.inspectionExpiry ? `<small>${copy('Chứng chỉ', 'Certificate')}: ${esc(item.certificateNo || '—')} · ${copy('Kiểm định đến', 'Inspection expiry')}: ${esc(item.inspectionExpiry || '—')}</small>` : ''}</div><div class="saas-workspace-card-actions"><button type="button" data-action="edit" data-id="${esc(item.id)}">${copy('Sửa', 'Edit')}</button><button type="button" class="is-danger" data-action="delete" data-id="${esc(item.id)}">${copy('Xóa', 'Delete')}</button></div></article>`;
  }

  async function loadPage(reset = false) {
    if (busy) { pendingTabReload = true; return; }
    pendingTabReload = false;
    const requestedTab = tab;
    if (reset) { cursor = null; hasMore = false; items = []; }
    busy = true;
    const list = backdrop.querySelector('[data-list]');
    if (!items.length && list) list.innerHTML = `<div class="saas-workspace-loading">${copy('Đang tải thư viện…', 'Loading library…')}</div>`;
    try {
      const page = await dataService.listWorkspacePage(db, profile.uid, requestedTab, { cursor });
      if (requestedTab !== tab) return;
      items = reset ? page.items : [...items, ...page.items];
      cursor = page.cursor;
      hasMore = page.hasMore;
      notice('');
      render();
    } catch (error) {
      console.error('[SafeLift3D] Workspace library could not be loaded', error);
      notice(copy('Không tải được dữ liệu. Kiểm tra Firestore Rules và kết nối Firebase.', 'Could not load data. Check Firestore Rules and Firebase connection.'), true);
      if (!items.length && list) list.innerHTML = '';
    } finally {
      busy = false;
      if (pendingTabReload) loadPage(true);
    }
  }

  async function savePlan() {
    const runtime = window.__LIFTING_RUNTIME__;
    const state = runtime?.api?.getState?.();
    if (!state) throw new Error(copy('Chưa thể đọc cấu hình mô phỏng hiện tại.', 'The current simulation configuration is not available.'));
    const title = window.prompt(copy('Tên phương án nâng:', 'Lift plan name:'), `${state.cargoType || 'Lift plan'} · ${new Date().toLocaleDateString()}`);
    if (!title?.trim()) return;
    const description = window.prompt(copy('Ghi chú (không bắt buộc):', 'Notes (optional):'), '') || '';
    const equipmentIds = await chooseEquipmentLinks();
    const analysis = runtime.api.getCurrentLiftPlanSummary?.() || null;
    await dataService.createLiftPlan(db, profile, { title, description, equipmentIds, snapshot: dataService.makePlanSnapshot(state, analysis) });
    notice(copy('Đã lưu phương án nâng.', 'Lift plan saved.'));
    await loadPage(true);
  }

  async function openEquipmentForm(item = null) {
    const categories = ['hook', 'sling', 'chain', 'shackle', 'spreader', 'lifting_beam', 'crane', 'other'];
    const formLayer = document.createElement('div');
    formLayer.className = 'saas-workspace-form-backdrop';
    const field = (name, label, value = '', type = 'text', max = 80) => `<label>${label}<input name="${name}" type="${type}" maxlength="${max}" value="${esc(value)}" ${name === 'name' ? 'required' : ''}></label>`;
    formLayer.innerHTML = `<form class="saas-workspace-form" role="dialog" aria-modal="true" aria-labelledby="saas-equipment-form-title"><button type="button" data-form-close class="saas-workspace-close" aria-label="${copy('Đóng', 'Close')}">×</button><span class="saas-workspace-kicker">${copy('DỮ LIỆU DO NGƯỜI DÙNG NHẬP', 'USER-ENTERED DATA')}</span><h3 id="saas-equipment-form-title">${item ? copy('Sửa dụng cụ', 'Edit equipment') : copy('Thêm dụng cụ', 'Add equipment')}</h3><p>${copy('Thông tin này là dữ liệu cá nhân, không phải chứng nhận hoặc tiêu chuẩn đã được SafeLift3D xác minh.', 'This is personal data, not a certification or standard verified by SafeLift3D.')}</p><div class="saas-workspace-form-error" data-form-error hidden></div>${field('name', copy('Tên dụng cụ *', 'Equipment name *'), item?.name || '', 'text', 80)}<label>${copy('Loại', 'Type')}<select name="category">${categories.map((category) => `<option value="${category}" ${item?.category === category ? 'selected' : ''}>${category.replace('_', ' ')}</option>`).join('')}</select></label>${field('manufacturer', copy('Nhà sản xuất', 'Manufacturer'), item?.manufacturer)}${field('model', copy('Model', 'Model'), item?.model)}<div class="saas-workspace-form-grid">${field('wllT', 'WLL (t)', item?.wllT ?? '', 'number')}${field('lengthM', copy('Chiều dài (m)', 'Length (m)'), item?.lengthM ?? '', 'number')}${field('massKg', copy('Khối lượng (kg)', 'Mass (kg)'), item?.massKg ?? '', 'number')}${field('safetyFactor', copy('Hệ số an toàn', 'Safety factor'), item?.safetyFactor ?? '', 'number')}</div>${field('certificateNo', copy('Số chứng chỉ', 'Certificate number'), item?.certificateNo || '')}${field('inspectionExpiry', copy('Hạn kiểm định', 'Inspection expiry'), item?.inspectionExpiry || '', 'date', 10)}<label>${copy('Ghi chú', 'Notes')}<textarea name="notes" maxlength="500" rows="3">${esc(item?.notes || '')}</textarea></label><div class="saas-workspace-form-actions"><button type="button" data-form-close>${copy('Hủy', 'Cancel')}</button><button type="submit" class="saas-workspace-primary">${copy('Lưu dụng cụ', 'Save equipment')}</button></div><small>${copy('Tối đa 500 ký tự ghi chú. Không tải tệp hoặc mô hình 3D.', 'Notes are limited to 500 characters. File and 3D model uploads are disabled.')}</small></form>`;
    backdrop.append(formLayer);
    const releaseFormFocus = trapDialogFocus(formLayer.querySelector('[role="dialog"]'), { initialFocus: formLayer.querySelector('input[name="name"]') });
    const close = () => { formLayer.remove(); releaseFormFocus(); };
    formLayer.addEventListener('click', (event) => { if (event.target === formLayer || event.target.closest('[data-form-close]')) close(); });
    formLayer.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } });
    formLayer.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const values = Object.fromEntries(form.entries());
      try {
        const submit = event.currentTarget.querySelector('[type="submit"]');
        submit.disabled = true;
        if (item) await dataService.updateEquipment(db, profile.uid, item.id, values);
        else await dataService.createEquipment(db, profile, values);
        close();
        await loadPage(true);
        notice(copy('Đã lưu thông tin dụng cụ.', 'Equipment saved.'));
      } catch (error) {
        console.error('[SafeLift3D] Equipment save failed', error);
        const formError = formLayer.querySelector('[data-form-error]');
        formError.hidden = false;
        formError.textContent = error.message || copy('Không lưu được dụng cụ.', 'Could not save equipment.');
        const submit = event.currentTarget.querySelector('[type="submit"]');
        if (submit) submit.disabled = false;
      }
    });
  }

  async function applyPlan(item) {
    const runtime = window.__LIFTING_RUNTIME__;
    const state = runtime?.api?.getState?.();
    if (!state) throw new Error(copy('Mô phỏng chưa sẵn sàng để mở phương án.', 'The simulator is not ready to open this plan.'));
    const snapshot = dataService.parsePlanSnapshot(item.snapshot);
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
    notice('');
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
      if (actionName === 'import-legacy') { openLegacyRigPicker(); return; }
      if (actionName === 'more') { await loadPage(false); return; }
      if (!item) return;
      button.disabled = true;
      if (actionName === 'apply') { await applyPlan(item); return; }
      if (actionName === 'export') {
        const data = JSON.stringify({ schemaVersion: item.schemaVersion, title: item.title, description: item.description, revision: item.revision, solverVersion: item.solverVersion, equipmentIds: item.equipmentIds || [], snapshot: dataService.parsePlanSnapshot(item.snapshot) }, null, 2);
        const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${String(item.title || 'safelift3d-lift-plan').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60)}.json`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      if (actionName === 'edit') { await openEquipmentForm(item); return; }
      if (actionName === 'delete') {
        if (!window.confirm(copy(`Xóa “${item.title || item.name}”?`, `Delete “${item.title || item.name}”?`))) return;
        await dataService.deleteWorkspaceItem(db, profile.uid, tab, id);
      } else if (actionName === 'archive') {
        await dataService.updateLiftPlan(db, profile.uid, id, { archived: button.dataset.archived === 'true' });
      } else if (actionName === 'duplicate') {
        await dataService.createLiftPlan(db, profile, { title: `${item.title} (${copy('bản sao', 'copy')})`.slice(0, 100), description: item.description, equipmentIds: item.equipmentIds || [], snapshot: item.snapshot });
      }
      await loadPage(true);
    } catch (error) {
      console.error('[SafeLift3D] Workspace action failed', error);
      notice(error.message || copy('Thao tác không thành công.', 'The action could not be completed.'), true);
    } finally { if (button.isConnected) button.disabled = false; }
  }

  template();
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeWorkspace();
    else action(event);
  });
  backdrop.addEventListener('input', (event) => {
    if (event.target.matches('[data-search]')) { searchText = event.target.value.trim().toLowerCase(); render(); }
  });
  backdrop.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tab]');
    if (!button || button.dataset.tab === tab) return;
    tab = button.dataset.tab;
    searchText = '';
    backdrop.querySelector('[data-search]').value = '';
    paintTab();
  });
  onKey = (event) => { if (event.key === 'Escape') closeWorkspace(); };
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  releaseWorkspaceFocus = trapDialogFocus(backdrop.querySelector('[role="dialog"]'), { initialFocus: backdrop.querySelector('[data-search]') });
  return { dispose: closeWorkspace };
}
