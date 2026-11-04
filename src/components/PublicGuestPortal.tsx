"use client";

import React from "react";
import {
  Calendar,
  MapPin,
  Users,
  ExternalLink,
  LogIn,
  Trophy,
  HeartHandshake,
  Clock,
  Camera,
  Star,
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
    title: "Đội hình ra sân sinh hoạt hằng tuần — FC HĐH Gò Nổi tại TP.HCM",
    tag: "Ảnh tập thể",
  },
  {
    src: "/uploads/avatars/member-10.jpg",
    title: "Tinh thần đoàn kết & nhiệt huyết trên sân cỏ",
    tag: "Khoảnh khắc sân cỏ",
  },
  {
    src: "/uploads/avatars/member-5.jpg",
    title: "Giao lưu bóng đá đồng hương Gò Nổi tại TP. Hồ Chí Minh",
    tag: "Hoạt động tuần",
  },
  {
    src: "/uploads/avatars/member-13.jpg",
    title: "Rèn luyện sức khoẻ và gắn kết anh em đồng hương",
    tag: "Giao hữu",
  },
  {
    src: "/uploads/avatars/member-7.jpg",
    title: "Màu áo vàng - xanh truyền thống của FC HĐH Gò Nổi",
    tag: "Màu cờ sắc áo",
  },
];

