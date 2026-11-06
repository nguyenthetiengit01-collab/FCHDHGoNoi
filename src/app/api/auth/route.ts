import { NextRequest, NextResponse } from "next/server";
import {
  verifyCredentials,
  createSessionToken,
  getAuthSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { Player } from "@/types/app";

/**
 * Lấy thông tin phiên làm việc hiện tại
 */
export async function GET(req: NextRequest) {
  try {
    const session = getAuthSession(req);
    if (!session) {
      return NextResponse.json({ authenticated: false, player: null });
    }

    const db = getDb();
    const playerRow = db
      .prepare("SELECT * FROM players WHERE id = ?")
      .get(session.playerId) as unknown as Player | undefined;

    if (!playerRow) {
      const res = NextResponse.json({ authenticated: false, player: null });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    // Luôn ẩn mã PIN trước khi gửi về client
    const safePlayer: Player = {
      ...playerRow,
      pin_code: "",
    };

    return NextResponse.json({
      authenticated: true,
      player: safePlayer,
      role: session.accessRole,
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
 * Xử lý đăng nhập và đăng xuất an toàn
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

      const db = getDb();
      const playerRow = db
        .prepare("SELECT * FROM players WHERE id = ?")
        .get(playerId) as unknown as Player | undefined;

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
      const { username, pin } = body;
      const verifyRes = verifyCredentials(username, pin);

      if (!verifyRes.success || !verifyRes.player) {
        return NextResponse.json(
          { success: false, error: verifyRes.error || "Đăng nhập thất bại" },
          { status: 401 }
        );
      }

      const player = verifyRes.player;
      const token = createSessionToken(player, 24 * 7); // 7 ngày

      // Bảo mật: Xóa mã PIN trước khi trả về dữ liệu người dùng
      const safePlayer: Player = {
        ...player,
        pin_code: "",
      };

      const res = NextResponse.json({
        success: true,
        player: safePlayer,
        message: `Đăng nhập thành công: ${player.full_name}`,
      });

      // Thiết lập httpOnly cookie an toàn chống đánh cắp từ Javascript client
      res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: token,
        maxAge: 7 * 24 * 3600, // 7 ngày
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

