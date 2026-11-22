import { NextRequest } from "next/server";
import crypto from "crypto";
import { getAsyncDb } from "./db";
import { validatePasswordStrength, type PasswordStrengthResult } from "./passwordStrength";
export { validatePasswordStrength, type PasswordStrengthResult };
import {
  clearAuthRateLimitOnSuccess,
  evaluateAuthRateLimit,
} from "./authRateLimit";
import type {
  Player,
  FullAppData,
  PublicPlayerDTO,
  SafePlayerPayload,
} from "@/types/app";

const DEV_TEST_FALLBACK_SECRET =
  "fc-hdh-go-noi-sapphire-secret-key-2026-secure-32chars";

const FORBIDDEN_PRODUCTION_SECRETS = new Set([
  "fc-hdh-go-noi-sapphire-secret-key-2026-production-fallback-key-32c",
  DEV_TEST_FALLBACK_SECRET,
  "changeme",
  "default",
]);

export class AuthSecretError extends Error {
  readonly code = "AUTH_SECRET_INVALID";
  readonly status = 503;

  constructor(message: string) {
    super(message);
    this.name = "AuthSecretError";
  }
}

export function isProductionAuthEnv(
  env: Record<string, string | undefined> = process.env
): boolean {
  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnv) {
    return vercelEnv === "production";
  }
  return env.NODE_ENV?.trim().toLowerCase() === "production";
}

export function isPreviewAuthEnv(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.VERCEL_ENV?.trim().toLowerCase() === "preview";
}

export function isDeployedAuthEnv(
  env: Record<string, string | undefined> = process.env
): boolean {
  return isProductionAuthEnv(env) || isPreviewAuthEnv(env);
}

/**
 * Lấy khóa bí mật ký session token.
 * Thống nhất APP_SECRET / AUTH_SECRET / NEXTAUTH_SECRET / SESSION_SECRET (và PREVIEW_AUTH_SECRET trên Preview).
 * Production và Vercel Preview bắt buộc cấu hình tường minh tối thiểu 32 ký tự và không chấp nhận fallback/placeholder (fail-closed).
 * Local Development và Vitest được phép dùng DEV_TEST_FALLBACK_SECRET khi chưa cấu hình secret riêng.
 */
export function getAuthSecret(
  env: Record<string, string | undefined> = process.env
): string {
  const isProd = isProductionAuthEnv(env);
  const isPreview = isPreviewAuthEnv(env);
  const isDeployed = isProd || isPreview;

  const rawSecret = isPreview
    ? env.PREVIEW_AUTH_SECRET ||
      env.APP_SECRET ||
      env.AUTH_SECRET ||
      env.NEXTAUTH_SECRET ||
      env.SESSION_SECRET ||
      ""
    : env.APP_SECRET ||
      env.AUTH_SECRET ||
      env.NEXTAUTH_SECRET ||
      env.SESSION_SECRET ||
      "";
  const secret = rawSecret.trim();

  if (isDeployed) {
    if (
      !secret ||
      secret.length < 32 ||
      FORBIDDEN_PRODUCTION_SECRETS.has(secret)
    ) {
      throw new AuthSecretError(
        isPreview
          ? "FATAL: Preview auth secret (PREVIEW_AUTH_SECRET / APP_SECRET / AUTH_SECRET / SESSION_SECRET) must be set, non-default, and at least 32 characters in Vercel Preview."
          : "FATAL: APP_SECRET / AUTH_SECRET must be set, non-default, and at least 32 characters in production."
      );
    }
    return secret;
  }

  if (secret.length > 0) {
    if (secret.length < 32) {
      throw new AuthSecretError(
        "FATAL: APP_SECRET / AUTH_SECRET must be at least 32 characters when configured."
      );
    }
    return secret;
  }

  // Chỉ dùng khóa dev/test nội bộ khi không chạy ở Production/Preview và chưa cấu hình secret riêng
  return DEV_TEST_FALLBACK_SECRET;
}

export const SESSION_COOKIE_NAME = "fc_session";

