"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  LogIn,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Camera,
  HeartHandshake,
  Calendar,
  BookOpen,
  Clock,
  Search,
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
  CLUB_TIMELINE_YEARS,
  type ActivityCategory,
} from "@/data/clubActivities";
import {
  ImageLightboxModal,
  type LightboxImage,
} from "./ImageLightboxModal";
import {
  BroadcastAthleteCard,
  getPlayerPositionBadge,
  getPlayerHamlet,
} from "./BroadcastAthleteCard";
import { MatchdayRosterPosterModal } from "./MatchdayRosterPoster";

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
interface ExpandedPlayerDetailProps {
  player: Player | null;
  attendances?: FullAppData["attendances"];
  onOpenImage?: (images: LightboxImage[], startIndex?: number) => void;
}

const FALLBACK_ACTION_PHOTOS = [
  "/images/hinhanh-webp/cauthu/05f39aceaf732e2d776225.webp",
  "/images/hinhanh-webp/giaidau/DSC06290.webp",
  "/images/hinhanh-webp/giaidau/DSC06530.webp",
  "/images/hinhanh-webp/giaoluu/29c7f1c6ac0f2c51751e1.webp",
];

function ExpandedPlayerDetail({
  player,
  attendances,
  onOpenImage,
}: ExpandedPlayerDetailProps) {
  if (!player) return null;

  return (
    <BroadcastAthleteCard
      player={player}
      attendances={attendances}
      layout="stacked"
      fallbackPhotos={FALLBACK_ACTION_PHOTOS}
      onOpenLightbox={(imgs, idx) => {
        if (onOpenImage) onOpenImage(imgs, idx);
      }}
    />
  );
}



/* =========================================================================
   THẺ CẦU THỦ THU NHỎ XẾP GỌN (MATCHDAY TEAM SHEET ROSTER)
   ========================================================================= */
interface CompactPlayerRowProps {
  player: Player;
  isSelected: boolean;
  onSelect: () => void;
}

