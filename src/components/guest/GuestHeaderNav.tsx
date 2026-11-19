"use client";

import React from "react";
import Image from "next/image";
import { ArrowUpRight, LogIn, Menu, X } from "lucide-react";
import { OFFICIAL_LOGO_URL } from "@/types/app";
import { WRAP, type GuestNavLink } from "./shared";

export interface GuestHeaderNavProps {
  scrolled: boolean;
  navLinks: GuestNavLink[];
  mobileNavOpen: boolean;
  setMobileNavOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileNavRef: React.RefObject<HTMLDivElement | null>;
  mobileNavCloseRef: React.RefObject<HTMLButtonElement | null>;
  mobileNavTitleId: string;
  mobileNavDrawerId: string;
  fanpageUrl: string;
  totalPlayerCount: number;
  go: (id: string) => void;
  onOpenLogin: () => void;
}

export function GuestHeaderNav({
  scrolled,
  navLinks,
  mobileNavOpen,
  setMobileNavOpen,
  mobileNavRef,
  mobileNavCloseRef,
  mobileNavTitleId,
  mobileNavDrawerId,
  fanpageUrl,
  go,
  onOpenLogin,
}: GuestHeaderNavProps) {
  return (
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${scrolled
          ? "bg-navy-800/90 backdrop-blur-lg pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-gold-500/30 shadow-lg"
          : "bg-gradient-to-b from-navy-900/80 via-navy-900/40 to-transparent pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]"
          }`}
      >
        <div className={`${WRAP} flex items-center justify-between gap-4`}>
          <button
            type="button"
            onClick={() => go("banner-hero")}
            className="flex items-center gap-3 cursor-pointer group"
            aria-label="Về đầu trang"
          >
            <Image
              src={OFFICIAL_LOGO_URL}
              alt="Logo FC HĐH Gò Nổi"
              width={44}
              height={44}
              priority
              className="h-11 w-11 rounded-full object-contain bg-white p-0.5 ring-2 ring-gold-500 group-hover:scale-105 transition shadow-md"
            />
            <div className="text-left hidden sm:block">
              <span className="font-display font-extrabold uppercase text-xl sm:text-2xl tracking-wide leading-none text-white block whitespace-nowrap">
                FC HĐH Gò Nổi
              </span>
              <span className="text-[10px] uppercase tracking-widest text-gold-500 font-bold block mt-0.5 whitespace-nowrap">
                Xã Gò Nổi • TP. Đà Nẵng
              </span>
            </div>
          </button>

          <nav
            aria-label="Điều hướng trang khách"
            className="hidden lg:flex items-center gap-5 xl:gap-8 text-[13px] uppercase font-bold tracking-[0.14em] xl:tracking-[0.18em] text-sky-100"
          >
            {navLinks.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => go(l.id)}
                className="hover:text-gold-500 cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition"
              >
                <span>{l.label}</span>
              </button>
            ))}
            <a
              href={fanpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gold-500 inline-flex items-center gap-1 text-sky-200 whitespace-nowrap shrink-0 transition"
            >
              Fanpage <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex min-h-11 items-center gap-2 bg-gradient-to-r from-gold-500 to-gold-450 hover:from-gold-450 hover:to-gold-300 text-slate-950 font-extrabold px-3.5 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm uppercase tracking-wider rounded-xl cursor-pointer shadow-lg hover:shadow-xl transition whitespace-nowrap shrink-0"
            >
              <LogIn className="h-4 w-4" />
              <span>Đăng nhập</span>
            </button>

            {/* Nút Hamburger mở menu trên Mobile */}
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label={mobileNavOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
              aria-expanded={mobileNavOpen}
              aria-controls={mobileNavDrawerId}
              className="lg:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-on-dark"
            >
              {mobileNavOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* ===================== MOBILE NAVIGATION DRAWER ===================== */}
        {mobileNavOpen && (
          <div
            id={mobileNavDrawerId}
            ref={mobileNavRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={mobileNavTitleId}
            tabIndex={-1}
            className="lg:hidden fixed inset-x-0 top-[60px] sm:top-[68px] bottom-0 bg-navy-900/98 backdrop-blur-xl z-50 overflow-y-auto border-t border-gold-500/30 shadow-2xl p-5 flex flex-col justify-between focus-visible:outline-2 focus-visible:outline-focus-on-dark"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/15">
                <div>
                  <span
                    id={mobileNavTitleId}
                    className="text-[11px] font-black uppercase tracking-[0.25em] text-gold-400 block"
                  >
                    DANH MỤC TRANG CHỦ
                  </span>
                  <span className="text-xs text-sky-200">
                    FC HĐH Gò Nổi
                  </span>
                </div>
                <button
                  ref={mobileNavCloseRef}
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Đóng menu điều hướng"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/15 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-on-dark"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {navLinks.map((l) => {
                  const Icon = l.icon;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => go(l.id)}
                      className="min-h-11 flex items-center justify-between p-3.5 rounded-xl bg-navy-700 hover:bg-navy-500 border border-white/10 text-left transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-navy-900 text-gold-400 border border-gold-400/30 group-hover:scale-110 transition">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-sm text-white group-hover:text-gold-400 transition">
                          {l.label}
                        </span>
                      </div>
                      {l.badge && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gold-400/15 text-gold-400 border border-gold-400/30">
                          {l.badge}
                        </span>
                      )}
                    </button>
                  );
                })}

                <a
                  href={fanpageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#1877F2]/20 hover:bg-[#1877F2]/30 border border-[#1877F2]/50 text-left transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#1877F2] text-white">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-white block">
                        Fanpage Facebook Chính Thức
                      </span>
                      <span className="text-[11px] text-sky-200 block">
                        Cập nhật hình ảnh, video & tỉ số trận
                      </span>
                    </div>
                  </div>
                </a>
              </div>
            </div>

            <div className="pt-6 border-t border-white/15 mt-6 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  onOpenLogin();
                }}
                className="w-full min-h-11 flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-450 text-slate-950 font-black py-3.5 rounded-xl uppercase text-xs tracking-wider shadow-lg"
              >
                <LogIn className="h-4 w-4" />
                <span>Đăng Nhập Thành Viên & Ban Quản Lý</span>
              </button>
              <p className="text-center text-[11px] text-sky-200/70">
                Xã Gò Nổi • TP. Đà Nẵng (Điện Quang - Điện Trung - Điện Phong cũ)
              </p>
            </div>
          </div>
        )}
      </header>
  );
}
