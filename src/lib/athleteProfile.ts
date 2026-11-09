import type { Player } from "@/types/app";

export interface PositionBadgeInfo {
  code: "GK" | "DF" | "MF" | "FW" | "BQL";
  label: string;
  badgeClass: string;
  tone: string;
}

export function getPlayerPositionBadge(
  player: Pick<Player, "position" | "access_role">
): PositionBadgeInfo {
  const pos = player.position || "";
  if (pos.includes("Thủ môn")) {
    return {
      code: "GK",
      label: "THỦ MÔN",
      badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      tone: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    };
  }
  if (pos.includes("Hậu vệ")) {
    return {
      code: "DF",
      label: "HẬU VỆ",
      badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      tone: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    };
  }
  if (pos.includes("Tiền vệ")) {
    return {
      code: "MF",
      label: "TIỀN VỆ",
      badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      tone: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    };
  }
  if (pos.includes("Tiền đạo")) {
    return {
      code: "FW",
      label: "TIỀN ĐẠO",
      badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      tone: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    };
  }
  return {
    code: "BQL",
    label: "ĐA NĂNG",
    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    tone: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  };
}

export function getPlayerHamlet(
  player: Pick<Player, "hometown" | "notes">
): string {
  if (player.hometown && player.hometown.trim()) {
    return player.hometown.trim();
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

  return [
    ...(player.avatar_url
      ? [
          {
            src: player.avatar_url,
            title: `${player.full_name} #${player.jersey_number ?? ""}`,
            caption: `Ảnh chân dung chính thức • ${posBadge.label} • Xã ${hamlet}`,
            tag: "Hồ Sơ Cầu Thủ",
          },
        ]
      : []),
    ...gallery.map((url, i) => ({
      src: url,
      title: `${player.full_name} • Khoảnh khắc #${i + 1}`,
      caption: `Hình ảnh thi đấu và hoạt động cùng FC HĐH Gò Nổi`,
      tag: "Khoảnh Khắc Sân Cỏ",
    })),
  ];
}

