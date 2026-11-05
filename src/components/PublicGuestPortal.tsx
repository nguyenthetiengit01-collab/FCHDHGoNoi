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
  Sparkles,
  Quote,
  Calendar,
  Users,
  CheckCircle2,
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
   BỘ TRỢ GIÚP THÔNG TIN CẦU THỦ
   ========================================================================= */
function getPlayerPositionBadge(player: Player) {
  if (player.access_role === "manager") {
    return {
      label: "Ban Điều Hành / Quản Lý",
      icon: "👑",
      code: "BQL",
      color: "from-[#d4af37] to-[#e6c466]",
    };
  }
  const pos = (player.position || "").toLowerCase();
  if (/thủ môn|gk/i.test(pos)) {
    return {
      label: "Thủ Môn",
      icon: "🧤",
      code: "GK",
      color: "from-[#38bdf8] to-[#0284c7]",
    };
  }
  if (/hậu vệ|cb|lb|rb/i.test(pos)) {
    return {
      label: "Hậu Vệ",
      icon: "🛡️",
      code: "DF",
      color: "from-[#60a5fa] to-[#2563eb]",
    };
  }
  if (/tiền vệ|cm|cdm|cam/i.test(pos)) {
    return {
      label: "Tiền Vệ",
      icon: "🎯",
      code: "MF",
      color: "from-[#818cf8] to-[#4f46e5]",
    };
  }
  return {
    label: player.position || "Tiền Đạo",
    icon: "⚡",
    code: "FW",
    color: "from-[#f59e0b] to-[#d97706]",
  };
}

function getPlayerHamlet(player: Player): string {
  const text = `${player.notes || ""} ${player.bio || ""} ${player.full_name}`;
  if (/điện quang/i.test(text)) return "Điện Quang";
  if (/điện trung/i.test(text)) return "Điện Trung";
  if (/điện phong/i.test(text)) return "Điện Phong";
  return "Gò Nổi";
}

/* =========================================================================
   CHI TIẾT CẦU THỦ PHÓNG TO (1/2 MÀN HÌNH BÊN TRÁI - KHÔNG LẬT NGHIÊNG)
   ========================================================================= */
interface ExpandedPlayerDetailProps {
  player: Player | null;
}

