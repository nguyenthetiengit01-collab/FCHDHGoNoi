"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  LogIn,
} from "lucide-react";
import { OFFICIAL_LOGO_URL, type FullAppData } from "@/types/app";
import { SPONSOR_TIERS, groupSponsorsByTier } from "@/lib/sponsors";
import { Reveal, WRAP } from "./shared";

export interface SponsorsFooterProps {
  data: FullAppData;
  fanpageUrl: string;
  totalPlayerCount: number;
  onOpenLogin: () => void;
}

export function SponsorsFooter({ data, fanpageUrl, totalPlayerCount, onOpenLogin }: SponsorsFooterProps) {
  return (
    <>
      <section
        id="partners-section"
        className="relative bg-gradient-to-b from-navy-800 via-navy-900 to-navy-900 py-20 border-t border-white/10"
      >
        <div className={WRAP}>
          <Reveal>
            <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-3">
              <span className="font-bold uppercase tracking-[0.35em] text-xs text-gold-500 flex items-center gap-2">
                <Award className="h-4 w-4 text-gold-500" />
                <span>Tri Ân & Đồng Hành Phong Trào</span>
              </span>
              <h2 className="font-display font-extrabold uppercase text-4xl sm:text-6xl text-white tracking-tight">
                Đồng Hành Cùng <span className="text-gold-500">FC HĐH Gò Nổi</span>
              </h2>
              <p className="text-sm sm:text-base text-sky-100/90 font-light leading-relaxed">
                Xin chân thành cảm ơn các cơ quan đoàn thể, doanh nghiệp, mạnh thường quân và những người con Gò Nổi xa quê đã chung tay tiếp lửa cho màu cờ sắc áo của đội bóng.
              </p>
              <div className="pt-2">
                <Link
                  href="/nha-tai-tro"
                  className="inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-gold-500 text-gold-300 hover:text-slate-950 font-bold px-4 py-2 text-xs uppercase tracking-wider border border-gold-500/40 transition"
                >
                  <span>Trang Nhà Tài Trợ & Đối Tác</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Phân tầng danh sách đơn vị tài trợ */}
            {(() => {
              const allSponsors = data.sponsors || [];
              const grouped = groupSponsorsByTier(allSponsors);
              const hasAny = allSponsors.length > 0;

              if (!hasAny) {
                return (
                  <div className="mt-12 rounded-xl bg-white/5 border border-white/10 p-10 text-center max-w-xl mx-auto">
                    <p className="text-sm text-slate-300">
                      CLB luôn trân trọng chào đón các đơn vị tài trợ và quý mạnh thường quân đồng hành cùng giải đấu và hoạt động phong trào thường niên.
                    </p>
                  </div>
                );
              }

              return (
                <div className="mt-14 space-y-12">
                  {/* Hạng Tài Trợ Chính / Kim Cương */}
                  {grouped.title.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-center">
                        <span className="inline-flex items-center gap-2 rounded-full bg-gold-500/20 border border-gold-500/50 px-4 py-1 text-xs font-black uppercase tracking-widest text-gold-300">
                          ★ Đơn Vị Bảo Trợ & Tài Trợ Kim Cương ★
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                        {grouped.title.map((sp) => (
                          <div
                            key={sp.id}
                            className="rounded-xl bg-gradient-to-br from-navy-600 via-navy-600 to-navy-900 border-2 border-gold-500 p-6 shadow-[0_10px_40px_rgba(212,175,55,0.2)] flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left transition hover:scale-[1.02]"
                          >
                            {sp.logo_url && (
                              <div className="relative h-20 w-20 shrink-0 rounded-xl bg-white p-2 border border-gold-500/60 shadow-md overflow-hidden">
                                <Image
                                  src={sp.logo_url}
                                  alt={sp.name}
                                  fill
                                  sizes="80px"
                                  unoptimized={!sp.logo_url.startsWith("/")}
                                  className="object-contain p-1.5"
                                />
                              </div>
                            )}
                            <div className="space-y-1 min-w-0">
                              <h3 className="font-display font-extrabold uppercase text-lg sm:text-xl text-white">
                                {sp.name}
                              </h3>
                              {sp.description && (
                                <p className="text-xs text-sky-200/90 font-light line-clamp-3">
                                  {sp.description}
                                </p>
                              )}
                              {sp.website_url && (
                                <a
                                  href={sp.website_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-bold text-gold-300 hover:underline pt-1"
                                >
                                  <span>Tìm hiểu thêm</span>
                                  <ArrowUpRight className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hạng Tài Trợ Vàng & Bạc */}
                  {(grouped.gold.length > 0 || grouped.silver.length > 0) && (
                    <div className="space-y-4">
                      <div className="text-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
                          Nhà Tài Trợ Vàng & Bạc
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-4 max-w-5xl mx-auto">
                        {[...grouped.gold, ...grouped.silver].map((sp) => (
                          <div
                            key={sp.id}
                            className="rounded-xl bg-navy-700 border border-white/15 hover:border-gold-500/60 p-4 flex items-center gap-3.5 transition hover:bg-navy-600 min-w-[240px] max-w-sm"
                          >
                            {sp.logo_url ? (
                              <div className="relative h-12 w-12 shrink-0 rounded-lg bg-white p-1 border border-slate-200 overflow-hidden shadow-xs">
                                <Image
                                  src={sp.logo_url}
                                  alt={sp.name}
                                  fill
                                  sizes="48px"
                                  unoptimized={!sp.logo_url.startsWith("/")}
                                  className="object-contain p-1"
                                />
                              </div>
                            ) : (
                              <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-800 flex items-center justify-center font-black text-xs text-slate-400">
                                LOGO
                              </div>
                            )}
                            <div className="min-w-0">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase border ${(SPONSOR_TIERS[sp.tier] || SPONSOR_TIERS.gold).badgeClass
                                  }`}
                              >
                                {(SPONSOR_TIERS[sp.tier] || SPONSOR_TIERS.gold).label}
                              </span>
                              <h3 className="font-bold text-sm text-white truncate mt-0.5">
                                {sp.name}
                              </h3>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Đối Tác & Đơn Vị Hỗ Trợ */}
                  {(grouped.partner.length > 0 || grouped.supporter.length > 0) && (
                    <div className="space-y-4 pt-4 border-t border-white/10 max-w-5xl mx-auto">
                      <div className="text-center">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Đối Tác Đồng Hành & Đơn Vị Hỗ Trợ
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        {[...grouped.partner, ...grouped.supporter].map((sp) => (
                          <div
                            key={sp.id}
                            className="rounded-lg bg-white/5 border border-white/10 px-3.5 py-2 flex items-center gap-2.5 transition hover:bg-white/10"
                          >
                            {sp.logo_url && (
                              <div className="relative h-6 w-6 rounded bg-white p-0.5 shrink-0 overflow-hidden">
                                <Image
                                  src={sp.logo_url}
                                  alt=""
                                  fill
                                  sizes="24px"
                                  unoptimized={!sp.logo_url.startsWith("/")}
                                  className="object-contain"
                                />
                              </div>
                            )}
                            <span className="text-xs font-semibold text-slate-200">
                              {sp.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </Reveal>
        </div>
      </section>

      {/* ===================== CTA + FOOTER SANG TRỌNG ===================== */}
      <footer className="relative bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 text-slate-950 overflow-hidden shadow-2xl">
        <div className={`${WRAP} pt-20 sm:pt-28 pb-10`}>
          <Reveal>
            <h2 className="font-display font-bold uppercase leading-[0.8] text-[17vw] sm:text-[13vw] lg:text-[11rem] drop-shadow-sm">
              Ra sân cùng
              <br />
              {totalPlayerCount}+ anh em Gò Nổi
            </h2>
            <p className="mt-4 text-base sm:text-xl font-bold uppercase tracking-wider text-slate-900/80 max-w-xl">
              Cánh cửa đội bóng luôn rộng mở chào đón tất cả anh em Điện Quang, Điện Trung, Điện Phong tại Sài Gòn!
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-3 bg-slate-950 hover:bg-navy-700 text-white font-bold px-8 py-5 text-sm uppercase tracking-widest rounded-xl cursor-pointer transition shadow-xl"
              >
                <LogIn className="h-5 w-5" />
                <span>Đăng nhập thành viên</span>
              </button>
              <a
                href={fanpageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 border-2 border-slate-950 hover:bg-slate-950 hover:text-white font-bold px-8 py-[18px] text-sm uppercase tracking-widest rounded-xl transition"
              >
                <span>Nhắn tin Fanpage</span>
                <ArrowUpRight className="h-5 w-5" />
              </a>
            </div>
          </Reveal>

          {/* Hàng Logo Đối Tác Chân Trang */}
          {(data.sponsors || []).length > 0 && (
            <div className="mt-12 pt-6 border-t border-slate-950/20">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-900/60 block mb-3 text-center sm:text-left">
                Đơn Vị Đồng Hành Cùng FC HĐH Gò Nổi:
              </span>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                {(data.sponsors || []).map((sp) => (
                  <div
                    key={sp.id}
                    title={sp.name}
                    className="flex items-center gap-2 rounded-lg bg-slate-950/10 px-2.5 py-1.5"
                  >
                    {sp.logo_url && (
                      <div className="relative h-5 w-5 rounded bg-white p-0.5 shrink-0 shadow-2xs overflow-hidden">
                        <Image
                          src={sp.logo_url}
                          alt=""
                          fill
                          sizes="20px"
                          unoptimized={!sp.logo_url.startsWith("/")}
                          className="object-contain"
                        />
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-950">
                      {sp.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm font-bold">
            <div className="flex items-center gap-3">
              <Image
                src={OFFICIAL_LOGO_URL}
                alt="Logo FC HĐH Gò Nổi"
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-contain bg-white p-0.5 ring-2 ring-slate-950"
              />
              <span>
                CLB bóng đá Hội Đồng Hương Xã Gò Nổi (TP. Đà Nẵng) tại TP. Hồ Chí Minh • Gắn kết con em 3 xã Điện Quang, Điện Trung, Điện Phong cũ
              </span>
            </div>
            <span>© {new Date().getFullYear()} FC HĐH Gò Nổi</span>
          </div>
        </div>
      </footer>
    </>
  );
}
