"use client";

import React from "react";
import Link from "next/link";
import { Home, RefreshCw, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#040e1a] text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-xl bg-[#081a33] border border-[#d4af37]/40 p-6 sm:p-8 text-center space-y-5 shadow-2xl">
        <div className="mx-auto h-16 w-16 rounded-full bg-white p-1 border border-[#d4af37]/60 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.jpg"
            alt="Logo FC HĐH Gò Nổi tại TP.HCM"
            className="h-full w-full object-contain rounded-full"
          />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
          <WifiOff className="h-3.5 w-3.5" />
          Không có kết nối mạng
        </div>

        <div className="space-y-2">
          <h1 className="font-display font-black uppercase text-2xl text-white">
            BẠN ĐANG NGOẠI TUYẾN
          </h1>
          <p className="text-sm text-slate-300 font-light leading-relaxed">
            Không thể tải dữ liệu mới nhất từ{" "}
            <span className="font-semibold text-white">FC HĐH Gò Nổi tại TP.HCM</span>.
            Vui lòng kiểm tra kết nối Wi-Fi hoặc 4G/5G và thử tải lại.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#d4af37] hover:bg-[#fde047] text-[#040e1a] text-xs font-extrabold uppercase tracking-wider transition"
          >
            <RefreshCw className="h-4 w-4" />
            Thử tải lại
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0b2447] hover:bg-[#11315f] border border-white/15 text-white text-xs font-bold uppercase tracking-wider transition"
          >
            <Home className="h-4 w-4" />
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