export interface SessionPayload {
  playerId: number;
  accessRole: "manager" | "player";
  fullName: string;
  shortName: string;
  jerseyNumber: number | null;
  pwdFingerprint?: string; // Dấu vân tay mật khẩu để thu hồi phiên tức thì khi đổi mật khẩu
  exp: number; // Unix timestamp in seconds
}

// =========================================================================
// 1. MÃ HÓA & XÁC THỰC MẬT KHẨU (SCRYPT + SALT + TIMING-SAFE)
// =========================================================================

/**
 * Băm mật khẩu một chiều an toàn bằng Scrypt và Salt ngẫu nhiên 16 bytes
 * Định dạng lưu trữ: scrypt$<saltHex>$<derivedKeyHex>
 */
export function hashPassword(password: string): string {
  const clean = String(password || "").trim();
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(clean, salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

/**
 * Tạo dấu vân tay ngắn cho mật khẩu để nhúng vào session token.
 * Fail-closed: trả về null nếu thiếu credential material (không fallback về "1234").
 */
export function getPasswordFingerprint(pinOrHash?: string | null): string | null {
  const clean = String(pinOrHash || "").trim();
  if (!clean) return null;
  return crypto
    .createHash("sha256")
    .update(clean)
    .digest("hex")
    .slice(0, 12);
}

/**
 * Xác minh mật khẩu người dùng nhập vào so với mật khẩu đã lưu trong DB
 * Hỗ trợ cả scrypt hash lẫn legacy plaintext (để migrate không làm gián đoạn)
 */
export function verifyPassword(password: string, storedHashOrPlain: string): boolean {
  const cleanInput = String(password || "").trim();
  const stored = String(storedHashOrPlain || "").trim();

  if (!cleanInput || cleanInput.length > 128 || !stored) return false;

  // Trường hợp 1: Mật khẩu đã được mã hóa chuẩn scrypt
  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const expectedKeyHex = parts[2];
    if (!salt || !expectedKeyHex) return false;

    try {
      const derivedKey = crypto.scryptSync(cleanInput, salt, 64);
      const expectedKey = Buffer.from(expectedKeyHex, "hex");
      if (derivedKey.length !== expectedKey.length) return false;
      return crypto.timingSafeEqual(derivedKey, expectedKey);
    } catch {
      return false;
    }
  }

  // Trường hợp 2: Mật khẩu cũ dạng văn bản thô (Plaintext e.g. "1234") — so sánh constant-length digest
  const inputDigest = crypto.createHash("sha256").update(cleanInput).digest();
  const storedDigest = crypto.createHash("sha256").update(stored).digest();
  return crypto.timingSafeEqual(inputDigest, storedDigest);
}

/**
 * Kiểm tra xem mật khẩu trong DB có cần nâng cấp lên scrypt hay không
 */
export function needsRehash(storedHashOrPlain: string): boolean {
  return !String(storedHashOrPlain || "").trim().startsWith("scrypt$");
}

/**
 * Kiểm tra xem mật khẩu hiện tại có phải là mật khẩu mặc định sơ khai "1234" hay không
 */
export function isDefaultPassword(pinOrHash?: string | null): boolean {
  if (!pinOrHash) return true;
  return verifyPassword("1234", pinOrHash);
}

// validatePasswordStrength re-exported from ./passwordStrength

// =========================================================================
// 2. CHỐNG BRUTE-FORCE VÀ TẠM KHÓA ĐĂNG NHẬP (RATE LIMITING)
// =========================================================================

interface AttemptRecord {
  count: number;
  lockedUntil: number;
  firstAttempt: number;
}

const loginAttempts = new Map<string, AttemptRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 phút
const WINDOW_DURATION_MS = 15 * 60 * 1000; // 15 phút

/**
 * Dọn dẹp các bản ghi rate-limit cũ để tránh rò rỉ bộ nhớ
 */
function cleanupAttempts() {
  const now = Date.now();
  for (const [key, val] of loginAttempts.entries()) {
    if (val.lockedUntil < now && now - val.firstAttempt > WINDOW_DURATION_MS) {
      loginAttempts.delete(key);
    }
  }
}

/**
 * Kiểm tra xem IP hoặc Tên tài khoản có đang bị khóa đăng nhập tạm thời hay không
 */
export function checkRateLimit(identifier: string): {
  allowed: boolean;
  waitSeconds?: number;
  lockoutSeconds?: number;
  remainingAttempts: number;
} {
  cleanupAttempts();
  const key = normalizeLoginString(identifier);
  if (!key) return { allowed: true, remainingAttempts: MAX_ATTEMPTS };

  const record = loginAttempts.get(key);
  if (!record) return { allowed: true, remainingAttempts: MAX_ATTEMPTS };

  const now = Date.now();
  if (record.lockedUntil > now) {
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      waitSeconds,
      lockoutSeconds: waitSeconds,
      remainingAttempts: 0,
    };
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - record.count);
  return { allowed: true, remainingAttempts: remaining };
}

