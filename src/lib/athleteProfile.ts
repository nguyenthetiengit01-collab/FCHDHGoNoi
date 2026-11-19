import type { Player } from "@/types/app";

export interface PositionBadgeInfo {
  code: "GK" | "DF" | "MF" | "FW" | "ĐN";
  label: string;
  badgeClass: string;
  tone: string;
}

export function getPlayerPositionBadge(
  player: Pick<Player, "position">
): PositionBadgeInfo {
  const pos = (player.position || "").trim();
  const upper = pos.toUpperCase();
  if (pos.includes("Thủ môn") || upper === "GK") {
    return {
      code: "GK",
      label: "THỦ MÔN",
      badgeClass: "bg-emerald-950/60 text-emerald-200 border-emerald-400/50",
      tone: "bg-emerald-950/60 text-emerald-200 border-emerald-400/50",
    };
  }
  if (pos.includes("Hậu vệ") || pos.includes("Trung vệ") || upper === "DF") {
    return {
      code: "DF",
      label: "HẬU VỆ",
      badgeClass: "bg-blue-950/60 text-blue-200 border-blue-400/50",
      tone: "bg-blue-950/60 text-blue-200 border-blue-400/50",
    };
  }
  if (pos.includes("Tiền vệ") || upper === "MF") {
    return {
      code: "MF",
      label: "TIỀN VỆ",
      badgeClass: "bg-amber-950/60 text-amber-200 border-amber-400/50",
      tone: "bg-amber-950/60 text-amber-200 border-amber-400/50",
    };
  }
  if (pos.includes("Tiền đạo") || upper === "FW") {
    return {
      code: "FW",
      label: "TIỀN ĐẠO",
      badgeClass: "bg-rose-950/60 text-rose-200 border-rose-400/50",
      tone: "bg-rose-950/60 text-rose-200 border-rose-400/50",
    };
  }
  return {
    code: "ĐN",
    label: "ĐA NĂNG",
    badgeClass: "bg-purple-950/60 text-purple-200 border-purple-400/50",
    tone: "bg-purple-950/60 text-purple-200 border-purple-400/50",
  };
}

export function getPlayerHamlet(
  player: Pick<Player, "hometown" | "notes">
): string {
  let raw = (player.hometown || "").trim();
  if (raw) {
    // Loại bỏ tiền tố "Xã " nếu có để tránh hiển thị trùng "Xã Xã ..."
    raw = raw.replace(/^(Xã|xa|XÃ)[:\s]+/i, "").trim();
    if (raw) return raw;
  }
  const notes = player.notes || "";
  if (notes.includes("Điện Quang")) return "Điện Quang";
  if (notes.includes("Điện Trung")) return "Điện Trung";
  if (notes.includes("Điện Phong")) return "Điện Phong";
  return "Điện Quang";
}

export interface AthleteLightboxImageItem {
  src: string;
  title?: string;
  caption?: string;
  tag?: string;
}

export function buildAthleteLightboxImages(
  player: Player,
  fallbackPhotos: string[] = []
): AthleteLightboxImageItem[] {
  const hamlet = getPlayerHamlet(player);
  const posBadge = getPlayerPositionBadge(player);
  const gallery =
    player.gallery_urls && player.gallery_urls.length > 0
      ? player.gallery_urls
      : fallbackPhotos;

  const images: AthleteLightboxImageItem[] = [];

  if (player.profile_image_url) {
    images.push({
      src: player.profile_image_url,
      title: `${player.full_name} #${player.jersey_number ?? ""} • Ảnh Giới Thiệu Profile`,
      caption: `Ảnh toàn thân & phong thái thi đấu • ${posBadge.label} • Xã ${hamlet}`,
      tag: "Ảnh Giới Thiệu Profile",
    });
  }

  if (player.avatar_url) {
    images.push({
      src: player.avatar_url,
      title: `${player.full_name} #${player.jersey_number ?? ""} • Ảnh Thẻ VĐV`,
      caption: `Ảnh chân dung chuẩn 3:4 hồ sơ thi đấu • ${posBadge.label} • Xã ${hamlet}`,
      tag: "Ảnh Avatar Thi Đấu (3:4)",
    });
  }

  gallery.forEach((url, i) => {
    if (url && url !== player.avatar_url && url !== player.profile_image_url) {
      images.push({
        src: url,
        title: `${player.full_name} • Khoảnh khắc #${i + 1}`,
        caption: `Hình ảnh thi đấu và hoạt động cùng FC HĐH Gò Nổi`,
        tag: "Khoảnh Khắc Sân Cỏ",
      });
    }
  });

  return images;
}

/**
 * Chuẩn hoá năm sinh thành chuỗi số nguyên 4 chữ số, loại bỏ hoàn toàn hậu tố ".0"
 * Ví dụ: "1991.0" -> "1991", 1989.0 -> "1989", "1995" -> "1995", null -> ""
 */
export function formatBirthYear(birthYear?: string | number | null): string {
  if (birthYear === undefined || birthYear === null) return "";
  const raw = String(birthYear).trim().replace(/\.0+$/, "");
  if (!raw || raw === "NaN" || raw === "null" || raw === "undefined") return "";
  const num = parseInt(raw, 10);
  return isNaN(num) || num <= 1900 ? "" : String(num);
}

/**
 * Tính tuổi cầu thủ chính xác hoặc trả về "Nòng cốt"
 */
export function getPlayerAgeText(birthYear?: string | number | null): string {
  const yearStr = formatBirthYear(birthYear);
  if (!yearStr) return "Nòng cốt";
  const num = parseInt(yearStr, 10);
  const currentYear = new Date().getFullYear();
  if (num > 1950 && num <= currentYear) {
    return `${currentYear - num} tuổi`;
  }
  return "Nòng cốt";
}

/**
 * Danh sách năm sinh khả dụng để chọn từ Dropdown (từ 2012 về 1965)
 */
export const BIRTH_YEAR_OPTIONS: number[] = Array.from(
  { length: 2012 - 1965 + 1 },
  (_, i) => 2012 - i
);

/**
 * Đường dẫn nội bộ đến hồ sơ cầu thủ độc lập
 */
export function getPlayerProfilePath(playerId: number | string): string {
  return `/cau-thu/${playerId}`;
}

/**
 * Đường dẫn URL đầy đủ đến hồ sơ cầu thủ để chia sẻ đa nền tảng
 */
export function getPlayerProfileUrl(
  playerId: number | string,
  baseUrl = "https://fchdhgonoi.vercel.app"
): string {
  return `${baseUrl.replace(/\/+$/, "")}/cau-thu/${playerId}`;
}



