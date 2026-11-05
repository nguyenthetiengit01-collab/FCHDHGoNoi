"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  MapPin,
  LogIn,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Camera,
  HeartHandshake,
  RotateCw,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Quote,
  X,
  User,
  Shield,
  Activity,
  Calendar,
  Users,
  CheckCircle2,
  BookOpen,
  Clock,
} from "lucide-react";
import type { FullAppData, Player } from "@/types/app";
import {
  FANPAGE_URL,
  OFFICIAL_LOGO_URL,
} from "@/types/app";
import { formatDateVN } from "@/lib/format";
import {
  CLUB_ACTIVITIES_POSTS,
  ACTIVITY_CATEGORIES,
  type ClubActivityPost,
  type ActivityCategory,
} from "@/data/clubActivities";

interface PublicGuestPortalProps {
  data: FullAppData;
  onOpenLogin: () => void;
}

const WRAP = "mx-auto w-full max-w-[1600px] px-5 sm:px-10 lg:px-16";

/* Danh sách ảnh WebP chất lượng cao theo đúng các thư mục hoạt động */
const HERO_PHOTOS = [
  "/images/hinhanh-webp/anhbia/DSC06734.webp",
  "/images/hinhanh-webp/giaidau/DSC06522.webp",
  "/images/hinhanh-webp/anhbia/IMG_5574.webp",
  "/images/hinhanh-webp/giaidau/DSC06530.webp",
  "/images/hinhanh-webp/anhbia/673ca5fcf835786b21245.webp",
];

const MOSAIC = [
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

/* Football-stylized SVG Icons */
function SoccerBallIcon({ className = "h-5 w-5" }: { className?: string }) {
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

function WhistleIcon({ className = "h-5 w-5" }: { className?: string }) {
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
      <path
        d="M11 5H6a4 4 0 0 0-4 4v3a4 4 0 0 0 4 4h2l3 3v-3h7a4 4 0 0 0 4-4V9a4 4 0 0 0-4-4h-7z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <circle cx="17" cy="10" r="2" fill="currentColor" />
      <path d="M6 5V2" />
    </svg>
  );
}

function CleatsIcon({ className = "h-5 w-5" }: { className?: string }) {
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
      <path
        d="M2 17c1.5-2 3.5-3 6-3h4c3 0 6 2 9 4v2H2v-3z"
        fill="currentColor"
        fillOpacity="0.25"
      />
      <path d="M12 14V8l4 2v4" />
      <line x1="5" y1="20" x2="5" y2="23" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="19" y1="20" x2="19" y2="23" />
    </svg>
  );
}

function GoalNetIcon({ className = "h-5 w-5" }: { className?: string }) {
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
      <rect
        x="3"
        y="4"
        width="18"
        height="15"
        rx="1"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="14" x2="21" y2="14" />
      <line x1="8" y1="4" x2="8" y2="19" />
      <line x1="13" y1="4" x2="13" y2="19" />
      <line x1="18" y1="4" x2="18" y2="19" />
    </svg>
  );
}