/**
 * Ghi nhận một lần nhập sai mật khẩu và tự động kích hoạt tạm khóa nếu vượt quá ngưỡng
 */
export function recordFailedAttempt(identifier: string): {
  locked: boolean;
  waitSeconds?: number;
  lockoutSeconds?: number;
  remainingAttempts: number;
} {
  const key = normalizeLoginString(identifier);
  if (!key) return { locked: false, remainingAttempts: MAX_ATTEMPTS };

  const now = Date.now();
  let record = loginAttempts.get(key);

  if (!record || now - record.firstAttempt > WINDOW_DURATION_MS) {
    record = { count: 1, lockedUntil: 0, firstAttempt: now };
    loginAttempts.set(key, record);
    return { locked: false, remainingAttempts: MAX_ATTEMPTS - 1 };
  }

  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    const waitSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
    return {
      locked: true,
      waitSeconds,
      lockoutSeconds: waitSeconds,
      remainingAttempts: 0,
    };
  }

  return {
    locked: false,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - record.count),
  };
}

/**
 * Xóa bỏ giới hạn sau khi đăng nhập thành công
 */
export function clearRateLimit(identifier: string): void {
  const key = normalizeLoginString(identifier);
  if (key) {
    loginAttempts.delete(key);
  }
}

// =========================================================================
// 3. TẠO & XÁC MINH PHIÊN LÀM VIỆC (SESSION MANAGEMENT)
// =========================================================================

/**
 * Ký và tạo Session Token an toàn (HMAC-SHA256) kèm vân tay mật khẩu
 */
export function createSessionToken(
  player: Player,
  durationHours = 24 * 7
): string {
  const pwdFingerprint = getPasswordFingerprint(player.pin_code);
  if (!pwdFingerprint) {
    throw new Error("Cannot create session token for account with missing credential material.");
  }

  const exp = Math.floor(Date.now() / 1000) + durationHours * 3600;
  const payload: SessionPayload = {
    playerId: player.id,
    accessRole: player.access_role || "player",
    fullName: player.full_name,
    shortName: player.short_name,
    jerseyNumber: player.jersey_number,
    pwdFingerprint,
    exp,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getAuthSecret())
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
}

/**
 * Giải mã và xác minh tính toàn vẹn của Session Token
 * Tùy chọn so sánh với vân tay mật khẩu hiện tại trong DB để thu hồi phiên cũ
 */
