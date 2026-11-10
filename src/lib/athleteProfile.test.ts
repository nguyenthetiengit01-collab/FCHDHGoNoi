import { describe, it, expect } from "vitest";
import {
  getPlayerPositionBadge,
  getPlayerHamlet,
  buildAthleteLightboxImages,
  formatBirthYear,
  getPlayerAgeText,
  BIRTH_YEAR_OPTIONS,
  getPlayerProfilePath,
  getPlayerProfileUrl,
} from "./athleteProfile";
import type { Player } from "@/types/app";

describe("BroadcastAthleteCard - Deep Module Domain Logic", () => {
  it("determines correct athletic position badges", () => {
    expect(getPlayerPositionBadge({ position: "Thủ môn xuất sắc", access_role: "player" }).code).toBe("GK");
    expect(getPlayerPositionBadge({ position: "Hậu vệ cánh", access_role: "player" }).code).toBe("DF");
    expect(getPlayerPositionBadge({ position: "Tiền vệ trung tâm", access_role: "player" }).code).toBe("MF");
    expect(getPlayerPositionBadge({ position: "Tiền đạo cắm", access_role: "player" }).code).toBe("FW");
    expect(getPlayerPositionBadge({ position: "Đa năng", access_role: "manager" }).code).toBe("ĐN");
  });

  it("extracts canonical hometown / hamlet accurately", () => {
    expect(getPlayerHamlet({ hometown: "Điện Quang", notes: "" })).toBe("Điện Quang");
    expect(getPlayerHamlet({ hometown: "Xã Điện Phong", notes: "" })).toBe("Điện Phong");
    expect(getPlayerHamlet({ hometown: "xã: Điện Trung", notes: "" })).toBe("Điện Trung");
    expect(getPlayerHamlet({ hometown: "", notes: "Cầu thủ quê gốc Xã Điện Phong" })).toBe("Điện Phong");
  });

  it("sanitizes birth_year to pure integer string removing any .0 suffix", () => {
    expect(formatBirthYear("1989.0")).toBe("1989");
    expect(formatBirthYear("1992.00")).toBe("1992");
    expect(formatBirthYear(1995.0)).toBe("1995");
    expect(formatBirthYear("1991")).toBe("1991");
    expect(formatBirthYear(null)).toBe("");
    expect(formatBirthYear("")).toBe("");
  });

  it("computes player age accurately without decimal places", () => {
    const currentYear = new Date().getFullYear();
    expect(getPlayerAgeText("1990.0")).toBe(`${currentYear - 1990} tuổi`);
    expect(getPlayerAgeText(1995)).toBe(`${currentYear - 1995} tuổi`);
    expect(getPlayerAgeText("")).toBe("Nòng cốt");
    expect(getPlayerAgeText(null)).toBe("Nòng cốt");
  });

  it("provides valid birth year options for dropdown selection", () => {
    expect(BIRTH_YEAR_OPTIONS.length).toBeGreaterThan(30);
    expect(BIRTH_YEAR_OPTIONS[0]).toBe(2012);
    expect(BIRTH_YEAR_OPTIONS).toContain(1991);
    expect(BIRTH_YEAR_OPTIONS).toContain(1986);
  });

  it("builds lightbox image list with avatar and gallery items", () => {
    const mockPlayer: Player = {
      id: 1,
      full_name: "Nguyễn Thế Tiếng",
      short_name: "Tiếng",
      jersey_number: 12,
      position: "Tiền vệ",
      role: "Đội trưởng",
      status: "Đang sinh hoạt",
      avatar_url: "/uploads/avatars/tieng.webp",
      hometown: "Điện Quang",
      gallery_urls: [
        "/uploads/gallery/match-1.webp",
        "/uploads/gallery/match-2.webp",
      ],
      access_role: "manager",
    };

    const images = buildAthleteLightboxImages(mockPlayer);
    expect(images).toHaveLength(3);
    expect(images[0].src).toBe("/uploads/avatars/tieng.webp");
    expect(images[0].tag).toBe("Hồ Sơ Cầu Thủ");
    expect(images[1].src).toBe("/uploads/gallery/match-1.webp");
    expect(images[1].tag).toBe("Khoảnh Khắc Sân Cỏ");
  });

  it("generates correct canonical profile path and shareable profile URL", () => {
    expect(getPlayerProfilePath(12)).toBe("/cau-thu/12");
    expect(getPlayerProfileUrl(12)).toBe("https://fchdhgonoi.vercel.app/cau-thu/12");
    expect(getPlayerProfileUrl("99", "https://custom-domain.com")).toBe("https://custom-domain.com/cau-thu/99");
  });
});
