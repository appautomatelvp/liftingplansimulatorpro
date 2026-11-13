const RATE_KEY = 'safelift.auth.rate.v1';
const LIMIT = 5;
const WINDOW_MS = 60_000;

const COPY = {
  en: {
    title: 'Sign in to SafeLift3D', subtitle: 'Secure access to your lifting workspace', email: 'Email address', password: 'Password', name: 'Full name',
    signIn: 'Sign in', create: 'Create account', google: 'Continue with Google', forgot: 'Forgot password?', switchCreate: 'New to SafeLift3D? Create an account', switchSignIn: 'Already registered? Sign in',
    config: 'Authentication is not configured yet. Add the Firebase web configuration and App Check site key to the deployment environment.', working: 'Please wait…',
    cooldown: 'Too many rapid attempts. Try again in {seconds}s.', suspended: 'This account is suspended. Contact SafeLift3D support.', unknown: 'Unable to complete the request. Please try again.',
    invalidCredential: 'Email or password is incorrect.', invalidEmail: 'Enter a valid email address.', weakPassword: 'Use a password with at least 6 characters.', emailInUse: 'An account already exists for this email.', popupClosed: 'The Google sign-in window was closed.', tooMany: 'Too many attempts. Try again later.', network: 'Network error. Check your connection and try again.', emailRequired: 'Enter your email address first.',
    unauthorizedDomain: 'This website is not authorized for sign-in. Add its domain in Firebase Authentication settings.', providerDisabled: 'This sign-in method is disabled in Firebase Authentication.', accountDisabled: 'This account has been disabled. Contact SafeLift3D support.',
    accountExistsWithOtherProvider: 'This email already uses another sign-in method. Sign in that way first, then link Google.',
    verifyEmail: 'Check your email for the password reset link.', accountCreated: 'Your account was created.', developer: 'Developed by Lê Việt Phương (Mr)', toggle: 'Tiếng Việt'
  },
  vi: {
    title: 'Đăng nhập SafeLift3D', subtitle: 'Truy cập an toàn vào không gian lập phương án nâng', email: 'Địa chỉ email', password: 'Mật khẩu', name: 'Họ và tên',
    signIn: 'Đăng nhập', create: 'Tạo tài khoản', google: 'Tiếp tục với Google', forgot: 'Quên mật khẩu?', switchCreate: 'Chưa có tài khoản? Đăng ký', switchSignIn: 'Đã có tài khoản? Đăng nhập',
    config: 'Chưa cấu hình xác thực. Hãy thêm cấu hình Firebase Web và khóa App Check vào môi trường triển khai.', working: 'Vui lòng đợi…',
    cooldown: 'Bạn thao tác quá nhanh. Thử lại sau {seconds} giây.', suspended: 'Tài khoản đang bị khóa. Vui lòng liên hệ SafeLift3D.', unknown: 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.',
    invalidCredential: 'Email hoặc mật khẩu không chính xác.', invalidEmail: 'Vui lòng nhập địa chỉ email hợp lệ.', weakPassword: 'Mật khẩu cần có ít nhất 6 ký tự.', emailInUse: 'Email này đã được đăng ký.', popupClosed: 'Cửa sổ đăng nhập Google đã bị đóng.', tooMany: 'Bạn đã thử quá nhiều lần. Hãy thử lại sau.', network: 'Lỗi kết nối mạng. Kiểm tra kết nối rồi thử lại.', emailRequired: 'Hãy nhập địa chỉ email trước.',
    unauthorizedDomain: 'Tên miền này chưa được cho phép đăng nhập. Hãy thêm tên miền trong Firebase Authentication.', providerDisabled: 'Phương thức đăng nhập này đang bị tắt trong Firebase Authentication.', accountDisabled: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ SafeLift3D.',
    accountExistsWithOtherProvider: 'Email này đã dùng phương thức đăng nhập khác. Hãy đăng nhập bằng phương thức đó trước rồi liên kết Google.',
    verifyEmail: 'Hãy kiểm tra email để nhận liên kết đặt lại mật khẩu.', accountCreated: 'Tài khoản đã được tạo.', developer: 'Phát triển bởi Lê Việt Phương (Mr)', toggle: 'English'
  }
};

