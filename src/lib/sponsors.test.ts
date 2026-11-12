import { describe, it, expect } from "vitest";
import {
  isSponsorBannerActive,
  shouldShowBannerAt,
  getSponsorStatus,
  groupSponsorsByTier,
} from "./sponsors";
import type { Sponsor } from "@/types/app";

describe("sponsors helper", () => {
  const baseSponsor: Sponsor = {
    id: 1,
    name: "Công ty ABC",
    tier: "gold",
    logo_url: "/logo.webp",
    banner_url: "/banner.webp",
    website_url: "https://abc.vn",
    description: "Nhà tài trợ vàng",
    start_date: "2026-11-01",
    end_date: "2026-11-30",
    display_positions: ["home_banner", "home_partners"],
    is_active: true,
    sort_order: 1,
  };

  it("chấp nhận banner khi ngày hiện tại nằm trong khoảng hiệu lực", () => {
    expect(isSponsorBannerActive(baseSponsor, "2026-11-12")).toBe(true);
    expect(shouldShowBannerAt(baseSponsor, "home_banner", "2026-11-12")).toBe(true);
  });

  it("từ chối banner khi chưa tới ngày bắt đầu", () => {
    expect(isSponsorBannerActive(baseSponsor, "2026-10-31")).toBe(false);
  });

  it("từ chối banner khi đã quá ngày kết thúc", () => {
    expect(isSponsorBannerActive(baseSponsor, "2026-12-01")).toBe(false);
    expect(shouldShowBannerAt(baseSponsor, "home_banner", "2026-12-01")).toBe(false);
  });

  it("từ chối khi is_active = false", () => {
    const inactive: Sponsor = { ...baseSponsor, is_active: false };
    expect(isSponsorBannerActive(inactive, "2026-11-12")).toBe(false);
  });

  it("từ chối khi vị trí hiển thị không được tích chọn", () => {
    expect(shouldShowBannerAt(baseSponsor, "match_roster", "2026-11-12")).toBe(false);
  });

  it("xác định trạng thái sắp hết hạn khi còn dưới 7 ngày", () => {
    const expiring = getSponsorStatus(baseSponsor, "2026-11-25");
    expect(expiring.status).toBe("expiring_soon");
    expect(expiring.daysRemaining).toBe(5);

    const expired = getSponsorStatus(baseSponsor, "2026-12-01");
    expect(expired.status).toBe("expired");
  });

  it("gom nhóm nhà tài trợ theo hạng chuẩn xác", () => {
    const list: Sponsor[] = [
      { ...baseSponsor, id: 1, tier: "title" },
      { ...baseSponsor, id: 2, tier: "gold" },
      { ...baseSponsor, id: 3, tier: "gold" },
      { ...baseSponsor, id: 4, tier: "supporter" },
    ];
    const grouped = groupSponsorsByTier(list);
    expect(grouped.title.length).toBe(1);
    expect(grouped.gold.length).toBe(2);
    expect(grouped.silver.length).toBe(0);
    expect(grouped.supporter.length).toBe(1);
  });
});

