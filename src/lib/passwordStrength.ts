export interface PasswordStrengthResult {
  valid: boolean;
  score: number;
  message?: string;
  error?: string;
}

const COMMON_WEAK_PASSWORDS = [
  "123456",
  "12345678",
  "123456789",
  "000000",
  "111111",
  "666666",
  "888888",
  "password",
  "matkhau",
  "qwerty",
  "admin123",
  "fchdhgonoi",
  "gonoi123",
];

/**
 * Shared password/PIN strength validator used by both backend API routes and frontend UI.
 */
export function validatePasswordStrength(
  pin: string,
  username?: string
): PasswordStrengthResult {
  const p = String(pin || "").trim();

  if (p.length < 6) {
    const msg = "Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên.";
    return { valid: false, score: 1, message: msg, error: msg };
  }

  if (p.length > 128) {
    const msg = "Mật khẩu không được vượt quá 128 ký tự.";
    return { valid: false, score: 1, message: msg, error: msg };
  }

  if (/^(.)\1{5,}$/.test(p)) {
    const msg =
      "Mật khẩu quá đơn giản và dễ đoán. Vui lòng chọn mật khẩu an toàn hơn.";
    return { valid: false, score: 1, message: msg, error: msg };
  }

  if (COMMON_WEAK_PASSWORDS.includes(p.toLowerCase())) {
    const msg =
      "Mật khẩu quá đơn giản và dễ đoán. Vui lòng chọn mật khẩu an toàn hơn.";
    return { valid: false, score: 1, message: msg, error: msg };
  }

  if (username && p.toLowerCase() === username.trim().toLowerCase()) {
    const msg = "Mật khẩu không được trùng với tên đăng nhập.";
    return { valid: false, score: 1, message: msg, error: msg };
  }

  let score = 1;
  if (p.length >= 8) score++;
  if (/[a-zA-Z]/.test(p) && /[0-9]/.test(p)) score++;
  if (/[^a-zA-Z0-9]/.test(p) || p.length >= 10) score++;

  return { valid: true, score };
}
