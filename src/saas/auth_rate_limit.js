// @purpose: Kiểm soát giới hạn tốc độ thử đăng nhập và chuẩn hóa thông báo lỗi xác thực (VI/EN)
import { safeReadLocalStore, safeWriteLocalStore } from '../utils/localDataStore.js';

export const RATE_KEY = 'safelift.auth.rate.v1';
export const RATE_LIMIT = 5;
export const RATE_WINDOW_MS = 60_000;

export const AUTH_COPY = {
  en: {
    title: 'Sign in to SafeLift3D', subtitle: 'Secure access to your lifting workspace', email: 'Email address', password: 'Password', name: 'Full name',
    signIn: 'Sign in', create: 'Create account', google: 'Continue with Google', forgot: 'Forgot password?', switchCreate: 'New to SafeLift3D? Create an account', switchSignIn: 'Already registered? Sign in',
    config: 'Authentication is not configured yet. Add the Firebase web configuration and App Check site key to the deployment environment.', working: 'Please wait…',
    cooldown: 'Too many rapid attempts. Try again in {seconds}s.', suspended: 'This account is suspended. Contact SafeLift3D support.', unknown: 'Unable to complete the request. Please try again.',
    invalidCredential: 'Email or password is incorrect.', invalidEmail: 'Enter a valid email address.', weakPassword: 'Use a password with at least 6 characters.', emailInUse: 'An account already exists for this email.', popupClosed: 'The Google sign-in window was closed.', tooMany: 'Too many attempts. Try again later.', network: 'Network error. Check your connection and try again.', emailRequired: 'Enter your email address first.',
    unauthorizedDomain: 'This website is not authorized for sign-in. Add its domain in Firebase Authentication settings.', providerDisabled: 'This sign-in method is disabled in Firebase Authentication.', accountDisabled: 'This account has been disabled. Contact SafeLift3D support.',
    accountExistsWithOtherProvider: 'This email already uses another sign-in method. Sign in that way first, then link Google.',
    verifyEmail: 'Check your email for the password reset link.', accountCreated: 'Your account was created. Check your email to verify your address.', developer: 'Developed by Lê Việt Phương (Mr)', contactCta: 'Send feedback / Contact developer', toggle: 'Tiếng Việt',
    verifyPendingTitle: 'Verify your email',
    verifyPendingSubtitle: 'We sent a verification link to {email}. Open the link in your inbox, then continue.',
    verifyCheck: "I've verified my email",
    verifyResend: 'Resend verification email',
    verifyResendCooldown: 'Resend in {seconds}s',
    verifyResent: 'Verification email sent. Check your inbox.',
    verifyNotYet: 'Email is not verified yet. Check your inbox and try again.',
    verifySignOut: 'Use another account'
  },
  vi: {
    title: 'Đăng nhập SafeLift3D', subtitle: 'Truy cập an toàn vào không gian lập phương án nâng', email: 'Địa chỉ email', password: 'Mật khẩu', name: 'Họ và tên',
    signIn: 'Đăng nhập', create: 'Tạo tài khoản', google: 'Tiếp tục với Google', forgot: 'Quên mật khẩu?', switchCreate: 'Chưa có tài khoản? Đăng ký', switchSignIn: 'Đã có tài khoản? Đăng nhập',
    config: 'Chưa cấu hình xác thực. Hãy thêm cấu hình Firebase Web và khóa App Check vào môi trường triển khai.', working: 'Vui lòng đợi…',
    cooldown: 'Bạn thao tác quá nhanh. Thử lại sau {seconds} giây.', suspended: 'Tài khoản đang bị khóa. Vui lòng liên hệ SafeLift3D.', unknown: 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.',
    invalidCredential: 'Email hoặc mật khẩu không chính xác.', invalidEmail: 'Vui lòng nhập địa chỉ email hợp lệ.', weakPassword: 'Mật khẩu cần có ít nhất 6 ký tự.', emailInUse: 'Email này đã được đăng ký.', popupClosed: 'Cửa sổ đăng nhập Google đã bị đóng.', tooMany: 'Bạn đã thử quá nhiều lần. Hãy thử lại sau.', network: 'Lỗi kết nối mạng. Kiểm tra kết nối rồi thử lại.', emailRequired: 'Hãy nhập địa chỉ email trước.',
    unauthorizedDomain: 'Tên miền này chưa được cho phép đăng nhập. Hãy thêm tên miền trong Firebase Authentication.', providerDisabled: 'Phương thức đăng nhập này đang bị tắt trong Firebase Authentication.', accountDisabled: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ SafeLift3D.',
    accountExistsWithOtherProvider: 'Email này đã dùng phương thức đăng nhập khác. Hãy đăng nhập bằng phương thức đó trước rồi liên kết Google.',
    verifyEmail: 'Hãy kiểm tra email để nhận liên kết đặt lại mật khẩu.', accountCreated: 'Tài khoản đã được tạo. Hãy kiểm tra email để xác minh địa chỉ.', developer: 'Phát triển bởi Lê Việt Phương (Mr)', contactCta: 'Gửi email góp ý / Hỗ trợ', toggle: 'English',
    verifyPendingTitle: 'Xác minh địa chỉ email',
    verifyPendingSubtitle: 'Chúng tôi đã gửi liên kết xác minh tới {email}. Mở liên kết trong hộp thư rồi tiếp tục.',
    verifyCheck: 'Tôi đã xác minh',
    verifyResend: 'Gửi lại email xác minh',
    verifyResendCooldown: 'Gửi lại sau {seconds}s',
    verifyResent: 'Đã gửi lại email xác minh. Hãy kiểm tra hộp thư.',
    verifyNotYet: 'Email chưa được xác minh. Hãy kiểm tra hộp thư và thử lại.',
    verifySignOut: 'Dùng tài khoản khác'
  }
};

export function readAttempts() {
  if (typeof localStorage === 'undefined') return {};
  return safeReadLocalStore(RATE_KEY, {});
}

export function consumeRateLimit(action) {
  const now = Date.now();
  const attempts = readAttempts();
  const active = (attempts[action] || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (active.length >= RATE_LIMIT) {
    const retryAfter = Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - active[0])) / 1000));
    const error = new Error('rate-limit');
    error.retryAfter = retryAfter;
    throw error;
  }
  active.push(now);
  attempts[action] = active;
  if (typeof localStorage !== 'undefined') safeWriteLocalStore(RATE_KEY, attempts);
}

export function messageFor(error, copy) {
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
