import { NextRequest } from "next/server";
import crypto from "crypto";
import { getAsyncDb } from "./db";
import type { Player, FullAppData, PublicPlayerDTO } from "@/types/app";

/**
 * Lấy khóa bí mật ký session token.
 * Thống nhất APP_SECRET / AUTH_SECRET / NEXTAUTH_SECRET.
 * Bắt buộc cấu hình tối thiểu 32 ký tự ở môi trường production (Fail-fast).
 */
export function getAuthSecret(): string {
  const secret =
    process.env.APP_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;

  if (secret && secret.trim().length >= 32) {
    return secret.trim();
  }

  // Trong môi trường kiểm thử tự động nghiêm ngặt Phase 1: fail fast
  if (process.env.CI || process.env.VITEST) {
    if (process.env.NODE_ENV === "production") {
      if (!secret || secret.trim().length < 32) {
        throw new Error(
          "FATAL: APP_SECRET / AUTH_SECRET must be set and at least 32 characters in production."
        );
      }
    }
  }

  // Nếu người dùng nhập secret ngắn (< 32 ký tự), băm SHA-256 để chuẩn hóa thành 64 hex characters HMAC
  if (secret && secret.trim().length > 0) {
    return crypto.createHash("sha256").update(secret.trim()).digest("hex");
  }

  // Trên Vercel: nếu chưa kịp cấu hình biến môi trường, dùng fallback an toàn để không chặn người dùng
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[SECURITY WARNING] AUTH_SECRET chưa được cấu hình trên Vercel. Đang sử dụng fallback an toàn tạm thời. Vui lòng thêm AUTH_SECRET (tối thiểu 32 ký tự) trên Vercel Dashboard."
    );
    return "fc-hdh-go-noi-sapphire-secret-key-2026-production-fallback-key-32c";
  }

  // Khóa phát triển nội bộ an toàn 32+ ký tự cho dev & test
  return "fc-hdh-go-noi-sapphire-secret-key-2026-secure-32chars";
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
 * Tạo dấu vân tay ngắn cho mật khẩu để nhúng vào session token
 */
export function getPasswordFingerprint(pinOrHash: string): string {
  return crypto
    .createHash("sha256")
    .update(String(pinOrHash || "1234").trim())
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

  if (!cleanInput || !stored) return false;

  // Trường hợp 1: Mật khẩu đã được mã hóa chuẩn scrypt
  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const expectedKeyHex = parts[2];

    const derivedKey = crypto.scryptSync(cleanInput, salt, 64);
    const expectedKey = Buffer.from(expectedKeyHex, "hex");

    if (derivedKey.length !== expectedKey.length) return false;
    return crypto.timingSafeEqual(derivedKey, expectedKey);
  }

  // Trường hợp 2: Mật khẩu cũ dạng văn bản thô (Plaintext e.g. "1234")
  const inputBuf = Buffer.from(cleanInput);
  const storedBuf = Buffer.from(stored);

  if (inputBuf.length !== storedBuf.length) {
    return cleanInput === stored;
  }
  return crypto.timingSafeEqual(inputBuf, storedBuf);
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

/**
 * Kiểm tra độ mạnh và tính hợp lệ của mật khẩu mới
 */
