import { describe, it, expect, beforeEach } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  normalizeLoginString,
  hashPassword,
  verifyPassword,
  needsRehash,
  isDefaultPassword,
  validatePasswordStrength,
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
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
    expect(verified?.pwdFingerprint).toBeDefined();
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

describe("Password Hashing & Verification (scrypt + random salt)", () => {
  it("băm mật khẩu với salt ngẫu nhiên (2 lần băm cùng mk cho ra kết quả khác nhau)", () => {
    const hash1 = hashPassword("MatKhauBiMat123");
    const hash2 = hashPassword("MatKhauBiMat123");

    expect(hash1.startsWith("scrypt$")).toBe(true);
    expect(hash2.startsWith("scrypt$")).toBe(true);
    expect(hash1).not.toBe(hash2); // Do salt ngẫu nhiên 16 bytes
  });

  it("xác thực chính xác mật khẩu đã băm", () => {
    const hash = hashPassword("Gonoifc@2025");
    expect(verifyPassword("Gonoifc@2025", hash)).toBe(true);
    expect(verifyPassword("SaiMatKhau", hash)).toBe(false);
    expect(verifyPassword("", hash)).toBe(false);
  });

  it("tương thích ngược hoàn hảo với mật khẩu plaintext cũ (legacy 1234)", () => {
    const legacyPlain = "1234";
    expect(verifyPassword("1234", legacyPlain)).toBe(true);
    expect(verifyPassword("9999", legacyPlain)).toBe(false);
  });

  it("nhận diện chính xác khi nào cần re-hash mật khẩu lên scrypt", () => {
    expect(needsRehash("1234")).toBe(true);
    expect(needsRehash("some_plain_pwd")).toBe(true);

    const modernHash = hashPassword("securePassword123");
    expect(needsRehash(modernHash)).toBe(false);
  });

  it("nhận diện chính xác mật khẩu mặc định (1234)", () => {
    expect(isDefaultPassword("1234")).toBe(true);
    expect(isDefaultPassword(hashPassword("1234"))).toBe(true);
    expect(isDefaultPassword("MatKhauMoi6789")).toBe(false);
    expect(isDefaultPassword(hashPassword("MatKhauMoi6789"))).toBe(false);
  });
});

describe("Password Strength Validation (Chính sách độ mạnh mật khẩu)", () => {
  it("từ chối mật khẩu dưới 6 ký tự", () => {
    const res = validatePasswordStrength("1234");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("6 ký tự");
  });

  it("từ chối mật khẩu nằm trong danh sách đen dễ đoán", () => {
    expect(validatePasswordStrength("123456").valid).toBe(false);
    expect(validatePasswordStrength("password").valid).toBe(false);
    expect(validatePasswordStrength("qwerty").valid).toBe(false);
    expect(validatePasswordStrength("admin123").valid).toBe(false);
  });

  it("từ chối mật khẩu trùng với tên đăng nhập", () => {
    const res = validatePasswordStrength("tiengfc", "tiengfc");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("không được trùng");
  });

  it("chấp nhận mật khẩu hợp lệ đủ an toàn", () => {
    const res = validatePasswordStrength("Gonoifc@2025", "tiengfc");
    expect(res.valid).toBe(true);
    expect(res.error).toBeUndefined();
  });
});

describe("Anti-Brute Force Rate Limiting", () => {
  const testKey = "test-rate-limit-user-1";

  beforeEach(() => {
    clearRateLimit(testKey);
  });

  it("cho phép đăng nhập trong giới hạn số lần cho phép", () => {
    const check = checkRateLimit(testKey);
    expect(check.allowed).toBe(true);
    expect(check.remainingAttempts).toBe(5);
  });

  it("khóa tài khoản tạm thời sau 5 lần nhập sai liên tiếp", () => {
    // 4 lần thử sai đầu tiên
    for (let i = 1; i <= 4; i++) {
      const rec = recordFailedAttempt(testKey);
      expect(rec.locked).toBe(false);
      expect(rec.remainingAttempts).toBe(5 - i);
    }

    // Lần thứ 5 sai -> bị khóa
    const fifth = recordFailedAttempt(testKey);
    expect(fifth.locked).toBe(true);
    expect(fifth.lockoutSeconds).toBeGreaterThan(0);

    // Kiểm tra rate limit báo bị khóa
    const check = checkRateLimit(testKey);
    expect(check.allowed).toBe(false);
    expect(check.lockoutSeconds).toBeGreaterThan(0);
  });

  it("reset bộ đếm khi đăng nhập thành công (clearRateLimit)", () => {
    recordFailedAttempt(testKey);
    recordFailedAttempt(testKey);

    clearRateLimit(testKey);

    const check = checkRateLimit(testKey);
    expect(check.allowed).toBe(true);
    expect(check.remainingAttempts).toBe(5);
  });
});
