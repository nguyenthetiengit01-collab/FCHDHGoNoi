import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_PLAYER_PROFILE_COLUMNS,
  AuthSecretError,
  verifyCredentials,
  createSessionToken,
  getAuthSecret,
  getAuthSession,
  getPasswordFingerprint,
  isDefaultPassword,
  projectSafePlayer,
  readMustChangePinState,
  SESSION_COOKIE_NAME,
  requireManagerSession,
  verifyCsrfOrigin,
} from "@/lib/auth";
import { extractTrustedClientIp } from "@/lib/authRateLimit";
import { getAsyncDb, recordAuditLog } from "@/lib/db";
import type { Player } from "@/types/app";

const NO_STORE_CACHE_CONTROL = "no-store, no-cache, must-revalidate";

function withNoStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", NO_STORE_CACHE_CONTROL);
  return res;
}

/**
 * Lấy thông tin phiên làm việc hiện tại và kiểm tra tính hợp lệ
 */
export async function GET(req: NextRequest) {
  return withNoStore(await handleGetAuth(req));
}

async function handleGetAuth(req: NextRequest): Promise<NextResponse> {
  try {
    try {
      getAuthSecret();
    } catch (err) {
      if (err instanceof AuthSecretError) {
        return NextResponse.json(
          {
            authenticated: false,
            player: null,
            error: "Hệ thống xác thực chưa được cấu hình đầy đủ trên máy chủ.",
            code: err.code,
          },
          { status: 503 }
        );
      }
      throw err;
    }

    const session = getAuthSession(req);
    if (!session) {
      return NextResponse.json({ authenticated: false, player: null });
    }

    const db = getAsyncDb();
    const playerRow =
      (await db.queryOne<Player>(
        `SELECT ${AUTH_PLAYER_PROFILE_COLUMNS} FROM players WHERE id = ? LIMIT 1`,
        [session.playerId]
      )) || undefined;

    if (!playerRow || playerRow.status === "inactive") {
      const res = NextResponse.json({ authenticated: false, player: null });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    // Thu hồi phiên tức thì nếu mật khẩu đã bị thay đổi hoặc thiếu credential
    const currentFp = getPasswordFingerprint(playerRow.pin_code);
    if (!currentFp || !session.pwdFingerprint || session.pwdFingerprint !== currentFp) {
      const res = NextResponse.json({
        authenticated: false,
        player: null,
        error: "Mật khẩu của bạn đã được thay đổi. Vui lòng đăng nhập lại.",
      });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    const pinState = await readMustChangePinState(db, playerRow.id);
    if (!pinState.ok) {
      return NextResponse.json(
        {
          authenticated: false,
          player: null,
          code: pinState.errorCode,
          error: pinState.error,
        },
        { status: pinState.status }
      );
    }
    playerRow.must_change_pin = pinState.mustChangePin ? 1 : 0;

    // Luôn ẩn mã PIN trước khi gửi về client (allow-list projection)
    const safePlayer = projectSafePlayer(playerRow);

    const mustChangePassword =
      isDefaultPassword(playerRow.pin_code) || pinState.mustChangePin;

    return NextResponse.json({
      authenticated: true,
      player: safePlayer,
      role: playerRow.access_role,
      mustChangePassword,
    });
  } catch (error) {
    console.error("GET /api/auth error:", error instanceof Error ? error.name : "UNKNOWN");
    return NextResponse.json(
      { error: "Lỗi kiểm tra phiên làm việc" },
      { status: 500 }
    );
  }
}

/**
 * Xử lý đăng nhập và đăng xuất an toàn với chuẩn chống Brute-force và Session Timeout
 */
export async function POST(req: NextRequest) {
  return withNoStore(await handlePostAuth(req));
}

async function handlePostAuth(req: NextRequest): Promise<NextResponse> {
  try {
    if (!verifyCsrfOrigin(req)) {
      return NextResponse.json(
        { success: false, error: "Yêu cầu bị từ chối do vi phạm bảo mật CSRF / Origin." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (action === "logout") {
      const res = NextResponse.json({ success: true, message: "Đã đăng xuất" });
      res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: "",
        maxAge: 0,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      return res;
    }

    try {
      getAuthSecret();
    } catch (err) {
      if (err instanceof AuthSecretError) {
        return NextResponse.json(
          {
            success: false,
            error: "Hệ thống xác thực tạm thời không khả dụng do thiếu cấu hình bảo mật máy chủ.",
            code: err.code,
          },
          { status: 503 }
        );
      }
      throw err;
    }

    if (action === "switch_role" || action === "quick_login") {
      const auth = await requireManagerSession(req);
      if (!auth.authorized) {
        return NextResponse.json(
          { success: false, error: auth.error || "Thao tác yêu cầu đăng nhập bằng tài khoản Ban Quản Lý" },
          { status: auth.status }
        );
      }

      const playerId = Number(body.playerId);
      if (!playerId) {
        return NextResponse.json(
          { success: false, error: "Mã cầu thủ không hợp lệ" },
          { status: 400 }
        );
      }

      const db = getAsyncDb();
      const playerRow =
        (await db.queryOne<Player>(
          `SELECT ${AUTH_PLAYER_PROFILE_COLUMNS} FROM players WHERE id = ? LIMIT 1`,
          [playerId]
        )) || undefined;

      if (!playerRow) {
        return NextResponse.json(
          { success: false, error: "Không tìm thấy hồ sơ cầu thủ" },
          { status: 404 }
        );
      }

      if (playerRow.status === "inactive") {
        return NextResponse.json(
          { success: false, error: "Không thể chuyển phiên sang tài khoản đã ngừng hoạt động." },
          { status: 403 }
        );
      }

      if (!String(playerRow.pin_code || "").trim()) {
        return NextResponse.json(
          { success: false, error: "Tài khoản mục tiêu chưa có thông tin xác thực hợp lệ." },
          { status: 403 }
        );
      }

      if (isDefaultPassword(playerRow.pin_code)) {
        return NextResponse.json(
          {
            success: false,
            code: "DEFAULT_PIN_RESET_REQUIRED",
            error:
              "Không thể chuyển phiên sang tài khoản đang sử dụng mã PIN mặc định. Vui lòng đặt lại mã PIN mới trước.",
          },
          { status: 403 }
        );
      }

      const token = createSessionToken(playerRow, 24 * 7);
      const safePlayer = projectSafePlayer(playerRow);

      await recordAuditLog({
        actorId: auth.player?.id ?? auth.session?.playerId ?? 0,
        actorName: auth.player?.full_name ?? auth.session?.fullName ?? "Manager",
        actorRole: auth.player?.access_role ?? auth.session?.accessRole ?? "manager",
        action,
        summary: `Manager #${auth.player?.id ?? auth.session?.playerId ?? 0} switched session to player #${playerRow.id} (${action})`,
        tx: db,
      });

      const res = NextResponse.json({
        success: true,
        player: safePlayer,
        message: `Đã kết nối phiên làm việc: ${playerRow.full_name}`,
      });

      res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: token,
        maxAge: 7 * 24 * 3600,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      return res;
    }

    if (action === "login") {
      const { username, pin, rememberMe } = body;
      const clientIp = extractTrustedClientIp(req.headers);

      const verifyRes = await verifyCredentials(username, pin, clientIp);

      if (!verifyRes.success || !verifyRes.player) {
        return NextResponse.json(
          {
            success: false,
            error: verifyRes.error || "Đăng nhập thất bại",
            ...(verifyRes.errorCode ? { code: verifyRes.errorCode } : {}),
          },
          {
            status: verifyRes.status || 401,
            headers: verifyRes.waitSeconds
              ? { "Retry-After": String(verifyRes.waitSeconds) }
              : undefined,
          }
        );
      }

      const player = verifyRes.player;
      // Ghi nhớ 30 ngày nếu chọn rememberMe, nếu không phiên là 24 giờ (an toàn cho máy lạ)
      const durationHours = rememberMe ? 24 * 30 : 24;
      const token = createSessionToken(player, durationHours);

      // Bảo mật: Loại bỏ hoàn toàn mã PIN trước khi trả về dữ liệu người dùng
      const safePlayer = projectSafePlayer(player);

      const res = NextResponse.json({
        success: true,
        player: safePlayer,
        mustChangePassword: verifyRes.mustChangePassword,
        message: `Đăng nhập thành công: ${player.full_name}`,
      });

      // Thiết lập httpOnly cookie an toàn chống đánh cắp từ Javascript client
      res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: token,
        maxAge: durationHours * 3600,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      return res;
    }

    return NextResponse.json(
      { error: "Hành động không hợp lệ" },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST /api/auth error:", error instanceof Error ? error.name : "UNKNOWN");
    if (error instanceof AuthSecretError) {
      return NextResponse.json(
        {
          error: "Hệ thống xác thực tạm thời không khả dụng do thiếu cấu hình bảo mật máy chủ.",
          code: error.code,
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Lỗi xử lý xác thực trên máy chủ" },
      { status: 500 }
    );
  }
}
