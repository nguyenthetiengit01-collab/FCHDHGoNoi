"use client";

import React, { useState } from "react";
import { FullAppData, AuthSession } from "@/types/app";
import {
  ClubActivityPost,
  CLUB_ACTIVITIES_POSTS,
  ACTIVITY_CATEGORIES,
} from "@/data/clubActivities";
import {
  Newspaper,
  Plus,
  Edit3,
  Trash2,
  Upload,
  CheckCircle2,
  Image as ImageIcon,
  Calendar,
  User,
  ExternalLink,
  X,
  Sparkles,
} from "lucide-react";
import { ModalDialog } from "./ModalDialog";
import {
  convertFileToWebp,
  convertMultipleFilesToWebp,
} from "@/lib/imageToWebp";

interface Props {
  data: FullAppData;
  session: AuthSession;
  onMutate: (action: string, payload?: unknown) => Promise<void>;
  isSaving: boolean;
}

const CATEGORY_META: Record<
  ClubActivityPost["category"],
  { label: string; badgeClass: string }
> = {
  giaidau: {
    label: "Giải Đấu & Phong Trào",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  giaoluu: {
    label: "Giao Lưu Kết Nối",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  cauthu: {
    label: "Cầu Thủ Gò Nổi",
    badgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  },
  taitro: {
    label: "Đồng Hành & Tài Trợ",
    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  },
  anhbia: {
    label: "Ảnh Bìa & Khí Thế",
    badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  },
};

export default function ClubPostsTab({
  data,
  session,
  onMutate,
  isSaving,
}: Props) {
  const isManager = session.role === "manager";
  const posts =
    data.posts && data.posts.length > 0 ? data.posts : CLUB_ACTIVITIES_POSTS;

  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ClubActivityPost | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [category, setCategory] =
    useState<ClubActivityPost["category"]>("giaidau");
  const [summary, setSummary] = useState("");
  const [contentText, setContentText] = useState("");
  const [quote, setQuote] = useState("");
  const [highlightsText, setHighlightsText] = useState("");
  const [author, setAuthor] = useState("Ban Truyền Thông FC Gò Nổi");
  const [publishedDate, setPublishedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [readingTime, setReadingTime] = useState("4 phút đọc");
  const [featuredImage, setFeaturedImage] = useState("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);

  // WebP conversion state
  const [isConvertingFeatured, setIsConvertingFeatured] = useState(false);
  const [featuredWebpInfo, setFeaturedWebpInfo] = useState("");
  const [isConvertingGallery, setIsConvertingGallery] = useState(false);
  const [galleryWebpInfo, setGalleryWebpInfo] = useState("");

  function openNewPostModal() {
    setEditingPost(null);
    setTitle("");
    setCategory("giaidau");
    setSummary("");
    setContentText("");
    setQuote("");
    setHighlightsText("");
    setAuthor("Ban Truyền Thông FC Gò Nổi");
    setPublishedDate(new Date().toISOString().slice(0, 10));
    setReadingTime("4 phút đọc");
    setFeaturedImage("/images/hinhanh-webp/giaidau/DSC06522.webp");
    setGalleryImages([]);
    setFeaturedWebpInfo("");
    setGalleryWebpInfo("");
    setModalOpen(true);
  }

  function openEditPostModal(post: ClubActivityPost) {
    setEditingPost(post);
    setTitle(post.title);
    setCategory(post.category);
    setSummary(post.summary);
    setContentText((post.paragraphs || []).join("\n\n"));
    setQuote(post.quote || "");
    setHighlightsText((post.highlights || []).join("\n"));
    setAuthor(post.author || "Ban Truyền Thông FC Gò Nổi");
    setPublishedDate(
      post.publishedDate || new Date().toISOString().slice(0, 10)
    );
    setReadingTime(post.readingTime || "4 phút đọc");
    setFeaturedImage(post.featuredImage);
    setGalleryImages(post.galleryImages || []);
    setFeaturedWebpInfo("");
    setGalleryWebpInfo("");
    setModalOpen(true);
  }

  async function handleFeaturedImageUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsConvertingFeatured(true);
    setFeaturedWebpInfo("Đang tự động chuyển ảnh đại diện bài viết sang chuẩn WebP...");
    try {
      const converted = await convertFileToWebp(file, {
        maxWidth: 1280,
        maxHeight: 960,
        quality: 0.85,
        mode: "contain",
      });
      setFeaturedImage(converted.dataUrl);
      setFeaturedWebpInfo(
        `Đã tự động chuyển sang WebP (${converted.originalSizeKB}KB -> ${converted.webpSizeKB}KB, tiết kiệm ${converted.savedPercent}%)`
      );
    } catch {
      setFeaturedWebpInfo("Không thể chuyển đổi ảnh sang WebP. Vui lòng thử ảnh khác.");
    } finally {
      setIsConvertingFeatured(false);
    }
  }

  async function handleGalleryImagesUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsConvertingGallery(true);
    setGalleryWebpInfo(
      `Đang tự động chuyển ${files.length} ảnh album sang chuẩn WebP...`
    );
    try {
      const convertedList = await convertMultipleFilesToWebp(files, {
        maxWidth: 1280,
        maxHeight: 960,
        quality: 0.85,
        mode: "contain",
      });
      const newUrls = convertedList.map((c) => c.dataUrl);
      const totalOrig = convertedList.reduce((s, c) => s + c.originalSizeKB, 0);
      const totalWebp = convertedList.reduce((s, c) => s + c.webpSizeKB, 0);
      setGalleryImages((prev) => [...prev, ...newUrls]);
      setGalleryWebpInfo(
        `Đã tự động chuyển ${convertedList.length} ảnh sang WebP (${totalOrig}KB -> ${totalWebp}KB)`
      );
    } catch {
      setGalleryWebpInfo("Không thể chuyển đổi ảnh album sang WebP.");
    } finally {
      setIsConvertingGallery(false);
    }
  }

  function removeGalleryImage(idx: number) {
    setGalleryImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSavePost(e: React.FormEvent) {
    e.preventDefault();
    if (!isManager) return;

    const meta = CATEGORY_META[category] || CATEGORY_META.giaidau;
    const paragraphs = contentText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const highlights = highlightsText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const id = editingPost ? editingPost.id : `post-${Date.now()}`;
    const slug =
      editingPost?.slug ||
      title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") ||
      id;

    await onMutate("upsert_club_post", {
      id,
      category,
      categoryLabel: meta.label,
      categoryBadgeClass: meta.badgeClass,
      title: title.trim(),
      slug,
      summary: summary.trim(),
      publishedDate,
      author: author.trim() || "Ban Truyền Thông FC Gò Nổi",
      featuredImage,
      galleryImages,
      readingTime: readingTime.trim() || "4 phút đọc",
      paragraphs: paragraphs.length > 0 ? paragraphs : [summary.trim()],
      quote: quote.trim(),
      highlights,
    });

    setModalOpen(false);
  }

  async function handleDeletePost(post: ClubActivityPost) {
    if (!isManager) return;
    if (
      !window.confirm(
        `Ban Quản Lý xác nhận xoá bài viết "${post.title}" khỏi trang Hoạt Động CLB?`
      )
    ) {
      return;
    }
    await onMutate("delete_club_post", { id: post.id });
  }

  const filteredPosts =
    filterCategory === "all"
      ? posts
      : posts.filter((p) => p.category === filterCategory);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0e2768] via-[#173b94] to-[#1e4fc2] p-6 text-white shadow-lg border border-[#ffc933]/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#ffc933]/20 border border-[#ffc933]/40 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[#ffc933] mb-2">
            <Newspaper className="h-3.5 w-3.5" />
            <span>Quản Lý Bài Viết & Hoạt Động CLB</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            TIN TỨC, GIẢI ĐẤU & HÌNH ẢNH HOẠT ĐỘNG FC GÒ NỔI
          </h2>
          <p className="text-xs sm:text-sm text-blue-100/90 mt-1">
            Mọi hình ảnh đại diện và album bài viết mới đều được tự động nén và
            chuyển sang chuẩn <strong>WebP</strong> tốc độ cao trước khi tải lên
            trang web.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href="/hoat-dong"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 text-xs font-bold text-white transition"
          >
            <ExternalLink className="h-4 w-4 text-[#ffc933]" />
            <span>Xem Trang Hoạt Động Công Khai</span>
          </a>

          {isManager && (
            <button
              type="button"
              onClick={openNewPostModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#ffc933] hover:bg-[#ffd65c] px-4 py-2.5 text-xs sm:text-sm font-black text-[#091b42] shadow-md transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Đăng Bài Viết Mới (Auto WebP)</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {ACTIVITY_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setFilterCategory(cat.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              filterCategory === cat.id
                ? "bg-[#1e4fc2] text-[#ffc933] shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPosts.map((post) => (
          <div
            key={post.id}
            className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition"
          >
            <div>
              <div className="relative h-48 bg-slate-900 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-3 left-3">
                  <span className="inline-flex items-center rounded-full bg-[#091b42]/85 backdrop-blur-md border border-[#ffc933]/40 px-2.5 py-1 text-[11px] font-bold text-[#ffc933]">
                    {post.categoryLabel}
                  </span>
                </div>
                {post.featuredImage.startsWith("data:image/webp") ||
                post.featuredImage.endsWith(".webp") ? (
                  <div className="absolute bottom-2 right-2 rounded-md bg-emerald-600/90 px-2 py-0.5 text-[10px] font-extrabold text-white">
                    WebP Chuẩn
                  </div>
                ) : null}
              </div>

              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-[#1e4fc2]" />
                    {post.publishedDate}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3 text-[#1e4fc2]" />
                    {post.author}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 line-clamp-2">
                  {post.title}
                </h3>

                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  {post.summary}
                </p>

                {post.galleryImages && post.galleryImages.length > 0 && (
                  <div className="pt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#1e4fc2]">
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>+{post.galleryImages.length} ảnh trong album</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <a
                href={`/hoat-dong/${post.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-[#1e4fc2] hover:underline inline-flex items-center gap-1"
              >
                <span>Đọc bài viết</span>
                <ExternalLink className="h-3 w-3" />
              </a>

              {isManager && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditPostModal(post)}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1e4fc2] px-2.5 py-1.5 text-xs font-bold transition cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Sửa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePost(post)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 px-2.5 py-1.5 text-xs font-bold transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Xoá</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Đăng / Chỉnh Sửa Bài Viết Mới */}
      <ModalDialog
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingPost
            ? `Chỉnh Sửa Bài Viết: ${editingPost.title}`
            : "Đăng Bài Viết Hoạt Động Mới (Tự Động Chuẩn Hoá Ảnh WebP)"
        }
        subtitle="Mọi ảnh đại diện và ảnh album bạn chọn từ máy tính/điện thoại sẽ tự động chuyển đổi sang định dạng WebP nhẹ, sắc nét trước khi lưu lên hệ thống."
      >
        <form onSubmit={handleSavePost} className="space-y-4">
          {/* Upload Ảnh Đại Diện Bài Viết (Auto WebP) */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-wider text-[#1e4fc2] flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#d99b00]" />
                <span>Ảnh Đại Diện Bài Viết (Tự động chuyển sang WebP) *</span>
              </label>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                Chuẩn WebP Tự Động
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {featuredImage ? (
                <div className="relative h-28 w-44 rounded-xl overflow-hidden border-2 border-[#1e4fc2] bg-slate-900 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featuredImage}
                    alt="Featured preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}

              <div className="space-y-2 flex-1">
                <label className="inline-flex items-center gap-2 rounded-xl bg-[#1e4fc2] hover:bg-[#163d99] px-4 py-2.5 text-xs font-bold text-[#ffc933] cursor-pointer transition shadow-sm">
                  <Upload className="h-4 w-4" />
                  <span>
                    {isConvertingFeatured
                      ? "Đang chuyển đổi sang WebP..."
                      : "Chọn Ảnh Đại Diện Từ Máy / Điện Thoại"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isConvertingFeatured}
                    onChange={handleFeaturedImageUpload}
                    className="sr-only"
                  />
                </label>

                {featuredWebpInfo && (
                  <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{featuredWebpInfo}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Tiêu đề & Chuyên mục */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tiêu đề bài viết *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Chiến thắng giàu cảm xúc của FC HĐH Gò Nổi..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Chuyên mục *
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ClubActivityPost["category"])
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
              >
                <option value="giaidau">Giải Đấu & Phong Trào</option>
                <option value="giaoluu">Giao Lưu Kết Nối</option>
                <option value="cauthu">Cầu Thủ Gò Nổi</option>
                <option value="taitro">Đồng Hành & Tài Trợ</option>
                <option value="anhbia">Ảnh Bìa & Khí Thế</option>
              </select>
            </div>
          </div>

          {/* Ngày đăng & Tác giả */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ngày đăng
              </label>
              <input
                type="date"
                value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tác giả / Người đăng
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Thời lượng đọc
              </label>
              <input
                type="text"
                value={readingTime}
                onChange={(e) => setReadingTime(e.target.value)}
                placeholder="4 phút đọc"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          {/* Tóm tắt ngắn */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tóm tắt bài viết (hiển thị ngoài thẻ tin) *
            </label>
            <textarea
              required
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Mô tả ngắn gọn nội dung chính của bài viết..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
            />
          </div>

          {/* Nội dung chi tiết */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nội dung chi tiết bài viết (mỗi đoạn cách nhau 1 dòng Enter) *
            </label>
            <textarea
              required
              rows={5}
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              placeholder="Nhập nội dung bài viết chi tiết..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
            />
          </div>

          {/* Câu trích dẫn & Điểm nhấn */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Câu trích dẫn ấn tượng (tuỳ chọn)
              </label>
              <textarea
                rows={2}
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="VD: Ra sân với 200% tinh thần đoàn kết Gò Nổi..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Điểm nhấn chính (mỗi dòng 1 ý, tuỳ chọn)
              </label>
              <textarea
                rows={2}
                value={highlightsText}
                onChange={(e) => setHighlightsText(e.target.value)}
                placeholder={"Tinh thần đoàn kết\nPhối hợp ăn ý"}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>
          </div>

          {/* Album Ảnh Trong Bài Viết (Auto WebP) */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Album Ảnh Đính Kèm Bài Viết ({galleryImages.length} ảnh - Tự
                động WebP)
              </span>
              <label className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 px-3 py-1.5 text-xs font-bold text-[#ffc933] cursor-pointer transition">
                <Upload className="h-3.5 w-3.5" />
                <span>
                  {isConvertingGallery
                    ? "Đang chuyển sang WebP..."
                    : "Thêm Nhiều Ảnh Vào Album"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={isConvertingGallery}
                  onChange={handleGalleryImagesUpload}
                  className="sr-only"
                />
              </label>
            </div>

            {galleryWebpInfo && (
              <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                {galleryWebpInfo}
              </p>
            )}

            {galleryImages.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 pt-1">
                {galleryImages.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="relative h-20 rounded-lg overflow-hidden border border-slate-300 bg-slate-900 group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl}
                      alt={`Gallery ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(idx)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-90 hover:opacity-100 cursor-pointer"
                      title="Xoá ảnh này"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isSaving || isConvertingFeatured || isConvertingGallery}
              className="rounded-xl bg-[#1e4fc2] hover:bg-[#163d99] disabled:opacity-50 px-5 py-2 text-xs font-black text-[#ffc933] shadow-md cursor-pointer"
            >
              {isSaving
                ? "Đang lưu bài viết..."
                : editingPost
                  ? "Lưu Cập Nhật Bài Viết"
                  : "Đăng Bài Viết Lên Trang Web"}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}

