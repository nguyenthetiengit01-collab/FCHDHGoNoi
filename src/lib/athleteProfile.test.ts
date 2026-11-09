import { describe, it, expect } from "vitest";
import {
  getPlayerPositionBadge,
  getPlayerHamlet,
  buildAthleteLightboxImages,
} from "./athleteProfile";
import type { Player } from "@/types/app";

describe("BroadcastAthleteCard - Deep Module Domain Logic", () => {
  it("determines correct athletic position badges", () => {
    expect(getPlayerPositionBadge({ position: "Thủ môn xuất sắc", access_role: "player" }).code).toBe("GK");
    expect(getPlayerPositionBadge({ position: "Hậu vệ cánh", access_role: "player" }).code).toBe("DF");
    expect(getPlayerPositionBadge({ position: "Tiền vệ trung tâm", access_role: "player" }).code).toBe("MF");
    expect(getPlayerPositionBadge({ position: "Tiền đạo cắm", access_role: "player" }).code).toBe("FW");
    expect(getPlayerPositionBadge({ position: "Đa năng", access_role: "manager" }).code).toBe("BQL");
  });

  it("extracts canonical hometown / hamlet accurately", () => {
    expect(getPlayerHamlet({ hometown: "Điện Quang", notes: "" })).toBe("Điện Quang");
    expect(getPlayerHamlet({ hometown: "Điện Trung", notes: "" })).toBe("Điện Trung");
    expect(getPlayerHamlet({ hometown: "Điện Phong", notes: "" })).toBe("Điện Phong");
    expect(getPlayerHamlet({ hometown: "", notes: "Cầu thủ quê gốc Xã Điện Phong" })).toBe("Điện Phong");
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
});
