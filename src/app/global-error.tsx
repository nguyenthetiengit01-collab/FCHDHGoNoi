"use client";

import React, { useEffect } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("GlobalError boundary triggered:", error?.digest || error?.name || "UNKNOWN");
  }, [error]);

  return (
    <html lang="vi">
      <body className="min-h-screen bg-[#040e1a] text-slate-100 antialiased flex items-center justify-center p-4">
        <main className="max-w-md w-full rounded-xl bg-[#081a33] border border-[#d4af37]/40 p-6 sm:p-8 text-center space-y-5 shadow-2xl">
          <div className="mx-auto h-16 w-16 rounded-full bg-white p-1 border border-[#d4af37]/60 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.jpg"
              alt="Logo FC HĐH Gò Nổi tại TP.HCM"
              className="h-full w-full object-contain rounded-full"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-400/30 text-rose-300 text-xs font-bold uppercase tracking-wider">
            <AlertTriangle className="h-3.5 w-3.5" />
            Lỗi ứng dụng nghiêm trọng
          </div>

          <div className="space-y-2">
            <h1 className="font-black uppercase text-2xl text-white">
              KHÔNG THỂ HIỂN THỊ TRANG
            </h1>
            <p className="text-sm text-slate-300 font-light leading-relaxed">
              Hệ thống{" "}
              <span className="font-semibold text-white">FC HĐH Gò Nổi tại TP.HCM</span>{" "}
              đang gặp sự cố khởi tạo giao diện. Vui lòng thử tải lại hoặc quay về trang chủ.
            </p>
            <p className="text-[11px] text-slate-400 uppercase tracking-widest">
              Xã Gò Nổi • TP. Đà Nẵng
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#d4af37] hover:bg-[#fde047] text-[#040e1a] text-xs font-extrabold uppercase tracking-wider transition cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Thử lại
            </button>

            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0b2447] hover:bg-[#11315f] border border-white/15 text-white text-xs font-bold uppercase tracking-wider transition"
            >
              <Home className="h-4 w-4" />
              Về trang chủ
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
