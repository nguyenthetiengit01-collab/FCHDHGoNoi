import { describe, it, expect } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  normalizeLoginString,
} from "./auth";
import type { Player } from "@/types/app";

describe("Security & Auth Token Verification", () => {
  const mockManager: Player = {
    id: 2,
    code_order: 1,
    full_name: "Nguyễn Thế Tiếng",
    short_name: "Tiếng",
    jersey_number: 12,
    position: "Đa năng",
    phone: "0901234567",
    birth_year: "1988",
    avatar_url: "/avatar.jpg",
    bio: "Đội trưởng",
    role: "Đội trưởng",
    access_role: "manager",
    pin_code: "1234",
    status: "Đang sinh hoạt",
    notes: "",
  };

  it("tạo token và giải mã thành công đúng dữ liệu danh tính", () => {
    const token = createSessionToken(mockManager, 24);
    expect(typeof token).toBe("string");
    expect(token.includes(".")).toBe(true);

    const verified = verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.playerId).toBe(mockManager.id);
    expect(verified?.accessRole).toBe("manager");
    expect(verified?.fullName).toBe("Nguyễn Thế Tiếng");
  });

  it("từ chối khi token bị giả mạo hoặc thay đổi nội dung (Anti-tampering)", () => {
    const validToken = createSessionToken(mockManager, 24);
    const [, sig] = validToken.split(".");

    // Kẻ tấn công sửa payload base64 (ví dụ nâng quyền từ player lên manager)
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        playerId: 999,
        accessRole: "manager",
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");

    const tamperedToken = `${tamperedPayload}.${sig}`;
    const result = verifySessionToken(tamperedToken);

    expect(result).toBeNull(); // Hệ thống phát hiện chữ ký sai và từ chối ngay lập tức
  });

  it("từ chối token đã hết hạn", () => {
    // Tạo token có thời hạn âm (đã hết hạn trong quá khứ)
    const expiredToken = createSessionToken(mockManager, -1);
    const result = verifySessionToken(expiredToken);

    expect(result).toBeNull();
  });

  it("chuẩn hóa tên đăng nhập không dấu, không phân biệt hoa thường", () => {
    expect(normalizeLoginString("Nguyễn Thế Tiếng")).toBe("nguyenthetieng");
    expect(normalizeLoginString("Hồ Viết Tín")).toBe("hoviettin");
    expect(normalizeLoginString("Đỗ Thiều Duy Vương")).toBe("dothieuduyvuong");
    expect(normalizeLoginString(" #12 ")).toBe("12");
    expect(normalizeLoginString("tieng_gonoi")).toBe("tienggonoi");
  });
});
