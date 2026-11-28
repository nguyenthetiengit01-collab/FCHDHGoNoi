import { NextRequest, NextResponse } from "next/server";
import {
  AuthDatabaseError,
  AUTH_PLAYER_PROFILE_COLUMNS,
  AuthSecretError,
  verifyCredentials,
  createSessionToken,
  getAuthSecret,
  getCurrentAuthContextFromToken,
  isDefaultPassword,
  queryAuthPlayerById,
  runAuthDbQuery,
  SESSION_COOKIE_NAME,
  requireManagerSession,
  verifyCsrfOrigin,
} from "@/lib/auth";
import { extractTrustedClientIp } from "@/lib/authRateLimit";
import { getAsyncDb, recordAuditLog } from "@/lib/db";
import { guardCutoverWrite } from "@/lib/cutoverFreeze";
import type { Player } from "@/types/app";

/**
 * Lấy thông tin phiên làm việc hiện tại và kiểm tra tính hợp lệ
 */
export async function GET(req: NextRequest) {
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

    const cookie = req.cookies.get(SESSION_COOKIE_NAME);
    if (!cookie?.value) {
      return NextResponse.json({ authenticated: false, player: null });
    }

    const ctx = await getCurrentAuthContextFromToken(cookie.value);
    if (ctx.status === 503) {
      return NextResponse.json(
        {
          authenticated: false,
          player: null,
          error: ctx.error || "Cơ sở dữ liệu xác thực tạm thời không khả dụng.",
          code: ctx.errorCode || "AUTH_DATABASE_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    if (!ctx.authorized || !ctx.player || !ctx.session) {
      const res = NextResponse.json({
        authenticated: false,
        player: null,
        error: ctx.error || "Phiên đăng nhập không hợp lệ hoặc đã bị thu hồi.",
        ...(ctx.errorCode ? { code: ctx.errorCode } : {}),
      });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    // Luôn ẩn mã PIN trước khi gửi về client
    const safePlayer: Player = {
      ...ctx.player,
      pin_code: "",
    };

    return NextResponse.json({
      authenticated: true,
      player: safePlayer,
      role: ctx.player.access_role === "manager" ? "manager" : "player",
      mustChangePassword: Boolean(ctx.mustChangePin),
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
  const freezeRes = guardCutoverWrite("POST /api/auth");
  if (freezeRes) return freezeRes;

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

      const { db, playerRow } = await runAuthDbQuery(async () => {
        const asyncDb = getAsyncDb();
        const found = await queryAuthPlayerById(asyncDb, playerId);
        return { db: asyncDb, playerRow: found };
      });

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

      if (Number(playerRow.must_change_pin) === 1) {
        return NextResponse.json(
          {
            success: false,
            code: "PIN_CHANGE_REQUIRED",
            error:
              "Không thể chuyển phiên sang tài khoản đang chờ đổi mật khẩu tạm thời.",
          },
          { status: 403 }
        );
      }

      const token = createSessionToken(playerRow, 24 * 7);
      const safePlayer: Player = {
        ...playerRow,
        pin_code: "",
      };

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

      // Bảo mật: Xóa mã PIN trước khi trả về dữ liệu người dùng
      const safePlayer: Player = {
        ...player,
        pin_code: "",
      };

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
    if (error instanceof AuthSecretError || error instanceof AuthDatabaseError) {
      return NextResponse.json(
        {
          error:
            error instanceof AuthDatabaseError
              ? error.message
              : "Hệ thống xác thực tạm thời không khả dụng do thiếu cấu hình bảo mật máy chủ.",
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