function CompactPlayerRow({
  player,
  isSelected,
  onSelect,
}: CompactPlayerRowProps) {
  const posBadge = getPlayerPositionBadge(player);
  const hamlet = getPlayerHamlet(player);

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer border ${isSelected
          ? "bg-[#103567] border-l-4 border-l-[#d4af37] border-y-[#d4af37]/60 border-r-[#d4af37]/60 shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
          : "bg-[#061830] border border-white/10 hover:border-white/25 hover:bg-[#092244]"
        }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-md bg-[#040e1a] border border-white/15 flex items-center justify-center shrink-0 font-display font-black text-base text-[#d4af37]">
          #{player.jersey_number ?? "--"}
        </div>

        <div className="relative h-11 w-11 rounded-md overflow-hidden bg-[#071933] border border-white/15 shrink-0">
          {player.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.avatar_url}
              alt={player.full_name}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-slate-400">
              {posBadge.code}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <h4 className="font-display font-bold uppercase text-sm text-white truncate">
              {player.full_name}
            </h4>
            {player.nickname && (
              <span className="text-xs text-[#d4af37] font-semibold shrink-0">
                ({player.nickname})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded border ${posBadge.badgeClass}`}
            >
              {posBadge.code}
            </span>
            <span className="text-[11px] text-slate-400 truncate">
              Xã {hamlet}
            </span>
          </div>
        </div>
      </div>

      <div className="text-right shrink-0 pl-2">
        {isSelected ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#d4af37] text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-sm">
            <span>ĐANG XEM</span>
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-slate-400 group-hover:text-white transition inline-flex items-center gap-1">
            <span>Xem</span>
            <ArrowRight className="h-3 w-3" />
          </span>
        )}
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

  /* Cầu thủ được chọn để phóng to 1/2 màn hình bên trái */
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");

  /* Chuyên mục hoạt động & Dòng thời gian năm */
  const [activeActivityCategory, setActiveActivityCategory] = useState<ActivityCategory>("all");
  const [selectedTimelineYear, setSelectedTimelineYear] = useState<string>("all");

  /* Lightbox ảnh phóng to toàn màn hình */
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  /* Modal Xuất Ảnh Đội Hình Ra Sân Điểm Danh */
  const [posterModalOpen, setPosterModalOpen] = useState(false);

  const handleOpenLightbox = (images: LightboxImage[], startIndex = 0) => {
    setLightboxImages(images);
    setLightboxIndex(startIndex);
    setLightboxOpen(true);
  };

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

  /* Lọc cầu thủ theo ô tìm kiếm */
  const displayedSquad = squad.filter((p) => {
    if (!playerSearchQuery.trim()) return true;
    const q = playerSearchQuery.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.short_name?.toLowerCase().includes(q) ||
      (p.jersey_number !== null && p.jersey_number !== undefined && p.jersey_number.toString().includes(q)) ||
      (p.position && p.position.toLowerCase().includes(q))
    );
  });

  /* Cầu thủ đang được phóng to trên 1/2 màn hình bên trái */
  const selectedPlayer =
    squad.find((p) => p.id === selectedPlayerId) ||
    displayedSquad[0] ||
    squad[0] ||
    null;

  const allActivityPosts =
    data.posts && data.posts.length > 0 ? data.posts : CLUB_ACTIVITIES_POSTS;
  const filteredActivityPosts = allActivityPosts.filter((p) => {
    const matchCat =
      activeActivityCategory === "all" ? true : p.category === activeActivityCategory;
    const matchYear =
      selectedTimelineYear === "all"
        ? true
        : (p.eventYear || p.publishedDate?.slice(0, 4)) === selectedTimelineYear;
    return matchCat && matchYear;
  });

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
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${scrolled
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
            className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ${heroIdx === i ? "opacity-100 scale-100" : "opacity-0 scale-105"
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

      {/* ===================== TRẬN CẦU TÂM ĐIỂM (BROADCAST MATCHDAY SCOREBOARD) ===================== */}
      {nextMatch && (
        <section
          id="match-center"
          className="relative bg-gradient-to-b from-[#061830] via-[#092244] to-[#061830] py-16 sm:py-24 overflow-hidden border-y border-white/10"
        >
          <span
            aria-hidden="true"
            className="absolute -left-4 top-1/2 -translate-y-1/2 font-display font-black text-[24vw] leading-none text-white/[0.02] select-none whitespace-nowrap pointer-events-none"
          >
            MATCHDAY
          </span>
          <div className={`${WRAP} relative`}>
            <Reveal>
              {/* Technical Section Index */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#d4af37] bg-[#d4af37]/15 px-2.5 py-1 rounded border border-[#d4af37]/30">
                    01 // MATCHDAY FIXTURE
                  </span>
                  <span className="text-xs uppercase font-extrabold tracking-widest text-slate-300">
                    {nextMatch.label}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {(data.attendances || []).filter(
                      (a) => a.match_id === nextMatch.id && a.rsvp_status === "registered"
                    ).length}{" "}
                    Cầu thủ đã báo danh ra sân
                  </span>
                </div>
              </div>

              {/* TV Broadcast Scoreboard Box */}
              <div className="mt-8 rounded-xl bg-[#041224] border border-white/15 p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.85)] relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-8 lg:gap-12">
                  {/* Đội chủ nhà FC Gò Nổi */}
                  <div className="flex flex-col lg:items-end items-center text-center lg:text-right space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-[#d4af37] bg-[#d4af37]/10 px-2 py-0.5 rounded border border-[#d4af37]/30">
                        CHỦ NHÀ
                      </span>
                    </div>
                    <h2 className="font-display font-black uppercase text-4xl sm:text-6xl lg:text-7xl text-white tracking-tight leading-none drop-shadow">
                      FC HĐH Gò Nổi
                    </h2>
                    <p className="text-xs text-sky-200 uppercase tracking-widest">
                      Điện Bàn • Quảng Nam
                    </p>
                  </div>

                  {/* Tỷ số hoặc VS Broadcast Center */}
                  <div className="flex flex-col items-center justify-center px-6 py-4 rounded-lg bg-[#061b36] border border-white/10 shrink-0">
                    {nextMatch.team_score !== null &&
                      nextMatch.opponent_score !== null ? (
                      <div className="font-display font-black text-5xl sm:text-7xl text-[#fde047] leading-none tracking-tight">
                        {nextMatch.team_score}
                        <span className="mx-2 text-white/40">:</span>
                        {nextMatch.opponent_score}
                      </div>
                    ) : (
                      <div className="font-display font-black text-4xl sm:text-5xl text-[#d4af37] leading-none tracking-widest">
                        VS
                      </div>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">
                      SÂN 7 NGƯỜI
                    </span>
                  </div>

                  {/* Đội đối thủ */}
                  <div className="flex flex-col lg:items-start items-center text-center lg:text-left space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        ĐỐI THỦ
                      </span>
                    </div>
                    <h2 className="font-display font-black uppercase text-4xl sm:text-6xl lg:text-7xl text-sky-100 tracking-tight leading-none">
                      {nextMatch.opponent}
                    </h2>
                    <p className="text-xs text-slate-400 uppercase tracking-widest">
                      Giao Hữu Phong Trào
                    </p>
                  </div>
                </div>

                {/* Match Bottom Bar */}
                <div className="mt-10 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-8 gap-y-2 text-sm text-white">
                    <span className="inline-flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#d4af37]" />
                      <span className="font-bold">{nextMatch.kickoff_time}</span>
                      <span className="text-slate-400">•</span>
                      <span>{formatDateVN(nextMatch.match_date)}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 text-sky-200">
                      <MapPin className="h-4 w-4 text-[#d4af37]" />
                      <span>{nextMatch.venue}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPosterModalOpen(true)}
                      className="inline-flex items-center gap-2 bg-[#061b36] hover:bg-[#092b57] text-[#d4af37] border border-[#d4af37]/50 font-extrabold px-5 py-3.5 text-xs uppercase tracking-wider rounded-lg cursor-pointer transition shadow-md"
                      title="Tải trực tiếp ảnh đội hình ra sân về máy để gửi vào Zalo"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Tải Ảnh Đội Hình (PNG)</span>
                    </button>

                    <button
                      type="button"
                      onClick={onOpenLogin}
                      className="inline-flex items-center gap-2.5 bg-gradient-to-r from-[#d4af37] to-[#e6c466] hover:from-[#e6c466] hover:to-[#f5d97f] text-slate-950 font-black px-6 py-3.5 text-xs uppercase tracking-widest rounded-lg cursor-pointer transition shadow-lg hover:shadow-xl"
                    >
                      <SoccerBallIcon className="h-4 w-4" />
                      <span>Đăng nhập để điểm danh</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ===================== HOẠT ĐỘNG & BÀI VIẾT CLB (EDITORIAL MAGAZINE LAYOUT) ===================== */}
      <section
        id="activities"
        className="bg-[#f8fafc] text-slate-900 py-20 sm:py-28 border-b border-slate-200"
      >
        <div className={WRAP}>
          <Reveal>
            {/* Header Chuyên Mục Chuẩn Báo Chí Thể Thao */}
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-8 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#17488c] bg-[#17488c]/10 px-2.5 py-1 rounded border border-[#17488c]/20">
                    02 // BÀI VIẾT &amp; HOẠT ĐỘNG CLB
                  </span>
                  <span className="text-xs uppercase font-extrabold tracking-widest text-slate-500">
                    KHO TƯ LIỆU THỰC TẾ
                  </span>
                </div>
                <h2 className="mt-3 font-display font-black uppercase leading-tight text-4xl sm:text-6xl text-slate-900">
                  Hoạt động &amp; <span className="text-[#17488c]">Ký ức sân cỏ</span>
                </h2>
                <p className="mt-3 max-w-2xl text-sm sm:text-base text-slate-600 leading-relaxed font-light">
                  Nơi ghi dấu những trận cầu nảy lửa, giải đấu truyền thống, khoảnh khắc giao lưu anh em đồng hương Điện Quang, Điện Trung, Điện Phong và tình cảm của các nhà tài trợ.
                </p>
              </div>

              <Link
                href="/hoat-dong"
                className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#17488c] hover:text-[#103567] bg-white border border-slate-300 hover:border-[#17488c] px-4 py-2.5 rounded-lg transition shadow-sm w-fit shrink-0"
              >
                <BookOpen className="h-4 w-4" />
                <span>Xem kho bài viết hoàn chỉnh</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Bộ lọc Năm & 5 Chuyên mục */}
            <div className="mt-6 space-y-3">
              {/* Dòng thời gian CLB theo năm */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold uppercase tracking-wider">
                <span className="text-slate-400 font-extrabold text-[10px] uppercase mr-1 shrink-0 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-[#17488c]" />
                  <span>Niên khóa:</span>
                </span>
                {CLUB_TIMELINE_YEARS.map((y) => (
                  <button
                    key={y.id}
                    type="button"
                    onClick={() => setSelectedTimelineYear(y.id)}
                    className={`px-3 py-1.5 rounded-md whitespace-nowrap transition cursor-pointer border text-xs flex items-center gap-1.5 ${selectedTimelineYear === y.id
                        ? "bg-[#17488c] text-white font-black border-[#17488c] shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900"
                      }`}
                  >
                    <span>{y.label}</span>
                    <span className="text-[10px] opacity-75 font-normal">({y.highlight})</span>
                  </button>
                ))}
              </div>

              {/* Bộ lọc 5 chuyên mục hoạt động */}
              <div className="flex gap-2 overflow-x-auto pb-2 gn-hide-scroll text-xs font-bold uppercase tracking-wider">
                {ACTIVITY_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveActivityCategory(cat.id)}
                    className={`px-3.5 py-2 rounded-md whitespace-nowrap transition cursor-pointer border ${activeActivityCategory === cat.id
                        ? "bg-[#092244] text-[#fde047] border-[#092244] shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900"
                      }`}
                  >
                    {cat.label}
                    <span className="ml-1 opacity-60 text-[11px]">
                      (
                      {cat.id === "all"
                        ? allActivityPosts.length
                        : allActivityPosts.filter((p) => p.category === cat.id).length}
                      )
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          {/* EDITORIAL MAGAZINE GRID (7 COLS BÀI TIÊU ĐIỂM + 5 COLS DÒNG TIN HOẠT ĐỘNG) */}
          {filteredActivityPosts.length === 0 ? (
            <div className="mt-10 p-12 text-center rounded-xl bg-white border border-slate-200 text-slate-500 text-sm">
              Chưa có bài viết nào trong chuyên mục hoặc năm đã chọn.
            </div>
          ) : (
            <div className="mt-8 space-y-8">
              {/* Asymmetric 7 / 5 Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* 7 COLS: BÀI VIẾT TIÊU ĐIỂM (LEAD STORY) */}
                {filteredActivityPosts[0] && (
                  <div className="lg:col-span-7">
                    <Link
                      href={`/hoat-dong/${filteredActivityPosts[0].id}`}
                      className="group block bg-white rounded-xl overflow-hidden border border-slate-200 hover:border-[#17488c] shadow-sm hover:shadow-xl transition-all duration-300"
                    >
                      {/* Ảnh đại diện tỷ lệ 16:9 với overlay thông số */}
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={filteredActivityPosts[0].featuredImage}
                          alt={filteredActivityPosts[0].title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                        />
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"
                        />

                        {/* Badges chuyên mục và năm */}
                        <div className="absolute top-4 left-4 flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-[#17488c] text-white shadow-sm">
                            TIÊU ĐIỂM // {filteredActivityPosts[0].categoryLabel}
                          </span>
                          {filteredActivityPosts[0].eventYear && (
                            <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-[#d4af37] text-slate-950 shadow-sm">
                              {filteredActivityPosts[0].eventYear}
                            </span>
                          )}
                        </div>

                        {/* Metadata ảnh và thời gian đọc */}
                        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white text-xs">
                          <span className="inline-flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded border border-white/15">
                            <Camera className="h-3.5 w-3.5 text-[#d4af37]" />
                            <span>
                              Album{" "}
                              {1 +
                                (filteredActivityPosts[0].galleryImages?.length ||
                                  0)}{" "}
                              ảnh
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded border border-white/15">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{filteredActivityPosts[0].readingTime}</span>
                          </span>
                        </div>
                      </div>

                      {/* Thân bài viết tiêu điểm */}
                      <div className="p-6 sm:p-7 space-y-3.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <Calendar className="h-3.5 w-3.5 text-[#17488c]" />
                          <span>{filteredActivityPosts[0].publishedDate}</span>
                          <span>•</span>
                          <span>Tác giả: {filteredActivityPosts[0].author}</span>
                        </div>

                        <h3 className="font-display font-black uppercase text-2xl sm:text-3xl text-slate-900 group-hover:text-[#17488c] transition leading-snug">
                          {filteredActivityPosts[0].title}
                        </h3>

                        <p className="text-slate-600 text-sm leading-relaxed font-light">
                          {filteredActivityPosts[0].summary}
                        </p>

                        {filteredActivityPosts[0].quote && (
                          <div className="p-3.5 rounded-lg bg-slate-50 border-l-4 border-[#17488c] text-xs italic text-slate-700">
                            &ldquo;{filteredActivityPosts[0].quote}&rdquo;
                          </div>
                        )}

                        {filteredActivityPosts[0].taggedPlayerNames &&
                          filteredActivityPosts[0].taggedPlayerNames.length >
                          0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">
                                Cầu thủ:
                              </span>
                              {filteredActivityPosts[0].taggedPlayerNames.map(
                                (name) => (
                                  <span
                                    key={name}
                                    className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200"
                                  >
                                    {name}
                                  </span>
                                )
                              )}
                            </div>
                          )}

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#17488c]">
                          <span className="group-hover:translate-x-1 transition inline-flex items-center gap-1.5">
                            <span>Đọc bài viết chi tiết &amp; xem album ảnh</span>
                            <ArrowRight className="h-4 w-4 text-[#d4af37]" />
                          </span>
                          <span className="text-slate-400 group-hover:text-slate-700">
                            Chi tiết bài viết →
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                )}

                {/* 5 COLS: DÒNG TIN HOẠT ĐỘNG (SECONDARY EDITORIAL FEED) */}
                <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <span className="text-xs uppercase font-extrabold tracking-widest text-[#17488c] flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4" />
                      <span>Dòng tin hoạt động gần đây</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {filteredActivityPosts.length} bài viết
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {filteredActivityPosts.slice(1, 4).map((post) => (
                      <Link
                        key={post.id}
                        href={`/hoat-dong/${post.id}`}
                        className="group py-3.5 flex gap-3.5 items-center cursor-pointer"
                      >
                        <div className="relative h-20 w-24 sm:h-22 sm:w-28 rounded-lg overflow-hidden shrink-0 bg-slate-100 border border-slate-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={post.featuredImage}
                            alt={post.title}
                            className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          {post.eventYear && (
                            <span className="absolute bottom-1 right-1 text-[9px] font-black px-1.5 py-0.2 rounded bg-black/75 text-[#fde047]">
                              {post.eventYear}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold mb-0.5">
                            <span className="text-[#17488c] uppercase font-bold">
                              {post.categoryLabel}
                            </span>
                            <span>•</span>
                            <span>{post.publishedDate}</span>
                          </div>

                          <h4 className="font-display font-bold uppercase text-xs sm:text-sm text-slate-900 group-hover:text-[#17488c] transition line-clamp-2 leading-snug">
                            {post.title}
                          </h4>

                          <p className="mt-1 line-clamp-1 text-slate-500 font-light text-[11px]">
                            {post.summary}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-slate-100 text-center">
                    <Link
                      href="/hoat-dong"
                      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#17488c] hover:text-[#103567]"
                    >
                      <span>Xem toàn bộ chuyên mục hoạt động</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* CÁC BÀI VIẾT BỔ SUNG (NẾU CÒN) TRÌNH BÀY DẠNG 3 CỘT GỌN GÀNG */}
              {filteredActivityPosts.length > 4 && (
                <div className="pt-6 border-t border-slate-200">
                  <h4 className="text-xs uppercase font-extrabold tracking-widest text-slate-500 mb-4">
                    Bài viết lưu trữ khác ({filteredActivityPosts.length - 4})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {filteredActivityPosts.slice(4).map((post) => (
                      <Link
                        key={post.id}
                        href={`/hoat-dong/${post.id}`}
                        className="group bg-white rounded-xl overflow-hidden border border-slate-200 hover:border-[#17488c] shadow-sm hover:shadow-md transition flex flex-col justify-between p-5"
                      >
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                            <span className="font-bold uppercase text-[#17488c]">
                              {post.categoryLabel}
                            </span>
                            <span>{post.publishedDate}</span>
                          </div>
                          <h5 className="font-display font-bold uppercase text-sm sm:text-base text-slate-900 group-hover:text-[#17488c] transition line-clamp-2">
                            {post.title}
                          </h5>
                          <p className="mt-2 text-xs text-slate-600 line-clamp-2 font-light">
                            {post.summary}
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#17488c]">
                          <span>Xem chi tiết</span>
                          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ===================== CẦU THỦ NÒNG CỐT 23+ (BROADCAST SQUAD ROSTER) ===================== */}
      <section
        id="squad-section"
        className="relative bg-gradient-to-b from-[#092244] via-[#071933] to-[#092244] py-20 sm:py-28 overflow-hidden border-y border-[#d4af37]/20"
      >
        <div className={WRAP}>
          <Reveal>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-8 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#d4af37] bg-[#d4af37]/15 px-2.5 py-1 rounded border border-[#d4af37]/30">
                    03 // ĐỘI HÌNH &amp; HỒ SƠ 23+ CẦU THỦ
                  </span>
                  <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400">
                    ROSTER 2026
                  </span>
                </div>
                <h2 className="mt-3 font-display font-black uppercase leading-tight text-4xl sm:text-6xl text-white">
                  Đội hình <span className="text-[#d4af37]">23+ chiến binh</span>
                </h2>
                <p className="text-xs sm:text-sm text-sky-200 mt-2 max-w-2xl leading-relaxed font-light">
                  Bảng danh sách đăng ký thi đấu chính thức mùa giải 2026. Chọn cầu thủ bên danh sách để xem thẻ vận động viên và hồ sơ chuyên sâu.
                </p>
              </div>

              {/* Thông số nhanh */}
              <div className="flex items-center gap-3">
                <div className="bg-[#051426] px-5 py-3 rounded-lg border border-[#d4af37]/40 shadow-sm text-right">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
                    Đội hình chính thức
                  </span>
                  <span className="text-2xl font-display font-black text-[#fde047] leading-none">
                    {activePlayers.length}+ Cầu thủ
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* BỐ CỤC 50/50: 1/2 TRÁI PHÓNG TO CHI TIẾT - 1/2 PHẢI THU NHỎ XẾP GỌN */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* CỘT 1/2 BÊN TRÁI: CHI TIẾT CẦU THỦ ĐƯỢC CHỌN */}
            <div className="lg:col-span-6 lg:sticky lg:top-24">
              <Reveal>
                <ExpandedPlayerDetail
                  player={selectedPlayer}
                  attendances={data.attendances}
                  onOpenImage={handleOpenLightbox}
                />
              </Reveal>
            </div>

            {/* CỘT 1/2 BÊN PHẢI: TEAM SHEET ROSTER */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-xl bg-[#061830] border border-white/10 p-4 sm:p-5 shadow-xl space-y-4">
                {/* Thanh tìm kiếm & lọc */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {/* Ô tìm kiếm */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-300/70" />
                    <input
                      type="text"
                      value={playerSearchQuery}
                      onChange={(e) => setPlayerSearchQuery(e.target.value)}
                      placeholder="Tìm theo tên, số áo, vị trí..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#092244] border border-white/15 text-white placeholder-sky-200/50 text-xs focus:outline-none focus:border-[#d4af37] transition"
                    />
                    {playerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setPlayerSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sky-200 hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-[#092244] border border-white/10 text-xs font-bold uppercase tracking-wider shrink-0">
                    {(
                      [
                        ["all", "Tất cả"],
                        ["manager", "BQL"],
                        ["player", "Cầu thủ"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSquadFilter(key)}
                        className={`px-3 py-1.5 rounded transition cursor-pointer ${squadFilter === key
                            ? "bg-[#d4af37] text-slate-950 font-black shadow-sm"
                            : "text-sky-200 hover:text-white"
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1 border-t border-white/10">
                  <span>
                    Hiển thị: <strong className="text-[#fde047]">{displayedSquad.length}</strong> cầu thủ
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Chọn cầu thủ để xem hồ sơ bên trái
                  </span>
                </div>
              </div>

              {/* Danh sách cuộn thu nhỏ */}
              <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1 gn-hide-scroll">
                {displayedSquad.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-[#061830] border border-white/10 text-slate-400 text-sm">
                    Không tìm thấy cầu thủ nào phù hợp với &ldquo;{playerSearchQuery}&rdquo;
                  </div>
                ) : (
                  displayedSquad.map((p) => (
                    <CompactPlayerRow
                      key={p.id}
                      player={p}
                      isSelected={selectedPlayer?.id === p.id}
                      onSelect={() => setSelectedPlayerId(p.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== HƯỚNG ĐẾN TẤT CẢ ANH EM GÒ NỔI (GIA NHẬP ĐỘI BÓNG) ===================== */}
      <section
        id="join-us"
        className="relative bg-gradient-to-b from-[#061830] via-[#092244] to-[#061830] py-20 sm:py-28 text-white overflow-hidden border-y border-white/10"
      >
        <span
          aria-hidden="true"
          className="absolute -right-6 top-1/2 -translate-y-1/2 font-display font-black text-[24vw] leading-none text-white/[0.02] select-none whitespace-nowrap pointer-events-none"
        >
          GO NOI FC
        </span>

        <div className={WRAP}>
          <Reveal>
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#d4af37] bg-[#d4af37]/15 px-2.5 py-1 rounded border border-[#d4af37]/30">
                  04 // KẾT NỐI ĐỒNG HƯƠNG
                </span>
                <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400">
                  ĐIỆN QUANG • ĐIỆN TRUNG • ĐIỆN PHONG
                </span>
              </div>
              <h2 className="font-display font-black uppercase leading-tight text-4xl sm:text-6xl lg:text-7xl text-white">
                Mở rộng cửa đón
                <br />
                <span className="text-[#d4af37]">anh em Gò Nổi</span>
              </h2>
              <p className="mt-4 text-base sm:text-lg text-sky-100 font-light leading-relaxed">
                Mục tiêu xuyên suốt của FC HĐH Gò Nổi là <strong className="text-[#fde047] font-semibold">quy tụ và chào đón tất cả anh em con em quê hương Gò Nổi</strong> đang sinh sống, học tập và làm việc tại TP.HCM cùng tề tựu trên sân cỏ.
              </p>
            </div>

            {/* 4 Trụ cột cam kết chào đón anh em (Athletic Technical Index) */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="rounded-xl bg-[#041224] p-6 border border-white/10 hover:border-[#d4af37]/60 shadow-lg transition group">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display font-black text-2xl text-[#d4af37]">
                    01
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                    QUY MÔ
                  </span>
                </div>
                <h3 className="font-display font-bold uppercase text-lg text-white mb-2 group-hover:text-[#d4af37] transition">
                  23+ Cầu thủ nòng cốt
                </h3>
                <p className="text-xs sm:text-sm text-sky-200/80 leading-relaxed font-light">
                  Đội bóng đã quy tụ hơn 23 anh em từ các thế hệ và luôn mở rộng đón nhận thêm thành viên mới mỗi tuần mà không giới hạn số lượng.
                </p>
              </div>

              <div className="rounded-xl bg-[#041224] p-6 border border-white/10 hover:border-emerald-500/60 shadow-lg transition group">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display font-black text-2xl text-emerald-400">
                    02
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                    CƠ HỘI
                  </span>
                </div>
                <h3 className="font-display font-bold uppercase text-lg text-white mb-2 group-hover:text-emerald-300 transition">
                  Ai cũng được ra sân
                </h3>
                <p className="text-xs sm:text-sm text-sky-200/80 leading-relaxed font-light">
                  Chỉ cần bạn yêu bóng đá và mang trong mình nhiệt huyết quê hương. Đội luôn tạo điều kiện xoay tua để mọi anh em đều được đá và toả sáng.
                </p>
              </div>

              <div className="rounded-xl bg-[#041224] p-6 border border-white/10 hover:border-sky-400/60 shadow-lg transition group">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display font-black text-2xl text-sky-400">
                    03
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                    NGHĨA TÌNH
                  </span>
                </div>
                <h3 className="font-display font-bold uppercase text-lg text-white mb-2 group-hover:text-sky-300 transition">
                  Gắn kết đồng hương
                </h3>
                <p className="text-xs sm:text-sm text-sky-200/80 leading-relaxed font-light">
                  Sau 90 phút trên sân cỏ là những câu chuyện quê nhà, hỗ trợ nhau trong công việc, nghề nghiệp và cuộc sống tại đất Sài Gòn.
                </p>
              </div>

              <div className="rounded-xl bg-[#041224] p-6 border border-white/10 hover:border-[#fde047]/60 shadow-lg transition group">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display font-black text-2xl text-[#fde047]">
                    04
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                    QUẢN TRỊ
                  </span>
                </div>
                <h3 className="font-display font-bold uppercase text-lg text-white mb-2 group-hover:text-[#fde047] transition">
                  Minh bạch &amp; Bài bản
                </h3>
                <p className="text-xs sm:text-sm text-sky-200/80 leading-relaxed font-light">
                  Hệ thống website quản lý hiện đại: quỹ thu chi công khai từng đồng, điểm danh trực tuyến và thông báo lịch đấu rõ ràng hàng tuần.
                </p>
              </div>
            </div>

            {/* Khung hành động & Ban Quản Lý */}
            <div className="mt-10 rounded-xl bg-[#041224] p-6 sm:p-8 border border-[#d4af37]/40 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 shadow-2xl">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#d4af37] block mb-1">
                  BẠN LÀ NGƯỜI CON GÒ NỔI TẠI TP.HCM?
                </span>
                <h3 className="font-display font-black uppercase text-2xl sm:text-3xl text-white">
                  Hãy xách giày và ra sân cùng anh em ngay tuần này!
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-sky-200 max-w-xl font-light">
                  Liên hệ ngay với Ban Điều Hành đội bóng hoặc gửi tin nhắn qua Fanpage để được xếp đội và tham gia buổi tập / giao hữu gần nhất.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-sky-200">
                  <span className="font-semibold text-white">Ban Điều Hành:</span>
                  <span className="rounded bg-white/5 px-2.5 py-0.5 border border-white/10">
                    Nguyễn Thế Tiếng (Đội trưởng)
                  </span>
                  <span className="rounded bg-white/5 px-2.5 py-0.5 border border-white/10">
                    Hồ Viết Tín (Đội phó)
                  </span>
                  <span className="rounded bg-white/5 px-2.5 py-0.5 border border-white/10">
                    Dương Hiển Hoài Sơn (BQL)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <a
                  href={fanpageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#e6c466] hover:from-[#e6c466] hover:to-[#f5d97f] text-slate-950 font-black px-6 py-3.5 text-xs uppercase tracking-wider transition shadow-lg cursor-pointer"
                >
                  <span>Nhắn Fanpage Tham Gia</span>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/30 hover:bg-white hover:text-slate-950 text-white font-bold px-6 py-3.5 text-xs uppercase tracking-wider transition cursor-pointer"
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
      <section className="bg-white text-slate-900 py-20 sm:py-28">
        <div className={WRAP}>
          <Reveal>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 pb-6 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#17488c] bg-[#17488c]/10 px-2.5 py-1 rounded border border-[#17488c]/20">
                    05 // KẾT QUẢ &amp; LỊCH THI ĐẤU
                  </span>
                  <span className="text-xs uppercase font-extrabold tracking-widest text-slate-500">
                    BÓNG LĂN MỖI TUẦN
                  </span>
                </div>
                <h2 className="mt-3 font-display font-black uppercase leading-tight text-4xl sm:text-6xl">
                  Lịch đấu <span className="text-[#17488c]">&amp; kết quả</span>
                </h2>
              </div>
              <div className="flex gap-4 text-xs font-black uppercase tracking-wider">
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
                    className={`px-4 py-2 rounded-md border transition cursor-pointer ${matchTab === key
                        ? "bg-[#17488c] text-white border-[#17488c] shadow-sm"
                        : "bg-white text-slate-600 border-slate-300 hover:text-slate-900"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
            {matchRows.length === 0 && (
              <p className="py-12 text-center text-slate-500 italic text-sm">
                Chưa có lịch mới. Ban điều hành đang chốt kèo giao hữu tiếp theo!
              </p>
            )}
            {matchRows.map((m) => (
              <div
                key={m.id}
                className="group grid grid-cols-1 md:grid-cols-[200px_1fr_auto] items-center gap-3 md:gap-8 py-5 hover:bg-slate-50 px-2 sm:px-4 transition-all rounded-lg"
              >
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <div className="text-[#17488c] font-black">{m.label}</div>
                  <div className="text-slate-400 mt-0.5">
                    {formatDateVN(m.match_date)}
                    {m.kickoff_time ? ` • ${m.kickoff_time}` : ""}
                  </div>
                </div>
                <div className="font-display font-black uppercase text-2xl sm:text-3xl leading-none flex flex-wrap items-center gap-x-3">
                  <span className="text-slate-900">FC Gò Nổi</span>
                  {matchTab === "results" ? (
                    <span className="text-[#17488c] px-2 py-0.5 rounded bg-slate-100 font-black">
                      {m.team_score ?? 0} - {m.opponent_score ?? 0}
                    </span>
                  ) : (
                    <span className="text-slate-300 text-lg">vs</span>
                  )}
                  <span className="text-slate-600">{m.opponent}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-[#d4af37]" />
                    {m.venue}
                  </span>
                  {matchTab === "fixtures" && (
                    <button
                      type="button"
                      onClick={onOpenLogin}
                      className="font-bold uppercase tracking-wider text-[#17488c] hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>Điểm danh</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== KHOẢNH KHẮC & HÌNH ẢNH WEBP ===================== */}
      <section id="gallery" className="bg-[#061830]">
        <div className={`${WRAP} pt-20 sm:pt-28 pb-10`}>
          <Reveal>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#d4af37] bg-[#d4af37]/15 px-2.5 py-1 rounded border border-[#d4af37]/30">
                06 // TƯ LIỆU SÂN CỎ
              </span>
              <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400">
                HÌNH ẢNH THỰC TẾ
              </span>
            </div>
            <h2 className="mt-3 font-display font-black uppercase leading-tight text-4xl sm:text-6xl lg:text-7xl text-white">
              Khoảnh khắc <span className="text-[#d4af37]">của đội</span>
            </h2>
          </Reveal>
        </div>

        {/* Gallery WebP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 auto-rows-[220px] sm:auto-rows-[300px] gap-1">
          {MOSAIC.map((img, i) => {
            const mosaicLightboxImages: LightboxImage[] = MOSAIC.map((m) => ({
              src: m.src,
              title: m.title,
              caption: `Khoảnh khắc FC HĐH Gò Nổi • ${m.title}`,
              tag: m.tag,
            }));

            return (
              <figure
                key={i}
                onClick={() => handleOpenLightbox(mosaicLightboxImages, i)}
                className={`relative overflow-hidden group ${img.span} cursor-pointer`}
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
                  <span className="text-xs text-sky-200/80 opacity-0 group-hover:opacity-100 transition mt-1.5 flex items-center gap-1.5">
                    <Camera className="h-3 w-3 text-[#d4af37]" />
                    <span>Nhấp để phóng to toàn màn hình</span>
                  </span>
                </figcaption>
              </figure>
            );
          })}
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

      {/* Lightbox phóng to ảnh đa năng */}
      <ImageLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        onNavigate={setLightboxIndex}
      />

      {/* Modal Xuất Bảng Điểm Danh Ra Sân Tuần Này */}
      {nextMatch && (
        <MatchdayRosterPosterModal
          isOpen={posterModalOpen}
          onClose={() => setPosterModalOpen(false)}
          match={nextMatch}
          attendances={data.attendances || []}
          players={data.players || []}
        />
      )}
    </div>
  );
}