function ExpandedPlayerDetail({ player }: ExpandedPlayerDetailProps) {
  if (!player) return null;

  const posBadge = getPlayerPositionBadge(player);
  const hamlet = getPlayerHamlet(player);
  const displayBio =
    player.bio?.trim() ||
    "Chiến binh nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần fair-play, quyết tâm và gắn kết nghĩa tình đồng hương sâu nặng.";

  return (
    <div className="rounded-3xl overflow-hidden bg-gradient-to-b from-[#103567] via-[#0d2a54] to-[#071933] border-2 border-[#d4af37] shadow-[0_25px_60px_rgba(0,0,0,0.85)] p-5 sm:p-7 space-y-6">
      {/* Top Bar: Số áo lớn + Huy hiệu vị trí + Quê quán */}
      <div className="flex items-center justify-between pb-4 border-b border-white/15">
        <div className="flex items-center gap-3.5">
          <span className="font-display font-black text-5xl sm:text-6xl text-[#d4af37] leading-none drop-shadow-md">
            #{player.jersey_number ?? "--"}
          </span>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-sky-200 block">
              Chiến Binh Nòng Cốt
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-gradient-to-r from-[#17488c] to-[#1e5eb8] text-[#fde047] border border-[#d4af37]/40 mt-1 shadow-sm">
              <span>{posBadge.icon}</span>
              <span>{posBadge.label}</span>
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-200 bg-[#071933]/90 px-3.5 py-1.5 rounded-full border border-white/15 shadow-sm">
            <MapPin className="h-3.5 w-3.5 text-[#d4af37]" />
            <span>Xã {hamlet}</span>
          </span>
        </div>
      </div>

      {/* Ảnh chân dung lớn: Hiển thị ít nhất nửa thân trên, chuẩn chỉnh và nổi bật */}
      <div className="relative w-full aspect-[3/4] max-h-[520px] rounded-2xl overflow-hidden border-2 border-[#d4af37]/60 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_25px_rgba(212,175,55,0.2)] bg-gradient-to-b from-[#133b73] via-[#092244] to-[#051326] flex items-center justify-center">
        {/* Hào quang ánh sáng sân cỏ chiếu sau lưng cầu thủ */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-radial-[circle_at_50%_35%] from-sky-400/20 via-[#0d2a54]/50 to-transparent pointer-events-none"
        />

        {player.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.avatar_url}
            alt={player.full_name}
            className="w-full h-full object-cover object-top filter brightness-105 contrast-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-[#133b73] to-[#071933]">
            <SoccerBallIcon className="h-20 w-20 text-[#d4af37] mb-3 animate-pulse" />
            <span className="font-display font-black text-7xl text-[#d4af37]">
              #{player.jersey_number ?? "-"}
            </span>
            <span className="text-xs uppercase text-sky-200 tracking-widest mt-2">
              Chiến Binh FC HĐH Gò Nổi
            </span>
          </div>
        )}

        {/* Lớp phủ chuyển sắc nhẹ đáy ảnh để tôn thông tin */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#071933] via-[#071933]/50 to-transparent pointer-events-none"
        />

        {/* Số áo in chìm nghệ thuật góc ảnh */}
        <span
          aria-hidden="true"
          className="absolute right-3 bottom-2 font-display font-black text-8xl text-transparent [-webkit-text-stroke:2px_rgba(212,175,55,0.45)] pointer-events-none select-none leading-none drop-shadow-lg"
        >
          {player.jersey_number ?? ""}
        </span>
      </div>

      {/* Thông tin danh tính */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display font-black uppercase text-3xl sm:text-4xl text-white">
            {player.full_name}
          </h3>
          {player.short_name && (
            <span className="text-xl text-[#d4af37] font-bold">
              ({player.short_name})
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-sky-200 mt-1">
          {player.role || "Cầu thủ thi đấu"} • {player.birth_year ? `Năm sinh ${player.birth_year}` : "Thành viên nòng cốt"}
        </p>
      </div>

      {/* 3 Chỉ số phong cách thi đấu */}
      <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-white/10 text-center">
        <div className="bg-[#071933]/90 p-2.5 rounded-xl border border-white/10">
          <span className="text-lg font-display font-bold text-[#fde047] block">98%</span>
          <span className="text-[10px] uppercase font-bold text-sky-200">Nhiệt Huyết</span>
        </div>
        <div className="bg-[#071933]/90 p-2.5 rounded-xl border border-white/10">
          <span className="text-lg font-display font-bold text-[#fde047] block">95%</span>
          <span className="text-[10px] uppercase font-bold text-sky-200">Đá Phủi</span>
        </div>
        <div className="bg-[#071933]/90 p-2.5 rounded-xl border border-white/10">
          <span className="text-lg font-display font-bold text-[#fde047] block">100%</span>
          <span className="text-[10px] uppercase font-bold text-sky-200">Đồng Hương</span>
        </div>
      </div>

      {/* Bài viết tự giới thiệu / Bio */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#071933]/90 border-l-4 border-[#d4af37] border-y border-r border-white/10 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-[#d4af37] uppercase tracking-wider">
          <Quote className="h-3.5 w-3.5" />
          <span>Lời ngỏ của cầu thủ</span>
        </div>
        <p className="text-sm text-sky-100 font-light leading-relaxed italic">
          &ldquo;{displayBio}&rdquo;
        </p>
      </div>

      {/* Ghi chú nếu có */}
      {player.notes && (
        <div className="text-xs text-sky-200/80 bg-white/5 p-3 rounded-xl border border-white/5">
          <strong className="text-[#d4af37]">Ghi chú:</strong> {player.notes}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   THẺ CẦU THỦ THU NHỎ XẾP GỌN (1/2 MÀN HÌNH BÊN PHẢI - KHÔNG LẬT NGHIÊNG)
   ========================================================================= */
interface CompactPlayerRowProps {
  player: Player;
  isSelected: boolean;
  onSelect: () => void;
}

function CompactPlayerRow({ player, isSelected, onSelect }: CompactPlayerRowProps) {
  const posBadge = getPlayerPositionBadge(player);
  const hamlet = getPlayerHamlet(player);

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between p-3 rounded-2xl transition cursor-pointer border ${
        isSelected
          ? "bg-gradient-to-r from-[#17488c] via-[#103567] to-[#0d2a54] border-[#d4af37] ring-2 ring-[#d4af37]/60 shadow-[0_0_20px_rgba(212,175,55,0.3)]"
          : "bg-[#071933]/80 border-white/10 hover:border-[#d4af37]/60 hover:bg-[#0c2850]"
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="relative h-13 w-13 rounded-xl overflow-hidden bg-[#092244] border border-[#d4af37]/50 shrink-0">
          {player.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.avatar_url}
              alt={player.full_name}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs font-bold text-[#d4af37]">
              #{player.jersey_number ?? "-"}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-lg text-[#d4af37] leading-none">
              #{player.jersey_number ?? "--"}
            </span>
            <h4 className="font-display font-bold uppercase text-base text-white truncate">
              {player.short_name || player.full_name}
            </h4>
          </div>
          <p className="text-xs text-slate-400 truncate mt-0.5">
            {player.full_name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/10 text-sky-200">
              {posBadge.code} • {posBadge.label}
            </span>
            <span className="text-[10px] text-slate-400">
              {hamlet}
            </span>
          </div>
        </div>
      </div>

      <div className="text-right shrink-0 pl-2">
        {isSelected ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d4af37] text-slate-950 text-[11px] font-extrabold uppercase tracking-wider shadow-sm">
            <span className="h-2 w-2 rounded-full bg-slate-950 animate-ping" />
            <span>Đang xem</span>
          </span>
        ) : (
          <span className="text-xs font-bold text-sky-200/60 group-hover:text-[#d4af37] transition inline-flex items-center gap-1">
            <span>Chọn</span>
            <ArrowRight className="h-3.5 w-3.5" />
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

  /* Chuyên mục hoạt động */
  const [activeActivityCategory, setActiveActivityCategory] = useState<ActivityCategory>("all");

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

  const filteredActivityPosts = CLUB_ACTIVITIES_POSTS.filter((p) =>
    activeActivityCategory === "all" ? true : p.category === activeActivityCategory
  );

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
                <Link
                  href={`/hoat-dong/${post.id}`}
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
                        Trang riêng →
                      </span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200">
            <p className="text-xs sm:text-sm text-slate-600">
              💡 Ban Quản Lý liên tục cập nhật bài viết mới kèm hình ảnh sau mỗi sự kiện và giải đấu của đội bóng.
            </p>
            <Link
              href="/hoat-dong"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#17488c] to-[#1e5eb8] hover:from-[#103567] hover:to-[#17488c] text-white font-bold text-xs uppercase tracking-wider px-5 py-3 transition shadow-md shrink-0"
            >
              <BookOpen className="h-4 w-4 text-[#fde047]" />
              <span>Xem tất cả bài viết trên trang riêng</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ===================== CẦU THỦ NÒNG CỐT 23+ (CHỌN 1 PHÓNG TO 1/2 MÀN HÌNH - XẾP GỌN 1/2 CÒN LẠI) ===================== */}
      <section
        id="squad-section"
        className="relative bg-gradient-to-b from-[#092244] via-[#0d2e5b] to-[#092244] py-20 sm:py-28 overflow-hidden border-y border-[#d4af37]/20"
      >
        {/* Subtle Pitch Watermark */}
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
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-10 border-b border-white/10">
              <div>
                <p className="text-[#d4af37] font-bold uppercase tracking-[0.35em] text-xs sm:text-sm flex items-center gap-2">
                  <CleatsIcon className="h-4 w-4" />
                  <span>Đội Hình Chiến Binh Gò Nổi • Hồ Sơ Chi Tiết</span>
                </p>
                <h2 className="mt-3 font-display font-bold uppercase leading-[0.88] text-6xl sm:text-7xl lg:text-8xl text-white">
                  Đội hình <span className="text-[#d4af37]">23+ cầu thủ</span>
                </h2>
                <p className="text-sm text-sky-200 mt-2 max-w-2xl leading-relaxed font-light">
                  Bấm vào bất kỳ cầu thủ nào bên phải để phóng to trọn vẹn thông tin, chỉ số và bài viết tự giới thiệu trên 1/2 màn hình bên trái.
                </p>
              </div>

              {/* Thông số nhanh */}
              <div className="flex items-center gap-3">
                <div className="bg-[#071933]/90 px-5 py-3 rounded-2xl border border-[#d4af37]/40 shadow-sm text-right">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-sky-200 block">
                    Đội hình chính thức
                  </span>
                  <span className="text-2xl font-display font-black text-[#fde047] leading-none">
                    {activePlayers.length}+ Chiến binh
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* BỐ CỤC 50/50: 1/2 TRÁI PHÓNG TO CHI TIẾT - 1/2 PHẢI THU NHỎ XẾP GỌN */}
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* CỘT 1/2 BÊN TRÁI: CHI TIẾT CẦU THỦ ĐƯỢC CHỌN (KHÔNG LẬT NGHIÊNG) */}
            <div className="lg:col-span-6 lg:sticky lg:top-24">
              <Reveal>
                <ExpandedPlayerDetail player={selectedPlayer} />
              </Reveal>
            </div>

            {/* CỘT 1/2 BÊN PHẢI: DANH SÁCH THU NHỎ XẾP GỌN */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-3xl bg-[#071933]/90 border border-white/10 p-4 sm:p-5 shadow-xl space-y-4">
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
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#092244] border border-white/15 text-white placeholder-sky-200/50 text-xs focus:outline-none focus:border-[#d4af37] transition"
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
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#092244] border border-white/10 text-xs font-bold uppercase tracking-wider shrink-0">
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
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                          squadFilter === key
                            ? "bg-[#d4af37] text-slate-950 font-black shadow-sm"
                            : "text-sky-200 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-sky-200/80 px-1 pt-1 border-t border-white/10">
                  <span>
                    Hiển thị: <strong className="text-[#fde047]">{displayedSquad.length}</strong> cầu thủ
                  </span>
                  <span className="italic text-[11px]">
                    Bấm thẻ để xem chi tiết bên trái
                  </span>
                </div>
              </div>

              {/* Danh sách cuộn thu nhỏ */}
              <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1 gn-hide-scroll">
                {displayedSquad.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-[#071933]/60 border border-white/10 text-slate-400 text-sm">
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
    </div>
  );
}
