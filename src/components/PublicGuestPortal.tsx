"use client";

import React, { useState } from "react";
import {
  Calendar,
  MapPin,
  Users,
  ExternalLink,
  LogIn,
  Trophy,
  Shield,
  Star,
  ChevronRight,
  Flame,
  Award,
  Clock,
  ArrowRight,
  Info,
  PhoneCall,
  Activity,
} from "lucide-react";
import type { FullAppData } from "@/types/app";
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
    tag: "Tập thể",
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
  const { settings, matches, attendances } = data;
  const fanpageUrl = settings.fanpage_url || FANPAGE_URL;
  const encodedFanpage = encodeURIComponent(fanpageUrl);

  const [activeTab, setActiveTab] = useState<"fixtures" | "results">("fixtures");

  // Lọc trận sắp tới và trận đã đá
  const upcomingMatches = matches.filter((m) => m.status === "Sắp diễn ra");
  const pastMatches = matches
    .filter((m) => m.status === "Đã kết thúc")
    .slice()
    .reverse();

  // Trận kế tiếp tiêu điểm
  const nextMatch = upcomingMatches[0] || matches[matches.length - 1];

  return (
    <div className="space-y-10 sm:space-y-14 font-sans text-slate-800 pb-12">
      {/* 1. TOP TICKER / CLUB MOTTO (Phong cách theme Football Club) */}
      <div className="bg-[#173f9e] text-white py-2 px-4 rounded-xl flex flex-wrap items-center justify-between text-xs font-semibold gap-3 border-b-2 border-[#ffc933]">
        <div className="flex items-center gap-2">
          <span className="bg-[#ffc933] text-[#173f9e] font-extrabold px-2 py-0.5 rounded text-[10px] tracking-wide uppercase">
            Official Club
          </span>
          <span className="text-slate-200 truncate">
            CLB Bóng Đá Hội Đồng Hương Gò Nổi (Điện Bàn, Quảng Nam) Tại TP. Hồ Chí Minh
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={fanpageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#ffc933] transition inline-flex items-center gap-1"
          >
            <span>Facebook Fanpage</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={onOpenLogin}
            className="text-[#ffc933] hover:underline font-bold inline-flex items-center gap-1"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Khu Vực Thành Viên</span>
          </button>
        </div>
      </div>

      {/* 2. HERO SHOWCASE: THEME FOOTBALL COACH CLUB STYLE */}
      <section className="relative rounded-2xl overflow-hidden bg-slate-950 text-white shadow-xl border border-slate-800">
        <div className="relative min-h-[420px] md:min-h-[480px] flex flex-col justify-end p-6 sm:p-10 z-10">
          {/* Background Image với hiệu ứng thể thao */}
          <div className="absolute inset-0 z-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_COVER_URL}
              alt="FC HĐH Gò Nổi Cover"
              className="w-full h-full object-cover object-center filter brightness-[0.45] contrast-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#173f9e]/80 via-transparent to-slate-950/80" />
          </div>

          {/* Nội dung Hero */}
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ffc933] text-[#173f9e] font-extrabold text-xs uppercase tracking-wider shadow-md">
              <Flame className="h-4 w-4 fill-current" />
              <span>Đoàn Kết • Bản Lĩnh • Nghĩa Tình Đồng Hương</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-white/95 p-1.5 border-2 border-[#ffc933] shadow-2xl shrink-0 flex items-center justify-center backdrop-blur">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={OFFICIAL_LOGO_URL}
                  alt="Logo FC HĐH Gò Nổi"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white uppercase drop-shadow-sm">
                  FC HĐH GÒ NỔI
                </h1>
                <p className="text-[#ffc933] font-bold text-sm sm:text-lg tracking-wide uppercase">
                  Tại TP. Hồ Chí Minh
                </p>
              </div>
            </div>

            <p className="text-slate-300 text-xs sm:text-base leading-relaxed line-clamp-3 max-w-2xl">
              Nơi hội tụ, rèn luyện sức khoẻ và thắt chặt tình cảm của những người con vùng đất Gò Nổi (Điện Quang, Điện Trung, Điện Phong) đang học tập, làm việc và sinh sống tại TP. Hồ Chí Minh.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-2 rounded-xl bg-[#ffc933] hover:bg-[#ffbf00] px-6 py-3.5 text-sm font-extrabold text-[#173f9e] transition shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                <span>ĐĂNG NHẬP THÀNH VIÊN / QUẢN LÝ</span>
              </button>
              <a
                href={fanpageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/30 backdrop-blur px-5 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
              >
                <span>THEO DÕI FANPAGE</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 3. NEXT MATCH HIGHLIGHT CARD (MATCH CENTER PREVIEW) */}
      {nextMatch && (
        <section className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-[#173f9e] text-white px-5 py-3 flex items-center justify-between border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#ffc933]" />
              <span className="font-extrabold text-xs uppercase tracking-wider text-[#ffc933]">
                Trận Đấu Tiêu Điểm
              </span>
              <span className="text-slate-300 text-xs">• {nextMatch.label}</span>
            </div>
            <span className="bg-white/10 px-2.5 py-0.5 rounded text-[11px] font-bold text-slate-200">
              {nextMatch.status}
            </span>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-6">
              {/* Đội chủ nhà: Gò Nổi */}
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-slate-50 border-2 border-[#173f9e] p-2 flex items-center justify-center shadow-sm">
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
                  <span className="text-xs font-semibold text-slate-500">
                    Áo Vàng - Quần Xanh
                  </span>
                </div>
              </div>

              {/* Tỉ số hoặc Thời gian VS */}
              <div className="flex flex-col items-center justify-center text-center space-y-2 py-3 md:py-0 border-y md:border-y-0 md:border-x border-slate-100">
                {nextMatch.team_score !== null && nextMatch.opponent_score !== null ? (
                  <div className="inline-flex items-center gap-3 bg-slate-900 text-[#ffc933] px-6 py-2 rounded-xl text-2xl font-black tracking-widest shadow-md">
                    <span>{nextMatch.team_score}</span>
                    <span className="text-slate-500 text-lg">-</span>
                    <span>{nextMatch.opponent_score}</span>
                  </div>
                ) : (
                  <div className="inline-block bg-[#173f9e]/10 text-[#173f9e] font-black text-xl px-5 py-2 rounded-xl tracking-wider">
                    VS
                  </div>
                )}

                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Clock className="h-3.5 w-3.5 text-[#173f9e]" />
                    <span>
                      {nextMatch.kickoff_time} | {formatDateVN(nextMatch.match_date)}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 block">
                    <MapPin className="h-3.5 w-3.5 text-rose-500" />
                    <span>{nextMatch.venue}</span>
                  </div>
                </div>
              </div>

              {/* Đội đối thủ */}
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center text-slate-700 font-extrabold text-xl shadow-sm">
                  <Shield className="h-8 w-8 text-slate-400" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900 uppercase">
                    {nextMatch.opponent}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">
                    Đối thủ / Giao hữu
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
              <span className="italic text-slate-500">
                * Kính mời quý bà con & cổ động viên đồng hương đến sân cổ vũ cho đội bóng.
              </span>
              <button
                type="button"
                onClick={onOpenLogin}
                className="font-bold text-[#173f9e] hover:underline inline-flex items-center gap-1"
              >
                <span>Cầu thủ đăng nhập để điểm danh</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 4. CLUB FIXTURES & RESULTS (BẢNG LỊCH THI ĐẤU & KẾT QUẢ ĐẶC TRƯNG FOOTBALL CLUB) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-slate-200 pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#173f9e] uppercase tracking-tight flex items-center gap-2">
              <Trophy className="h-6 w-6 text-[#ffc933]" />
              <span>Lịch Thi Đấu & Kết Quả Trận Đấu</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Thông tin công khai các trận thi đấu tuần của CLB FC HĐH Gò Nổi
            </p>
          </div>

          <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("fixtures")}
              className={`px-4 py-1.5 rounded-md text-xs font-extrabold uppercase transition cursor-pointer ${
                activeTab === "fixtures"
                  ? "bg-[#173f9e] text-[#ffc933] shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Lịch Sắp Tới ({upcomingMatches.length})
            </button>
            <button
              onClick={() => setActiveTab("results")}
              className={`px-4 py-1.5 rounded-md text-xs font-extrabold uppercase transition cursor-pointer ${
                activeTab === "results"
                  ? "bg-[#173f9e] text-[#ffc933] shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Kết Quả Đã Đấu ({pastMatches.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Lịch sắp diễn ra */}
        {activeTab === "fixtures" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingMatches.length === 0 ? (
              <div className="col-span-2 py-10 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm">
                Hiện chưa có lịch thi đấu mới. Ban quản lý đang sắp xếp trận tiếp theo!
              </div>
            ) : (
              upcomingMatches.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-[#173f9e] transition flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="bg-[#ffc933]/20 text-[#173f9e] px-2.5 py-0.5 rounded border border-[#ffc933]/50">
                        {m.label}
                      </span>
                      <span className="text-slate-500 inline-flex items-center gap-1 font-semibold">
                        <Clock className="h-3.5 w-3.5" />
                        {m.kickoff_time} | {formatDateVN(m.match_date)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2 border-y border-slate-100">
                      <div className="font-extrabold text-sm text-[#173f9e] flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={OFFICIAL_LOGO_URL}
                          alt="GN"
                          className="h-6 w-6 object-contain"
                        />
                        <span>FC HĐH Gò Nổi</span>
                      </div>
                      <span className="text-xs font-black text-slate-400">VS</span>
                      <div className="font-bold text-sm text-slate-800 text-right truncate max-w-[140px]">
                        {m.opponent}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-rose-500" />
                      {m.venue}
                    </span>
                    <button
                      onClick={onOpenLogin}
                      className="font-bold text-[#173f9e] hover:underline"
                    >
                      Đăng nhập điểm danh →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Kết quả đã thi đấu */}
        {activeTab === "results" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pastMatches.slice(0, 8).map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-[#173f9e] transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded">
                      {m.label} (Đã kết thúc)
                    </span>
                    <span className="text-slate-500">
                      {formatDateVN(m.match_date)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-y border-slate-100">
                    <div className="font-extrabold text-sm text-[#173f9e] flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={OFFICIAL_LOGO_URL}
                        alt="GN"
                        className="h-6 w-6 object-contain"
                      />
                      <span>Gò Nổi</span>
                    </div>

                    <div className="bg-[#173f9e] text-[#ffc933] font-black px-3 py-1 rounded text-sm tracking-widest">
                      {m.team_score ?? 0} - {m.opponent_score ?? 0}
                    </div>

                    <div className="font-bold text-sm text-slate-800 text-right truncate max-w-[140px]">
                      {m.opponent}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {m.venue}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Sinh hoạt bóng đá đồng hương
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. PHOTO GALLERY & FANPAGE (HÌNH ẢNH HOẠT ĐỘNG THỂ THAO) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Gallery 4 ảnh phong cách website bóng đá */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-base sm:text-lg text-[#173f9e] uppercase flex items-center gap-2">
              <Star className="h-5 w-5 text-[#ffc933] fill-current" />
              <span>Khoảnh Khắc Sân Cỏ FC HĐH Gò Nổi</span>
            </h3>
            <a
              href={fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-[#0284c7] hover:underline inline-flex items-center gap-1"
            >
              <span>Xem thêm</span>
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
                  <span className="text-[10px] font-extrabold text-[#ffc933] uppercase block">
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

        {/* Fanpage Widget */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-base sm:text-lg text-[#173f9e] uppercase flex items-center gap-2">
              <span>Fanpage Facebook CLB</span>
            </h3>
            <a
              href={fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-[#0284c7] hover:underline"
            >
              Facebook →
            </a>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex justify-center p-1">
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

          <div className="rounded-xl bg-[#173f9e] text-white p-3.5 text-xs flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-200">
              Giao lưu & tham gia cùng đội bóng
            </span>
            <a
              href={fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#ffc933] text-[#173f9e] px-3 py-1.5 rounded-lg font-bold hover:bg-[#ffbf00] transition shrink-0"
            >
              Nhắn Tin Fanpage
            </a>
          </div>
        </div>
      </section>

      {/* 6. FOOTER THEME STYLE FOOTBALL CLUB */}
      <footer className="border-t-2 border-slate-200 pt-8 mt-12 text-slate-500 text-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={OFFICIAL_LOGO_URL}
            alt="Logo"
            className="h-9 w-9 object-contain"
          />
          <div>
            <p className="font-extrabold text-slate-800">
              CLB BÓNG ĐÁ HỘI ĐỒNG HƯƠNG GÒ NỔI TẠI TP. HỒ CHÍ MINH
            </p>
            <p className="text-[11px] text-slate-400">
              Sinh hoạt & rèn luyện thể thao hằng tuần tại các cụm sân TP.HCM
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenLogin}
            className="bg-slate-900 text-white font-bold px-4 py-2 rounded-lg hover:bg-slate-800 transition"
          >
            Đăng Nhập Thành Viên
          </button>
        </div>
      </footer>
    </div>
  );
}