function readAttempts() {
  try { return JSON.parse(localStorage.getItem(RATE_KEY) || '{}'); } catch (_) { return {}; }
}

function consumeRateLimit(action) {
  const now = Date.now();
  const attempts = readAttempts();
  const active = (attempts[action] || []).filter((time) => now - time < WINDOW_MS);
  if (active.length >= LIMIT) {
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - active[0])) / 1000));
    const error = new Error('rate-limit');
    error.retryAfter = retryAfter;
    throw error;
  }
  active.push(now);
  attempts[action] = active;
  try { localStorage.setItem(RATE_KEY, JSON.stringify(attempts)); } catch (_) { /* browser storage may be disabled */ }
}

function messageFor(error, copy) {
  if (error?.code === 'safelift/account-suspended') return copy.suspended;
  if (error?.message === 'rate-limit') return copy.cooldown.replace('{seconds}', error.retryAfter);
  const known = {
    'auth/invalid-credential': copy.invalidCredential,
    'auth/wrong-password': copy.invalidCredential,
    'auth/invalid-email': copy.invalidEmail,
    'auth/weak-password': copy.weakPassword,
    'auth/email-already-in-use': copy.emailInUse,
    'auth/popup-closed-by-user': copy.popupClosed,
    'auth/too-many-requests': copy.tooMany,
    'auth/network-request-failed': copy.network,
    'auth/unauthorized-domain': copy.unauthorizedDomain,
    'auth/operation-not-allowed': copy.providerDisabled,
    'auth/user-disabled': copy.accountDisabled,
    'auth/account-exists-with-different-credential': copy.accountExistsWithOtherProvider
  };
  return known[error?.code] || copy.unknown;
}

export function restoreAuthActions(root, mode, copy) {
  const submit = root.querySelector('.saas-primary-button');
  if (submit) {
    submit.disabled = false;
    submit.textContent = mode === 'create' ? copy.create : copy.signIn;
  }
  const google = root.querySelector('[data-action="google"]');
  if (google) google.disabled = false;
}

