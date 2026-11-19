"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, Calendar, Camera, Clock } from "lucide-react";
import {
  ACTIVITY_CATEGORIES,
  CLUB_TIMELINE_YEARS,
  type ActivityCategory,
  type ClubActivityPost,
} from "@/data/clubActivities";
import type { LightboxImage } from "../ImageLightboxModal";
import { MOSAIC, Reveal, WRAP } from "./shared";

export interface ActivitiesMagazineProps {
  fanpageUrl: string;
  encodedFanpage: string;
  activeActivityCategory: ActivityCategory;
  setActiveActivityCategory: React.Dispatch<React.SetStateAction<ActivityCategory>>;
  selectedTimelineYear: string;
  setSelectedTimelineYear: React.Dispatch<React.SetStateAction<string>>;
  allActivityPosts: ClubActivityPost[];
  filteredActivityPosts: ClubActivityPost[];
  handleOpenLightbox: (images: LightboxImage[], startIndex?: number) => void;
}

export function ActivitiesMagazine({
  fanpageUrl,
  encodedFanpage,
  activeActivityCategory,
  setActiveActivityCategory,
  selectedTimelineYear,
  setSelectedTimelineYear,
  allActivityPosts,
  filteredActivityPosts,
  handleOpenLightbox,
}: ActivitiesMagazineProps) {
  return (
    <>
      <section
        id="activities"
        className="relative bg-gradient-to-b from-navy-800 via-navy-600 to-navy-800 text-white py-20 sm:py-28 border-b border-white/15"
      >
        <div className={WRAP}>
          <Reveal>
            {/* Header Chuyên Mục Chuẩn Báo Chí Thể Thao */}
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-8 border-b border-white/15">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.25em] text-gold-400 bg-gold-400/15 px-2.5 py-1 rounded border border-gold-400/40">
                    02 // BÀI VIẾT &amp; HOẠT ĐỘNG CLB
                  </span>
                  <span className="text-xs uppercase font-extrabold tracking-widest text-sky-200">
                    KHO TƯ LIỆU THỰC TẾ
                  </span>
                </div>
                <h2 className="mt-3 font-display font-black uppercase leading-tight text-4xl sm:text-6xl text-white">
                  Hoạt động &amp; <span className="text-gold-400">Ký ức sân cỏ</span>
                </h2>
                <p className="mt-3 max-w-2xl text-sm sm:text-base text-sky-100/90 leading-relaxed font-light">
                  Nơi ghi dấu những trận cầu nảy lửa, giải đấu truyền thống, khoảnh khắc giao lưu anh em đồng hương Điện Quang, Điện Trung, Điện Phong và tình cảm của các nhà tài trợ.
                </p>
              </div>

              <Link
                href="/hoat-dong"
                className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-gold-400 to-gold-300 hover:from-gold-300 hover:to-gold-400 px-5 py-3 rounded-xl transition shadow-lg w-fit shrink-0 hover:scale-[1.02]"
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
                <span className="text-sky-300 font-extrabold text-[10px] uppercase mr-1 shrink-0 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-gold-400" />
                  <span>Niên khóa:</span>
                </span>
                {CLUB_TIMELINE_YEARS.map((y) => (
                  <button
                    key={y.id}
                    type="button"
                    onClick={() => setSelectedTimelineYear(y.id)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer border text-xs flex items-center gap-1.5 ${selectedTimelineYear === y.id
                      ? "bg-gold-400 text-slate-950 font-black border-gold-400 shadow-sm"
                      : "bg-navy-700 text-sky-200 border-white/15 hover:border-white/30 hover:text-white"
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
                    className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition cursor-pointer border ${activeActivityCategory === cat.id
                      ? "bg-navy-500 text-gold-400 border-gold-400/70 shadow-md font-black"
                      : "bg-navy-700 text-sky-200 border-white/15 hover:border-white/30 hover:text-white"
                      }`}
                  >
                    {cat.label}
                    <span className="ml-1 opacity-70 text-[11px]">
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
            <div className="mt-10 p-12 text-center rounded-xl bg-navy-700 border border-white/15 text-sky-200 text-sm">
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
                      className="group block bg-navy-700 rounded-xl overflow-hidden border border-white/15 hover:border-gold-400/70 shadow-xl transition-all duration-300"
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
                          className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent"
                        />

                        {/* Badges chuyên mục và năm */}
                        <div className="absolute top-4 left-4 flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-navy-500 text-gold-400 border border-gold-400/40 shadow-sm">
                            TIÊU ĐIỂM // {filteredActivityPosts[0].categoryLabel}
                          </span>
                          {filteredActivityPosts[0].eventYear && (
                            <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-gold-500 text-slate-950 shadow-sm">
                              {filteredActivityPosts[0].eventYear}
                            </span>
                          )}
                        </div>

                        {/* Metadata ảnh và thời gian đọc */}
                        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white text-xs">
                          <span className="inline-flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded border border-white/15">
                            <Camera className="h-3.5 w-3.5 text-gold-500" />
                            <span>
                              Album{" "}
                              {1 +
                                (filteredActivityPosts[0].galleryImages?.length ||
                                  0)}{" "}
                              ảnh
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded border border-white/15 text-sky-200">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{filteredActivityPosts[0].readingTime}</span>
                          </span>
                        </div>
                      </div>

                      {/* Thân bài viết tiêu điểm */}
                      <div className="p-6 sm:p-7 space-y-3.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-sky-200">
                          <Calendar className="h-3.5 w-3.5 text-gold-400" />
                          <span>{filteredActivityPosts[0].publishedDate}</span>
                          <span>•</span>
                          <span>Tác giả: {filteredActivityPosts[0].author}</span>
                        </div>

                        <h3 className="font-display font-black uppercase text-2xl sm:text-3xl text-white group-hover:text-gold-400 transition leading-snug">
                          {filteredActivityPosts[0].title}
                        </h3>

                        <p className="text-sky-100 text-sm leading-relaxed font-light">
                          {filteredActivityPosts[0].summary}
                        </p>

                        {filteredActivityPosts[0].quote && (
                          <div className="p-3.5 rounded-lg bg-navy-800 border-l-4 border-gold-400 text-xs italic text-sky-200">
                            &ldquo;{filteredActivityPosts[0].quote}&rdquo;
                          </div>
                        )}

                        {filteredActivityPosts[0].taggedPlayerNames &&
                          filteredActivityPosts[0].taggedPlayerNames.length >
                          0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                              <span className="text-[10px] uppercase font-bold text-sky-300 mr-1">
                                Cầu thủ:
                              </span>
                              {filteredActivityPosts[0].taggedPlayerNames.map(
                                (name) => (
                                  <span
                                    key={name}
                                    className="px-2 py-0.5 rounded bg-navy-800 text-sky-200 text-[10px] font-semibold border border-white/15"
                                  >
                                    {name}
                                  </span>
                                )
                              )}
                            </div>
                          )}

                        <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-bold text-gold-400">
                          <span className="group-hover:translate-x-1 transition inline-flex items-center gap-1.5">
                            <span>Đọc bài viết chi tiết &amp; xem album ảnh</span>
                            <ArrowRight className="h-4 w-4 text-gold-400" />
                          </span>
                          <span className="text-sky-200/80 group-hover:text-white">
                            Chi tiết bài viết →
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                )}

                {/* 5 COLS: DÒNG TIN HOẠT ĐỘNG (SECONDARY EDITORIAL FEED) */}
                <div className="lg:col-span-5 bg-navy-700 rounded-xl border border-white/15 shadow-xl p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/15">
                    <span className="text-xs uppercase font-extrabold tracking-widest text-gold-400 flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4" />
                      <span>Dòng tin hoạt động gần đây</span>
                    </span>
                    <span className="text-[11px] text-sky-200">
                      {filteredActivityPosts.length} bài viết
                    </span>
                  </div>

                  <div className="divide-y divide-white/10">
                    {filteredActivityPosts.slice(1, 4).map((post) => (
                      <Link
                        key={post.id}
                        href={`/hoat-dong/${post.id}`}
                        className="group py-3.5 flex gap-3.5 items-center cursor-pointer"
                      >
                        <div className="relative h-20 w-24 sm:h-22 sm:w-28 rounded-lg overflow-hidden shrink-0 bg-navy-800 border border-white/15">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={post.featuredImage}
                            alt={post.title}
                            className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          {post.eventYear && (
                            <span className="absolute bottom-1 right-1 text-[9px] font-black px-1.5 py-0.2 rounded bg-black/85 text-gold-300">
                              {post.eventYear}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-[10px] text-sky-300 font-semibold mb-0.5">
                            <span className="text-gold-400 uppercase font-bold">
                              {post.categoryLabel}
                            </span>
                            <span>•</span>
                            <span>{post.publishedDate}</span>
                          </div>

                          <h4 className="font-display font-bold uppercase text-xs sm:text-sm text-white group-hover:text-gold-400 transition line-clamp-2 leading-snug">
                            {post.title}
                          </h4>

                          <p className="mt-1 line-clamp-1 text-sky-200/80 font-light text-[11px]">
                            {post.summary}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-white/10 text-center">
                    <Link
                      href="/hoat-dong"
                      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-400 hover:text-gold-300"
                    >
                      <span>Xem toàn bộ chuyên mục hoạt động</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* CÁC BÀI VIẾT BỔ SUNG (NẾU CÒN) TRÌNH BÀY DẠNG 3 CỘT GỌN GÀNG */}
              {filteredActivityPosts.length > 4 && (
                <div className="pt-6 border-t border-white/15">
                  <h4 className="text-xs uppercase font-extrabold tracking-widest text-sky-300 mb-4">
                    Bài viết lưu trữ khác ({filteredActivityPosts.length - 4})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {filteredActivityPosts.slice(4).map((post) => (
                      <Link
                        key={post.id}
                        href={`/hoat-dong/${post.id}`}
                        className="group bg-navy-700 rounded-xl overflow-hidden border border-white/15 hover:border-gold-400/70 shadow-lg hover:shadow-xl transition flex flex-col justify-between p-5"
                      >
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-sky-300 mb-2">
                            <span className="font-bold uppercase text-gold-400">
                              {post.categoryLabel}
                            </span>
                            <span>{post.publishedDate}</span>
                          </div>
                          <h5 className="font-display font-bold uppercase text-sm sm:text-base text-white group-hover:text-gold-400 transition line-clamp-2">
                            {post.title}
                          </h5>
                          <p className="mt-2 text-xs text-sky-200/80 line-clamp-2 font-light">
                            {post.summary}
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-gold-400">
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
      <section id="gallery" className="bg-navy-900">
        <div className={`${WRAP} pt-20 sm:pt-28 pb-10`}>
          <Reveal>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.25em] text-gold-500 bg-gold-500/15 px-2.5 py-1 rounded border border-gold-500/30">
                06 // TƯ LIỆU SÂN CỎ
              </span>
              <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400">
                HÌNH ẢNH THỰC TẾ
              </span>
            </div>
            <h2 className="mt-3 font-display font-black uppercase leading-tight text-4xl sm:text-6xl lg:text-7xl text-white">
              Khoảnh khắc <span className="text-gold-500">của đội</span>
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
                <figcaption className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-navy-800/90 via-transparent to-transparent p-5 opacity-90 group-hover:opacity-100 transition">
                  <span className="text-gold-500 text-[11px] font-bold uppercase tracking-[0.25em]">
                    {img.tag}
                  </span>
                  <p className="font-display font-bold uppercase text-2xl sm:text-3xl leading-none mt-1 text-white">
                    {img.title}
                  </p>
                  <span className="text-xs text-sky-200/80 opacity-0 group-hover:opacity-100 transition mt-1.5 flex items-center gap-1.5">
                    <Camera className="h-3 w-3 text-gold-500" />
                    <span>Nhấp để phóng to toàn màn hình</span>
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>

        {/* Fanpage Facebook */}
        <div className="bg-navy-700 border-t border-white/10">
          <div
            className={`${WRAP} py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center`}
          >
            <Reveal>
              <h3 className="font-display font-bold uppercase leading-[0.85] text-6xl sm:text-8xl text-white">
                Theo dõi <span className="text-gold-500">Fanpage</span>
              </h3>
              <p className="mt-5 max-w-md text-lg text-sky-100 font-light leading-relaxed">
                Ảnh, video bàn thắng và tin nóng của đội bóng được cập nhật sau mỗi trận. Anh em đồng hương muốn giao lưu hoặc gia nhập đội thì nhắn thẳng cho chúng mình nhé!
              </p>
              <a
                href={fanpageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-3 bg-gradient-to-r from-gold-500 to-gold-450 hover:from-gold-450 hover:to-gold-300 text-slate-950 font-bold px-7 py-4 text-sm uppercase tracking-widest rounded-xl transition shadow-lg"
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
    </>
  );
}
