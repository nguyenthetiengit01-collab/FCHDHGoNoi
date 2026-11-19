"use client";

import React, { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { FullAppData, Player } from "@/types/app";
import type { LightboxImage } from "../ImageLightboxModal";

export const WRAP = "mx-auto w-full max-w-[1600px] px-5 sm:px-10 lg:px-16";

export const HERO_PHOTOS = [
  "/images/hinhanh-webp/anhbia/DSC06734.webp",
  "/images/hinhanh-webp/giaidau/DSC06522.webp",
  "/images/hinhanh-webp/anhbia/IMG_5574.webp",
  "/images/hinhanh-webp/giaidau/DSC06530.webp",
  "/images/hinhanh-webp/anhbia/673ca5fcf835786b21245.webp",
];

export const MOSAIC = [
  {
    src: "/images/hinhanh-webp/anhbia/DSC06734.webp",
    title: "Tập thể FC HĐH Gò Nổi",
    tag: "Ảnh Bìa CLB",
    span: "sm:col-span-2 sm:row-span-2",
  },
  {
    src: "/images/hinhanh-webp/giaidau/DSC06290.webp",
    title: "Cháy hết mình tại các giải phủi",
    tag: "Giải Đấu & Phong Trào",
    span: "",
  },
  {
    src: "/images/hinhanh-webp/giaoluu/29c7f1c6ac0f2c51751e1.webp",
    title: "Giao lưu gắn kết đồng hương",
    tag: "Giao Lưu Kết Nối",
    span: "",
  },
  {
    src: "/images/hinhanh-webp/cauthu/05f39aceaf732e2d776225.webp",
    title: "Nụ cười & năng lượng cầu thủ",
    tag: "Cầu Thủ Gò Nổi",
    span: "",
  },
  {
    src: "/images/hinhanh-webp/taitro/16a77ea82361a33ffa703.webp",
    title: "Tri ân nhà tài trợ & mạnh thường quân",
    tag: "Đồng Hành & Tài Trợ",
    span: "sm:col-span-2",
  },
  {
    src: "/images/hinhanh-webp/giaidau/DSC06530.webp",
    title: "Ăn mừng bàn thắng đẹp mắt",
    tag: "Khoảnh Khắc Bùng Nổ",
    span: "",
  },
];

export interface GuestNavLink {
  id: string;
  label: string;
  icon: LucideIcon;
  badge: string;
}

export function SoccerBallIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon
        points="12 7 15.5 9.5 14 13.5 10 13.5 8.5 9.5"
        fill="currentColor"
        fillOpacity="0.25"
      />
      <line x1="12" y1="2" x2="12" y2="7" />
      <line x1="21.5" y1="9" x2="15.5" y2="9.5" />
      <line x1="18" y1="20" x2="14" y2="13.5" />
      <line x1="6" y1="20" x2="10" y2="13.5" />
      <line x1="2.5" y1="9" x2="8.5" y2="9.5" />
    </svg>
  );
}

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-1000 ease-out motion-reduce:transition-none ${shown
        ? "opacity-100 translate-y-0"
        : "opacity-0 translate-y-10 motion-reduce:opacity-100 motion-reduce:translate-y-0"
        } ${className}`}
    >
      {children}
    </div>
  );
}

/* =========================================================================
   CHI TIẾT CẦU THỦ PHÓNG TO (BROADCAST ATHLETE CARD)
   ========================================================================= */
export interface ExpandedPlayerDetailProps {
  player: Player | null;
  attendances?: FullAppData["attendances"];
  onOpenImage?: (images: LightboxImage[], startIndex?: number) => void;
}

export const FALLBACK_ACTION_PHOTOS = [
  "/images/hinhanh-webp/cauthu/05f39aceaf732e2d776225.webp",
  "/images/hinhanh-webp/giaidau/DSC06290.webp",
  "/images/hinhanh-webp/giaidau/DSC06530.webp",
  "/images/hinhanh-webp/giaoluu/29c7f1c6ac0f2c51751e1.webp",
];
