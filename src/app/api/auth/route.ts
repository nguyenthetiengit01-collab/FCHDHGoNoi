import { NextRequest, NextResponse } from "next/server";
import {
  verifyCredentials,
  createSessionToken,
  getAuthSession,
  getPasswordFingerprint,
  isDefaultPassword,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { getAsyncDb } from "@/lib/db";
import type { Player } from "@/types/app";

/**
 * Lấy thông tin phiên làm việc hiện tại và kiểm tra tính hợp lệ
 */
export async function GET(req: NextRequest) {
  try {
    const session = getAuthSession(req);
    if (!session) {
      return NextResponse.json({ authenticated: false, player: null });
    }

    const db = getAsyncDb();
    const playerRow = (await db.queryOne<Player>(
      "SELECT * FROM players WHERE id = ?",
      [session.playerId]
    )) || undefined;

    if (!playerRow) {
      const res = NextResponse.json({ authenticated: false, player: null });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    // Thu hồi phiên tức thì nếu mật khẩu đã bị thay đổi trên thiết bị khác
    if (session.pwdFingerprint) {
      const currentFp = getPasswordFingerprint(playerRow.pin_code || "1234");
      if (session.pwdFingerprint !== currentFp) {
        const res = NextResponse.json({
          authenticated: false,
          player: null,
          error: "Mật khẩu của bạn đã được thay đổi. Vui lòng đăng nhập lại.",
        });
        res.cookies.delete(SESSION_COOKIE_NAME);
        return res;
      }
    }

    // Luôn ẩn mã PIN trước khi gửi về client
    const safePlayer: Player = {
      ...playerRow,
      pin_code: "",
    };

    const mustChangePassword = isDefaultPassword(playerRow.pin_code);

    return NextResponse.json({
      authenticated: true,
      player: safePlayer,
      role: session.accessRole,
      mustChangePassword,
    });
  } catch (error) {
    console.error("GET /api/auth error:", error);
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
  try {
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

    if (action === "switch_role" || action === "quick_login") {
      const currentSession = getAuthSession(req);
      if (!currentSession || currentSession.accessRole !== "manager") {
        return NextResponse.json(
          { success: false, error: "Thao tác yêu cầu đăng nhập bằng tài khoản Ban Quản Lý" },
          { status: 401 }
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
      const playerRow = (await db.queryOne<Player>(
        "SELECT * FROM players WHERE id = ?",
        [playerId]
      )) || undefined;

      if (!playerRow) {
        return NextResponse.json(
          { success: false, error: "Không tìm thấy hồ sơ cầu thủ" },
          { status: 404 }
        );
      }

      const token = createSessionToken(playerRow, 24 * 7);
      const safePlayer: Player = {
        ...playerRow,
        pin_code: "",
      };

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
      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "local";

      const verifyRes = await verifyCredentials(username, pin, clientIp);

      if (!verifyRes.success || !verifyRes.player) {
        return NextResponse.json(
          { success: false, error: verifyRes.error || "Đăng nhập thất bại" },
          { status: 401 }
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
    console.error("POST /api/auth error:", error);
    return NextResponse.json(
      { error: "Lỗi xử lý xác thực trên máy chủ" },
      { status: 500 }
    );
  }
}
