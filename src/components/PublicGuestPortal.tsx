"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Clock,
  MapPin,
  ExternalLink,
  LogIn,
  Trophy,
  Shield,
  ChevronRight,
  Star,
  Users,
  Activity,
  ArrowRight,
  Flame,
  Wallet,
  Camera,
  Beer,
  HeartHandshake,
  Zap,
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

const ACTION_GALLERY = [
  {
    src: OFFICIAL_COVER_URL,
    title: "Anh em Gò Nổi ra sân cuối tuần tại TP.HCM",
    tag: "Tập thể",
  },
  {
    src: "/uploads/avatars/member-10.jpg",
    title: "Tinh thần phủi: đá hết mình, cười hết cỡ",
    tag: "Ra sân",
  },
  {
    src: "/uploads/avatars/member-5.jpg",
    title: "Giao lưu đồng hương Điện Bàn - Gò Nổi",
    tag: "Giao hữu",
  },
  {
    src: "/uploads/avatars/member-13.jpg",
    title: "Mồ hôi trên sân, tình nghĩa ngoài sân",
    tag: "Tình anh em",
  },
];

const ACTIVITIES = [
  {
    icon: Flame,
    title: "Đá phủi cuối tuần",
    text: "Sân 7, sân 11, mưa hay nắng anh em vẫn có mặt. Đá cho đã, về còn kể chuyện.",
    accent: "from-orange-500 to-amber-400",
  },
  {
    icon: Trophy,
    title: "Giao hữu & giải phong trào",
    text: "Kết nối các đội đồng hương và CLB bạn, đá nghiêm túc nhưng luôn vui vẻ, fair-play.",
    accent: "from-sky-500 to-blue-600",
  },
  {
    icon: Beer,
    title: "Sau trận là nghĩa tình",
    text: "Ly nước, tô hủ tiếu, vài câu chuyện quê nhà. Đá xong mới thấy nhà gần ngay đây.",
    accent: "from-emerald-500 to-teal-400",
  },
  {
    icon: Wallet,
    title: "Quỹ đội minh bạch",
    text: "Thu chi sân bãi, tiền nước đều ghi rõ từng trận. Cầu thủ đăng nhập là xem được.",
    accent: "from-yellow-400 to-amber-500",
  },
  {
    icon: Camera,
    title: "Khoảnh khắc & kỷ niệm",
    text: "Ảnh tập thể, pha bóng đẹp, cú sút lệch cột dọc. Tất cả lên Fanpage cho cả xóm cười.",
    accent: "from-pink-500 to-rose-500",
  },
  {
    icon: HeartHandshake,
    title: "Hướng về quê hương",
    text: "Gắn kết đồng hương Điện Quang, Điện Trung, Điện Phong, sẻ chia khi anh em cần.",
    accent: "from-violet-500 to-indigo-500",
  },
];