export function verifySessionToken(
  token: string,
  currentPinOrHash?: string
): SessionPayload | null {
  if (!token || !token.includes(".")) return null;

  const [payloadBase64, providedSig] = token.split(".");
  if (!payloadBase64 || !providedSig) return null;

  let secret: string;
  try {
    secret = getAuthSecret();
  } catch {
    return null; // Fail-closed nếu secret cấu hình không hợp lệ
  }

  // Kiểm tra chữ ký mật mã
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payloadBase64)
    .digest("base64url");

  if (
    providedSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig))
  ) {
    return null; // Chữ ký bị can thiệp / giả mạo
  }

  try {
    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf-8")
    );

    if (
      typeof payload.playerId !== "number" ||
      !Number.isInteger(payload.playerId) ||
      typeof payload.exp !== "number" ||
      (payload.accessRole !== "manager" && payload.accessRole !== "player") ||
      typeof payload.pwdFingerprint !== "string" ||
      !payload.pwdFingerprint.trim()
    ) {
      return null;
    }

    // Kiểm tra hạn sử dụng của phiên
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null; // Hết hạn
    }

    // Nếu cung cấp mật khẩu hiện tại trong DB: đối chiếu dấu vân tay (fail-closed nếu DB thiếu credential)
    if (currentPinOrHash !== undefined) {
      const currentFingerprint = getPasswordFingerprint(currentPinOrHash);
      if (!currentFingerprint || payload.pwdFingerprint !== currentFingerprint) {
        return null; // Mật khẩu đã thay đổi hoặc thiếu credential, vô hiệu hóa phiên cũ
      }
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Trích xuất và xác thực Session từ Cookie của HTTP Request
 */
export function getAuthSession(req: NextRequest): SessionPayload | null {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) return null;
  return verifySessionToken(cookie.value);
}

/**
 * Chuẩn hóa chuỗi tìm kiếm tài khoản / tên đăng nhập
 */
export function normalizeLoginString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export const UNIFIED_LOGIN_ERROR_MESSAGE =
  "Thông tin đăng nhập hoặc mật khẩu không chính xác.";

const DUMMY_SCRYPT_HASH = hashPassword("fc-gonoi-dummy-anti-enum-2026");

let dummyScryptHookForTest: ((reason: "missing" | "inactive" | "legacy_wrong_pin") => void) | null = null;

export function __setDummyScryptHookForTest(
  hook: ((reason: "missing" | "inactive" | "legacy_wrong_pin") => void) | null
): void {
  dummyScryptHookForTest = hook;
}

function runDummyScryptVerification(
  cleanPin: string,
  reason: "missing" | "inactive" | "legacy_wrong_pin"
): void {
  dummyScryptHookForTest?.(reason);
  verifyPassword(cleanPin, DUMMY_SCRYPT_HASH);
}

export const AUTH_PLAYER_PROFILE_COLUMNS = `
  id, code_order, full_name, short_name, username, jersey_number,
  position, phone, birth_year, avatar_url, profile_image_url,
  bio, role, access_role, pin_code, status, notes
`;

export async function hasMustChangePinColumn(
  db: { query: <T = Record<string, unknown>>(sql: string, args?: unknown[]) => Promise<T[]> }
): Promise<boolean> {
  try {
    const cols = await db.query<{ name?: string }>("PRAGMA table_info(players)");
    return cols.some((c) => c.name === "must_change_pin");
  } catch {
    return false;
  }
}

export async function readMustChangePinFlag(
  db: { queryOne: <T = Record<string, unknown>>(sql: string, args?: unknown[]) => Promise<T | null> },
  playerId: number
): Promise<boolean> {
  try {
    const row = await db.queryOne<{ must_change_pin?: number }>(
      "SELECT must_change_pin FROM players WHERE id = ? LIMIT 1",
      [playerId]
    );
    return Number(row?.must_change_pin || 0) === 1;
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    if (msg.includes("no such column") && msg.includes("must_change_pin")) {
      return false;
    }
    throw err;
  }
}

/**
 * Xác thực thông tin đăng nhập từ Server Database với chuẩn chống Brute-force, Anti-Enumeration & Auto Re-hash
 */