export function PublicGuestPortal({
  data,
  onOpenLogin,
}: PublicGuestPortalProps) {
  const { settings, matches, attendances } = data;
  const fanpageUrl = settings.fanpage_url || FANPAGE_URL;
  const encodedFanpage = encodeURIComponent(fanpageUrl);

  const recentMatches = matches.slice().reverse().slice(0, 6);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero Banner Có Ảnh Bìa Đội Bóng & Logo Chính Thức Đồng Bộ Màu Navy - Gold */}
      <section className="rounded-xl overflow-hidden bg-[#1e4fc2] text-white border-2 border-[#ffc933]/60 shadow-md">
        {/* Ảnh bìa lớn phía trên */}
        <div className="relative h-56 sm:h-80 md:h-96 w-full overflow-hidden bg-slate-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={OFFICIAL_COVER_URL}
            alt="Ảnh bìa Đội bóng FC HĐH Gò Nổi tại TP. Hồ Chí Minh"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1e4fc2] via-[#1e4fc2]/45 to-transparent" />

          {/* Huy hiệu 3 sao vàng trên góc */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 inline-flex items-center gap-1 rounded-full bg-[#1e4fc2]/90 border border-[#ffc933] px-3 py-1 text-xs font-extrabold text-[#ffc933] shadow-sm">
            <Star className="h-3.5 w-3.5 fill-[#ffc933]" />
            <Star className="h-3.5 w-3.5 fill-[#ffc933]" />
            <Star className="h-3.5 w-3.5 fill-[#ffc933]" />
            <span className="ml-1 text-white">HĐH GÒ NỔI • TP.HCM</span>
          </div>
        </div>

        {/* Phần thân Banner kèm Logo Khiên Chính Thức */}
        <div className="relative px-5 pb-6 pt-2 sm:px-8 sm:pb-8 -mt-14 sm:-mt-20 flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5">
            {/* Logo chính thức */}
            <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-xl bg-white p-1.5 border-2 border-[#ffc933] shadow-xl shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={OFFICIAL_LOGO_URL}
                alt="Logo FC HĐH Gò Nổi tại TP. Hồ Chí Minh"
                className="h-full w-full object-contain rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#2f66dd] px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#ffc933] border border-[#ffc933]/40">
                <span>⚽ Cổng Hoạt Động Chính Thức</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                FC HĐH GÒ NỔI{" "}
                <span className="text-[#ffc933] text-lg sm:text-2xl block sm:inline font-bold">
                  TẠI TP. HỒ CHÍ MINH
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed">
                Gắn kết những người con quê hương Gò Nổi tại TP. Hồ Chí Minh qua
                trái bóng tròn — Duy trì sinh hoạt hằng tuần, rèn luyện sức khoẻ
                và lan toả nghĩa tình đồng hương.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href={fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] px-4 py-2.5 text-xs sm:text-sm font-bold text-white transition shadow-sm"
            >
              <span>📘 Fanpage FC HĐH Gò Nổi</span>
              <ExternalLink className="h-4 w-4" />
            </a>

            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-2 rounded-xl bg-[#ffc933] hover:bg-[#eab308] px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[#1e4fc2] transition cursor-pointer shadow-sm"
            >
              <LogIn className="h-4 w-4" />
              <span>Đăng Nhập Thành Viên</span>
            </button>
          </div>
        </div>
      </section>

      {/* Khu vực Hình Ảnh Hoạt Động & Cầu Thủ Ra Sân */}
      <section className="rounded-xl bg-white p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Camera className="h-5 w-5 text-[#1e4fc2]" />
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#1e4fc2]">
                Hình Ảnh Cầu Thủ & Hoạt Động Đội Bóng
              </h2>
              <p className="text-xs text-slate-500">
                Những khoảnh khắc ra sân hằng tuần của anh em FC HĐH Gò Nổi
              </p>
            </div>
          </div>
          <a
            href={fanpageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-[#0284c7] hover:underline inline-flex items-center gap-1"
          >
            <span>Xem thêm ảnh trên Fanpage</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          {/* Ảnh lớn tiêu điểm */}
          <div className="md:col-span-7 relative rounded-xl overflow-hidden border border-slate-200 group min-h-[240px] sm:min-h-[300px] bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ACTION_GALLERY[0].src}
              alt={ACTION_GALLERY[0].title}
              className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1e4fc2]/95 via-[#1e4fc2]/60 to-transparent p-4 text-white">
              <span className="inline-block rounded bg-[#ffc933] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#1e4fc2]">
                {ACTION_GALLERY[0].tag}
              </span>
              <p className="mt-1 text-sm sm:text-base font-bold">
                {ACTION_GALLERY[0].title}
              </p>
            </div>
          </div>

          {/* 4 Ảnh chân dung / khoảnh khắc cầu thủ trên sân */}
          <div className="md:col-span-5 grid grid-cols-2 gap-3">
            {ACTION_GALLERY.slice(1).map((item, idx) => (
              <div
                key={idx}
                className="relative rounded-xl overflow-hidden border border-slate-200 group h-36 sm:h-40 bg-slate-900"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.src}
                  alt={item.title}
                  className="h-full w-full object-cover object-top group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1e4fc2]/90 to-transparent p-2.5 text-white">
                  <span className="text-[10px] font-bold text-[#ffc933] block">
                    {item.tag}
                  </span>
                  <p className="text-[11px] font-semibold line-clamp-1">
                    {item.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lịch Tuần Công Khai & Kết Nối Fanpage Facebook */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái: Lịch sinh hoạt & thi đấu tuần */}
        <section className="lg:col-span-7 rounded-xl bg-white p-5 sm:p-6 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <Calendar className="h-5 w-5 text-[#1e4fc2]" />
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-[#1e4fc2]">
                  Lịch Thi Đấu & Sinh Hoạt Hằng Tuần
                </h2>
                <p className="text-xs text-slate-500">
                  Lịch ra sân và kết quả các trận giao hữu của FC HĐH Gò Nổi
                </p>
              </div>
            </div>
            <span className="text-xs font-extrabold text-[#1e4fc2] bg-[#ffc933]/25 border border-[#ffc933] px-2.5 py-1 rounded-full">
              {matches.length} trận mùa này
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentMatches.map((m) => {
              const countJoined = attendances.filter(
                (a) =>
                  a.match_id === m.id &&
                  (a.attended === 1 ||
                    a.paid === 1 ||
                    a.rsvp_status === "registered")
              ).length;

              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-slate-200 p-4 hover:border-[#1e4fc2] transition bg-slate-50/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase ${
                        m.status === "Sắp diễn ra"
                          ? "bg-[#ffc933] text-[#1e4fc2]"
                          : "bg-[#1e4fc2] text-white"
                      }`}
                    >
                      {m.status}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDateVN(m.match_date)} • {m.kickoff_time}
                    </span>
                  </div>

                  <h3 className="mt-2 text-base font-extrabold text-[#1e4fc2]">
                    {m.label}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Đối thủ: <strong>{m.opponent}</strong>
                  </p>

                  {m.team_score !== null && m.opponent_score !== null && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#1e4fc2] text-[#ffc933] px-2.5 py-1 text-xs font-extrabold">
                      <Trophy className="h-3.5 w-3.5" />
                      <span>
                        Gò Nổi {m.team_score} - {m.opponent_score} Đối thủ
                      </span>
                    </div>
                  )}

                  <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 font-bold text-[#1e4fc2]">
                      <MapPin className="h-3.5 w-3.5 text-[#0284c7]" />
                      {m.venue}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      {countJoined} cầu thủ
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Cột phải: Kết nối Fanpage chính thức https://www.facebook.com/FCHDHGoNoi/ */}
        <section className="lg:col-span-5 rounded-xl bg-white p-5 sm:p-6 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <HeartHandshake className="h-5 w-5 text-[#0284c7]" />
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-[#1e4fc2]">
                  Fanpage FC HĐH Gò Nổi
                </h2>
                <p className="text-xs text-slate-500">
                  Cập nhật tin tức và hoạt động mới nhất trên Facebook
                </p>
              </div>
            </div>
            <a
              href={fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#0284c7] hover:underline"
            >
              <span>Mở Fanpage</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col items-center p-2">
            <iframe
              title="Fanpage FC HĐH Gò Nổi"
              src={`https://www.facebook.com/plugins/page.php?href=${encodedFanpage}&tabs=timeline&width=380&height=420&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`}
              width="380"
              height="420"
              style={{ border: "none", overflow: "hidden", maxWidth: "100%" }}
              scrolling="no"
              frameBorder="0"
              allowFullScreen={true}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            />
          </div>

          <div className="rounded-xl bg-[#1e4fc2] text-white p-4 text-xs flex items-center justify-between gap-3 border border-[#ffc933]/40">
            <div>
              <p className="font-bold text-[#ffc933]">
                Kết nối Fanpage chính thức FC HĐH Gò Nổi
              </p>
              <p className="text-slate-300 mt-0.5 break-all">{fanpageUrl}</p>
            </div>
            <a
              href={fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg bg-[#ffc933] px-3.5 py-2 text-xs font-extrabold text-[#1e4fc2] hover:bg-[#eab308]"
            >
              Truy cập
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
