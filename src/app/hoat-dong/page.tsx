"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  CLUB_ACTIVITIES_POSTS,
  ACTIVITY_CATEGORIES,
  ActivityCategory,
  ClubActivityPost,
} from "@/data/clubActivities";
import { OFFICIAL_LOGO_URL, FANPAGE_URL } from "@/types/app";
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
} from "lucide-react";

export default function HoatDongPage() {
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [posts, setPosts] = useState<ClubActivityPost[]>(CLUB_ACTIVITIES_POSTS);

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
      const matchQuery =
        !searchQuery.trim() ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.author.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [posts, selectedCategory, searchQuery]);

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
            Nơi lưu giữ từng nhịp đập, trận cầu rực lửa sân 7, những nghĩa tình đồng hương sâu nặng và hành trình quả cảm của những người con quê hương Điện Bàn, Quảng Nam tại Sài Gòn.
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
        </div>
      </section>

      {/* ==================== BỘ LỌC CHUYÊN MỤC ==================== */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
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
        <div className="mt-10">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-20 bg-[#092244]/40 rounded-3xl border border-white/10 p-8">
              <p className="text-lg text-slate-400">Không tìm thấy bài viết nào phù hợp.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("all");
                  setSearchQuery("");
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-[#d4af37] text-slate-950 font-bold text-xs uppercase"
              >
                Xem tất cả bài viết
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map((post: ClubActivityPost) => (
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
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#071933] via-transparent to-transparent opacity-80" />

                    <div className="absolute top-3 left-3">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider backdrop-blur-md border ${post.categoryBadgeClass}`}
                      >
                        {post.categoryLabel}
                      </span>
                    </div>

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
                        FC Gò Nổi
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ==================== FOOTER ==================== */}
      <footer className="mt-auto border-t border-[#d4af37]/20 bg-[#040e1e] py-8 text-center text-xs text-slate-400">
        <p>FC HĐH Gò Nổi © 2026 · Hào Khí Đất Quảng Giữa Lòng Sài Gòn</p>
      </footer>
    </div>
  );
}