/** Hiệu ứng hiện dần khi cuộn tới */
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
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        shown
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-6 motion-reduce:opacity-100 motion-reduce:translate-y-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  kicker,
  title,
  desc,
  light = false,
}: {
  kicker: string;
  title: string;
  desc?: string;
  light?: boolean;
}) {
  return (
    <div className="text-center space-y-2 max-w-2xl mx-auto">
      <span className="inline-block text-[11px] font-black uppercase tracking-[0.25em] text-[#ffc933]">
        {kicker}
      </span>
      <h2
        className={`font-display text-4xl sm:text-5xl font-extrabold uppercase leading-none tracking-tight ${
          light ? "text-white" : "text-[#0b1a33]"
        }`}
      >
        {title}
      </h2>
      <div className="flex items-center justify-center gap-2 pt-1">
        <span className="h-1 w-10 rounded-full bg-[#0D5EF4]" />
        <span className="h-1 w-4 rounded-full bg-[#ffc933]" />
      </div>
      {desc && (
        <p
          className={`text-sm sm:text-base ${
            light ? "text-slate-300" : "text-slate-500"
          }`}
        >
          {desc}
        </p>
      )}
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

  const [matchTab, setMatchTab] = useState<"fixtures" | "results">("fixtures");
  const [squadFilter, setSquadFilter] = useState<"all" | "manager" | "player">(
    "all"
  );
  const [showAllSquad, setShowAllSquad] = useState(false);

  const upcomingMatches = matches.filter((m) => m.status === "Sắp diễn ra");
  const pastMatches = matches
    .filter((m) => m.status === "Đã kết thúc")
    .slice()
    .reverse();
  const nextMatch = upcomingMatches[0] || matches[matches.length - 1];

  // Thống kê thật từ dữ liệu
  const wins = pastMatches.filter(
    (m) =>
      m.team_score !== null &&
      m.opponent_score !== null &&
      m.team_score > m.opponent_score
  ).length;

  const activePlayers: Player[] = players.filter(
    (p) => !/nghỉ|rời|ngưng/i.test(p.status || "")
  );
  const filteredSquad = activePlayers
    .filter((p) => (squadFilter === "all" ? true : p.access_role === squadFilter))
    .slice()
    .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999));
  const visibleSquad = showAllSquad ? filteredSquad : filteredSquad.slice(0, 8);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const navLinks: { id: string; label: string }[] = [
    { id: "banner-hero", label: "Trang Chủ" },
    { id: "match-center", label: "Lịch Đấu" },
    { id: "activities", label: "Hoạt Động" },
    { id: "squad-section", label: "Cầu Thủ" },
    { id: "gallery", label: "Khoảnh Khắc" },
  ];

  const tickerItems = [
    "ĐÁ PHỦI HẾT MÌNH",
    "ĐOÀN KẾT • BẢN LĨNH • NGHĨA TÌNH",
    "GÒ NỔI TẠI SÀI GÒN",
    "ĐÁ XONG LÀ ANH EM",
    "FC HĐH GÒ NỔI",
  ];

  return (
    <div className="w-full font-sans text-slate-800 -mt-4 sm:-mt-5 space-y-14 sm:space-y-20">
      {/* ============================ NAV ============================ */}
      <div className="pt-2 sticky top-2 z-30">
        <div className="bg-[#07142b]/95 backdrop-blur rounded-full p-2 sm:p-2.5 shadow-2xl border border-[#ffc933]/30 flex items-center justify-between gap-3 text-white">
          <button
            type="button"
            onClick={() => scrollToSection("banner-hero")}
            className="flex items-center gap-2.5 bg-gradient-to-r from-[#0D5EF4] to-[#2f7bff] pl-1.5 pr-4 sm:pr-5 py-1.5 rounded-full shrink-0 shadow-md cursor-pointer"
            aria-label="Về đầu trang"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_LOGO_URL}
              alt="Logo FC HĐH Gò Nổi"
              className="h-8 w-8 rounded-full object-contain bg-white p-0.5 ring-2 ring-[#ffc933]"
            />
            <span className="font-display font-extrabold uppercase text-base sm:text-lg tracking-wide truncate">
              FC HĐH Gò Nổi
            </span>
          </button>

          <nav
            aria-label="Điều hướng trang khách"
            className="hidden lg:flex items-center gap-1 text-xs uppercase font-bold tracking-wider text-slate-200"
          >
            {navLinks.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => scrollToSection(l.id)}
                className="px-3.5 py-2 rounded-full hover:bg-white/10 hover:text-[#ffc933] transition cursor-pointer"
              >
                {l.label}
              </button>
            ))}
            <a
              href={fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-full hover:bg-white/10 hover:text-[#ffc933] transition inline-flex items-center gap-1"
            >
              <span>Fanpage</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </nav>

          <button
            type="button"
            onClick={onOpenLogin}
            className="inline-flex items-center gap-2 bg-[#ffc933] hover:bg-[#ffd95e] text-slate-950 font-black px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm uppercase tracking-wide shadow-md hover:shadow-[0_0_24px_rgba(255,201,51,0.5)] cursor-pointer shrink-0"
          >
            <LogIn className="h-4 w-4" />
            <span>Đăng Nhập</span>
          </button>
        </div>
      </div>

      {/* ============================ HERO ============================ */}
      <section
        id="banner-hero"
        className="relative rounded-[2rem] overflow-hidden text-white shadow-2xl border border-[#ffc933]/20 bg-[#06122a]"
      >
        {/* Sân cỏ về đêm: vạch sân + ánh đèn */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 15% 0%, rgba(13,94,244,.55) 0%, transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(255,201,51,.22) 0%, transparent 50%), repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 80px, transparent 80px 160px)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-96 w-96 rounded-full border-[3px] border-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute -left-16 bottom-0 h-64 w-64 rounded-full border-[3px] border-[#ffc933]/10"
        />

        {/* Ticker */}
        <div className="relative z-10 bg-[#ffc933] text-slate-950 overflow-hidden border-b-2 border-slate-950/20">
          <div className="gn-marquee flex w-max gap-10 py-2 font-display font-extrabold uppercase text-sm tracking-widest">
            {[...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems].map(
              (t, i) => (
                <span key={i} className="inline-flex items-center gap-10">
                  <span>{t}</span>
                  <span aria-hidden="true">⚽</span>
                </span>
              )
            )}
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 items-center gap-10 px-6 sm:px-12 py-12 sm:py-16">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#ffc933]">
              <Zap className="h-3.5 w-3.5 fill-current" />
              <span>Bóng đá phủi • Đồng hương Gò Nổi • TP.HCM</span>
            </div>

            <h1 className="font-display font-extrabold uppercase leading-[0.9] tracking-tight">
              <span className="block text-6xl sm:text-7xl lg:text-8xl text-white">
                Đá phủi
              </span>
              <span className="block text-6xl sm:text-7xl lg:text-8xl bg-gradient-to-r from-[#ffc933] via-[#ffe38a] to-[#ffc933] bg-clip-text text-transparent">
                Hết mình
              </span>
              <span className="block text-2xl sm:text-3xl mt-3 text-[#6fa8ff] tracking-[0.12em]">
                FC HĐH Gò Nổi
              </span>
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl">
              Những người con Điện Quang, Điện Trung, Điện Phong xa quê cùng
              chung một niềm vui: ra sân, đá cho đã, cười cho thoả và về nhà
              với đầy năng lượng.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-2.5 bg-[#0D5EF4] hover:bg-[#2f7bff] text-white font-black px-7 py-4 rounded-xl text-sm sm:text-base uppercase tracking-wider shadow-[0_10px_30px_rgba(13,94,244,0.45)] hover:-translate-y-0.5 cursor-pointer"
              >
                <LogIn className="h-5 w-5" />
                <span>Vào khu thành viên</span>
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("squad-section")}
                className="inline-flex items-center gap-2 border-2 border-[#ffc933] text-[#ffc933] hover:bg-[#ffc933] hover:text-slate-950 font-black px-6 py-3.5 rounded-xl text-sm sm:text-base uppercase tracking-wider cursor-pointer"
              >
                <Users className="h-5 w-5" />
                <span>Gặp anh em</span>
              </button>
            </div>

            {/* Số liệu thật */}
            <div className="grid grid-cols-3 gap-3 pt-4 max-w-md">
              {[
                { n: activePlayers.length, l: "Cầu thủ" },
                { n: matches.length, l: "Trận đã lên lịch" },
                { n: wins, l: "Trận thắng" },
              ].map((s) => (
                <div
                  key={s.l}
                  className="rounded-2xl bg-white/5 border border-white/10 px-3 py-3 text-center backdrop-blur"
                >
                  <div className="font-display text-4xl font-extrabold text-[#ffc933] leading-none">
                    {s.n}
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300 mt-1">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ảnh bìa */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-[460px] group">
              <div className="absolute -inset-2 rounded-[1.75rem] bg-gradient-to-br from-[#0D5EF4] via-[#ffc933] to-[#0D5EF4] opacity-70 blur-lg group-hover:opacity-100 transition duration-500" />
              <div className="relative rounded-3xl overflow-hidden border-2 border-[#ffc933] bg-slate-950 shadow-2xl lg:rotate-2 group-hover:rotate-0 transition-transform duration-500">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={OFFICIAL_COVER_URL}
                  alt="Tập thể FC HĐH Gò Nổi tại TP.HCM"
                  className="w-full h-[320px] sm:h-[400px] object-cover object-center"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#06122a] via-[#06122a]/80 to-transparent p-5">
                  <div className="font-display font-extrabold uppercase text-2xl leading-none">
                    Tập thể FC HĐH Gò Nổi
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Điện Bàn, Quảng Nam • tại TP. Hồ Chí Minh
                  </p>
                </div>
              </div>
              <div
                aria-hidden="true"
                className="gn-float absolute -top-5 -right-3 sm:-right-6 h-16 w-16 rounded-full bg-[#ffc933] text-3xl flex items-center justify-center shadow-xl border-4 border-[#06122a]"
              >
                ⚽
              </div>
              <div className="gn-float-slow absolute -bottom-4 -left-3 sm:-left-6 rounded-2xl bg-[#0D5EF4] px-4 py-2 font-display font-extrabold uppercase text-lg shadow-xl border-2 border-white/20">
                Đá xong là anh em
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ MATCH CENTER ============================ */}
      {nextMatch && (
        <Reveal>
          <section
            id="match-center"
            className="rounded-3xl overflow-hidden shadow-xl border border-slate-200 bg-white"
          >
            <div className="bg-gradient-to-r from-[#06122a] to-[#0b2a5e] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b-4 border-[#ffc933]">
              <div className="flex items-center gap-2.5">
                <Activity className="h-5 w-5 text-[#ffc933]" />
                <span className="font-display font-extrabold text-xl uppercase tracking-wide text-[#ffc933]">
                  Trận cầu tâm điểm
                </span>
                <span className="text-slate-300 text-xs hidden sm:inline">
                  • {nextMatch.label}
                </span>
              </div>
              <span className="bg-[#0D5EF4] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                {nextMatch.status}
              </span>
            </div>

            <div className="p-6 sm:p-10">
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-8">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="h-24 w-24 rounded-3xl bg-white border-4 border-[#0D5EF4] p-2 shadow-lg flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={OFFICIAL_LOGO_URL}
                      alt="FC HĐH Gò Nổi"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <h3 className="font-display font-extrabold text-2xl uppercase text-[#0b1a33] leading-none">
                    FC HĐH Gò Nổi
                  </h3>
                </div>

                <div className="flex flex-col items-center text-center gap-4">
                  {nextMatch.team_score !== null &&
                  nextMatch.opponent_score !== null ? (
                    <div className="inline-flex items-center gap-4 bg-[#06122a] text-[#ffc933] px-8 py-3 rounded-2xl font-display text-6xl font-extrabold shadow-lg">
                      <span>{nextMatch.team_score}</span>
                      <span className="text-slate-500 text-4xl">:</span>
                      <span>{nextMatch.opponent_score}</span>
                    </div>
                  ) : (
                    <div className="font-display text-7xl font-extrabold text-[#0D5EF4] leading-none">
                      VS
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-800">
                      <Clock className="h-4 w-4 text-[#0D5EF4]" />
                      <span>
                        {nextMatch.kickoff_time} •{" "}
                        {formatDateVN(nextMatch.match_date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-600">
                      <MapPin className="h-4 w-4 text-rose-500" />
                      <span>{nextMatch.venue}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center text-center gap-3">
                  <div className="h-24 w-24 rounded-3xl bg-slate-100 border-4 border-slate-300 flex items-center justify-center shadow-lg">
                    <Shield className="h-11 w-11 text-slate-400" />
                  </div>
                  <h3 className="font-display font-extrabold text-2xl uppercase text-[#0b1a33] leading-none">
                    {nextMatch.opponent}
                  </h3>
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-slate-500 italic">
                  Mời bà con và cổ động viên đồng hương ra sân tiếp lửa cho anh em!
                </span>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="bg-[#0D5EF4] hover:bg-[#2f7bff] text-white font-bold px-5 py-2.5 rounded-xl inline-flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span>Cầu thủ đăng nhập để điểm danh</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </Reveal>
      )}

      {/* ============================ HOẠT ĐỘNG ============================ */}
      <section id="activities" className="space-y-10">
        <Reveal>
          <SectionTitle
            kicker="Sống trọn niềm vui"
            title="Hoạt động của anh em"
            desc="Không chỉ là đá bóng. Đây là nơi gặp gỡ, tiếp thêm năng lượng và giữ lửa tình đồng hương."
          />
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ACTIVITIES.map((a, i) => {
            const Icon = a.icon;
            return (
              <Reveal key={a.title} delay={(i % 3) * 90}>
                <article className="group relative h-full rounded-3xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden">
                  <div
                    aria-hidden="true"
                    className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${a.accent} opacity-15 group-hover:opacity-30 group-hover:scale-125 transition duration-500`}
                  />
                  <div
                    className={`relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${a.accent} text-white shadow-lg group-hover:rotate-6 transition`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="relative mt-4 font-display font-extrabold text-2xl uppercase text-[#0b1a33] leading-tight">
                    {a.title}
                  </h3>
                  <p className="relative mt-2 text-sm text-slate-600 leading-relaxed">
                    {a.text}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ============================ CẦU THỦ ============================ */}
      <section
        id="squad-section"
        className="relative rounded-[2rem] overflow-hidden bg-[#06122a] text-white px-5 sm:px-10 py-12 sm:py-16 space-y-10 shadow-2xl"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 0%, rgba(13,94,244,.45) 0%, transparent 60%), repeating-linear-gradient(90deg, rgba(255,255,255,.03) 0 80px, transparent 80px 160px)",
        }}
      >
        <Reveal>
          <SectionTitle
            light
            kicker="Những chiến binh sân cỏ"
            title="Gặp gỡ anh em"
            desc="Mỗi người một số áo, một phong cách, chung một tinh thần: vui là chính, thắng là phụ gia."
          />
        </Reveal>

        <div className="flex flex-wrap justify-center gap-2">
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
              onClick={() => {
                setSquadFilter(key);
                setShowAllSquad(false);
              }}
              aria-pressed={squadFilter === key}
              className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider cursor-pointer ${
                squadFilter === key
                  ? "bg-[#ffc933] text-slate-950 shadow-[0_0_20px_rgba(255,201,51,0.45)]"
                  : "bg-white/10 text-slate-200 hover:bg-white/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {visibleSquad.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) * 70}>
              <article className="group relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#0d2a5c] to-[#081a3a] border border-white/10 hover:border-[#ffc933] hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-all duration-300">
                <div className="relative h-52 sm:h-60 overflow-hidden">
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.avatar_url}
                      alt={p.full_name}
                      className="w-full h-full object-cover object-top group-hover:scale-110 transition duration-700"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#0D5EF4] to-[#06122a]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#081a3a] via-[#081a3a]/20 to-transparent" />
                  {/* Số áo khổng lồ */}
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-3 right-2 font-display font-extrabold text-8xl leading-none text-transparent [-webkit-text-stroke:2px_rgba(255,201,51,0.85)] group-hover:text-[#ffc933]/30 transition"
                  >
                    {p.jersey_number ?? ""}
                  </span>
                  <span
                    className={`absolute top-3 left-3 text-[10px] font-black uppercase px-2.5 py-1 rounded-full shadow ${
                      p.access_role === "manager"
                        ? "bg-[#ffc933] text-slate-950"
                        : "bg-white/90 text-slate-900"
                    }`}
                  >
                    {p.access_role === "manager"
                      ? "Ban điều hành"
                      : p.position || "Cầu thủ"}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-display font-extrabold text-2xl uppercase leading-none truncate">
                    {p.short_name || p.full_name}
                  </h3>
                  <p className="text-xs text-slate-400 truncate mt-1">
                    {p.full_name}
                  </p>
                  {p.jersey_number !== null && (
                    <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#ffc933]">
                      <Star className="h-3 w-3 fill-current" />
                      <span>Áo số {p.jersey_number}</span>
                    </div>
                  )}
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {filteredSquad.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllSquad((v) => !v)}
              className="inline-flex items-center gap-2 border-2 border-[#ffc933] text-[#ffc933] hover:bg-[#ffc933] hover:text-slate-950 font-black px-6 py-3 rounded-xl text-sm uppercase tracking-wider cursor-pointer"
            >
              <span>
                {showAllSquad
                  ? "Thu gọn"
                  : `Xem cả đội (${filteredSquad.length})`}
              </span>
              <ArrowRight
                className={`h-4 w-4 transition ${showAllSquad ? "-rotate-90" : "rotate-90"}`}
              />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenLogin}
            className="inline-flex items-center gap-2 bg-[#0D5EF4] hover:bg-[#2f7bff] text-white font-black px-6 py-3.5 rounded-xl text-sm uppercase tracking-wider shadow-lg cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            <span>Đăng nhập thành viên</span>
          </button>
        </div>
      </section>

      {/* ============================ LỊCH & KẾT QUẢ ============================ */}
      <section className="space-y-6">
        <Reveal>
          <SectionTitle
            kicker="Bóng lăn mỗi tuần"
            title="Lịch đấu & kết quả"
          />
        </Reveal>

        <div className="flex justify-center">
          <div className="flex rounded-2xl bg-slate-100 p-1.5 border border-slate-200">
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
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer ${
                  matchTab === key
                    ? "bg-[#0D5EF4] text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matchTab === "fixtures" &&
            (upcomingMatches.length === 0 ? (
              <div className="md:col-span-2 py-12 text-center text-slate-500 text-sm italic rounded-3xl bg-white border border-dashed border-slate-300">
                Chưa có lịch mới. Ban điều hành đang chốt kèo trận tiếp theo!
              </div>
            ) : (
              upcomingMatches.map((m) => (
                <article
                  key={m.id}
                  className="rounded-3xl bg-white border border-slate-200 p-5 hover:border-[#0D5EF4] hover:shadow-lg transition"
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="bg-[#0D5EF4]/10 text-[#0D5EF4] px-3 py-1 rounded-full">
                      {m.label}
                    </span>
                    <span className="text-slate-500 inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {m.kickoff_time} • {formatDateVN(m.match_date)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-4 my-3 border-y border-slate-100">
                    <span className="font-display font-extrabold text-xl uppercase text-[#0b1a33]">
                      FC Gò Nổi
                    </span>
                    <span className="text-xs font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                      VS
                    </span>
                    <span className="font-display font-extrabold text-xl uppercase text-slate-700 text-right truncate max-w-[150px]">
                      {m.opponent}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-rose-500" />
                      {m.venue}
                    </span>
                    <button
                      type="button"
                      onClick={onOpenLogin}
                      className="font-bold text-[#0D5EF4] hover:underline cursor-pointer"
                    >
                      Điểm danh →
                    </button>
                  </div>
                </article>
              ))
            ))}

          {matchTab === "results" &&
            pastMatches.slice(0, 6).map((m) => (
              <article
                key={m.id}
                className="rounded-3xl bg-white border border-slate-200 p-5 hover:border-[#0D5EF4] hover:shadow-lg transition"
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                    {m.label}
                  </span>
                  <span className="text-slate-500">
                    {formatDateVN(m.match_date)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-4 my-3 border-y border-slate-100">
                  <span className="font-display font-extrabold text-xl uppercase text-[#0b1a33]">
                    FC Gò Nổi
                  </span>
                  <span className="bg-[#06122a] text-[#ffc933] font-display font-extrabold text-2xl px-4 py-1 rounded-xl tracking-widest">
                    {m.team_score ?? 0} - {m.opponent_score ?? 0}
                  </span>
                  <span className="font-display font-extrabold text-xl uppercase text-slate-700 text-right truncate max-w-[150px]">
                    {m.opponent}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {m.venue}
                </span>
              </article>
            ))}
        </div>
      </section>

      {/* ============================ KHOẢNH KHẮC & FANPAGE ============================ */}
      <section id="gallery" className="space-y-10">
        <Reveal>
          <SectionTitle
            kicker="Sân cỏ kể chuyện"
            title="Khoảnh khắc của đội"
          />
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 grid grid-cols-2 gap-3 sm:gap-4">
            {ACTION_GALLERY.map((img, i) => (
              <Reveal key={i} delay={i * 80}>
                <figure
                  className={`relative rounded-2xl overflow-hidden group bg-slate-900 ${
                    i === 0 ? "h-56 sm:h-72" : "h-56 sm:h-72"
                  } ${i % 2 === 1 ? "sm:translate-y-6" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-transparent p-3 text-white">
                    <span className="inline-block bg-[#ffc933] text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                      {img.tag}
                    </span>
                    <p className="text-xs font-semibold mt-1 leading-snug">
                      {img.title}
                    </p>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>

          <div className="lg:col-span-5 rounded-3xl bg-white border border-slate-200 p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display font-extrabold text-2xl uppercase text-[#0b1a33]">
                Fanpage CLB
              </h3>
              <a
                href={fanpageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-[#0D5EF4] hover:underline"
              >
                Mở Facebook →
              </a>
            </div>
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex justify-center p-1">
              <iframe
                title="Fanpage FC HĐH Gò Nổi"
                src={`https://www.facebook.com/plugins/page.php?href=${encodedFanpage}&tabs=timeline&width=360&height=360&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=true`}
                width="360"
                height="360"
                style={{ border: "none", overflow: "hidden", maxWidth: "100%" }}
                scrolling="no"
                loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============================ CTA ============================ */}
      <Reveal>
        <section className="relative rounded-[2rem] overflow-hidden bg-gradient-to-r from-[#0D5EF4] via-[#1b6dff] to-[#0a3fb0] text-white px-6 sm:px-14 py-12 shadow-2xl">
          <div
            aria-hidden="true"
            className="absolute -right-10 -bottom-16 font-display font-extrabold text-[14rem] leading-none text-white/10 select-none"
          >
            ⚽
          </div>
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div>
              <h2 className="font-display font-extrabold uppercase text-4xl sm:text-5xl leading-none">
                Ra sân cùng <span className="text-[#ffc933]">anh em Gò Nổi</span>
              </h2>
              <p className="mt-3 text-blue-100 max-w-xl">
                Cầu thủ và ban điều hành đăng nhập để điểm danh, xem lịch đấu và
                theo dõi quỹ đội. Muốn gia nhập? Nhắn Fanpage cho anh em nhé!
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-2 bg-[#ffc933] hover:bg-[#ffd95e] text-slate-950 font-black px-7 py-4 rounded-xl text-sm uppercase tracking-wider shadow-xl cursor-pointer"
              >
                <LogIn className="h-5 w-5" />
                <span>Đăng nhập</span>
              </button>
              <a
                href={fanpageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/40 text-white font-black px-6 py-4 rounded-xl text-sm uppercase tracking-wider"
              >
                <span>Nhắn Fanpage</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ============================ FOOTER ============================ */}
      <footer className="rounded-[2rem] overflow-hidden bg-[#050e20] text-slate-300 border border-white/5">
        <div className="px-6 sm:px-12 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={OFFICIAL_LOGO_URL}
                alt="Logo FC HĐH Gò Nổi"
                className="h-12 w-12 rounded-full object-contain bg-white p-0.5 ring-2 ring-[#ffc933]"
              />
              <span className="font-display font-extrabold text-2xl uppercase text-white leading-none">
                FC HĐH Gò Nổi
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Câu lạc bộ bóng đá của những người con Gò Nổi (Điện Quang, Điện
              Trung, Điện Phong, Điện Bàn, Quảng Nam) đang sinh sống và làm việc
              tại TP. Hồ Chí Minh.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-display font-extrabold text-xl uppercase text-[#ffc933]">
              Điều hướng
            </h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {navLinks.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(l.id)}
                    className="hover:text-[#ffc933] transition cursor-pointer"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
              <li>
                <a
                  href={fanpageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#ffc933] transition"
                >
                  Fanpage
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-display font-extrabold text-xl uppercase text-[#ffc933]">
              Khu thành viên
            </h3>
            <p className="text-xs text-slate-400">
              Dành cho cầu thủ và Ban điều hành CLB.
            </p>
            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-2 bg-[#0D5EF4] hover:bg-[#2f7bff] text-white font-black px-5 py-3 rounded-xl text-xs uppercase tracking-wider cursor-pointer"
            >
              <LogIn className="h-4 w-4" />
              <span>Đăng nhập</span>
            </button>
          </div>
        </div>
        <div className="border-t border-white/10 px-6 sm:px-12 py-4 text-[11px] text-slate-500 text-center sm:text-left">
          © {new Date().getFullYear()} FC HĐH Gò Nổi • Đoàn kết • Bản lĩnh •
          Nghĩa tình
        </div>
      </footer>
    </div>
  );
}
