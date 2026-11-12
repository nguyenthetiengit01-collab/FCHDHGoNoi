import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFullAppData } from "@/lib/db";
import { getPlayerPositionBadge, getPlayerHamlet } from "@/lib/athleteProfile";
import { PlayerProfileClient } from "@/components/PlayerProfileClient";
import { ArrowLeft, UserX } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getFullAppData();
  const player = data.players.find(
    (p) => String(p.id) === id || String(p.jersey_number) === id
  );

  if (!player) {
    return {
      title: "Không tìm thấy cầu thủ | FC HĐH Gò Nổi",
      description: "Hồ sơ cầu thủ không tồn tại hoặc đã được cập nhật.",
    };
  }

  const posBadge = getPlayerPositionBadge(player);
  const hamlet = getPlayerHamlet(player);
  const numStr = player.jersey_number !== null ? ` #${player.jersey_number}` : "";
  const title = `Cầu thủ ${player.full_name}${numStr} • ${posBadge.label} | FC HĐH Gò Nổi`;
  const description = `${player.full_name} (${posBadge.label} • Xã ${hamlet}) - Chiến binh FC Hội Đồng Hương Gò Nổi tại TP.HCM. ${
    player.playing_style ? `Lối chơi: ${player.playing_style}. ` : ""
  }${player.bio || ""}`;

  const shareImageRaw = player.profile_image_url || player.avatar_url;
  const shareImage = shareImageRaw
    ? shareImageRaw.startsWith("http")
      ? shareImageRaw
      : `https://fchdhgonoi.vercel.app${shareImageRaw}`
    : "https://fchdhgonoi.vercel.app/images/cover-team.jpg";
  const isWideImage = Boolean(player.profile_image_url);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://fchdhgonoi.vercel.app/cau-thu/${player.id}`,
      siteName: "FC Hội Đồng Hương Gò Nổi",
      images: [
        {
          url: shareImage,
          width: isWideImage ? 1600 : 900,
          height: isWideImage ? 900 : 1200,
          alt: player.full_name,
        },
      ],
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [shareImage],
    },
  };
}

export default async function CauThuProfilePage({ params }: PageProps) {
  const { id } = await params;
  const data = await getFullAppData();
  const player = data.players.find(
    (p) => String(p.id) === id || String(p.jersey_number) === id
  );

  if (!player) {
    return (
      <div className="min-h-screen bg-[#040e1a] text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl bg-[#092244] border border-white/10 p-8 text-center space-y-4 shadow-xl">
          <div className="h-16 w-16 mx-auto rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
            <UserX className="h-8 w-8" />
          </div>
          <h2 className="font-display font-black text-xl text-white uppercase">
            Không Tìm Thấy Hồ Sơ Cầu Thủ
          </h2>
          <p className="text-sm text-sky-200">
            Cầu thủ với mã số này không tồn tại trong danh sách đội bóng hoặc thông tin đã được điều chỉnh.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ffd700] hover:bg-[#fde047] text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-md"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Về Trang Chủ Đội Bóng</span>
          </Link>
        </div>
      </div>
    );
  }

  const safePlayer = {
    ...player,
    phone: "",
    username: "",
    pin_code: "",
    notes: "",
  };
  const safeAllPlayers = data.players.map((p) => ({
    ...p,
    phone: "",
    username: "",
    pin_code: "",
    notes: "",
  }));

  return (
    <PlayerProfileClient
      player={safePlayer}
      attendances={data.attendances}
      matches={data.matches}
      allPlayers={safeAllPlayers}
    />
  );
}

