"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  MapPin,
  ExternalLink,
  LogIn,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Flame,
  Trophy,
  Beer,
  Wallet,
  Camera,
  HeartHandshake,
} from "lucide-react";
import type { FullAppData, Player } from "@/types/app";
import {
  FANPAGE_URL,
  OFFICIAL_LOGO_URL,
  OFFICIAL_COVER_URL,
} from "@/types/app";
import { formatDateVN } from "@/lib/format";

interface PublicGuestPortalProps {
  data: FullAppData;
  onOpenLogin: () => void;
}

const WRAP = "mx-auto w-full max-w-[1600px] px-5 sm:px-10 lg:px-16";

const MOSAIC = [
  {
    src: OFFICIAL_COVER_URL,
    title: "Anh em Gò Nổi ra sân cuối tuần",
    tag: "Tập thể",
    span: "sm:col-span-2 sm:row-span-2",
  },
  {
    src: "/uploads/avatars/member-10.jpg",
    title: "Đá hết mình, cười hết cỡ",
    tag: "Ra sân",
    span: "",
  },
  {
    src: "/uploads/avatars/member-5.jpg",
    title: "Giao lưu đồng hương Điện Bàn",
    tag: "Giao hữu",
    span: "",
  },
  {
    src: "/uploads/avatars/member-13.jpg",
    title: "Mồ hôi trên sân, tình nghĩa ngoài sân",
    tag: "Tình anh em",
    span: "sm:col-span-2",
  },
];

const ACTIVITIES = [
  {
    icon: Flame,
    title: "Đá phủi cuối tuần",
    text: "Sân 7, sân 11, mưa hay nắng anh em vẫn có mặt. Đá cho đã, về còn kể chuyện.",
  },
  {
    icon: Trophy,
    title: "Giao hữu & giải phong trào",
    text: "Kết nối các đội đồng hương và CLB bạn, đá nghiêm túc nhưng luôn vui vẻ, fair-play.",
  },
  {
    icon: Beer,
    title: "Sau trận là nghĩa tình",
    text: "Ly nước, tô hủ tiếu, vài câu chuyện quê nhà. Đá xong mới thấy nhà gần ngay đây.",
  },
  {
    icon: Wallet,
    title: "Quỹ đội minh bạch",
    text: "Thu chi sân bãi, tiền nước ghi rõ từng trận. Cầu thủ đăng nhập là xem được.",
  },
  {
    icon: Camera,
    title: "Khoảnh khắc & kỷ niệm",
    text: "Ảnh tập thể, pha bóng đẹp, cú sút lệch cột dọc. Tất cả lên Fanpage cho cả xóm cười.",
  },
  {
    icon: HeartHandshake,
    title: "Hướng về quê hương",
    text: "Gắn kết đồng hương Điện Quang, Điện Trung, Điện Phong, sẻ chia khi anh em cần.",
  },
];

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

