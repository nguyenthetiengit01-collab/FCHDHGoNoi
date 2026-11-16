"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Building2,
  Camera,
  ExternalLink,
  Handshake,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  FANPAGE_URL,
  OFFICIAL_LOGO_URL,
  type Sponsor,
} from "@/types/app";
import {
  SPONSOR_TIERS,
  sanitizeExternalUrl,
  splitSponsorsAndPartners,
} from "@/lib/sponsors";

function SponsorCard({
  sponsor,
  highlight = false,
}: {
  sponsor: Sponsor;
  highlight?: boolean;
}) {
  const tierMeta = SPONSOR_TIERS[sponsor.tier] || SPONSOR_TIERS.partner;
  const externalUrl = sanitizeExternalUrl(sponsor.website_url);
  const logoSrc = sponsor.logo_url?.trim() || OFFICIAL_LOGO_URL;

  return (
    <article
      className={`rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5 border transition ${
        highlight
          ? "bg-gradient-to-br from-[#0e2e5c] via-navy-800 to-[#06152b] border-gold-500/70 shadow-[0_10px_30px_rgba(212,175,55,0.12)]"
          : "bg-navy-900/90 border-white/10 hover:border-gold-500/50"
      }`}
    >
      <div className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-lg bg-white p-2 border border-gold-500/40 shadow-sm flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt={`Logo ${sponsor.name}`}
          loading="lazy"
          decoding="async"
          className="max-h-full max-w-full w-auto h-auto object-contain"
        />
      </div>

      <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${tierMeta.badgeClass}`}
          >
            {tierMeta.label}
          </span>
        </div>

        <h3 className="font-display font-extrabold uppercase text-lg sm:text-xl text-white tracking-tight">
          {sponsor.name}
        </h3>

        {sponsor.description && (
          <p className="text-sm text-slate-300 font-light leading-relaxed">
            {sponsor.description}
          </p>
        )}

        {sponsor.note && (
          <p className="text-xs text-sky-200/80 border-l-2 border-gold-500/60 pl-2.5 text-left">
            {sponsor.note}
          </p>
        )}

        {externalUrl && (
          <div className="pt-1">
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gold-300 hover:text-white transition"
            >
              <span>
                {externalUrl.includes("facebook.com")
                  ? "Xem Fanpage chính thức"
                  : "Truy cập trang chính thức"}
              </span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

function EmptyPartnerState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-xl bg-navy-900/60 border border-white/10 p-8 text-center space-y-2">
      <Building2 className="h-7 w-7 text-gold-500/70 mx-auto" />
      <p className="text-sm font-bold text-slate-200 uppercase tracking-wide">
        {title}
      </p>
      <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto font-light leading-relaxed">
        {message}
      </p>
    </div>
  );
}

export default function NhaTaiTroPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/team")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        if (json && Array.isArray(json.sponsors)) {
          setSponsors(json.sponsors);
        }
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const { financialSponsors, companionPartners } = useMemo(
    () => splitSponsorsAndPartners(sponsors),
    [sponsors]
  );

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col selection:bg-gold-500 selection:text-slate-950">
      <a href="#main-content" className="skip-link">
        Bỏ qua điều hướng, tới nội dung chính
      </a>
      {/* ==================== HEADER ==================== */}
      <header className="sticky top-0 z-40 bg-navy-900/95 backdrop-blur-md border-b border-gold-500/30 py-3.5 px-4 sm:px-8 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-3 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_LOGO_URL}
              alt="Logo FC HĐH Gò Nổi tại TP.HCM"
              className="h-10 w-10 rounded-full object-contain bg-white p-0.5 ring-2 ring-gold-500 group-hover:scale-105 transition"
            />
            <div>
              <span className="font-display font-extrabold uppercase text-base sm:text-lg tracking-wide text-white block leading-tight">
                FC HĐH GÒ NỔI tại TP.HCM
              </span>
              <span className="text-[10px] uppercase tracking-widest text-gold-500 font-bold block">
                Xã Gò Nổi • TP. Đà Nẵng
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/cau-chuyen-go-noi"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-gold-500 transition px-2 py-1"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Câu chuyện Gò Nổi</span>
            </Link>
            <Link
              href="/hoat-dong"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-gold-500 transition px-2 py-1"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Hoạt động CLB</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-navy-700 hover:bg-[#12386d] text-white font-bold px-3.5 py-2 text-xs uppercase tracking-wider border border-white/15 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Trang chủ</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* ==================== HERO ==================== */}
      <section className="relative py-14 sm:py-20 px-4 sm:px-8 bg-gradient-to-b from-navy-900 via-navy-700/70 to-navy-950 border-b border-white/10">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-lg bg-gold-500/15 border border-gold-500/40 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-gold-300">
            <Award className="h-4 w-4 text-gold-500" />
            <span>Tri Ân & Kết Nối Đồng Hương</span>
          </div>

          <h1 className="font-display font-extrabold uppercase text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight">
            Nhà Tài Trợ &{" "}
            <span className="text-gold-500">Đối Tác Đồng Hành</span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 font-light leading-relaxed">
            Ghi nhận và tri ân các đơn vị, tổ chức đồng hương đã đồng hành cùng{" "}
            <strong className="text-white font-semibold">
              FC HĐH Gò Nổi tại TP.HCM
            </strong>{" "}
            (Xã Gò Nổi • TP. Đà Nẵng — cội nguồn Điện Quang, Điện Trung, Điện
            Phong) trong các hoạt động thể thao và gắn kết cộng đồng.
          </p>
        </div>
      </section>

      {/* ==================== NỘI DUNG CHÍNH ==================== */}
      <main id="main-content" className="max-w-6xl mx-auto w-full px-4 sm:px-8 py-12 space-y-14 flex-1">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="h-40 rounded-xl bg-navy-900/80 border border-white/10 animate-pulse"
              />
            ))}
          </div>
        ) : loadError ? (
          <EmptyPartnerState
            title="Chưa thể tải danh sách đơn vị đồng hành"
            message="Hệ thống chưa thể kết nối dữ liệu ở thời điểm hiện tại. Quý anh chị có thể quay lại sau hoặc liên hệ trực tiếp qua Fanpage chính thức của CLB."
          />
        ) : (
          <>
            {/* 1. KHU VỰC NHÀ TÀI TRỢ */}
            <section aria-labelledby="financial-sponsors-heading" className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gold-500 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Bảo Trợ & Tài Trợ Chính Thức</span>
                  </span>
                  <h2
                    id="financial-sponsors-heading"
                    className="font-display font-extrabold uppercase text-2xl sm:text-3xl text-white mt-1"
                  >
                    Nhà Tài Trợ CLB
                  </h2>
                </div>
                <span className="text-xs text-slate-400">
                  Hiển thị các đơn vị đã được Ban Quản Lý xác minh
                </span>
              </div>

              {financialSponsors.length === 0 ? (
                <EmptyPartnerState
                  title="Chưa có thông tin nhà tài trợ được công bố"
                  message="Danh sách Nhà tài trợ chính thức sẽ được cập nhật tại đây khi có thông tin đã được phê duyệt."
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {financialSponsors.map((sp) => (
                    <SponsorCard
                      key={sp.id}
                      sponsor={sp}
                      highlight={sp.tier === "title"}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* 2. KHU VỰC ĐỐI TÁC ĐỒNG HÀNH */}
            <section aria-labelledby="companion-partners-heading" className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                    <Handshake className="h-3.5 w-3.5" />
                    <span>Hợp Tác & Hỗ Trợ Phong Trào</span>
                  </span>
                  <h2
                    id="companion-partners-heading"
                    className="font-display font-extrabold uppercase text-2xl sm:text-3xl text-white mt-1"
                  >
                    Đối Tác Đồng Hành
                  </h2>
                </div>
                <span className="text-xs text-slate-400">
                  Các đơn vị đồng hành & hỗ trợ hoạt động cộng đồng
                </span>
              </div>

              {companionPartners.length === 0 ? (
                <EmptyPartnerState
                  title="Đang cập nhật danh sách Đối tác đồng hành"
                  message="CLB trân trọng chào đón các doanh nghiệp, đơn vị truyền thông và anh chị đồng hương cùng đồng hành trong các mùa giải và sinh hoạt cộng đồng."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {companionPartners.map((sp) => (
                    <SponsorCard key={sp.id} sponsor={sp} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* 3. CTA KẾT NỐI HỢP TÁC */}
        <section className="rounded-xl bg-gradient-to-r from-navy-700 via-navy-900 to-navy-700 border border-gold-500/40 p-6 sm:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-300">
                <ShieldCheck className="h-4 w-4 text-gold-500" />
                <span>Kết Nối Đồng Hành Cùng FC HĐH Gò Nổi</span>
              </div>
              <h2 className="font-display font-extrabold uppercase text-2xl sm:text-3xl text-white">
                Cùng Lan Tỏa Tinh Thần Bóng Đá Quê Hương
              </h2>
              <p className="text-sm text-slate-300 font-light leading-relaxed">
                Quý doanh nghiệp, mạnh thường quân và bà con đồng hương Xã Gò Nổi
                mong muốn kết nối đồng hành cùng đội bóng vui lòng liên hệ qua
                Fanpage chính thức của CLB. Cổng thông tin công khai chỉ phục vụ
                giới thiệu và kết nối, không thu tiền hay xử lý hợp đồng trực
                tuyến.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <a
                href={FANPAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-gold-500 hover:bg-gold-300 text-slate-950 font-extrabold px-5 py-3 text-xs uppercase tracking-wider transition shadow-md"
              >
                <span>Liên hệ qua Fanpage CLB</span>
                <ExternalLink className="h-4 w-4" />
              </a>
              <Link
                href="/hoat-dong"
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-bold px-4 py-3 text-xs uppercase tracking-wider border border-white/15 transition"
              >
                <span>Xem hoạt động CLB</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ==================== FOOTER ==================== */}
      <footer className="border-t border-white/10 bg-navy-950 py-8 px-4 text-center text-xs text-slate-400 space-y-1">
        <p className="font-semibold text-slate-300">
          FC HĐH Gò Nổi tại TP.HCM · Xã Gò Nổi • TP. Đà Nẵng
        </p>
        <p>
          Cội nguồn: Điện Quang – Điện Trung – Điện Phong · Kết nối nghĩa tình
          đồng hương
        </p>
      </footer>
    </div>
  );
}