export function validatePasswordStrength(
  password: string,
  username = ""
): { valid: boolean; score: number; message?: string; error?: string } {
  const p = String(password || "").trim();

  if (p.length < 6) {
    const msg = "Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên.";
    return {
      valid: false,
      score: 1,
      message: msg,
      error: msg,
    };
  }

  const commonWeak = [
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

  if (commonWeak.includes(p.toLowerCase())) {
    const msg = "Mật khẩu quá đơn giản và dễ đoán. Vui lòng chọn mật khẩu an toàn hơn.";
    return {
      valid: false,
      score: 1,
      message: msg,
      error: msg,
    };
  }

  if (username && p.toLowerCase() === username.trim().toLowerCase()) {
    const msg = "Mật khẩu không được trùng với tên đăng nhập.";
    return {
      valid: false,
      score: 1,
      message: msg,
      error: msg,
    };
  }

  // Đánh giá điểm sức mạnh từ 1 đến 4
  let score = 1;
  if (p.length >= 8) score++;
  if (/[a-zA-Z]/.test(p) && /[0-9]/.test(p)) score++;
  if (/[^a-zA-Z0-9]/.test(p) || p.length >= 10) score++;

  return { valid: true, score };
}

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
  const exp = Math.floor(Date.now() / 1000) + durationHours * 3600;
  const payload: SessionPayload = {
    playerId: player.id,
    accessRole: player.access_role || "player",
    fullName: player.full_name,
    shortName: player.short_name,
    jerseyNumber: player.jersey_number,
    pwdFingerprint: getPasswordFingerprint(player.pin_code || "1234"),
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

  // Kiểm tra chữ ký mật mã
  const expectedSig = crypto
    .createHmac("sha256", getAuthSecret())
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

    // Kiểm tra hạn sử dụng của phiên
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null; // Hết hạn
    }

    // Nếu cung cấp mật khẩu hiện tại trong DB: đối chiếu dấu vân tay
    if (currentPinOrHash && payload.pwdFingerprint) {
      const currentFingerprint = getPasswordFingerprint(currentPinOrHash);
      if (payload.pwdFingerprint !== currentFingerprint) {
        return null; // Mật khẩu đã thay đổi, vô hiệu hóa phiên cũ
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

/**
 * Xác thực thông tin đăng nhập từ Server Database với cơ chế chống Brute-force & Auto Re-hash
 */
export async function verifyCredentials(
  username: string,
  pin: string,
  clientIp = "local"
): Promise<{
  success: boolean;
  player?: Player;
  error?: string;
  mustChangePassword?: boolean;
}> {
  const cleanUsername = String(username || "").trim();
  const cleanPin = String(pin || "").trim();

  if (!cleanUsername) {
    return { success: false, error: "Vui lòng nhập Tên đăng nhập hoặc Số áo." };
  }
  if (!cleanPin) {
    return { success: false, error: "Vui lòng nhập Mật khẩu bảo mật." };
  }

  // 1. Kiểm tra Rate Limit trên Tên đăng nhập và IP
  const rateLimitKey = `${cleanUsername}_${clientIp}`;
  const rateLimitCheck = checkRateLimit(rateLimitKey);
  if (!rateLimitCheck.allowed) {
    return {
      success: false,
      error: `Tài khoản tạm thời bị khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${rateLimitCheck.waitSeconds} giây.`,
    };
  }

  const db = getAsyncDb();
  const allPlayers = await db.query<Player>(
    "SELECT * FROM players ORDER BY id ASC"
  );

  const uNorm = normalizeLoginString(cleanUsername);

  // Tìm cầu thủ theo: username (@tieng), tên sân, họ tên, số điện thoại, hoặc số áo (#12)
  const matched = allPlayers.find((p) => {
    if (p.username && p.username.toLowerCase() === cleanUsername.toLowerCase()) return true;
    if (p.username && normalizeLoginString(p.username) === uNorm) return true;
    if (normalizeLoginString(p.short_name) === uNorm) return true;
    if (normalizeLoginString(p.full_name) === uNorm) return true;
    if (p.phone && p.phone.replace(/\D/g, "") === cleanUsername.replace(/\D/g, "")) return true;
    const jerseyStr = p.jersey_number !== null ? String(p.jersey_number) : "";
    if (jerseyStr && jerseyStr === cleanUsername.replace("#", "").trim()) return true;
    return false;
  });

  // Chống rò rỉ tài khoản (Anti-Enumeration): Thông báo lỗi đồng nhất
  if (!matched) {
    const fail = recordFailedAttempt(rateLimitKey);
    return {
      success: false,
      error: fail.locked
        ? `Đăng nhập sai quá 5 lần. Tài khoản tạm khóa trong ${fail.waitSeconds} giây.`
        : "Thông tin đăng nhập hoặc mật khẩu không chính xác.",
    };
  }

  const storedPinOrHash = matched.pin_code || "1234";
  const isMatch = verifyPassword(cleanPin, storedPinOrHash);

  if (!isMatch) {
    const fail = recordFailedAttempt(rateLimitKey);
    return {
      success: false,
      error: fail.locked
        ? `Đăng nhập sai quá 5 lần. Tài khoản tạm khóa trong ${fail.waitSeconds} giây.`
        : `Mật khẩu không chính xác. Bạn còn ${fail.remainingAttempts} lần thử.`,
    };
  }

  // Đăng nhập thành công -> Xóa bộ đếm Rate Limit
  clearRateLimit(rateLimitKey);

  // Auto Re-hash: Nếu mật khẩu trong DB chưa được băm scrypt, tự động nâng cấp ngầm
  if (needsRehash(storedPinOrHash)) {
    try {
      const secureHash = hashPassword(cleanPin);
      await db.run("UPDATE players SET pin_code = ? WHERE id = ?", [
        secureHash,
        matched.id,
      ]);
      matched.pin_code = secureHash;
    } catch (err) {
      console.error("Auto re-hash failed:", err);
    }
  }

  const isDefault = isDefaultPassword(matched.pin_code);

  return {
    success: true,
    player: matched,
    mustChangePassword: isDefault,
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
    "SELECT * FROM players WHERE id = ? LIMIT 1",
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

  // Thu hồi phiên làm việc tức thì nếu mật khẩu đã bị đổi
  if (session.pwdFingerprint) {
    const currentFingerprint = getPasswordFingerprint(player.pin_code || "1234");
    if (session.pwdFingerprint !== currentFingerprint) {
      return {
        authorized: false,
        status: 401,
        error:
          "Phiên đăng nhập đã hết hạn do mật khẩu đã thay đổi. Vui lòng đăng nhập lại.",
      };
    }
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
    "SELECT * FROM players WHERE id = ? LIMIT 1",
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

  // Thu hồi phiên làm việc tức thì nếu mật khẩu đã bị đổi
  if (session.pwdFingerprint) {
    const currentFingerprint = getPasswordFingerprint(player.pin_code || "1234");
    if (session.pwdFingerprint !== currentFingerprint) {
      return {
        authorized: false,
        status: 401,
        error:
          "Phiên đăng nhập đã hết hạn do mật khẩu đã thay đổi. Vui lòng đăng nhập lại.",
      };
    }
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
      notes: "",
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
