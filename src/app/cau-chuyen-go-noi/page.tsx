import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Compass,
  ExternalLink,
  HeartHandshake,
  MapPin,
  Users,
  Waves,
} from "lucide-react";
import {
  GO_NOI_GALLERY,
  GO_NOI_IDENTITY,
  GO_NOI_STORY_PILLARS,
  GO_NOI_VILLAGES,
} from "@/data/goNoiStory";

export const metadata: Metadata = {
  title: "Câu Chuyện Gò Nổi | FC HĐH Gò Nổi tại TP.HCM",
  description:
    "Tìm hiểu vùng đất Gò Nổi bên dòng sông Thu Bồn — Xã Gò Nổi • TP. Đà Nẵng (Gò Nổi – Điện Bàn – Quảng Nam cũ gồm Điện Quang, Điện Trung, Điện Phong) và hành trình kết nối cộng đồng FC HĐH Gò Nổi tại TP.HCM.",
};

export default function CauChuyenGoNoiPage() {
  return (
    <div className="min-h-screen bg-[#040e1a] text-slate-100">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#040e1a]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-[#d4af37]/50 hover:text-[#fde047]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Trang chủ CLB</span>
            </Link>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300">
              <span className="font-bold text-white">{GO_NOI_IDENTITY.clubName}</span>
              <span className="text-white/30">•</span>
              <span className="text-[#fde047]">{GO_NOI_IDENTITY.currentLocation}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/hoat-dong"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-emerald-400/50 hover:text-emerald-300"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Hoạt động CLB</span>
            </Link>
            <a
              href={GO_NOI_IDENTITY.fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#d4af37] px-3 py-1.5 text-xs font-bold text-[#040e1a] transition-colors hover:bg-[#fde047]"
            >
              <span>Fanpage</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero Section */}
        <section className="overflow-hidden rounded-xl border border-[#d4af37]/30 bg-gradient-to-br from-[#081a33] via-[#0b2447] to-[#040e1a] shadow-lg">
          <div className="grid grid-cols-1 gap-6 p-6 sm:p-8 lg:grid-cols-12 lg:items-center">
            <div className="space-y-4 lg:col-span-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#d4af37]/40 bg-[#d4af37]/15 px-2.5 py-1 text-xs font-bold text-[#fde047]">
                  <MapPin className="h-3.5 w-3.5" />
                  {GO_NOI_IDENTITY.currentLocation}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300">
                  <Compass className="h-3.5 w-3.5 text-emerald-400" />
                  Lịch sử: {GO_NOI_IDENTITY.historicalContext}
                </span>
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                Câu Chuyện Gò Nổi —{" "}
                <span className="text-[#fde047]">
                  Từ Bãi Bồi Thu Bồn Đến Mái Nhà Đồng Hương TP.HCM
                </span>
              </h1>

              <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
                Gò Nổi là vùng đất bãi bồi trù phú được bao bọc bởi hai nhánh{" "}
                <strong className="text-white">{GO_NOI_IDENTITY.riverName}</strong>.
                Ngày nay mang tên hành chính{" "}
                <strong className="text-[#fde047]">
                  {GO_NOI_IDENTITY.currentLocation}
                </strong>
                , vùng đất ấy gắn liền với ký ức ba xã{" "}
                <strong className="text-white">
                  Điện Quang – Điện Trung – Điện Phong
                </strong>{" "}
                thuộc{" "}
                <strong className="text-white">
                  {GO_NOI_IDENTITY.historicalContext}
                </strong>
                .
              </p>

              <blockquote className="rounded-lg border-l-4 border-[#d4af37] bg-[#040e1a]/60 px-4 py-3 text-sm italic text-slate-200">
                “{GO_NOI_IDENTITY.quote}”
              </blockquote>
            </div>

            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-xl border border-white/15 bg-[#040e1a]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={GO_NOI_IDENTITY.coverUrl}
                  alt="Tập thể FC HĐH Gò Nổi tại TP.HCM"
                  className="aspect-[16/10] w-full object-cover"
                />
                <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={GO_NOI_IDENTITY.logoUrl}
                      alt="Logo FC HĐH Gò Nổi"
                      className="h-8 w-8 rounded-lg border border-[#d4af37]/60 object-cover"
                    />
                    <div>
                      <p className="text-xs font-bold text-white">
                        {GO_NOI_IDENTITY.clubName}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {GO_NOI_IDENTITY.currentLocation}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    Thành lập 2024
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ba xã cội nguồn */}
        <section aria-labelledby="villages-heading" className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#fde047]">
                <Waves className="h-3.5 w-3.5 text-sky-400" />
                {GO_NOI_IDENTITY.riverName} • {GO_NOI_IDENTITY.historicalContext}
              </p>
              <h2
                id="villages-heading"
                className="mt-1 text-xl font-extrabold text-white sm:text-2xl"
              >
                Ba Xã Cội Nguồn Làm Nên Bản Sắc Gò Nổi
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Tên 3 xã cũ được giữ nguyên trong hồ sơ cầu thủ và thẻ VĐV.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {GO_NOI_VILLAGES.map((village) => (
              <article
                key={village.id}
                className="rounded-xl border border-white/10 bg-[#081a33] p-5 transition-colors hover:border-[#d4af37]/40"
              >
                <span className="inline-block rounded-md border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-0.5 text-[11px] font-bold text-[#fde047]">
                  {village.roleLabel}
                </span>
                <h3 className="mt-3 text-lg font-bold text-white">
                  {village.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {village.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Lịch sử, văn hóa & tinh thần đồng hương */}
        <section aria-labelledby="pillars-heading" className="space-y-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Award className="h-3.5 w-3.5" />
              Giá trị văn hóa & Truyền thống
            </p>
            <h2
              id="pillars-heading"
              className="mt-1 text-xl font-extrabold text-white sm:text-2xl"
            >
              Lịch Sử Quê Hương & Tinh Thần Đồng Hương
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {GO_NOI_STORY_PILLARS.map((pillar) => (
              <article
                key={pillar.id}
                className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#081a33]/90 p-5"
              >
                <div>
                  <span className="inline-block rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                    {pillar.badge}
                  </span>
                  <h3 className="mt-3 text-base font-bold text-white sm:text-lg">
                    {pillar.title}
                  </h3>
                  <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">
                    {pillar.paragraphs.map((text, idx) => (
                      <p key={idx}>{text}</p>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Hình ảnh thực tế của CLB */}
        <section aria-labelledby="gallery-heading" className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#fde047]">
                <Users className="h-3.5 w-3.5" />
                Tư liệu ảnh CLB
              </p>
              <h2
                id="gallery-heading"
                className="mt-1 text-xl font-extrabold text-white sm:text-2xl"
              >
                Khoảnh Khắc Gắn Kết Cộng Đồng Gò Nổi
              </h2>
            </div>
            <Link
              href="/hoat-dong"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#fde047] hover:underline"
            >
              <span>Xem toàn bộ bài viết hoạt động</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {GO_NOI_GALLERY.map((photo) => (
              <figure
                key={photo.src}
                className="overflow-hidden rounded-xl border border-white/10 bg-[#081a33]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="aspect-[16/10] w-full object-cover"
                />
                <figcaption className="border-t border-white/10 px-4 py-3 text-xs text-slate-300">
                  {photo.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* Lời mời kết nối cộng đồng */}
        <section className="rounded-xl border border-[#d4af37]/35 bg-gradient-to-r from-[#0b2447] via-[#081a33] to-[#0b2447] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300">
                <HeartHandshake className="h-4 w-4" />
                <span>Kết Nối Cộng Đồng Đồng Hương</span>
              </div>
              <h2 className="text-xl font-extrabold text-white sm:text-2xl">
                Chào Đón Người Con Gò Nổi Tại TP.HCM & Khắp Mọi Miền
              </h2>
              <p className="text-sm leading-relaxed text-slate-300">
                Dù bạn quê ở Điện Quang, Điện Trung hay Điện Phong, sân cỏ của{" "}
                <strong className="text-white">{GO_NOI_IDENTITY.clubName}</strong>{" "}
                luôn rộng mở để anh em gặp gỡ, rèn luyện sức khỏe và giữ trọn nghĩa
                tình quê hương. Khẩu hiệu chung:{" "}
                <span className="font-semibold text-[#fde047]">
                  “{GO_NOI_IDENTITY.slogan}”
                </span>
                .
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={GO_NOI_IDENTITY.fanpageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#d4af37] px-4 py-2.5 text-sm font-bold text-[#040e1a] transition-colors hover:bg-[#fde047]"
              >
                <span>Kết nối Fanpage CLB</span>
                <ExternalLink className="h-4 w-4" />
              </a>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:border-[#d4af37]/60 hover:text-[#fde047]"
              >
                <span>Về Trang Chủ & Đội Hình</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