export function mountAuthScreen(container, { lang, configured, actions, onLanguageChange }) {
  let mode = 'sign-in';
  let busy = false;
  let countdown = 0;
  let countdownTimer = null;
  const root = document.createElement('section');
  root.className = 'saas-auth-screen';
  root.setAttribute('aria-labelledby', 'saas-auth-title');
  container.replaceChildren(root);

  const render = () => {
    const copy = COPY[lang()] || COPY.en;
    root.innerHTML = `
      <div class="saas-auth-card">
        <div class="saas-auth-brand"><img class="saas-auth-mark" src="/safelift3d-icons/branding/main-logo.svg" alt="SafeLift3D — Heavy Rigging & Lift Planner"></div>
        <button class="saas-language-button" type="button" data-action="language">${copy.toggle}</button>
        <div class="saas-auth-kicker">${lang() === 'en' ? 'ENGINEERING WORKSPACE' : 'KHÔNG GIAN KỸ THUẬT'}</div>
        <h1 id="saas-auth-title">${copy.title}</h1>
        <p class="saas-auth-subtitle">${copy.subtitle}</p>
        ${configured ? `
          <form class="saas-auth-form" novalidate>
            ${mode === 'create' ? `<label>${copy.name}<input name="displayName" type="text" autocomplete="name" maxlength="100" required></label>` : ''}
            <label>${copy.email}<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
            <label>${copy.password}<input name="password" type="password" autocomplete="${mode === 'create' ? 'new-password' : 'current-password'}" minlength="6" required></label>
            <div class="saas-auth-status" role="status" aria-live="polite"></div>
            <button class="saas-primary-button" type="submit" ${busy ? 'disabled' : ''}>${busy ? copy.working : (mode === 'create' ? copy.create : copy.signIn)}</button>
          </form>
          <button class="saas-google-button" type="button" data-action="google" ${busy ? 'disabled' : ''}><span aria-hidden="true">G</span>${copy.google}</button>
          <div class="saas-auth-links">
            ${mode === 'sign-in' ? `<button type="button" data-action="reset">${copy.forgot}</button>` : ''}
            <button type="button" data-action="mode">${mode === 'create' ? copy.switchSignIn : copy.switchCreate}</button>
          </div>
        ` : `<div class="saas-config-notice" role="alert">${copy.config}<code>VITE_FIREBASE_API_KEY · VITE_FIREBASE_AUTH_DOMAIN · VITE_FIREBASE_PROJECT_ID · VITE_FIREBASE_APP_ID · VITE_FIREBASE_APPCHECK_SITE_KEY</code></div>`}
        <div class="saas-auth-footer"><span>ASME P30.1 · B30.9 / B30.20 · DNV-ST-N001</span><small>${copy.developer}</small><a href="mailto:levietphuong.hcmutrans@gmail.com">levietphuong.hcmutrans@gmail.com</a><a href="tel:+84968051697">+84 968 051 697</a></div>
      </div>`;

    root.querySelector('[data-action="language"]')?.addEventListener('click', () => onLanguageChange());
    root.querySelector('[data-action="mode"]')?.addEventListener('click', () => { mode = mode === 'create' ? 'sign-in' : 'create'; render(); });
    root.querySelector('[data-action="google"]')?.addEventListener('click', () => run('google', () => actions.google()));
    root.querySelector('[data-action="reset"]')?.addEventListener('click', async () => {
      const email = root.querySelector('[name="email"]')?.value.trim();
      if (!email) return showStatus(copy.emailRequired, true);
      await run('reset', () => actions.reset(email), copy.verifyEmail);
    });
    root.querySelector('form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const email = String(form.get('email') || '').trim();
      const password = String(form.get('password') || '');
      const displayName = String(form.get('displayName') || '').trim();
      if (mode === 'create') run('create', () => actions.create(email, password, displayName), copy.accountCreated);
      else run('sign-in', () => actions.signIn(email, password));
    });
  };

  function showStatus(message, isError = false) {
    const status = root.querySelector('.saas-auth-status');
    if (status) {
      status.textContent = message;
      status.classList.toggle('is-error', isError);
    }
  }

  async function run(action, operation, successMessage) {
    if (busy || countdown > 0) return;
    const copy = COPY[lang()] || COPY.en;
    try {
      consumeRateLimit(action);
      busy = true;
      render();
      await operation();
      if (successMessage) showStatus(successMessage, false);
    } catch (error) {
      if (error?.message === 'rate-limit') {
        countdown = error.retryAfter;
        startCountdown(action);
      }
      showStatus(messageFor(error, copy), true);
    } finally {
      busy = false;
      restoreAuthActions(root, mode, COPY[lang()] || COPY.en);
    }
  }

  function startCountdown(action) {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      countdown = Math.max(0, countdown - 1);
      if (countdown === 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
      const copy = COPY[lang()] || COPY.en;
      showStatus(copy.cooldown.replace('{seconds}', countdown), true);
      const button = root.querySelector('.saas-primary-button');
      if (button) button.disabled = countdown > 0;
      const google = root.querySelector('[data-action="google"]');
      if (google) google.disabled = countdown > 0;
    }, 1000);
  }

  render();
  return {
    setLanguage() { render(); },
    showMessage(message, isError = false) { showStatus(message, isError); },
    showError(error) { showStatus(messageFor(error, COPY[lang()] || COPY.en), true); },
    dispose() { if (countdownTimer) clearInterval(countdownTimer); root.remove(); }
  };
}
