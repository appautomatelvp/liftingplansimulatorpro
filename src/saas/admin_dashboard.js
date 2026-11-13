import { getLang, setLang } from '../i18n/index.js';
import { listAllUsers, setUserAccess } from './firebase_data.js';

export function mountAdminDashboard(container, { db, profile, authUser, signOut }) {
  const root = document.createElement('main');
  root.className = 'saas-admin-screen';
  container.replaceChildren(root);
  let users = [];
  let loading = false;
  let status = '';
  let error = false;
  const isAdmin = profile.role === 'admin';

  const render = () => {
    const en = getLang() === 'en';
    if (!isAdmin) {
      root.innerHTML = `<section class="saas-admin-card"><div class="saas-auth-brand"><span class="saas-auth-mark">SL</span><span>SafeLift3D</span></div><h1>${en ? 'Administrator access required' : 'Cần quyền quản trị viên'}</h1><p>${en ? 'This account does not have access to the CMS.' : 'Tài khoản này không có quyền truy cập CMS.'}</p><div class="saas-admin-actions"><a href="/">${en ? 'Return to workspace' : 'Quay lại không gian làm việc'}</a><button type="button" data-action="signout">${en ? 'Sign out' : 'Đăng xuất'}</button></div></section>`;
      root.querySelector('[data-action="signout"]')?.addEventListener('click', signOut);
      return;
    }
    root.innerHTML = `
      <header class="saas-admin-header">
        <div class="saas-auth-brand"><span class="saas-auth-mark">SL</span><span>SafeLift3D <small>ADMIN CMS</small></span></div>
        <div class="saas-admin-actions"><a href="/">${en ? 'Workspace' : 'Không gian làm việc'}</a><button type="button" data-action="language">${en ? 'Tiếng Việt' : 'English'}</button><button type="button" data-action="signout">${en ? 'Sign out' : 'Đăng xuất'}</button></div>
      </header>
      <section class="saas-admin-card">
        <div class="saas-admin-title-row"><div><div class="saas-auth-kicker">${en ? 'PLATFORM ACCESS' : 'QUẢN LÝ TRUY CẬP'}</div><h1>${en ? 'User management' : 'Quản lý người dùng'}</h1><p>${en ? 'Review account status and assign access tiers.' : 'Xem trạng thái tài khoản và gán gói truy cập.'}</p></div><button type="button" class="saas-secondary-button" data-action="refresh" ${loading ? 'disabled' : ''}>${loading ? (en ? 'Loading…' : 'Đang tải…') : (en ? 'Refresh' : 'Làm mới')}</button></div>
        <div class="saas-admin-stats"><div><span>${en ? 'Registered users' : 'Tổng tài khoản'}</span><strong>${users.length}</strong></div><div><span>${en ? 'Active' : 'Đang hoạt động'}</span><strong>${users.filter((u) => u.status === 'active').length}</strong></div><div><span>${en ? 'Premium' : 'Premium'}</span><strong>${users.filter((u) => u.tier === 'premium').length}</strong></div></div>
        ${status ? `<div class="saas-admin-notice ${error ? 'is-error' : ''}" role="status">${escapeHtml(status)}</div>` : ''}
        <div class="saas-table-wrap"><table class="saas-users-table"><thead><tr><th>${en ? 'User' : 'Người dùng'}</th><th>${en ? 'Role' : 'Vai trò'}</th><th>${en ? 'Tier' : 'Gói'}</th><th>${en ? 'Status' : 'Trạng thái'}</th><th>${en ? 'Actions' : 'Thao tác'}</th></tr></thead><tbody>
          ${users.map((user) => `<tr><td><strong>${escapeHtml(user.displayName || user.email || user.uid)}</strong><small>${escapeHtml(user.email || user.uid)}</small></td><td>${escapeHtml(user.role || 'user')}</td><td><span class="saas-pill tier-${user.tier === 'premium' ? 'premium' : 'free'}">${escapeHtml(user.tier || 'free')}</span></td><td><span class="saas-pill status-${escapeHtml(user.status || 'unknown')}">${escapeHtml(user.status || 'unknown')}</span></td><td><div class="saas-row-actions"><button type="button" data-tier="${user.tier === 'premium' ? 'free' : 'premium'}" data-uid="${escapeHtml(user.uid)}">${user.tier === 'premium' ? (en ? 'Set Free' : 'Gói Free') : (en ? 'Set Premium' : 'Gói Premium')}</button><button type="button" data-status="${user.status === 'active' ? 'locked' : 'active'}" data-uid="${escapeHtml(user.uid)}" ${user.uid === authUser.uid ? 'disabled title="Cannot suspend the current admin account"' : ''}>${user.status === 'active' ? (en ? 'Suspend' : 'Khóa') : (en ? 'Activate' : 'Mở khóa')}</button><button type="button" class="saas-danger-button" data-status="banned" data-uid="${escapeHtml(user.uid)}" ${user.uid === authUser.uid ? 'disabled title="Cannot ban the current admin account"' : ''}>${en ? 'Ban' : 'Cấm'}</button></div></td></tr>`).join('')}
          ${users.length ? '' : `<tr><td colspan="5" class="saas-empty-row">${loading ? (en ? 'Loading users…' : 'Đang tải tài khoản…') : (en ? 'No users found.' : 'Chưa có tài khoản.')}</td></tr>`}
        </tbody></table></div>
      </section>`;
    root.querySelector('[data-action="signout"]')?.addEventListener('click', signOut);
    root.querySelector('[data-action="language"]')?.addEventListener('click', () => { setLang(en ? 'vi' : 'en'); render(); });
    root.querySelector('[data-action="refresh"]')?.addEventListener('click', loadUsers);
    root.querySelectorAll('[data-tier], [data-status]').forEach((button) => button.addEventListener('click', async () => {
      const update = button.dataset.tier ? { tier: button.dataset.tier } : { status: button.dataset.status };
      button.disabled = true;
      try {
        await setUserAccess(db, button.dataset.uid, update);
        status = en ? 'Access updated.' : 'Đã cập nhật quyền truy cập.';
        error = false;
        await loadUsers(false);
      } catch (e) {
        status = e?.code === 'permission-denied'
          ? (en ? 'Firestore rejected this change. Check the admin role and Firestore rules.' : 'Firestore từ chối thay đổi. Kiểm tra quyền admin và Firestore rules.')
          : (en ? 'Unable to update this account. Please try again.' : 'Không thể cập nhật tài khoản này. Vui lòng thử lại.');
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
      users = await listAllUsers(db);
      error = false;
      if (!status) status = '';
    } catch (e) {
      users = [];
      error = true;
      status = e?.code === 'permission-denied'
        ? (getLang() === 'en' ? 'Firestore denied this read. Confirm the administrator profile and deployed rules.' : 'Firestore từ chối truy vấn. Kiểm tra hồ sơ admin và rules đã triển khai.')
        : (getLang() === 'en' ? 'Could not load users. Check your connection and try again.' : 'Không thể tải danh sách người dùng. Kiểm tra kết nối rồi thử lại.');
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
