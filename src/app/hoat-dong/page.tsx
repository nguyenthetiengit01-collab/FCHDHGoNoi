"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  CLUB_ACTIVITIES_POSTS,
  ACTIVITY_CATEGORIES,
  CLUB_TIMELINE_YEARS,
  ActivityCategory,
  ClubActivityPost,
} from "@/data/clubActivities";
import {
  buildClubGalleryPhotos,
  buildClubGalleryAlbums,
  filterClubGalleryPhotos,
  INITIAL_GALLERY_LIMIT,
  GALLERY_LOAD_STEP,
  type ClubGalleryPhoto,
} from "@/data/clubPhotoGallery";
import { OFFICIAL_LOGO_URL, FANPAGE_URL } from "@/types/app";
import {
  ImageLightboxModal,
  type LightboxImage,
} from "@/components/ImageLightboxModal";
import {
  Calendar,
  Clock,
  ArrowRight,
  ArrowLeft,
  Search,
  Trophy,
  HeartHandshake,
  Users,
  Award,
  Camera,
  Flame,
  ExternalLink,
  Images,
  ZoomIn,
  BookOpen,
} from "lucide-react";

export default function HoatDongPage() {
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [posts, setPosts] = useState<ClubActivityPost[]>(CLUB_ACTIVITIES_POSTS);
  const [galleryCategory, setGalleryCategory] = useState<ActivityCategory>("all");
  const [visiblePhotoCount, setVisiblePhotoCount] = useState<number>(INITIAL_GALLERY_LIMIT);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (imgs: LightboxImage[], idx = 0) => {
    setLightboxImages(imgs);
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  useEffect(() => {
    fetch("/api/team")
      .then((res) => res.json())
      .then((json) => {
        if (json && Array.isArray(json.posts) && json.posts.length > 0) {
          setPosts(json.posts);
        }
      })
      .catch(() => {});
  }, []);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchCat =
        selectedCategory === "all" || post.category === selectedCategory;
      const matchYear =
        selectedYear === "all"
          ? true
          : (post.eventYear || post.publishedDate?.slice(0, 4)) === selectedYear;
      const matchQuery =
        !searchQuery.trim() ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.taggedPlayerNames &&
          post.taggedPlayerNames.some((n) =>
            n.toLowerCase().includes(searchQuery.toLowerCase())
          ));
      return matchCat && matchYear && matchQuery;
    });
  }, [posts, selectedCategory, selectedYear, searchQuery]);

  const allGalleryPhotos = useMemo(
    () => buildClubGalleryPhotos(posts, true),
    [posts]
  );

  const galleryAlbums = useMemo(
    () => buildClubGalleryAlbums(allGalleryPhotos),
    [allGalleryPhotos]
  );

  const filteredGalleryPhotos = useMemo(
    () =>
      filterClubGalleryPhotos(allGalleryPhotos, {
        category: galleryCategory,
        year: selectedYear,
        query: searchQuery,
      }),
    [allGalleryPhotos, galleryCategory, selectedYear, searchQuery]
  );

  const visibleGalleryPhotos = useMemo(
    () => filteredGalleryPhotos.slice(0, visiblePhotoCount),
    [filteredGalleryPhotos, visiblePhotoCount]
  );

  const toGalleryLightboxItems = (items: ClubGalleryPhoto[]): LightboxImage[] =>
    items.map((photo) => ({
      src: photo.src,
      title: photo.title,
      caption: photo.caption,
      tag: photo.categoryLabel,
    }));

  const getCategoryIcon = (id: ActivityCategory) => {
    switch (id) {
      case "giaidau":
        return <Trophy className="h-4 w-4" />;
      case "giaoluu":
        return <HeartHandshake className="h-4 w-4" />;
      case "cauthu":
        return <Users className="h-4 w-4" />;
      case "taitro":
        return <Award className="h-4 w-4" />;
      case "anhbia":
        return <Camera className="h-4 w-4" />;
      default:
        return <Flame className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#050b17] text-slate-100 flex flex-col selection:bg-[#d4af37] selection:text-slate-950">
      {/* ==================== HEADER TRANG HOẠT ĐỘNG ==================== */}
      <header className="sticky top-0 z-40 bg-[#092244]/90 backdrop-blur-md border-b border-[#d4af37]/30 py-3.5 px-4 sm:px-8 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-3 group cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_LOGO_URL}
              alt="FC HĐH Gò Nổi"
              className="h-10 w-10 rounded-full object-contain bg-white p-0.5 ring-2 ring-[#d4af37] group-hover:scale-105 transition"
            />
            <div>
              <span className="font-display font-extrabold uppercase text-lg sm:text-xl tracking-wide text-white block">
                FC HĐH GÒ NỔI
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[#d4af37] font-bold block">
                Chuyên trang Hoạt động & Bài viết
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/cau-chuyen-go-noi"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-sky-200 hover:text-[#d4af37] transition"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Câu chuyện Gò Nổi</span>
            </Link>

            <a
              href={FANPAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-sky-200 hover:text-[#d4af37] transition"
            >
              <span>Fanpage CLB</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#17488c] to-[#1e5eb8] hover:from-[#1e5eb8] hover:to-[#2563eb] text-white font-bold px-4 py-2 text-xs uppercase tracking-wider border border-sky-300/30 transition shadow-md"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Về trang chủ</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ==================== HERO TIÊU ĐỀ CHUYÊN TRANG ==================== */}
      <section className="relative py-16 sm:py-20 px-4 sm:px-8 overflow-hidden bg-gradient-to-b from-[#092244] via-[#0d2e5b] to-[#050b17] border-b border-[#d4af37]/20">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 25%, #38bdf8 0, transparent 40%), linear-gradient(90deg, transparent 49%, rgba(212,175,55,0.3) 50%, transparent 51%)",
          }}
        />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/50 px-4 py-1 text-xs font-extrabold text-[#fde047] backdrop-blur-md">
            <Flame className="h-4 w-4 text-[#d4af37]" />
            <span>Phóng Sự • Tin Tức • Khoảnh Khắc Gò Nổi</span>
          </div>

          <h1 className="font-display font-extrabold uppercase text-4xl sm:text-6xl lg:text-7xl text-white tracking-tight leading-tight">
            Hoạt Động & Bài Viết <span className="text-[#d4af37]">CLB</span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-sky-200 font-light leading-relaxed">
            Nơi lưu giữ từng nhịp đập, trận cầu rực lửa sân 7, những nghĩa tình đồng hương sâu nặng của những người con xã Gò Nổi (TP. Đà Nẵng) – chung cội nguồn 3 xã Điện Quang, Điện Trung, Điện Phong cũ tại Sài Gòn.
          </p>

          {/* Ô tìm kiếm nhanh */}
          <div className="pt-4 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm bài viết, tác giả, giải đấu..."
                className="w-full bg-[#071933]/90 border border-[#d4af37]/40 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5 text-xs font-bold">
            <a
              href="#hoat-dong-cong-dong"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-3.5 py-2 text-sky-100 transition"
            >
              <Flame className="h-3.5 w-3.5 text-[#d4af37]" />
              <span>Hoạt động cộng đồng ({posts.length})</span>
            </a>
            <a
              href="#thu-vien-hinh-anh"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border border-[#d4af37]/40 px-3.5 py-2 text-[#fde047] transition"
            >
              <Images className="h-3.5 w-3.5 text-[#d4af37]" />
              <span>Thư viện hình ảnh ({allGalleryPhotos.length} ảnh)</span>
            </a>
          </div>
        </div>
      </section>

      {/* ==================== BỘ LỌC DÒNG THỜI GIAN & CHUYÊN MỤC ==================== */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 space-y-5">
        {/* Dòng thời gian CLB theo năm */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
          <span className="text-xs uppercase font-extrabold text-sky-300 tracking-wider mr-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#d4af37]" />
            <span>Dòng thời gian:</span>
          </span>
          {CLUB_TIMELINE_YEARS.map((y) => (
            <button
              key={y.id}
              type="button"
              onClick={() => setSelectedYear(y.id)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer border flex items-center gap-1.5 ${
                selectedYear === y.id
                  ? "bg-[#d4af37] text-slate-950 font-black border-[#d4af37] shadow-sm"
                  : "bg-[#092244]/80 text-sky-200 hover:bg-[#123e7a] hover:text-white border-white/10"
              }`}
            >
              <span>{y.label}</span>
              <span className="text-[10px] opacity-75 font-normal">({y.highlight})</span>
            </button>
          ))}
        </div>

        {/* 5 Chuyên mục bài viết */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-1 border-t border-white/10">
          {ACTIVITY_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition cursor-pointer ${
                  isSelected
                    ? "bg-[#d4af37] text-slate-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                    : "bg-[#092244]/80 text-sky-200 hover:bg-[#123e7a] hover:text-white border border-white/10"
                }`}
              >
                {getCategoryIcon(cat.id)}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* ==================== DANH SÁCH BÀI VIẾT ==================== */}
        <div id="hoat-dong-cong-dong" className="mt-8 scroll-mt-24">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-20 bg-[#092244]/40 rounded-3xl border border-white/10 p-8">
              <p className="text-lg text-slate-400">Không tìm thấy bài viết nào phù hợp.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedYear("all");
                  setSearchQuery("");
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-[#d4af37] text-slate-950 font-bold text-xs uppercase"
              >
                Xem tất cả bài viết
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map((post: ClubActivityPost) => {
                const postLightboxImages: LightboxImage[] = [
                  {
                    src: post.featuredImage,
                    title: post.title,
                    caption: post.summary,
                    tag: post.categoryLabel,
                  },
                  ...(post.galleryImages || []).map((img, idx) => ({
                    src: img,
                    title: `${post.title} • Ảnh #${idx + 1}`,
                    caption: post.title,
                    tag: post.categoryLabel,
                  })),
                ];

                return (
                  <article
                    key={post.id}
                    className="group flex flex-col rounded-3xl overflow-hidden bg-gradient-to-b from-[#0b2952] to-[#071933] border border-[#d4af37]/30 hover:border-[#d4af37] shadow-xl hover:shadow-[0_20px_40px_rgba(212,175,55,0.15)] transition duration-300"
                  >
                    {/* Ảnh bài viết */}
                    <div className="relative aspect-video overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#071933] via-transparent to-transparent opacity-80" />

                      {/* Badge chuyên mục & Năm */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider backdrop-blur-md border ${post.categoryBadgeClass}`}
                        >
                          {post.categoryLabel}
                        </span>
                        {post.eventYear && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-[#d4af37] text-slate-950 shadow-sm border border-[#fde047]">
                            {post.eventYear}
                          </span>
                        )}
                      </div>

                      {/* Nút xem ảnh Lightbox */}
                      <button
                        type="button"
                        onClick={() => openLightbox(postLightboxImages, 0)}
                        className="absolute bottom-3 left-3 flex items-center gap-1 text-[11px] font-bold text-white bg-black/60 hover:bg-[#d4af37] hover:text-slate-950 px-2.5 py-0.5 rounded-full backdrop-blur-md transition border border-white/20 cursor-pointer"
                      >
                        <Camera className="h-3 w-3" />
                        <span>Xem ảnh ({postLightboxImages.length})</span>
                      </button>

                      <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[11px] font-medium text-white/90 bg-black/60 px-2.5 py-0.5 rounded-full backdrop-blur-md">
                        <Clock className="h-3 w-3 text-[#d4af37]" />
                        <span>{post.readingTime}</span>
                      </div>
                    </div>

                    {/* Nội dung bài viết */}
                    <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-sky-200/80 mb-2">
                          <Calendar className="h-3.5 w-3.5 text-[#d4af37]" />
                          <span>{post.publishedDate}</span>
                          <span>•</span>
                          <span className="text-slate-400 truncate">{post.author}</span>
                        </div>

                        <h2 className="font-display font-extrabold uppercase text-xl text-white group-hover:text-[#fde047] transition line-clamp-2 leading-snug">
                          {post.title}
                        </h2>

                        <p className="mt-3 text-sm text-sky-100/80 line-clamp-3 leading-relaxed font-light">
                          {post.summary}
                        </p>

                        {/* Cầu thủ được gắn thẻ */}
                        {post.taggedPlayerNames && post.taggedPlayerNames.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                            <span className="text-[10px] text-sky-200/60 font-bold uppercase">
                              Cầu thủ:
                            </span>
                            {post.taggedPlayerNames.map((name) => (
                              <span
                                key={name}
                                className="px-2 py-0.5 rounded-md bg-white/10 text-sky-200 text-[10px] font-semibold border border-white/10"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Nút đọc bài viết chi tiết - Dẫn sang trang riêng */}
                      <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-bold text-[#d4af37]">
                        <Link
                          href={`/hoat-dong/${post.id}`}
                          className="group-hover:translate-x-1 transition inline-flex items-center gap-1.5 cursor-pointer text-white hover:text-[#d4af37]"
                        >
                          <span>Đọc bài viết trên trang riêng</span>
                          <ArrowRight className="h-4 w-4 text-[#d4af37]" />
                        </Link>
                        <span className="text-[11px] uppercase tracking-wider text-slate-400">
                          FC HĐH Gò Nổi
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* ==================== THƯ VIỆN HÌNH ẢNH FC HĐH GÒ NỔI ==================== */}
        <section
          id="thu-vien-hinh-anh"
          className="mt-16 pt-12 border-t border-[#d4af37]/25 scroll-mt-24 space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/40 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#fde047]">
                <Images className="h-3.5 w-3.5 text-[#d4af37]" />
                <span>Kho Tư Liệu Nội Bộ</span>
              </div>
              <h2 className="font-display font-extrabold uppercase text-2xl sm:text-4xl text-white tracking-tight">
                Thư Viện Hình Ảnh <span className="text-[#d4af37]">Gò Nổi</span>
              </h2>
              <p className="text-sm text-sky-200/80 max-w-2xl font-light">
                Tổng hợp hình ảnh sinh hoạt, giải đấu, giao lưu và đồng hành cùng FC HĐH Gò Nổi tại TP.HCM. Nhấn vào từng ảnh để xem kích thước lớn.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-sky-200 bg-[#092244]/80 border border-white/10 rounded-xl px-4 py-2.5 self-start md:self-auto">
              <Camera className="h-4 w-4 text-[#d4af37]" />
              <span>
                Đang hiển thị{" "}
                <strong className="text-white">{visibleGalleryPhotos.length}</strong> /{" "}
                <strong className="text-[#fde047]">{filteredGalleryPhotos.length}</strong> ảnh
              </span>
            </div>
          </div>

          {/* Album đại diện theo nhóm hoạt động */}
          {galleryAlbums.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {galleryAlbums.map((album) => {
                const isSelectedAlbum = galleryCategory === album.id;
                return (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => {
                      setGalleryCategory(isSelectedAlbum ? "all" : album.id);
                      setVisiblePhotoCount(INITIAL_GALLERY_LIMIT);
                    }}
                    className={`group text-left rounded-2xl overflow-hidden border transition cursor-pointer bg-[#092244]/70 ${
                      isSelectedAlbum
                        ? "border-[#d4af37] ring-2 ring-[#d4af37]/40"
                        : "border-white/10 hover:border-[#d4af37]/60"
                    }`}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-[#040e1e]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={album.coverImage}
                        alt={`Album ${album.label} - FC HĐH Gò Nổi`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#040e1e] via-[#040e1e]/20 to-transparent" />
                      <span className="absolute top-2 right-2 rounded-full bg-black/70 border border-white/15 px-2.5 py-0.5 text-[10px] font-bold text-[#fde047]">
                        {album.photoCount} ảnh
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-extrabold uppercase tracking-wide text-white group-hover:text-[#fde047] transition line-clamp-1">
                        {album.label}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 leading-snug">
                        {album.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Bộ lọc album cho thư viện ảnh */}
          <div className="flex flex-wrap items-center gap-2">
            {ACTIVITY_CATEGORIES.map((cat) => {
              const isSelected = galleryCategory === cat.id;
              return (
                <button
                  key={`gallery-filter-${cat.id}`}
                  type="button"
                  onClick={() => {
                    setGalleryCategory(cat.id);
                    setVisiblePhotoCount(INITIAL_GALLERY_LIMIT);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer border ${
                    isSelected
                      ? "bg-[#d4af37] text-slate-950 border-[#d4af37]"
                      : "bg-[#092244]/70 text-sky-200 hover:bg-[#123e7a] hover:text-white border-white/10"
                  }`}
                >
                  {getCategoryIcon(cat.id)}
                  <span>{cat.id === "all" ? "Tất cả ảnh" : cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Lưới ảnh thư viện */}
          {visibleGalleryPhotos.length === 0 ? (
            <div className="text-center py-14 bg-[#092244]/40 rounded-3xl border border-white/10 p-6">
              <p className="text-base text-slate-300">
                Chưa có hình ảnh phù hợp với bộ lọc hiện tại.
              </p>
              <button
                type="button"
                onClick={() => {
                  setGalleryCategory("all");
                  setSelectedYear("all");
                  setSearchQuery("");
                  setVisiblePhotoCount(INITIAL_GALLERY_LIMIT);
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-[#d4af37] text-slate-950 font-bold text-xs uppercase cursor-pointer"
              >
                Xem toàn bộ thư viện ảnh
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {visibleGalleryPhotos.map((photo, idx) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() =>
                      openLightbox(
                        toGalleryLightboxItems(filteredGalleryPhotos),
                        idx
                      )
                    }
                    className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#092244] border border-white/10 hover:border-[#d4af37] transition text-left cursor-pointer shadow-lg"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.src}
                      alt={photo.alt}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#040e1e]/95 via-[#040e1e]/25 to-transparent opacity-80 group-hover:opacity-95 transition" />

                    <div className="absolute inset-x-2 sm:inset-x-2.5 top-2 sm:top-2.5 flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate px-2 sm:px-2.5 py-0.5 rounded-full bg-black/65 border border-white/15 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide sm:tracking-wider text-[#fde047] backdrop-blur-sm">
                        {photo.categoryLabel}
                      </span>

                      <span className="shrink-0 p-1.5 rounded-full bg-black/60 text-white opacity-80 group-hover:opacity-100 group-hover:bg-[#d4af37] group-hover:text-slate-950 transition">
                        <ZoomIn className="h-3.5 w-3.5" />
                      </span>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-3 space-y-0.5">
                      <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#fde047] transition">
                        {photo.title}
                      </p>
                      <p className="text-[11px] text-slate-300 line-clamp-1 font-light">
                        {photo.caption}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Điều khiển tải thêm ảnh để tránh tải thừa */}
              {filteredGalleryPhotos.length > INITIAL_GALLERY_LIMIT && (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  {visiblePhotoCount < filteredGalleryPhotos.length && (
                    <button
                      type="button"
                      onClick={() =>
                        setVisiblePhotoCount((prev) =>
                          Math.min(
                            prev + GALLERY_LOAD_STEP,
                            filteredGalleryPhotos.length
                          )
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-[#d4af37] hover:bg-[#fde047] text-slate-950 font-extrabold px-5 py-2.5 text-xs uppercase tracking-wider transition shadow-md cursor-pointer"
                    >
                      <Images className="h-4 w-4" />
                      <span>
                        Xem thêm ảnh (còn{" "}
                        {filteredGalleryPhotos.length - visiblePhotoCount} ảnh)
                      </span>
                    </button>
                  )}

                  {visiblePhotoCount > INITIAL_GALLERY_LIMIT && (
                    <button
                      type="button"
                      onClick={() => setVisiblePhotoCount(INITIAL_GALLERY_LIMIT)}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold px-4 py-2.5 text-xs uppercase tracking-wider border border-white/15 transition cursor-pointer"
                    >
                      Thu gọn
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        onNavigate={setLightboxIndex}
      />

      {/* ==================== FOOTER ==================== */}
      <footer className="mt-auto border-t border-[#d4af37]/20 bg-[#040e1e] py-8 text-center text-xs text-slate-400">
        <p>FC HĐH Gò Nổi © 2026 · Hào Khí Đất Quảng Giữa Lòng Sài Gòn</p>
      </footer>
    </div>
  );
}

