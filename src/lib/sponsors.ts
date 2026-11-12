import type { Sponsor, SponsorTier } from "@/types/app";

export interface SponsorTierInfo {
  tier: SponsorTier;
  label: string;
  badgeClass: string;
  order: number;
}

export const SPONSOR_TIERS: Record<SponsorTier, SponsorTierInfo> = {
  title: {
    tier: "title",
    label: "Tài Trợ Chính (Kim Cương)",
    badgeClass: "bg-amber-400/20 text-[#fde047] border-amber-400/40",
    order: 1,
  },
  gold: {
    tier: "gold",
    label: "Tài Trợ Vàng",
    badgeClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    order: 2,
  },
  silver: {
    tier: "silver",
    label: "Tài Trợ Bạc",
    badgeClass: "bg-slate-300/20 text-slate-200 border-slate-300/40",
    order: 3,
  },
  partner: {
    tier: "partner",
    label: "Đối Tác Đồng Hành",
    badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    order: 4,
  },
  supporter: {
    tier: "supporter",
    label: "Đơn Vị Hỗ Trợ",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    order: 5,
  },
};

export const DISPLAY_POSITION_OPTIONS = [
  { id: "home_banner", label: "Banner trượt trang chủ (Hero)" },
  { id: "home_partners", label: "Khu vực Logo Đồng Hành trang chủ" },
  { id: "match_roster", label: "Ảnh Bảng Điểm Danh & Thẻ Cầu Thủ" },
  { id: "footer", label: "Chân trang website (Footer)" },
];

/**
 * Kiểm tra xem Banner của nhà tài trợ có đang trong thời hạn hiệu lực hay không.
 * Nếu chưa đến start_date hoặc đã quá end_date -> false.
 */
export function isSponsorBannerActive(
  sponsor: Sponsor,
  todayStr: string = new Date().toISOString().slice(0, 10)
): boolean {
  if (!sponsor.is_active) return false;
  if (sponsor.start_date && todayStr < sponsor.start_date) return false;
  if (sponsor.end_date && todayStr > sponsor.end_date) return false;
  return true;
}

/**
 * Kiểm tra xem có nên hiển thị banner của nhà tài trợ tại 1 vị trí nhất định.
 */
export function shouldShowBannerAt(
  sponsor: Sponsor,
  position: string,
  todayStr: string = new Date().toISOString().slice(0, 10)
): boolean {
  if (!isSponsorBannerActive(sponsor, todayStr)) return false;
  if (!Array.isArray(sponsor.display_positions)) return false;
  return sponsor.display_positions.includes(position);
}

/**
 * Lấy trạng thái hiển thị chi tiết (dành cho Ban Quản Lý).
 */
export function getSponsorStatus(
  sponsor: Sponsor,
  todayStr: string = new Date().toISOString().slice(0, 10)
): {
  status: "active" | "expiring_soon" | "expired" | "inactive";
  label: string;
  badgeClass: string;
  daysRemaining?: number;
} {
  if (!sponsor.is_active) {
    return {
      status: "inactive",
      label: "Đang ẩn",
      badgeClass: "bg-slate-500/20 text-slate-300 border-slate-500/40",
    };
  }

  if (sponsor.start_date && todayStr < sponsor.start_date) {
    return {
      status: "inactive",
      label: "Chưa tới ngày",
      badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    };
  }

  if (sponsor.end_date) {
    if (todayStr > sponsor.end_date) {
      return {
        status: "expired",
        label: "Hết hạn banner",
        badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      };
    }

    const todayDate = new Date(todayStr);
    const endDate = new Date(sponsor.end_date);
    const diffTime = endDate.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) {
      return {
        status: "expiring_soon",
        label: `Còn ${diffDays} ngày`,
        badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        daysRemaining: diffDays,
      };
    }
  }

  return {
    status: "active",
    label: "Đang hiển thị",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  };
}

/**
 * Gom nhóm danh sách nhà tài trợ theo hạng để render phân tầng khu vực Đồng Hành.
 */
export function groupSponsorsByTier(
  sponsors: Sponsor[]
): Record<SponsorTier, Sponsor[]> {
  const initial: Record<SponsorTier, Sponsor[]> = {
    title: [],
    gold: [],
    silver: [],
    partner: [],
    supporter: [],
  };

  for (const sp of sponsors) {
    const tier = (sp.tier && initial[sp.tier] ? sp.tier : "partner") as SponsorTier;
    initial[tier].push(sp);
  }

  return initial;
}

