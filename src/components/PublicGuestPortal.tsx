"use client";

import React, { useState } from "react";
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
  CheckCircle2,
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
    title: "Đội hình sinh hoạt tuần FC HĐH Gò Nổi tại TP.HCM",
    tag: "Tập thể CLB",
  },
  {
    src: "/uploads/avatars/member-10.jpg",
    title: "Tinh thần thi đấu nhiệt huyết, gắn kết quê hương",
    tag: "Ra sân",
  },
  {
    src: "/uploads/avatars/member-5.jpg",
    title: "Giao lưu thể thao đồng hương Điện Bàn - Gò Nổi",
    tag: "Giao hữu",
  },
  {
    src: "/uploads/avatars/member-13.jpg",
    title: "Rèn luyện thể lực và phong trào bóng đá bền vững",
    tag: "Phong trào",
  },
];

export function PublicGuestPortal({
  data,
  onOpenLogin,
}: PublicGuestPortalProps) {
  const { settings, matches, players } = data;
  const fanpageUrl = settings.fanpage_url || FANPAGE_URL;
  const encodedFanpage = encodeURIComponent(fanpageUrl);

  const [matchTab, setMatchTab] = useState<"fixtures" | "results">("fixtures");

  // Lọc trận sắp tới và trận đã đá
  const upcomingMatches = matches.filter((m) => m.status === "Sắp diễn ra");
  const pastMatches = matches
    .filter((m) => m.status === "Đã kết thúc")
    .slice()
    .reverse();

  // Trận kế tiếp tiêu điểm
  const nextMatch = upcomingMatches[0] || matches[matches.length - 1];

  // Danh sách ban điều hành & cầu thủ tiêu biểu
  const featuredSquad: Player[] = players
    .filter((p) => p.status === "active")
    .slice(0, 8);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="w-full font-sans text-slate-800 -mt-4 sm:-mt-5 space-y-12 sm:space-y-16">
      {/* =========================================================================
          THEME HEADER PILL NAV (Tham khảo header.php của football-coach-club)
          ========================================================================= */}
      <div className="pt-2">
        <div className="bg-[#0f2239] rounded-full p-2 sm:p-2.5 shadow-xl border border-blue-900/40 flex items-center justify-between gap-3 text-white">
          {/* Logo capsule block: Primary Blue #0D5EF4 */}
          <div className="flex items-center gap-2.5 bg-[#0D5EF4] px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full font-black tracking-wider text-xs sm:text-sm shrink-0 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_LOGO_URL}
              alt="Logo FC HĐH Gò Nổi"
              className="h-6 w-6 sm:h-7 sm:w-7 rounded-full object-contain bg-white p-0.5"
            />
            <span className="uppercase tracking-tight truncate max-w-[150px] sm:max-w-none">
              FC HĐH GÒ NỔI
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs uppercase font-bold tracking-wider text-slate-200">
            <button
              onClick={() => scrollToSection("banner-hero")}
              className="hover:text-[#0D5EF4] transition cursor-pointer text-[#0D5EF4]"
            >
              Trang Chủ
            </button>
            <button
              onClick={() => scrollToSection("match-center")}
              className="hover:text-[#0D5EF4] transition cursor-pointer"
            >
              Lịch Đấu
            </button>
            <button
              onClick={() => scrollToSection("about-club")}
              className="hover:text-[#0D5EF4] transition cursor-pointer"
            >
              Về CLB
            </button>
            <button
              onClick={() => scrollToSection("club-news")}
              className="hover:text-[#0D5EF4] transition cursor-pointer"
            >
              Bản Tin
            </button>
            <button
              onClick={() => scrollToSection("squad-section")}
              className="hover:text-[#0D5EF4] transition cursor-pointer"
            >
              Đội Hình
            </button>
            <a
              href={fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#ffc933] transition flex items-center gap-1"
            >
              <span>Fanpage</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </nav>

          {/* Right Action: Đăng Nhập Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-2 bg-[#ffc933] hover:bg-[#ffd95e] text-slate-950 font-black px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm uppercase tracking-wide transition shadow-md hover:shadow-lg cursor-pointer shrink-0"
            >
              <LogIn className="h-4 w-4" />
              <span>Đăng Nhập</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          1. HERO BANNER (Tham khảo banner.php: 2-column cover, banner.png & banner1.png)
          ========================================================================= */}
      <section
        id="banner-hero"
        className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-[#0d1322] text-white"
        style={{
          backgroundImage: "radial-gradient(ellipse at 80% 20%, #1e3a8a 0%, #0d1322 70%)",
        }}
      >
        {/* Background stadium lighting image from theme */}
        <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/theme/banner.png"
            alt=""
            className="w-full h-full object-cover object-center"
          />
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 items-center gap-8 px-6 sm:px-12 py-10 sm:py-16 min-h-[580px]">
          {/* Left Column (58% width): Date, Primary tag, Large Title, Text, CTA buttons */}
          <div className="lg:col-span-7 space-y-5 text-left">
            {/* Short Heading / Date tag */}
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-widest text-slate-300">
              <span className="h-2 w-2 rounded-full bg-[#0D5EF4] animate-pulse" />
              <span>Mùa giải 2025 - 2026 • TP. Hồ Chí Minh</span>
            </div>

            {/* Level 3 Heading in Primary Color (#0D5EF4) */}
            <h3 className="text-[#0D5EF4] font-black uppercase text-xl sm:text-2xl md:text-3xl tracking-wide drop-shadow-sm">
              LATEST MATCH • TRẬN CẦU TÂM ĐIỂM
            </h3>

            {/* Level 2 Heading: Massive Uppercase White (55px style) */}
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-white drop-shadow-md leading-none">
                FC HĐH GÒ NỔI
              </h1>
              <p className="text-[#ffc933] font-black uppercase text-lg sm:text-2xl tracking-wider">
                ĐOÀN KẾT - BẢN LĨNH - NGHĨA TÌNH
              </p>
            </div>

            {/* Description */}
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl">
              Nơi hội tụ, rèn luyện sức khoẻ và thắt chặt tình cảm của những người con vùng đất Gò Nổi (Điện Quang, Điện Trung, Điện Phong - Điện Bàn, Quảng Nam) đang học tập, làm việc và sinh sống tại TP. Hồ Chí Minh.
            </p>

            {/* CTA Button Group matching banner.php */}
            <div className="pt-3 flex flex-wrap items-center gap-4">
              {/* Primary Button */}
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-2.5 bg-[#0D5EF4] hover:bg-blue-600 text-white font-extrabold px-6 sm:px-8 py-3.5 rounded-[7px] text-sm sm:text-base uppercase tracking-wider transition shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 cursor-pointer"
              >
                <LogIn className="h-5 w-5" />
                <span>ĐĂNG NHẬP HỆ THỐNG</span>
              </button>

              {/* Watch Video / Fanpage Button with watch.png */}
              <a
                href={fanpageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-white hover:text-[#ffc933] font-bold text-sm sm:text-base capitalize transition group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/theme/watch.png"
                  alt="Watch"
                  className="h-10 w-10 transition group-hover:scale-110 drop-shadow"
                />
                <span className="underline underline-offset-4">Xem Fanpage & Video</span>
              </a>
            </div>

            {/* Quick Points */}
            <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#0D5EF4]" />
                <span>Minh bạch quỹ 100%</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#0D5EF4]" />
                <span>Sinh hoạt cuối tuần cố định</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#0D5EF4]" />
                <span>Điểm danh số hóa</span>
              </div>
            </div>
          </div>

          {/* Right Column (45% width): Ảnh Bìa Đại Diện FC HĐH Gò Nổi */}
          <div className="lg:col-span-5 flex justify-center items-center relative">
            <div className="relative w-full max-w-[480px] group">
              {/* Stadium blue & gold glow halo */}
              <div className="absolute -inset-1 bg-gradient-to-r from-[#0D5EF4] via-[#ffc933] to-[#0D5EF4] rounded-3xl blur-md opacity-60 group-hover:opacity-100 transition duration-500" />

              <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-[#ffc933] bg-slate-950 shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={OFFICIAL_COVER_URL}
                  alt="Tập thể FC HĐH Gò Nổi tại TP.HCM"
                  className="w-full h-[280px] sm:h-[340px] object-cover object-center group-hover:scale-105 transition duration-700 filter brightness-100 contrast-105"
                />

                {/* Gradient caption overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-4 sm:p-5 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-[#ffc933] text-slate-950 text-[10px] sm:text-xs font-black uppercase px-2.5 py-0.5 rounded-full shadow">
                      Ảnh Bìa Đại Diện CLB
                    </span>
                    <span className="text-[11px] text-slate-300 font-semibold">
                      Mùa giải 2025 - 2026
                    </span>
                  </div>
                  <h4 className="font-black text-sm sm:text-base text-white uppercase tracking-wide">
                    Tập Thể FC HĐH Gò Nổi
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    Hội Đồng Hương Gò Nổi (Điện Bàn, Quảng Nam) tại TP. Hồ Chí Minh
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. MATCH CENTER CARD (High-impact Fixture & Scoreboard Bar)
          ========================================================================= */}
      {nextMatch && (
        <section
          id="match-center"
          className="bg-white rounded-2xl border-2 border-slate-200 shadow-lg overflow-hidden"
        >
          {/* Top Bar with Primary Blue #0D5EF4 */}
          <div className="bg-[#0f2239] text-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#0D5EF4]">
            <div className="flex items-center gap-2.5">
              <Activity className="h-4 w-4 text-[#ffc933]" />
              <span className="font-black text-xs sm:text-sm uppercase tracking-wider text-[#ffc933]">
                Match Center • Trận Đấu Tâm Điểm
              </span>
              <span className="text-slate-300 text-xs hidden sm:inline">
                • {nextMatch.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-[#0D5EF4] text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                {nextMatch.status}
              </span>
            </div>
          </div>

          {/* Match Scoreboard Body */}
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-6">
              {/* Home Team: FC HĐH Gò Nổi */}
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-white border-2 border-[#0D5EF4] p-2 flex items-center justify-center shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={OFFICIAL_LOGO_URL}
                    alt="FC HĐH Gò Nổi"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900 uppercase">
                    FC HĐH GÒ NỔI
                  </h3>
                  <span className="inline-block text-xs font-bold text-[#0D5EF4] bg-blue-50 px-2 py-0.5 rounded-full">
                    Chủ nhà • Áo Vàng
                  </span>
                </div>
              </div>

              {/* VS or Match Score */}
              <div className="flex flex-col items-center justify-center text-center space-y-3 py-4 md:py-0 border-y md:border-y-0 md:border-x border-slate-100">
                {nextMatch.team_score !== null && nextMatch.opponent_score !== null ? (
                  <div className="inline-flex items-center gap-4 bg-[#0f2239] text-[#ffc933] px-7 py-3 rounded-2xl text-3xl font-black tracking-widest shadow-md">
                    <span>{nextMatch.team_score}</span>
                    <span className="text-slate-500 text-xl">-</span>
                    <span>{nextMatch.opponent_score}</span>
                  </div>
                ) : (
                  <div className="inline-block bg-[#0D5EF4] text-white font-black text-2xl px-6 py-2.5 rounded-2xl tracking-wider shadow-md">
                    VS
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-800">
                    <Clock className="h-4 w-4 text-[#0D5EF4]" />
                    <span>
                      {nextMatch.kickoff_time} • {formatDateVN(nextMatch.match_date)}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <MapPin className="h-4 w-4 text-rose-500" />
                    <span>{nextMatch.venue}</span>
                  </div>
                </div>
              </div>

              {/* Opponent Team */}
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-slate-100 border-2 border-slate-300 flex items-center justify-center shadow-md text-slate-500">
                  <Shield className="h-10 w-10 text-slate-400" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900 uppercase">
                    {nextMatch.opponent}
                  </h3>
                  <span className="inline-block text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    Đội khách • Giao hữu
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom notification & Action */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
              <span className="italic text-slate-500">
                * Kính mời quý bà con & cổ động viên đồng hương đến sân tiếp lửa cho đội bóng.
              </span>
              <button
                type="button"
                onClick={onOpenLogin}
                className="bg-[#0D5EF4] hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <span>Cầu thủ đăng nhập điểm danh trận này</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          3. ABOUT CLUB SECTION (Tham khảo about-section.php & about-img.png)
          ========================================================================= */}
      <section
        id="about-club"
        className="bg-white rounded-3xl p-6 sm:p-12 border border-slate-200 shadow-sm space-y-8"
      >
        {/* Section Heading matching theme: uppercase 30px bold centered */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-slate-900 tracking-tight">
            ABOUT CLUB • VỀ CÂU LẠC BỘ
          </h2>
          <div className="h-1 w-20 bg-[#0D5EF4] mx-auto rounded-full" />
          <p className="text-xs sm:text-sm text-slate-500 uppercase tracking-wider font-semibold">
            Hội Đồng Hương Gò Nổi (Điện Quang - Điện Trung - Điện Phong) Tại TP. Hồ Chí Minh
          </p>
        </div>

        {/* 2 Columns Layout matching about-section.php */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Ảnh đại diện tập thể FC HĐH Gò Nổi */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#0D5EF4] shadow-xl group max-w-md w-full bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={OFFICIAL_COVER_URL}
                alt="FC HĐH Gò Nổi"
                className="w-full h-[260px] sm:h-[300px] object-cover group-hover:scale-105 transition duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f2239]/90 via-transparent to-transparent flex items-end p-4">
                <span className="text-white font-black uppercase text-xs tracking-wider bg-[#0D5EF4] px-3 py-1.5 rounded-lg shadow">
                  FC HĐH Gò Nổi • Thành Lập 2024
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: about-text-box with 4 structured points */}
          <div className="lg:col-span-7 space-y-4 text-slate-700 text-sm sm:text-base leading-relaxed">
            <div className="space-y-1">
              <h4 className="font-bold text-[#0D5EF4] text-base uppercase">
                1. Mái Nhà Chung Gắn Kết Tình Đồng Hương
              </h4>
              <p className="text-slate-600 text-sm">
                CLB FC Hội Đồng Hương Gò Nổi là nơi gắn kết những người con xa xứ đến từ ba xã Điện Quang, Điện Trung, Điện Phong (thị xã Điện Bàn, tỉnh Quảng Nam). Qua niềm đam mê trái bóng tròn, anh em có cơ hội sẻ chia, tương trợ và đồng hành cùng nhau trong cuộc sống nơi đất khách.
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-[#0D5EF4] text-base uppercase">
                2. Lịch Sinh Hoạt & Giao Hữu Hằng Tuần Đều Đặn
              </h4>
              <p className="text-slate-600 text-sm">
                Đội bóng duy trì sinh hoạt thể thao định kỳ vào các tối cuối tuần tại các cụm sân chất lượng cao tại TP. Hồ Chí Minh, thường xuyên giao lưu cùng các câu lạc bộ đồng hương bạn để nâng cao thể lực và phong cách thi đấu.
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-[#0D5EF4] text-base uppercase">
                3. Quản Trị Số Hóa & Minh Bạch Tài Chính 100%
              </h4>
              <p className="text-slate-600 text-sm">
                Hệ thống số hóa giúp đội bóng theo dõi điểm danh trước trận, thu tiền sân, tính toán chi phí và công khai quỹ đội minh bạch từng ngày. Mỗi cầu thủ đều có tài khoản tra cứu riêng biệt.
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-[#0D5EF4] text-base uppercase">
                4. Tinh Thần Thể Thao Cao Thượng & Trách Nhiệm Xã Hội
              </h4>
              <p className="text-slate-600 text-sm">
                Luôn đề cao tinh thần thi đấu fair-play, tôn trọng trọng tài và đội bạn. Đội bóng cũng là lực lượng nòng cốt tham gia các hoạt động xã hội, khuyến học và hướng về quê hương Gò Nổi thân yêu.
              </p>
            </div>

            {/* Quick 4 Stats Grid */}
            <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-100">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <div className="text-2xl font-black text-[#0D5EF4]">{players.length}+</div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Cầu Thủ</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <div className="text-2xl font-black text-[#0D5EF4]">52+</div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Trận / Năm</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <div className="text-2xl font-black text-[#0D5EF4]">100%</div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Minh Bạch Quỹ</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <div className="text-2xl font-black text-[#0D5EF4]">2024</div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Năm Thành Lập</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. RECENT CLUB NEWS (Tham khảo latest-news.php: 3-column card grid)
          ========================================================================= */}
      <section id="club-news" className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-slate-900 tracking-tight">
            RECENT CLUB NEWS • HOẠT ĐỘNG & BẢN TIN CLB
          </h2>
          <div className="h-1 w-20 bg-[#0D5EF4] mx-auto rounded-full" />
          <p className="text-xs sm:text-sm text-slate-500">
            Tin tức hoạt động, kế hoạch thi đấu và thông báo chính thức từ Ban Điều Hành
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Match Schedule & Attendance */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-[#0D5EF4] transition flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden h-44 bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={OFFICIAL_COVER_URL}
                  alt="Lịch thi đấu tuần"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500 filter brightness-90"
                />
                <span className="absolute top-3 left-3 bg-[#0D5EF4] text-white text-[10px] font-black uppercase px-2.5 py-1 rounded">
                  LỊCH THI ĐẤU
                </span>
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase">
                Cập nhật hằng tuần
              </div>
              <h3 className="font-black text-lg text-slate-900 group-hover:text-[#0D5EF4] transition">
                Lịch Thi Đấu & Điểm Danh Ra Sân Tuần Mới
              </h3>
              <p className="text-xs text-slate-600 line-clamp-3">
                Ban quản lý đã công bố lịch bóng lăn cuối tuần. Cầu thủ vui lòng đăng nhập vào hệ thống để bấm xác nhận CÓ MẶT hoặc VẮNG MẶT để ban huấn luyện chốt danh sách đội hình.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={onOpenLogin}
                className="text-xs font-bold text-[#0D5EF4] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Đăng nhập điểm danh</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Card 2: Financial Transparency */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-[#0D5EF4] transition flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden h-44 bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/uploads/avatars/member-10.jpg"
                  alt="Minh bạch tài chính"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500 filter brightness-90"
                />
                <span className="absolute top-3 left-3 bg-[#ffc933] text-slate-950 text-[10px] font-black uppercase px-2.5 py-1 rounded">
                  TÀI CHÍNH CLB
                </span>
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase">
                Sổ quỹ công khai
              </div>
              <h3 className="font-black text-lg text-slate-900 group-hover:text-[#0D5EF4] transition">
                Minh Bạch Quỹ Đội & Báo Cáo Thu Chi Từng Trận
              </h3>
              <p className="text-xs text-slate-600 line-clamp-3">
                Toàn bộ tiền quỹ đóng theo tháng, tiền thu sân từng trận đấu và các khoản chi tiền sân, tiền nước đều được thủ quỹ cập nhật công khai rõ ràng, giúp anh em luôn an tâm.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={onOpenLogin}
                className="text-xs font-bold text-[#0D5EF4] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Đăng nhập xem quỹ</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Card 3: Community & Fanpage */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-[#0D5EF4] transition flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden h-44 bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/uploads/avatars/member-5.jpg"
                  alt="Giao lưu đồng hương"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500 filter brightness-90"
                />
                <span className="absolute top-3 left-3 bg-[#10b981] text-white text-[10px] font-black uppercase px-2.5 py-1 rounded">
                  ĐỒNG HƯƠNG
                </span>
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase">
                Kết nối xứ Quảng
              </div>
              <h3 className="font-black text-lg text-slate-900 group-hover:text-[#0D5EF4] transition">
                Giao Lưu Bóng Đá Đồng Hương Điện Bàn - Quảng Nam
              </h3>
              <p className="text-xs text-slate-600 line-clamp-3">
                Hình ảnh những pha bóng đẹp mắt, những khoảnh khắc gắn kết tình anh em Gò Nổi tại Sài Gòn được cập nhật liên tục trên trang Fanpage chính thức của câu lạc bộ.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
              <a
                href={fanpageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-[#0D5EF4] hover:underline flex items-center gap-1"
              >
                <span>Xem trên Fanpage</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. FIXTURES & RESULTS TABS (Bảng thi đấu công khai)
          ========================================================================= */}
      <section className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase flex items-center gap-2">
              <Trophy className="h-6 w-6 text-[#ffc933]" />
              <span>Lịch Thi Đấu & Kết Quả Trận Đấu</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Theo dõi lịch bóng lăn và tỉ số các trận đấu của FC HĐH Gò Nổi
            </p>
          </div>

          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 self-start sm:self-auto">
            <button
              onClick={() => setMatchTab("fixtures")}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition cursor-pointer ${
                matchTab === "fixtures"
                  ? "bg-[#0D5EF4] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Lịch Sắp Tới ({upcomingMatches.length})
            </button>
            <button
              onClick={() => setMatchTab("results")}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition cursor-pointer ${
                matchTab === "results"
                  ? "bg-[#0D5EF4] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Kết Quả Đã Đấu ({pastMatches.length})
            </button>
          </div>
        </div>

        {/* Fixtures Tab */}
        {matchTab === "fixtures" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingMatches.length === 0 ? (
              <div className="col-span-2 py-10 text-center text-slate-500 text-sm italic">
                Hiện tại chưa có lịch thi đấu mới. Ban quản lý đang chuẩn bị trận tiếp theo!
              </div>
            ) : (
              upcomingMatches.map((m) => (
                <div
                  key={m.id}
                  className="bg-slate-50 rounded-2xl border border-slate-200 p-5 hover:border-[#0D5EF4] transition flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="bg-[#0D5EF4]/10 text-[#0D5EF4] px-2.5 py-0.5 rounded-full">
                        {m.label}
                      </span>
                      <span className="text-slate-500 inline-flex items-center gap-1 font-semibold">
                        <Clock className="h-3.5 w-3.5" />
                        {m.kickoff_time} • {formatDateVN(m.match_date)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2 border-y border-slate-200">
                      <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={OFFICIAL_LOGO_URL}
                          alt="GN"
                          className="h-6 w-6 object-contain rounded-full bg-white p-0.5 border"
                        />
                        <span>FC Gò Nổi</span>
                      </div>
                      <span className="text-xs font-black text-slate-400 bg-white px-2 py-0.5 rounded border">
                        VS
                      </span>
                      <div className="font-bold text-sm text-slate-800 text-right truncate max-w-[140px]">
                        {m.opponent}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-rose-500" />
                      {m.venue}
                    </span>
                    <button
                      onClick={onOpenLogin}
                      className="font-bold text-[#0D5EF4] hover:underline cursor-pointer"
                    >
                      Điểm danh →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Results Tab */}
        {matchTab === "results" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pastMatches.slice(0, 6).map((m) => (
              <div
                key={m.id}
                className="bg-slate-50 rounded-2xl border border-slate-200 p-5 hover:border-[#0D5EF4] transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full">
                      {m.label} • Đã kết thúc
                    </span>
                    <span className="text-slate-500">
                      {formatDateVN(m.match_date)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-y border-slate-200">
                    <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={OFFICIAL_LOGO_URL}
                        alt="GN"
                        className="h-6 w-6 object-contain rounded-full bg-white p-0.5 border"
                      />
                      <span>FC Gò Nổi</span>
                    </div>

                    <div className="bg-[#0f2239] text-[#ffc933] font-black px-3 py-1 rounded-lg text-sm tracking-widest">
                      {m.team_score ?? 0} - {m.opponent_score ?? 0}
                    </div>

                    <div className="font-bold text-sm text-slate-800 text-right truncate max-w-[140px]">
                      {m.opponent}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {m.venue}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Giao hữu rèn luyện thể thao
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =========================================================================
          6. FEATURED SQUAD (Tham khảo top-products.php / Đội hình tiêu biểu)
          ========================================================================= */}
      <section id="squad-section" className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-slate-900 tracking-tight">
            FEATURED SQUAD • ĐỘI HÌNH & THÀNH VIÊN
          </h2>
          <div className="h-1 w-20 bg-[#0D5EF4] mx-auto rounded-full" />
          <p className="text-xs sm:text-sm text-slate-500">
            Những gương mặt đồng hương nhiệt huyết cống hiến cho màu cờ sắc áo FC HĐH Gò Nổi
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {featuredSquad.map((player) => (
            <div
              key={player.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:border-[#0D5EF4] transition group flex flex-col"
            >
              <div className="relative h-44 sm:h-52 bg-slate-900 overflow-hidden">
                {player.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={player.avatar_url}
                    alt={player.full_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-slate-950 text-white font-black text-3xl">
                    #{player.jersey_number ?? "-"}
                  </div>
                )}
                {/* Jersey number badge */}
                <div className="absolute top-2.5 right-2.5 bg-[#0D5EF4] text-white text-xs font-black px-2 py-0.5 rounded shadow">
                  #{player.jersey_number ?? "-"}
                </div>
                {/* Role badge */}
                <div className="absolute bottom-2.5 left-2.5">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shadow ${
                      player.access_role === "manager"
                        ? "bg-[#ffc933] text-slate-950"
                        : "bg-white/90 text-slate-900"
                    }`}
                  >
                    {player.access_role === "manager"
                      ? "Ban Quản Lý"
                      : player.position || "Cầu thủ"}
                  </span>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                    {player.full_name}
                  </h4>
                  <p className="text-xs text-slate-500 truncate">
                    {player.short_name || player.full_name}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                  <span>Trạng thái:</span>
                  <span className="text-emerald-600 font-bold">Sẵn sàng ra sân</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center pt-2">
          <button
            onClick={onOpenLogin}
            className="inline-flex items-center gap-2 bg-[#0f2239] hover:bg-slate-900 text-[#ffc933] font-bold px-6 py-3 rounded-xl text-xs sm:text-sm uppercase tracking-wide transition shadow cursor-pointer"
          >
            <Users className="h-4 w-4" />
            <span>Xem Đầy Đủ Danh Sách & Đăng Nhập Thành Viên</span>
          </button>
        </div>
      </section>

      {/* =========================================================================
          7. FANPAGE & PHOTO COMMUNITY
          ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Gallery */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 uppercase flex items-center gap-2">
              <Star className="h-5 w-5 text-[#ffc933] fill-current" />
              <span>Khoảnh Khắc Sân Cỏ FC HĐH Gò Nổi</span>
            </h3>
            <a
              href={fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-[#0D5EF4] hover:underline inline-flex items-center gap-1"
            >
              <span>Xem album</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {ACTION_GALLERY.map((img, i) => (
              <div
                key={i}
                className="relative rounded-xl overflow-hidden group h-36 sm:h-44 bg-slate-900 border border-slate-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt={img.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500 filter brightness-95"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent p-2.5 text-white">
                  <span className="text-[10px] font-black text-[#ffc933] uppercase block">
                    {img.tag}
                  </span>
                  <p className="text-[11px] font-medium truncate text-slate-200">
                    {img.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fanpage Facebook Plugin */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 uppercase">
              Fanpage Facebook CLB
            </h3>
            <a
              href={fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-[#0D5EF4] hover:underline"
            >
              Truy cập Fanpage →
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
              frameBorder="0"
              allowFullScreen={true}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            />
          </div>

          <div className="rounded-2xl bg-[#0f2239] text-white p-4 text-xs flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-200">
              Giao lưu & tham gia cùng đội bóng
            </span>
            <a
              href={fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#0D5EF4] hover:bg-blue-600 text-white px-3.5 py-1.5 rounded-lg font-bold transition shrink-0"
            >
              Nhắn Tin Fanpage
            </a>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. THEME FOOTER (Tham khảo footer.php & footer.png: dark stadium background)
          ========================================================================= */}
      <footer
        className="relative rounded-3xl overflow-hidden bg-[#0a101d] text-slate-300 shadow-2xl border border-slate-800"
        style={{
          backgroundImage: "radial-gradient(circle at 50% 0%, #172554 0%, #0a101d 85%)",
        }}
      >
        {/* Theme Footer Image Overlay */}
        <div className="absolute inset-0 z-0 opacity-30 mix-blend-screen pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/theme/footer.png"
            alt=""
            className="w-full h-full object-cover object-top"
          />
        </div>

        <div className="relative z-10 p-8 sm:p-14 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Column 1: About Club */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={OFFICIAL_LOGO_URL}
                  alt="Logo FC HĐH Gò Nổi"
                  className="h-10 w-10 rounded-full object-contain bg-white p-0.5 border border-[#ffc933]"
                />
                <h3 className="font-black text-white uppercase text-base tracking-wider">
                  FC HĐH GÒ NỔI
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Câu lạc bộ bóng đá của những người con Gò Nổi (Điện Quang, Điện Trung, Điện Phong) đang học tập, làm việc và sinh sống tại TP. Hồ Chí Minh.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <a
                  href={fanpageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 w-8 rounded-full bg-white/10 hover:bg-[#0D5EF4] flex items-center justify-center text-white transition"
                  title="Facebook Fanpage"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={onOpenLogin}
                  className="h-8 w-8 rounded-full bg-white/10 hover:bg-[#ffc933] hover:text-slate-950 flex items-center justify-center text-white transition cursor-pointer"
                  title="Đăng nhập"
                >
                  <LogIn className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Column 2: Latest Match Preview (Footer post style with blue date box) */}
            <div className="space-y-4">
              <h3 className="font-black text-white uppercase text-base tracking-wider">
                LATEST MATCH
              </h3>
              {nextMatch ? (
                <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                  {/* Primary Blue Date Box matching theme footer */}
                  <div className="bg-[#0D5EF4] text-white rounded-lg p-2 text-center shrink-0 w-12">
                    <div className="text-xs font-black">
                      {nextMatch.match_date ? nextMatch.match_date.slice(8, 10) : "25"}
                    </div>
                    <div className="text-[9px] font-bold uppercase">THÁNG</div>
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h5 className="font-bold text-xs text-white truncate">
                      {nextMatch.opponent}
                    </h5>
                    <p className="text-[11px] text-slate-400 truncate">
                      {nextMatch.kickoff_time} • {nextMatch.venue}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Đang cập nhật trận tiếp theo.</p>
              )}
            </div>

            {/* Column 3: Quick Links */}
            <div className="space-y-3">
              <h3 className="font-black text-white uppercase text-base tracking-wider">
                QUICK LINKS
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => scrollToSection("banner-hero")}
                    className="hover:text-[#ffc933] transition cursor-pointer"
                  >
                    Trang Chủ
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection("match-center")}
                    className="hover:text-[#ffc933] transition cursor-pointer"
                  >
                    Lịch Thi Đấu & Kết Quả
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection("about-club")}
                    className="hover:text-[#ffc933] transition cursor-pointer"
                  >
                    Về CLB FC HĐH Gò Nổi
                  </button>
                </li>
                <li>
                  <button
                    onClick={onOpenLogin}
                    className="hover:text-[#ffc933] transition cursor-pointer font-bold text-[#ffc933]"
                  >
                    Đăng Nhập Cầu Thủ & Quản Lý →
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: Contact & Hotline */}
            <div className="space-y-3">
              <h3 className="font-black text-white uppercase text-base tracking-wider">
                LIÊN HỆ
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Mọi thông tin giao lưu, tài trợ hoặc đăng ký tham gia câu lạc bộ, xin vui lòng liên hệ Ban Điều Hành qua Fanpage hoặc đăng nhập hệ thống.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="w-full bg-[#0D5EF4] hover:bg-blue-600 text-white font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow cursor-pointer"
                >
                  Đăng Nhập Thành Viên
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Copyright bar */}
          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-3">
            <span>
              © 2025 FC HĐH GÒ NỔI (ĐIỆN BÀN - QUẢNG NAM). THEME STYLED AFTER FOOTBALL COACH CLUB.
            </span>
            <div className="flex items-center gap-4">
              <span className="text-slate-400">Thiết kế phong cách Football Club Theme</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