export function PublicGuestPortal({
  data,
  onOpenLogin,
}: PublicGuestPortalProps) {
  const { settings, matches, players } = data;
  const fanpageUrl = settings.fanpage_url || FANPAGE_URL;
  const encodedFanpage = encodeURIComponent(fanpageUrl);

  const [scrolled, setScrolled] = useState(false);
  const [matchTab, setMatchTab] = useState<"fixtures" | "results">("fixtures");
  const [squadFilter, setSquadFilter] = useState<"all" | "manager" | "player">(
    "all"
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  const go = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const navLinks = [
    { id: "banner-hero", label: "Trang chủ" },
    { id: "match-center", label: "Lịch đấu" },
    { id: "activities", label: "Hoạt động" },
    { id: "squad-section", label: "Cầu thủ" },
    { id: "gallery", label: "Khoảnh khắc" },
  ];

  const ticker = [
    "Đá phủi hết mình",
    "Đoàn kết • Bản lĩnh • Nghĩa tình",
    "Gò Nổi tại Sài Gòn",
    "Đá xong là anh em",
  ];

  const matchRows = matchTab === "fixtures" ? upcomingMatches : pastMatches.slice(0, 8);

  return (
    <div className="w-full font-sans text-white overflow-x-clip">
      {/* ===================== HEADER (toàn chiều rộng) ===================== */}
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
          scrolled
            ? "bg-[#050e20]/90 backdrop-blur-md py-2.5 border-b border-white/10"
            : "bg-transparent py-5"
        }`}
      >
        <div className={`${WRAP} flex items-center justify-between gap-4`}>
          <button
            type="button"
            onClick={() => go("banner-hero")}
            className="flex items-center gap-3 cursor-pointer"
            aria-label="Về đầu trang"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_LOGO_URL}
              alt="Logo FC HĐH Gò Nổi"
              className="h-11 w-11 rounded-full object-contain bg-white p-0.5 ring-2 ring-[#ffc933]"
            />
            <span className="font-display font-extrabold uppercase text-2xl tracking-wide leading-none hidden sm:block">
              FC HĐH Gò Nổi
            </span>
          </button>

          <nav
            aria-label="Điều hướng trang khách"
            className="hidden lg:flex items-center gap-8 text-[13px] uppercase font-bold tracking-[0.18em] text-white/80"
          >
            {navLinks.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => go(l.id)}
                className="hover:text-[#ffc933] cursor-pointer"
              >
                {l.label}
              </button>
            ))}
            <a
              href={fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#ffc933] inline-flex items-center gap-1"
            >
              Fanpage <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </nav>

          <button
            type="button"
            onClick={onOpenLogin}
            className="inline-flex items-center gap-2 bg-[#ffc933] hover:bg-white text-slate-950 font-black px-5 sm:px-6 py-3 text-xs sm:text-sm uppercase tracking-widest cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            Đăng nhập
          </button>
        </div>
      </header>

      {/* ===================== HERO TOÀN MÀN HÌNH ===================== */}
      <section
        id="banner-hero"
        className="relative min-h-[100svh] flex flex-col justify-end overflow-hidden"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={OFFICIAL_COVER_URL}
          alt="Tập thể FC HĐH Gò Nổi tại TP.HCM"
          className="absolute inset-0 h-full w-full object-cover object-center gn-kenburns"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#050e20] via-[#050e20]/55 to-[#050e20]/30"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#0a2d7a]/70 via-transparent to-transparent"
        />

        <div className={`${WRAP} relative z-10 pt-40 pb-14 sm:pb-20`}>
          <p className="font-bold uppercase tracking-[0.35em] text-xs sm:text-sm text-[#ffc933] mb-4">
            Bóng đá phủi • Đồng hương Gò Nổi • TP.HCM
          </p>
          <h1 className="font-display font-extrabold uppercase leading-[0.82] tracking-tight">
            <span className="block text-[22vw] sm:text-[17vw] lg:text-[13.5rem]">
              Đá phủi
            </span>
            <span className="block text-[22vw] sm:text-[17vw] lg:text-[13.5rem] text-transparent [-webkit-text-stroke:3px_#ffc933]">
              Hết mình
            </span>
          </h1>

          <div className="mt-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <p className="max-w-xl text-lg sm:text-xl text-white/85 leading-relaxed">
              Những người con Điện Quang, Điện Trung, Điện Phong xa quê cùng
              chung một niềm vui: ra sân, đá cho đã, cười cho thoả và về nhà
              đầy năng lượng.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-3 bg-[#0D5EF4] hover:bg-[#2f7bff] text-white font-black px-8 py-5 text-sm uppercase tracking-widest cursor-pointer"
              >
                Vào khu thành viên <ArrowRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => go("squad-section")}
                className="inline-flex items-center gap-3 border-2 border-white/70 hover:bg-white hover:text-slate-950 font-black px-8 py-[18px] text-sm uppercase tracking-widest cursor-pointer"
              >
                Gặp anh em
              </button>
            </div>
          </div>

          {/* Số liệu thật */}
          <dl className="mt-14 flex flex-wrap gap-x-14 gap-y-6 border-t border-white/20 pt-8">
            {[
              { n: activePlayers.length, l: "Cầu thủ" },
              { n: matches.length, l: "Trận đã lên lịch" },
              { n: wins, l: "Trận thắng" },
            ].map((s) => (
              <div key={s.l}>
                <dd className="font-display text-6xl sm:text-7xl font-extrabold text-[#ffc933] leading-none">
                  {s.n}
                </dd>
                <dt className="mt-1 text-xs font-bold uppercase tracking-[0.25em] text-white/70">
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
          className="absolute right-6 sm:right-12 bottom-36 hidden sm:flex flex-col items-center gap-2 text-white/70 hover:text-[#ffc933] text-[11px] uppercase tracking-[0.3em] cursor-pointer [writing-mode:vertical-rl]"
        >
          Cuộn
          <ChevronDown className="h-4 w-4 gn-float" />
        </button>

        {/* Dải chữ chạy */}
        <div className="relative z-10 bg-[#ffc933] text-slate-950 overflow-hidden">
          <div className="gn-marquee flex w-max gap-12 py-3 font-display font-extrabold uppercase text-lg tracking-[0.2em]">
            {[...ticker, ...ticker, ...ticker, ...ticker].map((t, i) => (
              <span key={i} className="inline-flex items-center gap-12">
                {t}
                <span aria-hidden="true">⚽</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== TRẬN TÂM ĐIỂM (band tràn lề) ===================== */}
      {nextMatch && (
        <section
          id="match-center"
          className="relative bg-gradient-to-br from-[#0a2d7a] via-[#0D5EF4] to-[#0a2d7a] py-20 sm:py-28 overflow-hidden"
        >
          <span
            aria-hidden="true"
            className="absolute -left-4 top-1/2 -translate-y-1/2 font-display font-extrabold text-[28vw] leading-none text-white/[0.06] select-none whitespace-nowrap"
          >
            MATCH DAY
          </span>
          <div className={`${WRAP} relative`}>
            <Reveal>
              <p className="text-[#ffc933] font-bold uppercase tracking-[0.35em] text-xs sm:text-sm">
                Trận cầu tâm điểm • {nextMatch.label} • {nextMatch.status}
              </p>
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-6 lg:gap-14">
                <h2 className="font-display font-extrabold uppercase leading-[0.85] text-6xl sm:text-8xl lg:text-9xl lg:text-right">
                  FC Gò Nổi
                </h2>

                {nextMatch.team_score !== null &&
                nextMatch.opponent_score !== null ? (
                  <div className="font-display font-extrabold text-7xl sm:text-9xl text-[#ffc933] leading-none text-center">
                    {nextMatch.team_score}
                    <span className="mx-3 text-white/40">:</span>
                    {nextMatch.opponent_score}
                  </div>
                ) : (
                  <div className="font-display font-extrabold text-7xl sm:text-9xl text-[#ffc933] leading-none text-center">
                    VS
                  </div>
                )}

                <h2 className="font-display font-extrabold uppercase leading-[0.85] text-6xl sm:text-8xl lg:text-9xl text-white/90">
                  {nextMatch.opponent}
                </h2>
              </div>

              <div className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-white/25 pt-6">
                <div className="flex flex-wrap items-center gap-x-10 gap-y-2 text-lg font-semibold">
                  <span>
                    {nextMatch.kickoff_time} • {formatDateVN(nextMatch.match_date)}
                  </span>
                  <span className="inline-flex items-center gap-2 text-white/85">
                    <MapPin className="h-5 w-5 text-[#ffc933]" />
                    {nextMatch.venue}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="inline-flex items-center gap-3 bg-[#ffc933] hover:bg-white text-slate-950 font-black px-7 py-4 text-sm uppercase tracking-widest cursor-pointer"
                >
                  Đăng nhập để điểm danh <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ===================== HOẠT ĐỘNG (danh sách mở, không khung) ===================== */}
      <section
        id="activities"
        className="bg-[#f6f1e4] text-[#0b1a33] py-24 sm:py-32"
      >
        <div className={`${WRAP} grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20`}>
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-32">
              <Reveal>
                <p className="text-[#0D5EF4] font-bold uppercase tracking-[0.35em] text-xs sm:text-sm">
                  Sống trọn niềm vui
                </p>
                <h2 className="mt-4 font-display font-extrabold uppercase leading-[0.85] text-7xl sm:text-8xl lg:text-9xl">
                  Hoạt động
                  <span className="block text-[#0D5EF4]">anh em</span>
                </h2>
                <p className="mt-6 max-w-md text-lg text-slate-600 leading-relaxed">
                  Không chỉ là đá bóng. Đây là nơi gặp gỡ, tiếp thêm năng lượng
                  và giữ lửa tình đồng hương.
                </p>
              </Reveal>
            </div>
          </div>

          <ol className="lg:col-span-7 divide-y divide-[#0b1a33]/15 border-y border-[#0b1a33]/15">
            {ACTIVITIES.map((a, i) => {
              const Icon = a.icon;
              return (
                <li key={a.title}>
                  <Reveal delay={(i % 3) * 60}>
                    <div className="group flex items-start gap-5 sm:gap-8 py-8 sm:py-10 hover:pl-3 transition-all duration-300">
                      <span className="font-display font-extrabold text-5xl sm:text-6xl text-transparent [-webkit-text-stroke:1.5px_#0b1a33] group-hover:text-[#ffc933] group-hover:[-webkit-text-stroke:1.5px_#ffc933] transition w-16 sm:w-24 shrink-0 leading-none">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1">
                        <h3 className="font-display font-extrabold uppercase text-3xl sm:text-5xl leading-none group-hover:text-[#0D5EF4] transition">
                          {a.title}
                        </h3>
                        <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                          {a.text}
                        </p>
                      </div>
                      <Icon className="h-9 w-9 text-[#0D5EF4] opacity-30 group-hover:opacity-100 group-hover:rotate-12 transition shrink-0 hidden sm:block" />
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ===================== CẦU THỦ (cuộn ngang tràn lề) ===================== */}
      <section
        id="squad-section"
        className="relative bg-[#050e20] py-24 sm:py-32 overflow-hidden"
      >
        <div className={WRAP}>
          <Reveal>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
              <div>
                <p className="text-[#ffc933] font-bold uppercase tracking-[0.35em] text-xs sm:text-sm">
                  Những chiến binh sân cỏ
                </p>
                <h2 className="mt-4 font-display font-extrabold uppercase leading-[0.85] text-7xl sm:text-8xl lg:text-9xl">
                  Gặp gỡ <span className="text-[#ffc933]">anh em</span>
                </h2>
              </div>
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
                    className={`pb-1 border-b-2 cursor-pointer ${
                      squadFilter === key
                        ? "text-[#ffc933] border-[#ffc933]"
                        : "text-white/60 border-transparent hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        <div className="mt-14 flex gap-1 overflow-x-auto snap-x snap-mandatory pb-6 px-5 sm:px-10 lg:px-16 gn-hide-scroll">
          {squad.map((p) => (
            <article
              key={p.id}
              className="group relative snap-start shrink-0 w-[72vw] sm:w-[340px] lg:w-[380px] h-[520px] sm:h-[600px] overflow-hidden bg-[#0a2d7a]"
            >
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.avatar_url}
                  alt={p.full_name}
                  className="absolute inset-0 h-full w-full object-cover object-top grayscale-[35%] group-hover:grayscale-0 group-hover:scale-105 transition duration-700"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#0D5EF4] to-[#050e20]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#050e20] via-[#050e20]/30 to-transparent" />
              <span
                aria-hidden="true"
                className="absolute -top-4 right-3 font-display font-extrabold text-[11rem] leading-none text-transparent [-webkit-text-stroke:2px_rgba(255,201,51,0.9)] group-hover:text-[#ffc933]/25 transition"
              >
                {p.jersey_number ?? ""}
              </span>
              <div className="absolute inset-x-0 bottom-0 p-6">
                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#ffc933]">
                  {p.access_role === "manager"
                    ? "Ban điều hành"
                    : p.position || "Cầu thủ"}
                </span>
                <h3 className="font-display font-extrabold uppercase text-5xl leading-none mt-1 truncate">
                  {p.short_name || p.full_name}
                </h3>
                <p className="text-sm text-white/60 truncate mt-1">
                  {p.full_name}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className={`${WRAP} mt-8 flex items-center justify-between gap-4`}>
          <span className="text-xs uppercase tracking-[0.3em] text-white/50">
            Vuốt ngang để xem thêm →
          </span>
          <button
            type="button"
            onClick={onOpenLogin}
            className="inline-flex items-center gap-3 text-[#ffc933] hover:text-white font-black text-sm uppercase tracking-widest cursor-pointer"
          >
            Đăng nhập thành viên <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* ===================== LỊCH & KẾT QUẢ (bảng mở) ===================== */}
      <section className="bg-white text-[#0b1a33] py-24 sm:py-32">
        <div className={WRAP}>
          <Reveal>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div>
                <p className="text-[#0D5EF4] font-bold uppercase tracking-[0.35em] text-xs sm:text-sm">
                  Bóng lăn mỗi tuần
                </p>
                <h2 className="mt-4 font-display font-extrabold uppercase leading-[0.85] text-7xl sm:text-8xl">
                  Lịch đấu <span className="text-[#0D5EF4]">& kết quả</span>
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
                    className={`pb-1 border-b-2 cursor-pointer ${
                      matchTab === key
                        ? "text-[#0D5EF4] border-[#0D5EF4]"
                        : "text-slate-400 border-transparent hover:text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="mt-12 border-t-2 border-[#0b1a33]">
            {matchRows.length === 0 && (
              <p className="py-14 text-slate-500 italic">
                Chưa có lịch mới. Ban điều hành đang chốt kèo trận tiếp theo!
              </p>
            )}
            {matchRows.map((m) => (
              <div
                key={m.id}
                className="group grid grid-cols-1 md:grid-cols-[200px_1fr_auto] items-center gap-3 md:gap-8 py-6 border-b border-slate-200 hover:bg-[#f6f1e4] hover:px-4 transition-all"
              >
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  <div className="text-[#0D5EF4]">{m.label}</div>
                  <div>
                    {formatDateVN(m.match_date)}
                    {m.kickoff_time ? ` • ${m.kickoff_time}` : ""}
                  </div>
                </div>
                <div className="font-display font-extrabold uppercase text-3xl sm:text-5xl leading-none flex flex-wrap items-center gap-x-4">
                  <span>FC Gò Nổi</span>
                  {matchTab === "results" ? (
                    <span className="text-[#0D5EF4]">
                      {m.team_score ?? 0} - {m.opponent_score ?? 0}
                    </span>
                  ) : (
                    <span className="text-slate-300">vs</span>
                  )}
                  <span className="text-slate-600">{m.opponent}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600">
                    <MapPin className="h-4 w-4 text-rose-500" />
                    {m.venue}
                  </span>
                  {matchTab === "fixtures" && (
                    <button
                      type="button"
                      onClick={onOpenLogin}
                      className="font-black uppercase tracking-widest text-[#0D5EF4] hover:underline cursor-pointer"
                    >
                      Điểm danh
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== KHOẢNH KHẮC (mosaic sát mép) ===================== */}
      <section id="gallery" className="bg-[#050e20]">
        <div className={`${WRAP} pt-24 sm:pt-32 pb-12`}>
          <Reveal>
            <p className="text-[#ffc933] font-bold uppercase tracking-[0.35em] text-xs sm:text-sm">
              Sân cỏ kể chuyện
            </p>
            <h2 className="mt-4 font-display font-extrabold uppercase leading-[0.85] text-7xl sm:text-8xl lg:text-9xl">
              Khoảnh khắc <span className="text-[#ffc933]">của đội</span>
            </h2>
          </Reveal>
        </div>

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
              <figcaption className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[#050e20]/90 via-transparent to-transparent p-5 opacity-90 group-hover:opacity-100">
                <span className="text-[#ffc933] text-[11px] font-black uppercase tracking-[0.25em]">
                  {img.tag}
                </span>
                <p className="font-display font-extrabold uppercase text-2xl sm:text-3xl leading-none mt-1">
                  {img.title}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>

        {/* Fanpage */}
        <div className="bg-[#0D5EF4]">
          <div
            className={`${WRAP} py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center`}
          >
            <Reveal>
              <h3 className="font-display font-extrabold uppercase leading-[0.85] text-6xl sm:text-8xl">
                Theo dõi <span className="text-[#ffc933]">Fanpage</span>
              </h3>
              <p className="mt-5 max-w-md text-lg text-white/85">
                Ảnh, video và tin nóng của đội cập nhật mỗi tuần. Muốn gia nhập
                thì nhắn thẳng cho anh em nhé!
              </p>
              <a
                href={fanpageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-3 bg-[#ffc933] hover:bg-white text-slate-950 font-black px-7 py-4 text-sm uppercase tracking-widest"
              >
                Mở Facebook <ExternalLink className="h-5 w-5" />
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

      {/* ===================== CTA + FOOTER ===================== */}
      <footer className="relative bg-[#ffc933] text-slate-950 overflow-hidden">
        <div className={`${WRAP} pt-20 sm:pt-28 pb-10`}>
          <Reveal>
            <h2 className="font-display font-extrabold uppercase leading-[0.8] text-[17vw] sm:text-[13vw] lg:text-[11rem]">
              Ra sân cùng
              <br />
              anh em Gò Nổi
            </h2>
            <div className="mt-10 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-3 bg-slate-950 hover:bg-[#0D5EF4] text-white font-black px-8 py-5 text-sm uppercase tracking-widest cursor-pointer"
              >
                <LogIn className="h-5 w-5" />
                Đăng nhập thành viên
              </button>
              <a
                href={fanpageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 border-2 border-slate-950 hover:bg-slate-950 hover:text-white font-black px-8 py-[18px] text-sm uppercase tracking-widest"
              >
                Nhắn Fanpage <ArrowUpRight className="h-5 w-5" />
              </a>
            </div>
          </Reveal>

          <div className="mt-16 pt-6 border-t border-slate-950/25 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm font-semibold">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={OFFICIAL_LOGO_URL}
                alt="Logo FC HĐH Gò Nổi"
                className="h-10 w-10 rounded-full object-contain bg-white p-0.5"
              />
              <span>
                CLB bóng đá đồng hương Gò Nổi (Điện Bàn, Quảng Nam) tại TP. Hồ
                Chí Minh
              </span>
            </div>
            <span>© {new Date().getFullYear()} FC HĐH Gò Nổi</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
