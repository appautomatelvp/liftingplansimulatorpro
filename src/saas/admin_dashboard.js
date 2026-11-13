import { getLang, setLang } from '../i18n/index.js';
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
    const en = getLang() === 'en';
    if (!isAdmin) {
      root.innerHTML = `<section class="saas-admin-card"><div class="saas-auth-brand"><img class="saas-auth-mark" src="/safelift3d-icons/branding/main-logo.svg" alt="SafeLift3D — Heavy Rigging & Lift Planner"></div><h1>${en ? 'Administrator access required' : 'Cần quyền quản trị viên'}</h1><p>${en ? 'This account does not have access to the CMS.' : 'Tài khoản này không có quyền truy cập CMS.'}</p><div class="saas-admin-actions"><a href="/">${en ? 'Return to workspace' : 'Quay lại không gian làm việc'}</a><button type="button" data-action="signout">${en ? 'Sign out' : 'Đăng xuất'}</button></div></section>`;
      root.querySelector('[data-action="signout"]')?.addEventListener('click', signOut);
      return;
    }
    root.innerHTML = `
      <header class="saas-admin-header">
        <div class="saas-auth-brand"><img class="saas-auth-mark" src="/safelift3d-icons/branding/main-logo.svg" alt="SafeLift3D — Heavy Rigging & Lift Planner"><span>ADMIN CMS</span></div>
        <div class="saas-admin-actions"><a href="/">${en ? 'Workspace' : 'Không gian làm việc'}</a><button type="button" data-action="language">${en ? 'Tiếng Việt' : 'English'}</button><button type="button" data-action="signout">${en ? 'Sign out' : 'Đăng xuất'}</button></div>
      </header>
      <section class="saas-admin-card">
        <div class="saas-admin-title-row"><div><div class="saas-auth-kicker">${en ? 'PLATFORM ACCESS' : 'QUẢN LÝ TRUY CẬP'}</div><h1>${en ? 'User management' : 'Quản lý người dùng'}</h1><p>${en ? 'Review account status and assign access tiers.' : 'Xem trạng thái tài khoản và gán gói truy cập.'}</p></div><button type="button" class="saas-secondary-button" data-action="refresh" ${loading ? 'disabled' : ''}>${loading ? (en ? 'Loading…' : 'Đang tải…') : (en ? 'Refresh' : 'Làm mới')}</button></div>
        <div class="saas-admin-stats"><div><span>${en ? 'Users on this page' : 'Tài khoản trang này'}</span><strong>${users.length}</strong></div><div><span>${en ? 'Active on this page' : 'Đang hoạt động trang này'}</span><strong>${users.filter((u) => u.status === 'active').length}</strong></div><div><span>${en ? 'Premium on this page' : 'Premium trang này'}</span><strong>${users.filter((u) => u.tier === 'premium').length}</strong></div></div>
        ${status ? `<div class="saas-admin-notice ${error ? 'is-error' : ''}" role="status">${escapeHtml(status)}</div>` : ''}
        <form class="saas-admin-search" data-action="search-form"><label for="admin-user-search">${en ? 'Search by email prefix' : 'Tìm theo phần đầu email'}</label><div><input id="admin-user-search" type="search" maxlength="254" autocomplete="off" placeholder="${en ? 'e.g. name@company.com' : 'ví dụ: ten@congty.com'}" value="${escapeHtml(emailPrefix)}"><button type="submit" class="saas-secondary-button">${en ? 'Search' : 'Tìm kiếm'}</button><button type="button" class="saas-secondary-button" data-action="clear-search" ${emailPrefix ? '' : 'disabled'}>${en ? 'Clear' : 'Xóa lọc'}</button></div><small>${en ? 'Search uses a bounded email-prefix query; each page loads up to 25 users.' : 'Tìm kiếm email theo tiền tố; mỗi trang chỉ tải tối đa 25 tài khoản.'}</small></form>
        <div class="saas-table-wrap"><table class="saas-users-table"><thead><tr><th>${en ? 'User' : 'Người dùng'}</th><th>${en ? 'Role' : 'Vai trò'}</th><th>${en ? 'Tier' : 'Gói'}</th><th>${en ? 'Status' : 'Trạng thái'}</th><th>${en ? 'Actions' : 'Thao tác'}</th></tr></thead><tbody>
          ${users.map((user) => `<tr><td><strong>${escapeHtml(user.displayName || user.email || user.uid)}</strong><small>${escapeHtml(user.email || user.uid)}</small></td><td>${escapeHtml(user.role || 'user')}</td><td><span class="saas-pill tier-${user.tier === 'premium' ? 'premium' : 'free'}">${escapeHtml(user.tier || 'free')}</span></td><td><span class="saas-pill status-${escapeHtml(user.status || 'unknown')}">${escapeHtml(user.status || 'unknown')}</span></td><td><div class="saas-row-actions"><button type="button" data-tier="${user.tier === 'premium' ? 'free' : 'premium'}" data-uid="${escapeHtml(user.uid)}">${user.tier === 'premium' ? (en ? 'Set Free' : 'Gói Free') : (en ? 'Set Premium' : 'Gói Premium')}</button><button type="button" data-status="${user.status === 'active' ? 'locked' : 'active'}" data-uid="${escapeHtml(user.uid)}" ${user.uid === authUser.uid ? 'disabled title="Cannot suspend the current admin account"' : ''}>${user.status === 'active' ? (en ? 'Suspend' : 'Khóa') : (en ? 'Activate' : 'Mở khóa')}</button><button type="button" class="saas-danger-button" data-status="banned" data-uid="${escapeHtml(user.uid)}" ${user.uid === authUser.uid ? 'disabled title="Cannot ban the current admin account"' : ''}>${en ? 'Ban' : 'Cấm'}</button></div></td></tr>`).join('')}
          ${users.length ? '' : `<tr><td colspan="5" class="saas-empty-row">${loading ? (en ? 'Loading users…' : 'Đang tải tài khoản…') : (en ? 'No users found.' : 'Chưa có tài khoản.')}</td></tr>`}
        </tbody></table></div>
        <nav class="saas-admin-pagination" aria-label="${en ? 'User pages' : 'Trang người dùng'}"><span>${en ? `Page ${pageIndex + 1}` : `Trang ${pageIndex + 1}`}</span><div><button type="button" class="saas-secondary-button" data-action="previous" ${pageIndex === 0 || loading ? 'disabled' : ''}>${en ? 'Previous' : 'Trước'}</button><button type="button" class="saas-secondary-button" data-action="next" ${!hasMore || loading ? 'disabled' : ''}>${en ? 'Next' : 'Tiếp'}</button></div></nav>
      </section>`;
    root.querySelector('[data-action="signout"]')?.addEventListener('click', signOut);
    root.querySelector('[data-action="language"]')?.addEventListener('click', () => { setLang(en ? 'vi' : 'en'); render(); });
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
