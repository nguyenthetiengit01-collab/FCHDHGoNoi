import { NextRequest } from "next/server";
import crypto from "crypto";
import { getDb } from "./db";
import type { Player } from "@/types/app";

// Khóa bí mật ký session token - ưu tiên lấy từ biến môi trường
const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "fc-hdh-go-noi-sapphire-secret-key-2026-secure";

export const SESSION_COOKIE_NAME = "fc_session";

export interface SessionPayload {
  playerId: number;
  accessRole: "manager" | "player";
  fullName: string;
  shortName: string;
  jerseyNumber: number | null;
  exp: number; // Unix timestamp in seconds
}

/**
 * Ký và tạo Session Token an toàn (HMAC-SHA256)
 */
export function createSessionToken(player: Player, durationHours = 24 * 7): string {
  const exp = Math.floor(Date.now() / 1000) + durationHours * 3600;
  const payload: SessionPayload = {
    playerId: player.id,
    accessRole: player.access_role || "player",
    fullName: player.full_name,
    shortName: player.short_name,
    jerseyNumber: player.jersey_number,
    exp,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
}

/**
 * Giải mã và xác minh tính toàn vẹn của Session Token
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.includes(".")) return null;

  const [payloadBase64, providedSig] = token.split(".");
  if (!payloadBase64 || !providedSig) return null;

  // Kiểm tra chữ ký mật mã
  const expectedSig = crypto
    .createHmac("sha256", AUTH_SECRET)
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
 * Chuẩn hóa tên đăng nhập không dấu để so khớp linh hoạt
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
 * Xác thực thông tin đăng nhập từ Server Database
 */
export function verifyCredentials(
  username: string,
  pin: string
): { success: boolean; player?: Player; error?: string } {
  const cleanUsername = String(username || "").trim();
  const cleanPin = String(pin || "").trim();

  if (!cleanUsername) {
    return { success: false, error: "Vui lòng nhập Tên đăng nhập" };
  }
  if (!cleanPin) {
    return { success: false, error: "Vui lòng nhập Mật khẩu / Mã PIN" };
  }

  const db = getDb();
  const allPlayers = db
    .prepare("SELECT * FROM players ORDER BY id ASC")
    .all() as unknown as Player[];

  const uNorm = normalizeLoginString(cleanUsername);

  // Tìm cầu thủ theo: tên tài khoản riêng (username), tên thường gọi, họ và tên, số điện thoại, hoặc số áo
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

  if (!matched) {
    return {
      success: false,
      error: "Tên đăng nhập không chính xác hoặc không thuộc danh sách CLB.",
    };
  }

  const expectedPin = matched.pin_code || "1234";
  if (cleanPin !== expectedPin) {
    return {
      success: false,
      error: "Mật khẩu không chính xác. Vui lòng kiểm tra lại hoặc liên hệ Ban Quản Lý.",
    };
  }

  return { success: true, player: matched };
}

