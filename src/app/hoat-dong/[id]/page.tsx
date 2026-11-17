"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import {
  CLUB_ACTIVITIES_POSTS,
  ClubActivityPost,
} from "@/data/clubActivities";
import { OFFICIAL_LOGO_URL, FANPAGE_URL } from "@/types/app";
import {
  Calendar,
  Clock,
  ArrowLeft,
  Quote,
  CheckCircle2,
  Share2,
  ChevronRight,
  Flame,
  Camera,
  Users,
} from "lucide-react";
import {
  ImageLightboxModal,
  type LightboxImage,
} from "@/components/ImageLightboxModal";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ChiTietHoatDongPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const postId = resolvedParams.id;
  const [posts, setPosts] = useState<ClubActivityPost[]>(CLUB_ACTIVITIES_POSTS);
  const [loading, setLoading] = useState(
    !CLUB_ACTIVITIES_POSTS.some((p) => p.id === postId || p.slug === postId)
  );

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
    fetch(`/api/public/activities?id=${encodeURIComponent(postId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json && json.post) {
          setPosts((prev) => [
            json.post,
            ...prev.filter((p) => p.id !== json.post.id && p.slug !== json.post.slug),
          ]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId]);

  const post: ClubActivityPost | undefined = posts.find(
    (p) => p.id === postId || p.slug === postId
  );

  if (loading && !post) {
    return (
      <div className="min-h-screen bg-navy-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <p className="text-gold-500 font-bold animate-pulse">
          Đang tải bài viết hoạt động...
        </p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-navy-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="font-display text-4xl text-gold-500 font-bold mb-3">
          Không Tìm Thấy Bài Viết
        </h1>
        <p className="text-slate-300 max-w-md mb-6">
          Bài viết này có thể đã được cập nhật hoặc không còn tồn tại trên hệ thống.
        </p>
        <Link
          href="/hoat-dong"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold-500 text-slate-950 font-bold uppercase text-xs tracking-wider"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Về danh sách hoạt động</span>
        </Link>
      </div>
    );
  }

  // Related posts
  const relatedPosts = posts.filter((p) => p.id !== post.id).slice(0, 3);

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col selection:bg-gold-500 selection:text-slate-950">
      <a href="#main-content" className="skip-link">
        Bỏ qua điều hướng, tới nội dung chính
      </a>
      {/* ==================== HEADER ==================== */}
      <header className="sticky top-0 z-40 bg-navy-800/90 backdrop-blur-md border-b border-gold-500/30 py-3.5 px-4 sm:px-8 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-3 group cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_LOGO_URL}
              alt="FC HĐH Gò Nổi"
              className="h-10 w-10 rounded-full object-contain bg-white p-0.5 ring-2 ring-gold-500 group-hover:scale-105 transition"
            />
            <div>
              <span className="font-display font-extrabold uppercase text-lg sm:text-xl tracking-wide text-white block">
                FC HĐH GÒ NỔI
              </span>
              <span className="text-[10px] uppercase tracking-widest text-gold-500 font-bold block">
                Hoạt động & Bài viết
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/hoat-dong"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider border border-white/20 transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Tất cả bài viết</span>
            </Link>

            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-navy-500 to-royal-500 hover:from-royal-500 hover:to-[#2563eb] text-white font-bold px-4 py-2 text-xs uppercase tracking-wider border border-sky-300/30 transition shadow-md"
            >
              <span>Về trang chủ</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ==================== BREADCRUMBS ==================== */}
      <div className="bg-navy-900 border-b border-white/10 py-2.5 px-4 sm:px-8 text-xs text-sky-200">
        <div className="max-w-4xl mx-auto flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-gold-500 transition">
            Trang chủ
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-500" />
          <Link href="/hoat-dong" className="hover:text-gold-500 transition">
            Hoạt động & Bài viết
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-500" />
          <span className="text-white truncate max-w-xs sm:max-w-md font-semibold">
            {post.title}
          </span>
        </div>
      </div>

      {/* ==================== NỘI DUNG CHÍNH BÀI VIẾT ==================== */}
      <main id="main-content" className="flex-1">
        <article className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14">
        {/* Meta & Chuyên mục */}
        <div className="space-y-4 mb-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${post.categoryBadgeClass}`}
            >
              {post.categoryLabel}
            </span>
            {post.eventYear && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase bg-gold-500 text-slate-950 border border-gold-300 shadow-sm">
                Năm {post.eventYear}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs text-sky-200 bg-white/10 px-3 py-1 rounded-full border border-white/10">
              <Clock className="h-3.5 w-3.5 text-gold-500" />
              <span>{post.readingTime}</span>
            </span>
          </div>

          <h1 className="font-display font-extrabold uppercase text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-b border-white/10 pb-4 text-xs sm:text-sm text-sky-200/80">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-navy-500 border border-gold-500 flex items-center justify-center font-bold text-gold-500">
                GN
              </div>
              <div>
                <span className="font-bold text-white block">{post.author}</span>
                <span className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-gold-500" />
                  <span>{post.publishedDate}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={FANPAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition border border-white/10"
              >
                <Share2 className="h-3.5 w-3.5 text-gold-500" />
                <span>Chia sẻ Fanpage</span>
              </a>
            </div>
          </div>
        </div>

        {/* Ảnh bìa lớn - Nhấp để xem phóng to */}
        <div
          onClick={() => {
            const allImgs: LightboxImage[] = [
              {
                src: post.featuredImage,
                title: post.title,
                caption: post.summary,
                tag: post.categoryLabel,
              },
              ...(post.galleryImages || []).map((img, i) => ({
                src: img,
                title: `${post.title} • Ảnh #${i + 1}`,
                caption: post.title,
                tag: post.categoryLabel,
              })),
            ];
            openLightbox(allImgs, 0);
          }}
          className="relative aspect-video rounded-xl overflow-hidden mb-10 border-2 border-gold-500/40 shadow-2xl cursor-pointer group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.featuredImage}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
          />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition" />
          <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md text-white text-xs font-bold px-3.5 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5 shadow-lg group-hover:bg-gold-500 group-hover:text-slate-950 transition">
            <Camera className="h-3.5 w-3.5" />
            <span>Phóng to ảnh bìa</span>
          </div>
        </div>

        {/* Tóm tắt mở đầu */}
        <div className="text-lg sm:text-xl text-sky-100 font-light leading-relaxed mb-8 p-6 rounded-2xl bg-navy-800/60 border-l-4 border-gold-500">
          {post.summary}
        </div>

        {/* Toàn văn các đoạn văn */}
        <div className="space-y-6 text-base sm:text-lg text-slate-200 font-normal leading-relaxed">
          {post.paragraphs.map((para, idx) => (
            <p key={idx} className="leading-relaxed">
              {para}
            </p>
          ))}
        </div>

        {/* Trích dẫn nổi bật (Quote) */}
        {post.quote && (
          <blockquote className="my-10 p-6 sm:p-8 rounded-xl bg-gradient-to-r from-navy-600 to-navy-800 border border-gold-500/60 shadow-xl relative overflow-hidden">
            <Quote className="absolute right-4 bottom-4 h-24 w-24 text-white/5 pointer-events-none" />
            <p className="font-display font-bold text-xl sm:text-2xl text-gold-300 leading-snug">
              &ldquo;{post.quote}&rdquo;
            </p>
            <footer className="mt-3 text-xs uppercase tracking-widest text-gold-500 font-bold">
              — FC HĐH Gò Nổi • Tinh thần rực lửa
            </footer>
          </blockquote>
        )}

        {/* Điểm nhấn hoạt động */}
        {post.highlights && post.highlights.length > 0 && (
          <div className="my-10 p-6 sm:p-8 rounded-xl bg-navy-900 border border-white/15">
            <h3 className="font-display font-extrabold uppercase text-lg text-gold-500 mb-4 flex items-center gap-2">
              <Flame className="h-5 w-5" />
              <span>Điểm nhấn hoạt động</span>
            </h3>
            <ul className="space-y-3">
              {post.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-slate-200">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cầu thủ được gắn thẻ trong bài viết */}
        {post.taggedPlayerNames && post.taggedPlayerNames.length > 0 && (
          <div className="my-10 p-6 rounded-xl bg-navy-900 border border-gold-500/30">
            <h3 className="font-display font-extrabold uppercase text-base text-gold-500 mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Cầu thủ góp mặt trong hoạt động này</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {post.taggedPlayerNames.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-gold-500/20 border border-white/15 text-xs font-bold text-sky-100"
                >
                  <span className="h-2 w-2 rounded-full bg-gold-500" />
                  <span>{name}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Album ảnh hoạt động con */}
        {post.galleryImages && post.galleryImages.length > 0 && (
          <div className="my-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-gold-500" />
                <h3 className="font-display font-extrabold uppercase text-xl sm:text-2xl text-white">
                  Bộ Sưu Tập Hình Ảnh Hoạt Động ({post.galleryImages.length} ảnh)
                </h3>
              </div>
              <span className="text-xs text-sky-200/70 italic">Nhấp ảnh để phóng to</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {post.galleryImages.map((imgSrc, i) => {
                const allImgs: LightboxImage[] = [
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
                  <div
                    key={i}
                    onClick={() => openLightbox(allImgs, i + 1)}
                    className="group relative aspect-video rounded-2xl overflow-hidden border border-gold-500/30 shadow-lg cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgSrc}
                      alt={`Hình ảnh hoạt động ${i + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition" />
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition bg-black/70 text-white text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1">
                      <Camera className="h-3 w-3 text-gold-500" />
                      <span>Xem phóng to</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Nút điều hướng cuối bài */}
        <div className="mt-12 pt-8 border-t border-white/15 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/hoat-dong"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition border border-white/20 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại danh sách hoạt động</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider hover:bg-[#e6c466] transition shadow-md cursor-pointer"
          >
            <span>Về cổng thông tin CLB</span>
          </Link>
        </div>

        {/* ==================== BÀI VIẾT LIÊN QUAN KHÁC ==================== */}
        {relatedPosts.length > 0 && (
          <div className="mt-16 pt-12 border-t border-white/15">
            <h3 className="font-display font-extrabold uppercase text-2xl text-white mb-6">
              Các Bài Viết Hoạt Động Khác
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {relatedPosts.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/hoat-dong/${rel.id}`}
                  className="group flex flex-col rounded-2xl overflow-hidden bg-navy-800/80 border border-white/10 hover:border-gold-500 transition p-3 cursor-pointer"
                >
                  <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={rel.featuredImage}
                      alt={rel.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  </div>
                  <span className="text-[10px] uppercase font-bold text-gold-500 mb-1">
                    {rel.categoryLabel}
                  </span>
                  <h4 className="font-display font-bold uppercase text-sm text-white group-hover:text-gold-300 line-clamp-2 leading-snug">
                    {rel.title}
                  </h4>
                </Link>
              ))}
            </div>
          </div>
        )}
        </article>
      </main>

      {/* ==================== FOOTER ==================== */}
      <footer className="mt-auto border-t border-gold-500/20 bg-navy-950 py-8 text-center text-xs text-slate-400">
        <p>FC HĐH Gò Nổi © 2026 · Hào Khí Đất Quảng Giữa Lòng Sài Gòn</p>
      </footer>

      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        onNavigate={setLightboxIndex}
      />
    </div>
  );
}
