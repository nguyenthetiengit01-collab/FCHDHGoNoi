import { describe, it, expect } from "vitest";
import {
  sanitizeFilename,
  buildAthleteCardFilename,
  buildMatchdayRosterFilename,
} from "./exportImage";

describe("exportImage helper functions", () => {
  describe("sanitizeFilename", () => {
    it("converts Vietnamese accented strings into clean URL/file slugs", () => {
      expect(sanitizeFilename("Nguyễn Thế Tiệp")).toBe("Nguyen-The-Tiep");
      expect(sanitizeFilename("Trần Văn Đạt - Số 10")).toBe("Tran-Van-Dat-So-10");
      expect(sanitizeFilename("Đặng Vũ")).toBe("Dang-Vu");
    });

    it("handles empty or special character inputs with default fallback", () => {
      expect(sanitizeFilename("", "mac-dinh")).toBe("mac-dinh");
      expect(sanitizeFilename("!@#$%^&*()", "fallback")).toBe("fallback");
    });
  });

  describe("buildAthleteCardFilename", () => {
    it("generates broadcast standard athlete card filename with jersey number", () => {
      const filename = buildAthleteCardFilename("Lê Hoàng Nam", 7);
      expect(filename).toBe("The-VDV-7-Le-Hoang-Nam-FCHDHGoNoi.png");
    });

    it("generates filename gracefully when jersey number is null or empty", () => {
      const filename = buildAthleteCardFilename("Nguyễn Văn A", null);
      expect(filename).toBe("The-VDV-Nguyen-Van-A-FCHDHGoNoi.png");
    });
  });

  describe("buildMatchdayRosterFilename", () => {
    it("generates matchday roster filename with date", () => {
      const filename = buildMatchdayRosterFilename("Trận 17", "11-11-2026");
      expect(filename).toBe("Diem-Danh-Tran-17-11-11-2026-FCHDHGoNoi.png");
    });

    it("generates matchday roster filename without date", () => {
      const filename = buildMatchdayRosterFilename("Giao Hữu Tuần 18");
      expect(filename).toBe("Diem-Danh-Giao-Huu-Tuan-18-FCHDHGoNoi.png");
    });
  });
});