export async function verifyCredentials(
  username: string,
  pin: string,
  clientIp = "local"
): Promise<{
  success: boolean;
  status?: 200 | 401 | 403 | 429 | 503;
  errorCode?: string;
  waitSeconds?: number;
  player?: Player;
  error?: string;
  mustChangePassword?: boolean;
}> {
  const cleanUsername = String(username || "").trim();
  const cleanPin = String(pin || "").trim();

  if (!cleanUsername || !cleanPin || cleanPin.length > 128) {
    return { success: false, status: 401, error: UNIFIED_LOGIN_ERROR_MESSAGE };
  }

  try {
    getAuthSecret();
  } catch (err) {
    if (err instanceof AuthSecretError) {
      return {
        success: false,
        status: 503,
        errorCode: err.code,
        error: "Hệ thống xác thực tạm thời không khả dụng do thiếu cấu hình bảo mật máy chủ.",
      };
    }
    throw err;
  }

  // 1. Distributed Rate Limiting (IP + Account+IP pair) — fail-closed trên Production
  const rl = await evaluateAuthRateLimit({ username: cleanUsername, clientIp });
  if (!rl.allowed) {
    return {
      success: false,
      status: rl.status,
      errorCode: rl.errorCode,
      waitSeconds: rl.waitSeconds,
      error: rl.error,
    };
  }

  // 2. Chỉ truy vấn các cột định danh tối thiểu phục vụ tìm kiếm ứng viên (không pin_code, không SELECT *)
  const db = getAsyncDb();
  const lookupCandidates = await db.query<{
    id: number;
    full_name: string;
    short_name: string;
    username: string | null;
    jersey_number: number | null;
    phone: string;
    status: string;
  }>(
    `SELECT id, full_name, short_name, username, jersey_number, phone, status
     FROM players
     ORDER BY id ASC`
  );

  const uNorm = normalizeLoginString(cleanUsername);
  const cleanDigits = cleanUsername.replace(/\D/g, "");
  const cleanJersey = cleanUsername.replace("#", "").trim();

  // Tìm cầu thủ theo: username (@tieng), tên sân, họ tên, số điện thoại, hoặc số áo (#12)
  const matched = lookupCandidates.find((p) => {
    if (p.username && p.username.toLowerCase() === cleanUsername.toLowerCase()) return true;
    if (p.username && normalizeLoginString(p.username) === uNorm) return true;
    if (normalizeLoginString(p.short_name) === uNorm) return true;
    if (normalizeLoginString(p.full_name) === uNorm) return true;
    if (p.phone && cleanDigits && p.phone.replace(/\D/g, "") === cleanDigits) return true;
    const jerseyStr = p.jersey_number !== null ? String(p.jersey_number) : "";
    if (jerseyStr && jerseyStr === cleanJersey) return true;
    return false;
  });

  // Chống rò rỉ tài khoản & Timing Attack: luôn chạy Scrypt ngay cả khi tài khoản không tồn tại / bị khóa
  if (!matched || matched.status === "inactive") {
    runDummyScryptVerification(cleanPin, !matched ? "missing" : "inactive");
    return {
      success: false,
      status: 401,
      error: UNIFIED_LOGIN_ERROR_MESSAGE,
    };
  }

  // Chỉ truy vấn pin_code cho đúng 1 ứng viên đã khớp và đang hoạt động
  const pinRow = await db.queryOne<{ pin_code: string | null }>(
    "SELECT pin_code FROM players WHERE id = ? LIMIT 1",
    [matched.id]
  );

  const storedPinOrHash = String(pinRow?.pin_code || "").trim();
  if (!storedPinOrHash) {
    runDummyScryptVerification(cleanPin, "missing");
    return {
      success: false,
      status: 401,
      error: UNIFIED_LOGIN_ERROR_MESSAGE,
    };
  }

  const isMatch = verifyPassword(cleanPin, storedPinOrHash);

  if (!isMatch) {
    // Nếu tài khoản vẫn đang dùng plaintext PIN cũ, chạy thêm dummy Scrypt để tránh short-circuit qua SHA-256 nhanh
    if (needsRehash(storedPinOrHash)) {
      runDummyScryptVerification(cleanPin, "legacy_wrong_pin");
    }
    return {
      success: false,
      status: 401,
      error: UNIFIED_LOGIN_ERROR_MESSAGE,
    };
  }

  // Từ chối đăng nhập và không auto-rehash nếu tài khoản vẫn đang dùng mã PIN mặc định "1234"
  if (isDefaultPassword(storedPinOrHash)) {
    return {
      success: false,
      status: 403,
      errorCode: "DEFAULT_PIN_RESET_REQUIRED",
      error:
        "Tài khoản đang sử dụng mã PIN mặc định không còn được phép đăng nhập. Vui lòng liên hệ Ban Quản Lý để được cấp lại mã PIN mới.",
    };
  }

  // Đăng nhập thành công -> Xóa bộ đếm Rate Limit theo tài khoản / cặp
  await clearAuthRateLimitOnSuccess({ username: cleanUsername, clientIp });

  let finalPinCode = storedPinOrHash;
  // Auto Re-hash: Nếu mật khẩu trong DB chưa được băm scrypt, tự động nâng cấp ngầm
  if (needsRehash(storedPinOrHash)) {
    try {
      const secureHash = hashPassword(cleanPin);
      await db.run("UPDATE players SET pin_code = ? WHERE id = ?", [
        secureHash,
        matched.id,
      ]);
      finalPinCode = secureHash;
    } catch (err) {
      console.error("Auto re-hash failed:", err);
    }
  }

  // Chỉ tải hồ sơ chi tiết cho đúng 1 người dùng đã xác thực thành công
  const hydratedPlayer =
    (await db.queryOne<Player>(
      `SELECT ${AUTH_PLAYER_PROFILE_COLUMNS} FROM players WHERE id = ? LIMIT 1`,
      [matched.id]
    )) || undefined;

  if (!hydratedPlayer) {
    return {
      success: false,
      status: 401,
      error: UNIFIED_LOGIN_ERROR_MESSAGE,
    };
  }

  hydratedPlayer.pin_code = finalPinCode;
  const isDefault = isDefaultPassword(finalPinCode);
  const mustChangePin = await readMustChangePinFlag(db, matched.id);
  if (mustChangePin) {
    hydratedPlayer.must_change_pin = 1;
  }

  return {
    success: true,
    status: 200,
    player: hydratedPlayer,
    mustChangePassword: isDefault || mustChangePin,
  };
}