function Reveal({
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
      className={`transition-all duration-1000 ease-out motion-reduce:transition-none ${
        shown
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-10 motion-reduce:opacity-100 motion-reduce:translate-y-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* =========================================================================
   THẺ CẦU THỦ 3D PROFILE SANG TRỌNG (TƯƠNG TÁC TILT, LẬT 3D & XEM TIỂU SỬ)
   ========================================================================= */
interface PlayerCard3DProps {
  player: Player;
  onOpenProfile: (player: Player) => void;
}

function PlayerCard3D({ player, onOpenProfile }: PlayerCard3DProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0, glareX: 50, glareY: 50 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 12;

    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setTilt({ x: rotateX, y: rotateY, glareX, glareY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0, glareX: 50, glareY: 50 });
  }, []);

  const positionBadge =
    player.access_role === "manager"
      ? { label: "Ban Điều Hành", icon: "👑", code: "BQL", color: "from-[#d4af37] to-[#e6c466]" }
      : /thủ môn|gk/i.test(player.position || "")
      ? { label: "Thủ Môn", icon: "🧤", code: "GK", color: "from-[#38bdf8] to-[#0284c7]" }
      : /hậu vệ|cb|lb|rb/i.test(player.position || "")
      ? { label: "Hậu Vệ", icon: "🛡️", code: "DF", color: "from-[#60a5fa] to-[#2563eb]" }
      : /tiền vệ|cm|cdm|cam/i.test(player.position || "")
      ? { label: "Tiền Vệ", icon: "🎯", code: "MF", color: "from-[#818cf8] to-[#4f46e5]" }
      : { label: player.position || "Tiền Đạo", icon: "⚡", code: "FW", color: "from-[#f59e0b] to-[#d97706]" };

  const playerBio =
    player.bio?.trim() ||
    "Chiến binh nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần fair-play và tình anh em quê hương bền chặt.";

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="perspective-1200 shrink-0 w-[82vw] sm:w-[340px] lg:w-[370px] h-[550px] sm:h-[610px] select-none"
    >
      <div
        className="relative w-full h-full preserve-3d transition-transform duration-500 ease-out"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${
            tilt.y + (isFlipped ? 180 : 0)
          }deg) scale3d(1.02, 1.02, 1.02)`,
        }}
      >
        {/* ==================== MẶT TRƯỚC (FRONT 3D PROFILE CARD - XANH LAM SANG TRỌNG) ==================== */}
        <div className="absolute inset-0 backface-hidden rounded-3xl overflow-hidden bg-gradient-to-b from-[#133b73] via-[#0d2a54] to-[#081b38] border-2 border-[#d4af37]/80 shadow-[0_20px_60px_rgba(10,35,75,0.7)] flex flex-col justify-between p-4 sm:p-5">
          {/* ScrollCraft Chromatic Hologram Sweep */}
          <div aria-hidden="true" className="sc-hologram-sweep" />

          {/* Holographic Diamond Glare */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none opacity-45 mix-blend-overlay transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.85) 0%, rgba(212,175,55,0.4) 30%, transparent 68%)`,
            }}
          />

          {/* Sân bóng hoàng gia trang trí chìm */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none opacity-15"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 35%, #38bdf8 0, transparent 48%), linear-gradient(0deg, transparent 49%, rgba(212,175,55,0.4) 50%, transparent 51%)",
            }}
          />

          {/* Top Card Badge: Chỉ số & Huy hiệu */}
          <div className="relative z-10 flex items-start justify-between">
            <div className="flex flex-col items-center bg-[#071933]/70 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-[#d4af37]/40 shadow-sm">
              <span className="font-display font-extrabold text-3xl sm:text-4xl text-[#d4af37] leading-none drop-shadow">
                {player.jersey_number ?? 99}
              </span>
              <span className="font-display font-bold text-[10px] uppercase text-sky-200 tracking-widest mt-0.5">
                {positionBadge.code}
              </span>
              <span className="text-sm mt-0.5" title={positionBadge.label}>
                {positionBadge.icon}
              </span>
            </div>

            <div className="flex items-center gap-2 bg-[#071933]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#d4af37]/50 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={OFFICIAL_LOGO_URL}
                alt="FC HĐH Gò Nổi"
                className="h-6 w-6 rounded-full object-contain bg-white p-0.5 ring-1 ring-[#d4af37]"
              />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#d4af37]">
                FC GÒ NỔI
              </span>
            </div>
          </div>

          {/* Player Visual Portrait / Action Stance */}
          <div className="relative z-10 flex-1 flex items-center justify-center my-2">
            <div className="relative w-48 h-60 sm:w-56 sm:h-72 flex items-center justify-center group">
              {/* Hào quang xanh lam sapphire & vàng hoàng gia */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-t from-[#1d5ab9]/60 via-[#0284c7]/30 to-[#d4af37]/30 blur-2xl scale-95" />

              {player.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={player.avatar_url}
                  alt={player.full_name}
                  className="relative z-10 w-full h-full object-cover object-top rounded-2xl shadow-2xl border-2 border-[#d4af37]/50 filter brightness-105 contrast-105"
                />
              ) : (
                <div className="relative z-10 w-full h-full rounded-2xl bg-gradient-to-b from-[#17488c] to-[#0a1e3d] flex flex-col items-center justify-center text-center p-4 border border-[#d4af37]/40 shadow-inner">
                  <SoccerBallIcon className="h-16 w-16 text-[#d4af37] mb-2 animate-pulse" />
                  <span className="font-display font-extrabold text-6xl text-[#d4af37]">
                    #{player.jersey_number ?? "-"}
                  </span>
                  <span className="text-xs uppercase text-sky-200 tracking-widest mt-1">
                    Cầu thủ Gò Nổi
                  </span>
                </div>
              )}

              {/* Số áo 3D in chìm vàng kim loại */}
              <span
                aria-hidden="true"
                className="absolute -right-3 -bottom-3 font-display font-black text-8xl sm:text-9xl text-transparent [-webkit-text-stroke:2px_rgba(212,175,55,0.6)] pointer-events-none z-20 select-none leading-none"
              >
                {player.jersey_number ?? ""}
              </span>
            </div>
          </div>

          {/* Bottom Card Plate: Thông tin, Chỉ số phủi & 2 Nút hành động */}
          <div className="relative z-10 bg-[#071933]/90 backdrop-blur-md rounded-2xl p-3.5 border border-[#d4af37]/40 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h4 className="font-display font-extrabold uppercase text-xl sm:text-2xl text-white leading-tight truncate">
                  {player.short_name || player.full_name}
                </h4>
                <p className="text-[12px] text-[#d4af37] truncate font-semibold">
                  {player.full_name}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gradient-to-r from-[#17488c] to-[#1e5eb8] text-[#fde047] border border-[#d4af37]/50 shadow-xs">
                {positionBadge.label}
              </span>
            </div>

            {/* Chỉ số đá phủi vui vẻ & nhiệt huyết */}
            <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-white/10 text-center text-[10px] font-bold">
              <div className="bg-white/10 py-1 rounded-lg border border-white/5">
                <span className="text-[#fde047] block text-xs">98</span>
                <span className="text-sky-200 text-[9px] uppercase">Nhiệt Huyết</span>
              </div>
              <div className="bg-white/10 py-1 rounded-lg border border-white/5">
                <span className="text-[#fde047] block text-xs">95</span>
                <span className="text-sky-200 text-[9px] uppercase">Đá Phủi</span>
              </div>
              <div className="bg-white/10 py-1 rounded-lg border border-white/5">
                <span className="text-[#fde047] block text-xs">100</span>
                <span className="text-sky-200 text-[9px] uppercase">Đồng Hương</span>
              </div>
            </div>

            {/* 2 Nút: Lật thẻ 3D + Xem Profile & Tiểu sử */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsFlipped(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold py-2 px-2 transition border border-white/15 cursor-pointer"
                title="Lật thẻ xem số áo 3D"
              >
                <RotateCw className="h-3.5 w-3.5 text-[#d4af37]" />
                <span>Lật áo đấu</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenProfile(player)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e6c466] hover:from-[#e6c466] hover:to-[#f5d97f] text-slate-950 text-[11px] font-extrabold py-2 px-2 transition shadow-md cursor-pointer"
                title="Xem bài viết & hồ sơ giới thiệu cầu thủ"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Xem Profile</span>
              </button>
            </div>
          </div>
        </div>

        {/* ==================== MẶT SAU (BACK 3D CARD - ÁO ĐẤU HOÀNG GIA & BÀI VIẾT GIỚI THIỆU) ==================== */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-3xl overflow-hidden bg-gradient-to-b from-[#133b73] via-[#0d2a54] to-[#071933] border-2 border-[#d4af37] shadow-[0_20px_60px_rgba(10,35,75,0.7)] flex flex-col justify-between p-5 text-white">
          {/* Cổ áo đấu vàng viền kim loại */}
          <div className="relative z-10 flex items-center justify-between border-b border-[#d4af37]/40 pb-3">
            <div className="flex items-center gap-2">
              <CleatsIcon className="h-5 w-5 text-[#d4af37]" />
              <span className="font-display font-bold uppercase tracking-wider text-sm text-[#d4af37]">
                Áo đấu FC HĐH Gò Nổi
              </span>
            </div>
            <span className="text-[11px] bg-gradient-to-r from-[#d4af37] to-[#e6c466] text-slate-950 px-2.5 py-0.5 rounded-full font-black tracking-wide shadow-xs">
              MÙA GIẢI 2026
            </span>
          </div>

          {/* Lưng áo 3D với tên và số áo khổng lồ */}
          <div className="relative z-10 text-center my-auto py-1">
            <p className="font-display font-extrabold uppercase text-2xl tracking-[0.25em] text-[#d4af37] drop-shadow">
              {player.short_name || player.full_name}
            </p>
            <div className="font-display font-black text-8xl sm:text-9xl text-white leading-none my-1 tracking-tighter drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]">
              {player.jersey_number ?? "-"}
            </div>
            <p className="text-xs uppercase tracking-widest text-sky-200">
              GÒ NỔI • ĐIỆN BÀN • QUẢNG NAM
            </p>
          </div>

          {/* Lời tự giới thiệu / Bio của cầu thủ */}
          <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-[#d4af37] font-bold">
              <Quote className="h-3.5 w-3.5" />
              <span>Lời ngỏ sân cỏ của cầu thủ:</span>
            </div>
            <p className="text-xs text-sky-100 italic line-clamp-3 leading-relaxed">
              &ldquo;{playerBio}&rdquo;
            </p>
          </div>

          {/* Nút lật lại & Nút mở Profile modal */}
          <div className="relative z-10 grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsFlipped(false)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 border border-white/20 transition cursor-pointer"
            >
              <RotateCw className="h-3.5 w-3.5 text-[#d4af37]" />
              <span>Mặt trước thẻ</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenProfile(player)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#d4af37] hover:bg-[#e6c466] text-slate-950 text-xs font-extrabold py-2 transition shadow-sm cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Đọc bài viết</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MODAL PROFILE GIỚI THIỆU CHI TIẾT CẦU THỦ (CÓ BÀI VIẾT TỰ SỬA CỦA CẦU THỦ)
   ========================================================================= */
interface PlayerProfileModalProps {
  player: Player | null;
  onClose: () => void;
  onOpenLogin: () => void;
}

function PlayerProfileModal({
  player,
  onClose,
  onOpenLogin,
}: PlayerProfileModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (player) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [player, onClose]);

  if (!player) return null;

  const defaultBio =
    "Chiến binh nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt.";
  const displayBio = player.bio?.trim() || defaultBio;

  const positionBadge =
    player.access_role === "manager"
      ? { label: "Ban Điều Hành / Thu Quỹ", icon: "👑", code: "BQL" }
      : /thủ môn|gk/i.test(player.position || "")
      ? { label: "Thủ Môn", icon: "🧤", code: "GK" }
      : /hậu vệ|cb|lb|rb/i.test(player.position || "")
      ? { label: "Hậu Vệ", icon: "🛡️", code: "DF" }
      : /tiền vệ|cm|cdm|cam/i.test(player.position || "")
      ? { label: "Tiền Vệ", icon: "🎯", code: "MF" }
      : { label: player.position || "Tiền Đạo", icon: "⚡", code: "FW" };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#041022]/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-gradient-to-b from-[#103567] via-[#0d2a54] to-[#071a36] border-2 border-[#d4af37] text-white shadow-[0_25px_80px_rgba(0,0,0,0.85)] p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition border border-white/20 cursor-pointer"
          aria-label="Đóng cửa sổ hồ sơ"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Profile */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 border-b border-white/15 pb-6">
          <div className="relative shrink-0">
            {player.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.avatar_url}
                alt={player.full_name}
                className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl object-cover object-top border-2 border-[#d4af37] shadow-xl"
              />
            ) : (
              <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl bg-[#1d5ab9] flex flex-col items-center justify-center border-2 border-[#d4af37]">
                <User className="h-12 w-12 text-[#d4af37]" />
              </div>
            )}
            <span className="absolute -bottom-2 -right-2 font-display font-black text-xl bg-[#d4af37] text-slate-950 px-2.5 py-0.5 rounded-lg shadow-md">
              #{player.jersey_number ?? "?"}
            </span>
          </div>

          <div className="text-center sm:text-left flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider px-3 py-1 rounded-full bg-white/15 text-[#fde047] border border-[#d4af37]/40">
                {positionBadge.icon} {positionBadge.label}
              </span>
              {player.access_role === "manager" && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 inline-flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Ban Quản Lý
                </span>
              )}
            </div>

            <h3 className="mt-2 font-display font-extrabold uppercase text-3xl sm:text-4xl text-white leading-tight">
              {player.full_name}
            </h3>
            <p className="text-sm font-semibold text-[#d4af37]">
              Biệt danh sân cỏ: &ldquo;{player.short_name || player.full_name}&rdquo;
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-sky-100">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-[#d4af37]" />
                Năm sinh: <strong>{player.birth_year || "---"}</strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-[#d4af37]" />
                Quê quán: <strong>Điện Bàn, Quảng Nam</strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                Trạng thái:{" "}
                <strong className="text-emerald-300">
                  {player.status || "Đang sinh hoạt"}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Bài viết / Lời tự giới thiệu của cầu thủ */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display font-bold uppercase tracking-wider text-lg text-[#d4af37] flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>Bài viết giới thiệu bản thân & Lời ngỏ sân cỏ</span>
            </h4>
            <span className="text-[11px] text-sky-200/80 italic hidden sm:inline">
              Cầu thủ tự cập nhật
            </span>
          </div>

          <div className="relative rounded-2xl bg-white/10 p-5 sm:p-6 border border-white/15">
            <Quote className="h-8 w-8 text-[#d4af37]/40 mb-2" />
            <p className="text-sm sm:text-base text-slate-100 leading-relaxed whitespace-pre-line italic font-serif">
              {displayBio}
            </p>
          </div>

          {/* Ghi chú cá nhân nếu có */}
          {player.notes && (
            <div className="rounded-xl bg-[#092244]/80 p-3.5 border border-white/10 text-xs text-sky-200">
              <strong className="text-[#d4af37]">Ghi chú:</strong> {player.notes}
            </div>
          )}

          {/* Chân trang modal: Hướng dẫn cầu thủ tự sửa bio */}
          <div className="pt-4 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-sky-200">
            <p>
              💡 Cầu thủ có thể đăng nhập để chỉnh sửa lời giới thiệu, ảnh đại diện và thông tin của mình.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLogin();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#d4af37] hover:bg-[#e6c466] text-slate-950 font-bold px-4 py-2 transition shrink-0 cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Đăng nhập chỉnh sửa</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MODAL CHI TIẾT BÀI VIẾT HOẠT ĐỘNG CLB (TƯƠNG ỨNG CÁC FOLDER ẢNH)
   ========================================================================= */
interface ActivityArticleModalProps {
  post: ClubActivityPost | null;
  onClose: () => void;
  fanpageUrl: string;
}

function ActivityArticleModal({
  post,
  onClose,
  fanpageUrl,
}: ActivityArticleModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (post) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [post, onClose]);

  if (!post) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#041022]/85 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-gradient-to-b from-[#103567] via-[#0d2a54] to-[#071a36] border-2 border-[#d4af37] text-white shadow-[0_25px_80px_rgba(0,0,0,0.85)] p-5 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 z-20 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition border border-white/20 cursor-pointer shadow-md"
          aria-label="Đóng bài viết"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Ảnh bìa bài viết */}
        <div className="relative -mx-5 sm:-mx-8 -mt-5 sm:-mt-8 mb-6 overflow-hidden rounded-t-3xl h-64 sm:h-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.featuredImage}
            alt={post.title}
            className="w-full h-full object-cover object-center filter brightness-95"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#103567] via-[#103567]/40 to-transparent"
          />
          <div className="absolute bottom-4 left-5 sm:left-8 right-5 sm:right-8 flex flex-wrap items-center gap-2">
            <span
              className={`text-xs uppercase font-extrabold tracking-wider px-3 py-1 rounded-full border backdrop-blur-md ${post.categoryBadgeClass}`}
            >
              {post.categoryLabel}
            </span>
            <span className="text-xs text-sky-200/90 font-medium bg-black/40 px-3 py-1 rounded-full backdrop-blur-md inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {post.readingTime}
            </span>
            <span className="text-xs text-sky-200/90 font-medium bg-black/40 px-3 py-1 rounded-full backdrop-blur-md inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {post.publishedDate}
            </span>
          </div>
        </div>

        {/* Nội dung bài viết */}
        <div className="space-y-5">
          <div className="border-b border-white/15 pb-4">
            <h3 className="font-display font-extrabold uppercase text-2xl sm:text-4xl text-white leading-tight">
              {post.title}
            </h3>
            <p className="mt-2 text-xs font-semibold text-[#d4af37] flex items-center gap-2">
              <span>Tác giả: {post.author}</span>
              <span>•</span>
              <span>CLB Bóng Đá HĐH Gò Nổi</span>
            </p>
          </div>

          {/* Tóm tắt */}
          <div className="rounded-2xl bg-white/10 p-4 border border-white/15">
            <p className="text-sm sm:text-base text-sky-100 italic leading-relaxed">
              {post.summary}
            </p>
          </div>

          {/* Các đoạn văn bài viết */}
          <div className="space-y-4 text-sm sm:text-base text-slate-100 font-light leading-relaxed">
            {post.paragraphs.map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </div>

          {/* Trích dẫn nổi bật nếu có */}
          {post.quote && (
            <div className="rounded-2xl bg-gradient-to-r from-[#d4af37]/20 via-[#d4af37]/10 to-transparent p-5 border-l-4 border-[#d4af37]">
              <Quote className="h-6 w-6 text-[#d4af37] mb-2" />
              <p className="text-base sm:text-lg text-white font-medium italic font-serif">
                &ldquo;{post.quote}&rdquo;
              </p>
            </div>
          )}

          {/* Điểm nhấn hoạt động */}
          {post.highlights && post.highlights.length > 0 && (
            <div className="rounded-2xl bg-[#071933]/70 p-5 border border-white/10 space-y-2.5">
              <h4 className="font-display font-bold uppercase text-xs sm:text-sm tracking-wider text-[#d4af37] flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span>Điểm nhấn tiêu biểu</span>
              </h4>
              <ul className="space-y-1.5 text-xs sm:text-sm text-sky-100">
                {post.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Album ảnh kèm theo của hoạt động */}
          {post.galleryImages && post.galleryImages.length > 0 && (
            <div className="pt-3 border-t border-white/15 space-y-3">
              <h4 className="font-display font-bold uppercase text-xs sm:text-sm tracking-wider text-[#d4af37] flex items-center gap-2">
                <Camera className="h-4 w-4" />
                <span>Hình ảnh tiêu biểu của hoạt động này</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {post.galleryImages.map((img, i) => (
                  <div
                    key={i}
                    className="relative h-24 sm:h-28 rounded-xl overflow-hidden border border-white/20 group cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`Ảnh ${i + 1}`}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chân trang modal */}
          <div className="pt-4 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-sky-200">
            <p>
              💡 Đón đọc các bài viết cập nhật tiếp theo trên website và Fanpage chính thức của đội.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={fanpageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#d4af37] hover:bg-[#e6c466] text-slate-950 font-bold px-4 py-2 transition cursor-pointer"
              >
                <span>Xem trên Fanpage</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-2 transition border border-white/20 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   TRANG GIAO DIỆN KHÁCH TOÀN DIỆN - XANH LAM HOÀNG GIA SANG TRỌNG
   ========================================================================= */
export function PublicGuestPortal({
  data,
  onOpenLogin,
}: PublicGuestPortalProps) {
  const { settings, matches, players } = data;
  const fanpageUrl = settings.fanpage_url || FANPAGE_URL;
  const encodedFanpage = encodeURIComponent(fanpageUrl);

  const [scrolled, setScrolled] = useState(false);
  const [matchTab, setMatchTab] = useState<"fixtures" | "results">("fixtures");
  const [squadFilter, setSquadFilter] = useState<"all" | "manager" | "player">("all");
  const [heroIdx, setHeroIdx] = useState(0);

  /* Profile Modal Dialog State */
  const [selectedProfilePlayer, setSelectedProfilePlayer] = useState<Player | null>(null);

  /* Activity Post Modal & Category Filter State */
  const [selectedActivityPost, setSelectedActivityPost] = useState<ClubActivityPost | null>(null);
  const [activeActivityCategory, setActiveActivityCategory] = useState<ActivityCategory>("all");

  /* Auto-scroll Carousel State for Squad */
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Luân chuyển ảnh nền Hero nhẹ nhàng
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIdx((prev) => (prev + 1) % HERO_PHOTOS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const upcomingMatches = matches.filter((m) => m.status === "Sắp diễn ra");
  const pastMatches = matches
    .filter((m) => m.status === "Đã kết thúc")
    .slice()
    .reverse();
  const nextMatch = upcomingMatches[0] || matches[matches.length - 1];

  const wins = pastMatches.filter(
    (m) =>
      m.team_score !== null &&
      m.opponent_score !== null &&
      m.team_score > m.opponent_score
  ).length;

  const activePlayers: Player[] = players.filter(
    (p) => !/nghỉ|rời|ngưng/i.test(p.status || "")
  );
  const squad = activePlayers
    .filter((p) => (squadFilter === "all" ? true : p.access_role === squadFilter))
    .slice()
    .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999));

  const filteredActivityPosts = CLUB_ACTIVITIES_POSTS.filter((p) =>
    activeActivityCategory === "all" ? true : p.category === activeActivityCategory
  );

  /* Tự động chạy ngang mượt mà cho danh sách cầu thủ */
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || !isAutoPlay || isHovered) return;

    let animId: number;
    let lastTime = performance.now();

    const step = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (!isHovered && el) {
        el.scrollLeft += delta * 45;
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 5) {
          el.scrollLeft = 0;
        }
      }
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isAutoPlay, isHovered, squad]);

  const scrollCarousel = (direction: "left" | "right") => {
    if (!carouselRef.current) return;
    const offset = direction === "left" ? -370 : 370;
    carouselRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  const go = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const navLinks = [
    { id: "banner-hero", label: "Trang chủ" },
    { id: "match-center", label: "Lịch đấu" },
    { id: "activities", label: "Hoạt động" },
    { id: "squad-section", label: "Cầu thủ 23+" },
    { id: "join-us", label: "Gia nhập đội" },
    { id: "gallery", label: "Khoảnh khắc" },
  ];

  const ticker = [
    "23+ Cầu thủ nòng cốt • Mở rộng chào đón tất cả anh em Gò Nổi",
    "Điện Quang • Điện Trung • Điện Phong chung một mái nhà",
    "Đá phủi hết mình • Đoàn kết • Nghĩa tình",
    "Hướng đến toàn bộ con em quê hương Gò Nổi tại Sài Gòn",
  ];

  const matchRows =
    matchTab === "fixtures" ? upcomingMatches : pastMatches.slice(0, 8);

  return (
    <div className="w-full font-sans text-white overflow-x-clip bg-[#092244]">
      {/* ===================== HEADER XANH LAM HOÀNG GIA ===================== */}
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
          scrolled
            ? "bg-[#0a274e]/90 backdrop-blur-lg py-3 border-b border-[#d4af37]/30 shadow-lg"
            : "bg-gradient-to-b from-[#061730]/80 via-[#061730]/40 to-transparent py-5"
        }`}
      >
        <div className={`${WRAP} flex items-center justify-between gap-4`}>
          <button
            type="button"
            onClick={() => go("banner-hero")}
            className="flex items-center gap-3 cursor-pointer group"
            aria-label="Về đầu trang"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_LOGO_URL}
              alt="Logo FC HĐH Gò Nổi"
              className="h-11 w-11 rounded-full object-contain bg-white p-0.5 ring-2 ring-[#d4af37] group-hover:scale-105 transition shadow-md"
            />
            <div className="text-left hidden sm:block">
              <span className="font-display font-extrabold uppercase text-xl sm:text-2xl tracking-wide leading-none text-white block">
                FC HĐH Gò Nổi
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[#d4af37] font-bold block mt-0.5">
                Điện Bàn • Quảng Nam
              </span>
            </div>
          </button>

          <nav
            aria-label="Điều hướng trang khách"
            className="hidden lg:flex items-center gap-8 text-[13px] uppercase font-bold tracking-[0.18em] text-sky-100"
          >
            {navLinks.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => go(l.id)}
                className="hover:text-[#d4af37] cursor-pointer inline-flex items-center gap-1.5 transition"
              >
                <span>{l.label}</span>
              </button>
            ))}
            <a
              href={fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#d4af37] inline-flex items-center gap-1 text-sky-200 transition"
            >
              Fanpage <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </nav>

          <button
            type="button"
            onClick={onOpenLogin}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#d4af37] to-[#e6c466] hover:from-[#e6c466] hover:to-[#f5d97f] text-slate-950 font-extrabold px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm uppercase tracking-wider rounded-xl cursor-pointer shadow-lg hover:shadow-xl transition"
          >
            <LogIn className="h-4 w-4" />
            <span>Đăng nhập</span>
          </button>
        </div>
      </header>

      {/* ===================== HERO BANNER TOÀN MÀN HÌNH (ẢNH WEBP THẬT) ===================== */}
      <section
        id="banner-hero"
        className="relative min-h-[100svh] flex flex-col justify-end overflow-hidden"
      >
        {/* Nền ảnh WebP từ folder hinhanh tự động xử lý */}
        {HERO_PHOTOS.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt="FC HĐH Gò Nổi"
            className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ${
              heroIdx === i ? "opacity-100 scale-100" : "opacity-0 scale-105"
            }`}
          />
        ))}

        {/* Lớp phủ chuyển sắc xanh lam sapphire sang trọng & chiều sâu sân vận động ScrollCraft */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-radial-[circle_at_50%_25%] from-[#10346a]/30 via-transparent to-transparent mix-blend-screen pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-radial-[circle_at_20%_20%] from-[#d4af37]/15 via-transparent to-transparent mix-blend-screen pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#092244] via-[#0b2952]/75 to-[#071933]/45"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#0c2850]/85 via-[#0b2952]/40 to-transparent"
        />

        {/* Chữ in chìm không gian sâu (Depth Watermark) */}
        <div
          aria-hidden="true"
          className="absolute top-[32%] left-1/2 -translate-x-1/2 -translate-y-1/2 font-display font-black text-[22vw] leading-none text-white/[0.03] select-none whitespace-nowrap pointer-events-none tracking-widest uppercase"
        >
          GO NOI FC
        </div>

        <div className={`${WRAP} relative z-10 pt-40 pb-14 sm:pb-20`}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="font-bold uppercase tracking-[0.35em] text-xs sm:text-sm text-[#d4af37] flex items-center gap-2">
              <SoccerBallIcon className="h-4 w-4 text-[#d4af37] gn-spin-slow" />
              <span>Bóng đá phủi • Đồng hương Gò Nổi • TP.HCM</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/50 px-3 py-0.5 text-[11px] font-extrabold text-[#fde047] backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>23+ Cầu thủ • Mở rộng đón anh em Gò Nổi</span>
            </span>
          </div>

          <h1 className="font-display font-bold uppercase leading-[0.82] tracking-tight">
            <span className="block text-[22vw] sm:text-[17vw] lg:text-[13rem] drop-shadow-lg">
              Đá phủi
            </span>
            <span className="block text-[22vw] sm:text-[17vw] lg:text-[13rem] text-transparent [-webkit-text-stroke:2px_#d4af37] drop-shadow-md">
              Hết mình
            </span>
          </h1>

          <div className="mt-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <p className="max-w-xl text-lg sm:text-xl text-sky-100 leading-relaxed font-light">
              Ngôi nhà chung của <strong className="text-[#fde047] font-bold">23+ anh em chiến binh</strong> và không ngừng mở rộng, hướng đến việc quy tụ toàn bộ anh em con em Điện Quang, Điện Trung, Điện Phong tại TP.HCM. Bất kể bạn đá ở vị trí nào, chỉ cần mang trong mình tinh thần Gò Nổi — sân bóng luôn sẵn sàng đón bạn!
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-3 bg-gradient-to-r from-[#17488c] to-[#1e5eb8] hover:from-[#1e5eb8] hover:to-[#2563eb] text-white font-bold px-8 py-4 sm:py-5 text-sm uppercase tracking-widest rounded-xl cursor-pointer shadow-xl border border-sky-300/30 transition hover:scale-[1.02]"
              >
                <span>Vào khu thành viên</span>
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => go("join-us")}
                className="inline-flex items-center gap-3 border-2 border-[#d4af37] hover:bg-[#d4af37] hover:text-slate-950 text-[#d4af37] font-bold px-8 py-[14px] sm:py-[18px] text-sm uppercase tracking-widest rounded-xl cursor-pointer transition shadow-md hover:scale-[1.02]"
              >
                <HeartHandshake className="h-5 w-5" />
                <span>Gia nhập đội bóng</span>
              </button>
            </div>
          </div>

          {/* Số liệu thật */}
          <dl className="mt-14 flex flex-wrap gap-x-14 gap-y-6 border-t border-white/20 pt-8">
            {[
              { n: `${Math.max(23, activePlayers.length)}+`, l: "Cầu thủ tham gia" },
              { n: matches.length, l: "Trận đã lên lịch" },
              { n: wins, l: "Trận thắng" },
            ].map((s) => (
              <div key={s.l}>
                <dd className="font-display text-6xl sm:text-7xl font-bold text-[#d4af37] leading-none">
                  {s.n}
                </dd>
                <dt className="mt-1 text-xs font-bold uppercase tracking-[0.25em] text-sky-200">
                  {s.l}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        <button
          type="button"
          onClick={() => go("match-center")}
          aria-label="Cuộn xuống"
          className="absolute right-6 sm:right-12 bottom-36 hidden sm:flex flex-col items-center gap-2 text-sky-200/80 hover:text-[#d4af37] text-[11px] uppercase tracking-[0.3em] cursor-pointer [writing-mode:vertical-rl]"
        >
          <span>Cuộn</span>
          <ChevronDown className="h-4 w-4 gn-float text-[#d4af37]" />
        </button>

        {/* Dải chữ chạy vàng kim loại */}
        <div className="relative z-10 bg-gradient-to-r from-[#d4af37] via-[#f5d97f] to-[#d4af37] text-slate-950 overflow-hidden shadow-inner">
          <div className="gn-marquee flex w-max gap-12 py-3 font-display font-bold uppercase text-lg tracking-[0.2em]">
            {[...ticker, ...ticker, ...ticker, ...ticker].map((t, i) => (
              <span key={i} className="inline-flex items-center gap-12">
                <span>{t}</span>
                <SoccerBallIcon className="h-5 w-5 inline text-slate-950" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== TRẬN CẦU TÂM ĐIỂM (XANH LAM SAPPHIRE) ===================== */}
      {nextMatch && (
        <section
          id="match-center"
          className="relative bg-gradient-to-br from-[#0c2850] via-[#123e7a] to-[#092244] py-20 sm:py-28 overflow-hidden border-y border-[#d4af37]/20"
        >
          <span
            aria-hidden="true"
            className="absolute -left-4 top-1/2 -translate-y-1/2 font-display font-bold text-[28vw] leading-none text-white/[0.03] select-none whitespace-nowrap pointer-events-none"
          >
            MATCH DAY
          </span>
          <div className={`${WRAP} relative`}>
            <Reveal>
              <div className="flex items-center gap-2 text-[#d4af37] font-bold uppercase tracking-[0.35em] text-xs sm:text-sm">
                <WhistleIcon className="h-4 w-4 text-[#d4af37]" />
                <span>Trận cầu tâm điểm • {nextMatch.label} • {nextMatch.status}</span>
              </div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-6 lg:gap-14">
                <h2 className="font-display font-bold uppercase leading-[0.85] text-6xl sm:text-8xl lg:text-9xl lg:text-right text-white drop-shadow">
                  FC Gò Nổi
                </h2>

                {nextMatch.team_score !== null &&
                nextMatch.opponent_score !== null ? (
                  <div className="font-display font-bold text-7xl sm:text-9xl text-[#d4af37] leading-none text-center drop-shadow-md">
                    {nextMatch.team_score}
                    <span className="mx-3 text-white/40">:</span>
                    {nextMatch.opponent_score}
                  </div>
                ) : (
                  <div className="font-display font-bold text-7xl sm:text-9xl text-[#d4af37] leading-none text-center drop-shadow-md">
                    VS
                  </div>
                )}

                <h2 className="font-display font-bold uppercase leading-[0.85] text-6xl sm:text-8xl lg:text-9xl text-sky-100">
                  {nextMatch.opponent}
                </h2>
              </div>

              <div className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-white/20 pt-6">
                <div className="flex flex-wrap items-center gap-x-10 gap-y-2 text-lg font-semibold text-white">
                  <span className="inline-flex items-center gap-2">
                    <WhistleIcon className="h-5 w-5 text-[#d4af37]" />
                    {nextMatch.kickoff_time} • {formatDateVN(nextMatch.match_date)}
                  </span>
                  <span className="inline-flex items-center gap-2 text-sky-100">
                    <MapPin className="h-5 w-5 text-[#d4af37]" />
                    {nextMatch.venue}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-[#d4af37] to-[#e6c466] hover:from-[#e6c466] hover:to-[#f5d97f] text-slate-950 font-bold px-7 py-4 text-sm uppercase tracking-widest rounded-xl cursor-pointer transition shadow-xl"
                >
                  <SoccerBallIcon className="h-5 w-5" />
                  <span>Đăng nhập để điểm danh</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ===================== HOẠT ĐỘNG & BÀI VIẾT CLB (5 CHUYÊN MỤC ẢNH) ===================== */}
      <section
        id="activities"
        className="bg-[#f8fafc] text-slate-900 py-24 sm:py-32 border-b border-slate-200"
      >
        <div className={WRAP}>
          <Reveal>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <p className="text-[#17488c] font-bold uppercase tracking-[0.35em] text-xs sm:text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#d4af37]" />
                  <span>5 Hoạt Động Trọng Tâm • FC HĐH Gò Nổi</span>
                </p>
                <h2 className="mt-4 font-display font-bold uppercase leading-[0.85] text-6xl sm:text-8xl text-slate-900">
                  Hoạt động &amp; <span className="text-[#17488c]">Bài viết CLB</span>
                </h2>
                <p className="mt-4 max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed font-light">
                  Khám phá những hình ảnh và câu chuyện thực tế từ các hoạt động của đội: Giải Đấu Phong Trào, Giao Lưu Đồng Hương, Cầu Thủ Gò Nổi, Nhà Tài Trợ Đồng Hành và Ảnh Bìa Khí Thế.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-200/60 px-4 py-2 rounded-full w-fit">
                <BookOpen className="h-4 w-4 text-[#17488c]" />
                <span>Cập nhật liên tục các bài viết mới</span>
              </div>
            </div>

            {/* Bộ lọc 5 chuyên mục hoạt động */}
            <div className="mt-10 flex gap-2.5 overflow-x-auto pb-3 gn-hide-scroll text-xs sm:text-sm font-bold uppercase tracking-wider">
              {ACTIVITY_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveActivityCategory(cat.id)}
                  className={`px-4 sm:px-5 py-2.5 rounded-full whitespace-nowrap transition cursor-pointer border ${
                    activeActivityCategory === cat.id
                      ? "bg-[#092244] text-[#fde047] border-[#d4af37] shadow-md"
                      : "bg-white text-slate-600 border-slate-300 hover:border-slate-400 hover:text-slate-900"
                  }`}
                >
                  {cat.label}
                  <span className="ml-1.5 opacity-60 text-xs">
                    (
                    {cat.id === "all"
                      ? CLUB_ACTIVITIES_POSTS.length
                      : CLUB_ACTIVITIES_POSTS.filter((p) => p.category === cat.id).length}
                    )
                  </span>
                </button>
              ))}
            </div>
          </Reveal>

          {/* Danh sách thẻ bài viết hoạt động */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredActivityPosts.map((post, i) => (
              <Reveal key={post.id} delay={(i % 3) * 60}>
                <article
                  onClick={() => setSelectedActivityPost(post)}
                  className="group bg-white rounded-3xl overflow-hidden border border-slate-200 hover:border-[#d4af37] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full cursor-pointer"
                >
                  {/* Ảnh đại diện hoạt động */}
                  <div className="relative h-56 sm:h-64 overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.featuredImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent"
                    />

                    {/* Badge chuyên mục */}
                    <div className="absolute top-4 left-4">
                      <span
                        className={`text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full border backdrop-blur-md shadow-sm ${post.categoryBadgeClass}`}
                      >
                        {post.categoryLabel}
                      </span>
                    </div>

                    {/* Thời gian đọc */}
                    <div className="absolute bottom-3 right-4 flex items-center gap-1 text-[11px] font-medium text-white/90 bg-black/50 px-2.5 py-0.5 rounded-full backdrop-blur-md">
                      <Clock className="h-3 w-3" />
                      <span>{post.readingTime}</span>
                    </div>
                  </div>

                  {/* Nội dung tóm tắt thẻ */}
                  <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                        <Calendar className="h-3.5 w-3.5 text-[#d4af37]" />
                        <span>{post.publishedDate}</span>
                        <span>•</span>
                        <span className="text-slate-600 truncate">{post.author}</span>
                      </div>

                      <h3 className="font-display font-extrabold uppercase text-xl sm:text-2xl text-slate-900 group-hover:text-[#17488c] transition line-clamp-2 leading-snug">
                        {post.title}
                      </h3>

                      <p className="mt-3 text-sm text-slate-600 line-clamp-3 leading-relaxed font-light">
                        {post.summary}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#17488c]">
                      <span className="group-hover:translate-x-1 transition inline-flex items-center gap-1.5">
                        <span>Đọc bài viết chi tiết</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#d4af37]" />
                      </span>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 group-hover:text-[#d4af37] transition font-bold">
                        FC Gò Nổi
                      </span>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>

          <div className="mt-12 text-center text-xs text-slate-500 italic">
            💡 Ban Quản Lý sẽ liên tục bổ sung và cập nhật bài viết mới kèm hình ảnh sau mỗi sự kiện và giải đấu của đội bóng.
          </div>
        </div>
      </section>

      {/* ===================== CẦU THỦ 3D PROFILE (AUTO CHẠY NGANG & XEM BÀI VIẾT) ===================== */}
      <section
        id="squad-section"
        className="relative bg-gradient-to-b from-[#092244] via-[#0d2e5b] to-[#092244] py-24 sm:py-32 overflow-hidden border-y border-[#d4af37]/20"
      >
        {/* Subtle Luxury Pitch Watermark */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 50%, #38bdf8 0, transparent 40%), linear-gradient(90deg, transparent 49%, rgba(212,175,55,0.3) 50%, transparent 51%)",
          }}
        />

        <div className={WRAP}>
          <Reveal>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
              <div>
                <p className="text-[#d4af37] font-bold uppercase tracking-[0.35em] text-xs sm:text-sm flex items-center gap-2">
                  <CleatsIcon className="h-4 w-4" />
                  <span>Profile 23+ Chiến Binh Sân Cỏ 3D</span>
                </p>
                <h2 className="mt-4 font-display font-bold uppercase leading-[0.85] text-7xl sm:text-8xl lg:text-9xl text-white">
                  Gặp gỡ <span className="text-[#d4af37]">23+ anh em</span>
                </h2>
                <p className="text-sm text-sky-200 mt-3 max-w-xl leading-relaxed font-light">
                  Đội hình 23+ cầu thủ nòng cốt và luôn hướng đến việc quy tụ toàn bộ anh em con em Gò Nổi tại Sài Gòn. Mỗi thẻ là một hồ sơ Profile 3D tương tác: tự động chạy ngang, nghiêng 3D, lật xem số áo, và bấm để đọc trọn vẹn bài viết tự giới thiệu do chính cầu thủ viết!
                </p>
              </div>

              {/* Bộ lọc + Điều khiển chạy tự động */}
              <div className="space-y-4">
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm font-bold uppercase tracking-[0.2em]">
                  {(
                    [
                      ["all", "Tất cả"],
                      ["manager", "Ban điều hành"],
                      ["player", "Cầu thủ"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSquadFilter(key)}
                      aria-pressed={squadFilter === key}
                      className={`pb-1 border-b-2 cursor-pointer transition ${
                        squadFilter === key
                          ? "text-[#d4af37] border-[#d4af37]"
                          : "text-sky-200/70 border-transparent hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAutoPlay((v) => !v)}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold uppercase tracking-wider text-[#d4af37] border border-[#d4af37]/40 transition"
                  >
                    {isAutoPlay ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isAutoPlay ? "Tạm dừng chạy" : "Tự động chạy ngang"}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => scrollCarousel("left")}
                      className="h-8 w-8 rounded-full bg-white/10 hover:bg-[#d4af37] hover:text-slate-950 flex items-center justify-center transition cursor-pointer"
                      title="Cuộn sang trái"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollCarousel("right")}
                      className="h-8 w-8 rounded-full bg-white/10 hover:bg-[#d4af37] hover:text-slate-950 flex items-center justify-center transition cursor-pointer"
                      title="Cuộn sang phải"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Carousel container cuộn ngang tự động & Thẻ 3D */}
        <div
          ref={carouselRef}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onTouchStart={() => setIsHovered(true)}
          onTouchEnd={() => setIsHovered(false)}
          className="mt-14 flex gap-6 overflow-x-auto py-8 px-5 sm:px-10 lg:px-16 gn-hide-scroll select-none scroll-smooth"
        >
          {squad.map((p) => (
            <PlayerCard3D
              key={p.id}
              player={p}
              onOpenProfile={(player) => setSelectedProfilePlayer(player)}
            />
          ))}
        </div>

        <div className={`${WRAP} mt-8 flex flex-wrap items-center justify-between gap-4 text-xs`}>
          <span className="uppercase tracking-[0.25em] text-[#d4af37] flex items-center gap-2">
            <SoccerBallIcon className="h-4 w-4 gn-spin-slow" />
            <span>Thẻ 3D Profile • Bấm &ldquo;Xem Profile&rdquo; để đọc bài viết tự giới thiệu</span>
          </span>
          <button
            type="button"
            onClick={onOpenLogin}
            className="inline-flex items-center gap-2 text-white hover:text-[#d4af37] font-bold uppercase tracking-widest cursor-pointer transition"
          >
            <span>Cầu thủ tự cập nhật Profile</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* ===================== HƯỚNG ĐẾN TẤT CẢ ANH EM GÒ NỔI (GIA NHẬP ĐỘI BÓNG) ===================== */}
      <section
        id="join-us"
        className="relative bg-gradient-to-br from-[#0c2850] via-[#123e7a] to-[#092244] py-24 sm:py-32 text-white overflow-hidden border-y border-[#d4af37]/30"
      >
        <span
          aria-hidden="true"
          className="absolute -right-6 top-1/2 -translate-y-1/2 font-display font-black text-[24vw] leading-none text-white/[0.03] select-none whitespace-nowrap pointer-events-none"
        >
          GO NOI FC
        </span>

        <div className={WRAP}>
          <Reveal>
            <div className="max-w-3xl">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="h-12 w-12 rounded-full border-2 border-[#d4af37] p-1.5 shadow-[0_0_25px_rgba(212,175,55,0.4)] shrink-0 bg-[#071933]/80">
                  <svg viewBox="0 0 32 32" className="w-full h-full">
                    <circle cx="16" cy="16" r="14" fill="none" stroke="#D4AF37" strokeWidth="1.5" />
                    <polygon points="16,6 19.5,13.5 27,14.5 21.5,19.5 23,27 16,23 9,27 10.5,19.5 5,14.5 12.5,13.5" fill="#D4AF37" />
                  </svg>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/50 px-4 py-1.5 text-xs font-bold text-[#fde047] backdrop-blur-md">
                  <Users className="h-4 w-4" />
                  <span>Mái nhà chung của 23+ cầu thủ & Toàn thể anh em đồng hương</span>
                </div>
              </div>
              <h2 className="font-display font-bold uppercase leading-[0.88] text-6xl sm:text-8xl lg:text-9xl text-white drop-shadow">
                Mở rộng cửa đón
                <br />
                <span className="text-[#d4af37]">anh em Gò Nổi</span>
              </h2>
              <p className="mt-6 text-lg sm:text-xl text-sky-100 font-light leading-relaxed">
                Mục tiêu xuyên suốt của FC HĐH Gò Nổi là <strong className="text-[#fde047] font-semibold">kết nối và hướng đến tất cả anh em, con em quê hương Gò Nổi</strong> (Điện Quang, Điện Trung, Điện Phong) đang sinh sống, học tập và làm việc tại TP.HCM cùng tề tựu trên sân cỏ.
              </p>
            </div>

            {/* 4 Trụ cột cam kết chào đón anh em */}
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="rounded-3xl bg-[#071933]/70 backdrop-blur-md p-6 sm:p-7 border border-[#d4af37]/40 shadow-xl hover:border-[#d4af37] transition group">
                <div className="h-12 w-12 rounded-2xl bg-[#d4af37]/20 border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37] mb-5 group-hover:scale-110 transition">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold uppercase text-2xl text-white mb-2 group-hover:text-[#d4af37] transition">
                  23+ Cầu thủ nòng cốt
                </h3>
                <p className="text-sm text-sky-100 leading-relaxed font-light">
                  Đội bóng đã quy tụ hơn 23 anh em từ các thế hệ và luôn mở rộng đón nhận thêm thành viên mới mỗi tuần mà không giới hạn số lượng.
                </p>
              </div>

              <div className="rounded-3xl bg-[#071933]/70 backdrop-blur-md p-6 sm:p-7 border border-[#d4af37]/40 shadow-xl hover:border-[#d4af37] transition group">
                <div className="h-12 w-12 rounded-2xl bg-emerald-400/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 mb-5 group-hover:scale-110 transition">
                  <SoccerBallIcon className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold uppercase text-2xl text-white mb-2 group-hover:text-[#d4af37] transition">
                  Ai cũng được ra sân
                </h3>
                <p className="text-sm text-sky-100 leading-relaxed font-light">
                  Chỉ cần bạn yêu bóng đá và mang trong mình nhiệt huyết quê hương. Đội luôn tạo điều kiện xoay tua để mọi anh em đều được đá và toả sáng.
                </p>
              </div>

              <div className="rounded-3xl bg-[#071933]/70 backdrop-blur-md p-6 sm:p-7 border border-[#d4af37]/40 shadow-xl hover:border-[#d4af37] transition group">
                <div className="h-12 w-12 rounded-2xl bg-[#38bdf8]/20 border border-[#38bdf8]/50 flex items-center justify-center text-sky-300 mb-5 group-hover:scale-110 transition">
                  <HeartHandshake className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold uppercase text-2xl text-white mb-2 group-hover:text-[#d4af37] transition">
                  Gắn kết đồng hương
                </h3>
                <p className="text-sm text-sky-100 leading-relaxed font-light">
                  Sau 90 phút trên sân cỏ là những câu chuyện quê nhà, hỗ trợ nhau trong công việc, nghề nghiệp và cuộc sống tại đất Sài Gòn.
                </p>
              </div>

              <div className="rounded-3xl bg-[#071933]/70 backdrop-blur-md p-6 sm:p-7 border border-[#d4af37]/40 shadow-xl hover:border-[#d4af37] transition group">
                <div className="h-12 w-12 rounded-2xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 mb-5 group-hover:scale-110 transition">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold uppercase text-2xl text-white mb-2 group-hover:text-[#d4af37] transition">
                  Minh bạch & Bài bản
                </h3>
                <p className="text-sm text-sky-100 leading-relaxed font-light">
                  Hệ thống website quản lý hiện đại: quỹ thu chi công khai từng đồng, điểm danh trực tuyến và thông báo lịch đấu rõ ràng hàng tuần.
                </p>
              </div>
            </div>

            {/* Khung hành động & Ban Quản Lý */}
            <div className="mt-12 rounded-3xl bg-[#071933]/90 backdrop-blur-md p-6 sm:p-10 border-2 border-[#d4af37]/60 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 shadow-2xl">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#d4af37] block mb-1">
                  Bạn là người con Gò Nổi tại TP.HCM?
                </span>
                <h3 className="font-display font-extrabold uppercase text-3xl sm:text-4xl text-white">
                  Hãy xách giày và ra sân cùng anh em ngay tuần này!
                </h3>
                <p className="mt-2 text-sm text-sky-200 max-w-xl font-light">
                  Liên hệ ngay với Ban Điều Hành đội bóng hoặc gửi tin nhắn qua Fanpage để được xếp đội và tham gia buổi tập / giao hữu gần nhất.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-sky-200">
                  <span className="font-semibold text-white">Ban Điều Hành:</span>
                  <span className="rounded-lg bg-white/10 px-2.5 py-1 border border-white/15">
                    Nguyễn Thế Tiếng (Đội trưởng)
                  </span>
                  <span className="rounded-lg bg-white/10 px-2.5 py-1 border border-white/15">
                    Hồ Viết Tín (Đội phó)
                  </span>
                  <span className="rounded-lg bg-white/10 px-2.5 py-1 border border-white/15">
                    Dương Hiển Hoài Sơn (BQL)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 shrink-0">
                <a
                  href={fanpageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e6c466] hover:from-[#e6c466] hover:to-[#f5d97f] text-slate-950 font-extrabold px-7 py-4 text-sm uppercase tracking-wider transition shadow-lg cursor-pointer"
                >
                  <span>Nhắn Fanpage Tham Gia</span>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="inline-flex items-center gap-2.5 rounded-xl border-2 border-white/40 hover:bg-white hover:text-slate-950 text-white font-bold px-7 py-3.5 text-sm uppercase tracking-wider transition cursor-pointer"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Đăng Nhập Thành Viên</span>
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===================== LỊCH ĐẤU & KẾT QUẢ ===================== */}
      <section className="bg-white text-slate-900 py-24 sm:py-32">
        <div className={WRAP}>
          <Reveal>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div>
                <p className="text-[#17488c] font-bold uppercase tracking-[0.35em] text-xs sm:text-sm flex items-center gap-2">
                  <GoalNetIcon className="h-4 w-4 text-[#d4af37]" />
                  <span>Bóng lăn mỗi tuần</span>
                </p>
                <h2 className="mt-4 font-display font-bold uppercase leading-[0.85] text-7xl sm:text-8xl">
                  Lịch đấu <span className="text-[#17488c]">& kết quả</span>
                </h2>
              </div>
              <div className="flex gap-8 text-sm font-bold uppercase tracking-[0.2em]">
                {(
                  [
                    ["fixtures", `Sắp tới (${upcomingMatches.length})`],
                    ["results", `Đã đấu (${pastMatches.length})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMatchTab(key)}
                    aria-pressed={matchTab === key}
                    className={`pb-1 border-b-2 cursor-pointer transition ${
                      matchTab === key
                        ? "text-[#17488c] border-[#17488c]"
                        : "text-slate-400 border-transparent hover:text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="mt-12 border-t-2 border-[#17488c]">
            {matchRows.length === 0 && (
              <p className="py-14 text-slate-500 italic">
                Chưa có lịch mới. Ban điều hành đang chốt kèo giao hữu tiếp theo!
              </p>
            )}
            {matchRows.map((m) => (
              <div
                key={m.id}
                className="group grid grid-cols-1 md:grid-cols-[200px_1fr_auto] items-center gap-3 md:gap-8 py-6 border-b border-slate-200 hover:bg-[#f1f5f9] hover:px-4 transition-all"
              >
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  <div className="text-[#17488c]">{m.label}</div>
                  <div>
                    {formatDateVN(m.match_date)}
                    {m.kickoff_time ? ` • ${m.kickoff_time}` : ""}
                  </div>
                </div>
                <div className="font-display font-bold uppercase text-3xl sm:text-5xl leading-none flex flex-wrap items-center gap-x-4">
                  <span>FC Gò Nổi</span>
                  {matchTab === "results" ? (
                    <span className="text-[#17488c]">
                      {m.team_score ?? 0} - {m.opponent_score ?? 0}
                    </span>
                  ) : (
                    <span className="text-slate-300">vs</span>
                  )}
                  <span className="text-slate-600">{m.opponent}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600">
                    <MapPin className="h-4 w-4 text-[#d4af37]" />
                    {m.venue}
                  </span>
                  {matchTab === "fixtures" && (
                    <button
                      type="button"
                      onClick={onOpenLogin}
                      className="font-bold uppercase tracking-widest text-[#17488c] hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>Điểm danh</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== KHOẢNH KHẮC & HÌNH ẢNH WEBP ===================== */}
      <section id="gallery" className="bg-[#092244]">
        <div className={`${WRAP} pt-24 sm:pt-32 pb-12`}>
          <Reveal>
            <p className="text-[#d4af37] font-bold uppercase tracking-[0.35em] text-xs sm:text-sm flex items-center gap-2">
              <Camera className="h-4 w-4" />
              <span>Sân cỏ ghi dấu</span>
            </p>
            <h2 className="mt-4 font-display font-bold uppercase leading-[0.85] text-7xl sm:text-8xl lg:text-9xl text-white">
              Khoảnh khắc <span className="text-[#d4af37]">của đội</span>
            </h2>
          </Reveal>
        </div>

        {/* Gallery WebP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 auto-rows-[220px] sm:auto-rows-[300px] gap-1">
          {MOSAIC.map((img, i) => (
            <figure
              key={i}
              className={`relative overflow-hidden group ${img.span}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt={img.title}
                className="absolute inset-0 h-full w-full object-cover group-hover:scale-110 transition duration-1000"
              />
              <figcaption className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[#092244]/90 via-transparent to-transparent p-5 opacity-90 group-hover:opacity-100 transition">
                <span className="text-[#d4af37] text-[11px] font-bold uppercase tracking-[0.25em]">
                  {img.tag}
                </span>
                <p className="font-display font-bold uppercase text-2xl sm:text-3xl leading-none mt-1 text-white">
                  {img.title}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>

        {/* Fanpage Facebook */}
        <div className="bg-[#0c2850] border-t border-white/10">
          <div
            className={`${WRAP} py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center`}
          >
            <Reveal>
              <h3 className="font-display font-bold uppercase leading-[0.85] text-6xl sm:text-8xl text-white">
                Theo dõi <span className="text-[#d4af37]">Fanpage</span>
              </h3>
              <p className="mt-5 max-w-md text-lg text-sky-100 font-light leading-relaxed">
                Ảnh, video bàn thắng và tin nóng của đội bóng được cập nhật sau mỗi trận. Anh em đồng hương muốn giao lưu hoặc gia nhập đội thì nhắn thẳng cho chúng mình nhé!
              </p>
              <a
                href={fanpageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-3 bg-gradient-to-r from-[#d4af37] to-[#e6c466] hover:from-[#e6c466] hover:to-[#f5d97f] text-slate-950 font-bold px-7 py-4 text-sm uppercase tracking-widest rounded-xl transition shadow-lg"
              >
                Mở Facebook <ArrowUpRight className="h-5 w-5" />
              </a>
            </Reveal>
            <div className="flex lg:justify-end">
              <iframe
                title="Fanpage FC HĐH Gò Nổi"
                src={`https://www.facebook.com/plugins/page.php?href=${encodedFanpage}&tabs=timeline&width=360&height=420&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=true`}
                width="360"
                height="420"
                style={{ border: "none", overflow: "hidden", maxWidth: "100%" }}
                scrolling="no"
                loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===================== CTA + FOOTER SANG TRỌNG ===================== */}
      <footer className="relative bg-gradient-to-r from-[#d4af37] via-[#f5d97f] to-[#d4af37] text-slate-950 overflow-hidden shadow-2xl">
        <div className={`${WRAP} pt-20 sm:pt-28 pb-10`}>
          <Reveal>
            <h2 className="font-display font-bold uppercase leading-[0.8] text-[17vw] sm:text-[13vw] lg:text-[11rem] drop-shadow-sm">
              Ra sân cùng
              <br />
              23+ anh em Gò Nổi
            </h2>
            <p className="mt-4 text-base sm:text-xl font-bold uppercase tracking-wider text-slate-900/80 max-w-xl">
              Cánh cửa đội bóng luôn rộng mở chào đón tất cả anh em Điện Quang, Điện Trung, Điện Phong tại Sài Gòn!
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-3 bg-slate-950 hover:bg-[#0c2850] text-white font-bold px-8 py-5 text-sm uppercase tracking-widest rounded-xl cursor-pointer transition shadow-xl"
              >
                <LogIn className="h-5 w-5" />
                <span>Đăng nhập thành viên</span>
              </button>
              <a
                href={fanpageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 border-2 border-slate-950 hover:bg-slate-950 hover:text-white font-bold px-8 py-[18px] text-sm uppercase tracking-widest rounded-xl transition"
              >
                <span>Nhắn tin Fanpage</span>
                <ArrowUpRight className="h-5 w-5" />
              </a>
            </div>
          </Reveal>

          <div className="mt-16 pt-6 border-t border-slate-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm font-bold">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={OFFICIAL_LOGO_URL}
                alt="Logo FC HĐH Gò Nổi"
                className="h-10 w-10 rounded-full object-contain bg-white p-0.5 ring-2 ring-slate-950"
              />
              <span>
                CLB bóng đá đồng hương Gò Nổi (Điện Bàn, Quảng Nam) tại TP. Hồ Chí Minh
              </span>
            </div>
            <span>© {new Date().getFullYear()} FC HĐH Gò Nổi</span>
          </div>
        </div>
      </footer>

      {/* ===================== POPUP MODAL PROFILE CẦU THỦ ===================== */}
      <PlayerProfileModal
        player={selectedProfilePlayer}
        onClose={() => setSelectedProfilePlayer(null)}
        onOpenLogin={onOpenLogin}
      />

      {/* ===================== POPUP MODAL BÀI VIẾT HOẠT ĐỘNG CLB ===================== */}
      <ActivityArticleModal
        post={selectedActivityPost}
        onClose={() => setSelectedActivityPost(null)}
        fanpageUrl={fanpageUrl}
      />
    </div>
  );
}