// =========================================================================
// 4. KIỂM SOÁT PHÂN QUYỀN (SERVER-SIDE AUTHORIZATION & CSRF)
// =========================================================================

export interface AuthCheckResult {
  authorized: boolean;
  status: 200 | 401 | 403;
  error?: string;
  session?: SessionPayload;
  player?: Player;
}

/**
 * Kiểm tra tính hợp lệ của Header Origin / Referer đối với các HTTP Request làm thay đổi dữ liệu
 * Chống tấn công CSRF (Cross-Site Request Forgery)
 */
export function verifyCsrfOrigin(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  // Các phương thức an toàn chỉ đọc không yêu cầu kiểm tra CSRF
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;

  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  if (!origin) {
    const referer = req.headers.get("referer");
    if (!referer) {
      // Môi trường dev hoặc test runner nội bộ không gửi origin
      return process.env.NODE_ENV !== "production";
    }
    try {
      const refererHost = new URL(referer).host;
      return refererHost === host;
    } catch {
      return false;
    }
  }

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

/**
 * Xác thực bắt buộc quyền Ban Quản Lý (Manager).
 * Kiểm tra trực tiếp trạng thái và vai trò hiện hành trong Cơ Sở Dữ Liệu,
 * không chỉ tin tưởng vào claim trong session token cũ.
 */
export async function requireManagerSession(
  req: NextRequest
): Promise<AuthCheckResult> {
  const session = getAuthSession(req);
  if (!session) {
    return {
      authorized: false,
      status: 401,
      error: "Yêu cầu đăng nhập tài khoản Ban Quản Lý.",
    };
  }

  const db = getAsyncDb();
  const players = await db.query<Player>(
    `SELECT ${AUTH_PLAYER_PROFILE_COLUMNS} FROM players WHERE id = ? LIMIT 1`,
    [session.playerId]
  );
  const player = players[0];

  if (!player || (player as unknown as { status?: string }).status === "inactive") {
    return {
      authorized: false,
      status: 401,
      error: "Tài khoản không tồn tại hoặc đã bị ngừng hoạt động.",
    };
  }

  if (player.access_role !== "manager") {
    return {
      authorized: false,
      status: 403,
      error: "Thao tác yêu cầu quyền Ban Quản Lý (Manager).",
    };
  }

  // Thu hồi phiên làm việc tức thì nếu mật khẩu đã bị đổi hoặc thiếu credential
  const currentFingerprint = getPasswordFingerprint(player.pin_code);
  if (!currentFingerprint || !session.pwdFingerprint || session.pwdFingerprint !== currentFingerprint) {
    return {
      authorized: false,
      status: 401,
      error:
        "Phiên đăng nhập đã hết hạn do mật khẩu đã thay đổi. Vui lòng đăng nhập lại.",
    };
  }

  return { authorized: true, status: 200, session, player };
}

/**
 * Xác thực bắt buộc thành viên / cầu thủ đã đăng nhập vào hệ thống
 */
export async function requirePlayerSession(
  req: NextRequest
): Promise<AuthCheckResult> {
  const session = getAuthSession(req);
  if (!session) {
    return {
      authorized: false,
      status: 401,
      error: "Yêu cầu đăng nhập tài khoản.",
    };
  }

  const db = getAsyncDb();
  const players = await db.query<Player>(
    `SELECT ${AUTH_PLAYER_PROFILE_COLUMNS} FROM players WHERE id = ? LIMIT 1`,
    [session.playerId]
  );
  const player = players[0];

  if (!player || (player as unknown as { status?: string }).status === "inactive") {
    return {
      authorized: false,
      status: 401,
      error: "Tài khoản không tồn tại hoặc đã bị ngừng hoạt động.",
    };
  }

  // Thu hồi phiên làm việc tức thì nếu mật khẩu đã bị đổi hoặc thiếu credential
  const currentFingerprint = getPasswordFingerprint(player.pin_code);
  if (!currentFingerprint || !session.pwdFingerprint || session.pwdFingerprint !== currentFingerprint) {
    return {
      authorized: false,
      status: 401,
      error:
        "Phiên đăng nhập đã hết hạn do mật khẩu đã thay đổi. Vui lòng đăng nhập lại.",
    };
  }

  return { authorized: true, status: 200, session, player };
}

// =========================================================================
// 5. LỌC VÀ CHUẨN HÓA DỮ LIỆU CÔNG KHAI (DATA SANITIZATION & DTO)
// =========================================================================

/**
 * Lọc sạch thông tin nhạy cảm của cầu thủ cho người xem công khai (Guest)
 * Loại bỏ: phone, username, pin_code, notes, access_role
 */
export function sanitizePlayerForPublic(player: Player): PublicPlayerDTO {
  return {
    id: player.id,
    code_order: player.code_order,
    full_name: player.full_name,
    short_name: player.short_name,
    jersey_number: player.jersey_number,
    position: player.position,
    birth_year: player.birth_year,
    avatar_url: player.avatar_url,
    profile_image_url: player.profile_image_url || "",
    role: player.role,
    status: player.status,
    bio: player.bio,
    hometown: player.hometown,
    nickname: player.nickname,
    playing_style: player.playing_style,
    gallery_urls: player.gallery_urls,
  };
}

/**
 * Lọc dữ liệu toàn đội dành cho khách vãng lai (Guest Portal)
 * Ẩn toàn bộ: SĐT thành viên, mã PIN, ghi chú nội bộ, chi tiết thu chi từng hóa đơn
 */
export function sanitizeDataForPublic(data: FullAppData): FullAppData {
  return {
    settings: {
      ...data.settings,
      tournament_fund_note: "", // Ẩn ghi chú nội bộ
    },
    players: data.players.map((p) => ({
      ...p,
      phone: "",
      username: "",
      pin_code: "",
      must_change_pin: undefined,
      notes: "",
      gallery_urls: [],
      access_role: "player" as const,
    })),
    matches: data.matches,
    attendances: data.attendances,
    otherIncomes: [], // Ẩn sổ chi tiết từng khoản ngoài
    expenses: [], // Ẩn sổ chứng từ chi tiêu chi tiết
    summary: data.summary,
    posts: data.posts,
    sponsors: data.sponsors,
  };
}

/**
 * Lọc dữ liệu dành cho Cầu thủ thường (Player):
 * Giữ nguyên minh bạch tài chính và tổng quỹ, nhưng ẩn thông tin liên hệ riêng tư của cầu thủ khác
 */
export function sanitizeDataForPlayer(
  data: FullAppData,
  currentUserId: number
): FullAppData {
  return {
    settings: {
      ...data.settings,
      tournament_fund_note: "",
    },
    players: data.players.map((p) => {
      if (p.id === currentUserId) {
        return {
          ...p,
          pin_code: "", // Tuyệt đối không truyền mã PIN / hash qua mạng
        };
      }
      return {
        ...p,
        phone: "",
        username: "",
        pin_code: "",
        must_change_pin: undefined,
        notes: "",
        access_role: "player" as const,
      };
    }),
    matches: data.matches,
    attendances: data.attendances,
    otherIncomes: data.otherIncomes,
    expenses: data.expenses,
    summary: data.summary,
    posts: data.posts,
    sponsors: data.sponsors,
  };
}

/**
 * Chiếu đối tượng cầu thủ theo danh sách trường cho phép (allow-list),
 * loại bỏ hoàn toàn pin_code và mọi thông tin băm/dấu vân tay mật khẩu khỏi API DTO.
 */
export function projectSafePlayer(player: Player): SafePlayerPayload {
  return {
    id: player.id,
    code_order: player.code_order,
    full_name: player.full_name,
    short_name: player.short_name,
    jersey_number: player.jersey_number,
    position: player.position,
    phone: player.phone,
    birth_year: player.birth_year,
    avatar_url: player.avatar_url,
    profile_image_url: player.profile_image_url || "",
    role: player.role,
    access_role: player.access_role,
    ...(player.username !== undefined ? { username: player.username } : {}),
    status: player.status,
    notes: player.notes,
    ...(player.bio !== undefined ? { bio: player.bio } : {}),
    ...(player.hometown !== undefined ? { hometown: player.hometown } : {}),
    ...(player.nickname !== undefined ? { nickname: player.nickname } : {}),
    ...(player.playing_style !== undefined ? { playing_style: player.playing_style } : {}),
    ...(player.gallery_urls !== undefined ? { gallery_urls: player.gallery_urls } : {}),
    ...(player.must_change_pin !== undefined
      ? { mustChangePin: Number(player.must_change_pin) === 1 }
      : {}),
  };
}

export type SafeTeamResponseData = Omit<FullAppData, "players"> & {
  players: SafePlayerPayload[];
};

/**
 * Chuẩn hóa và lọc dữ liệu trả về cho API (/api/team, /api/import) theo vai trò hiện hành:
 * - Manager: xem toàn bộ dữ liệu nhưng vẫn loại bỏ hoàn toàn thuộc tính pin_code.
 * - Player: giữ hồ sơ của chính mình, ẩn SĐT/username/notes/access_role của người khác và tournament_fund_note.
 * - Guest (null): chỉ giữ dữ liệu công khai.
 */
export function sanitizeTeamResponseData(
  data: FullAppData,
  session: Pick<SessionPayload, "playerId" | "accessRole"> | null
): SafeTeamResponseData {
  const scoped: FullAppData =
    session && session.accessRole === "manager"
      ? data
      : session
        ? sanitizeDataForPlayer(data, session.playerId)
        : sanitizeDataForPublic(data);

  return {
    ...scoped,
    players: scoped.players.map(projectSafePlayer),
  };
}
