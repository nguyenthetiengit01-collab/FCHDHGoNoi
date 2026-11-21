import React from "react";
import Link from "next/link";
import { Compass, Home, Users } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#040e1a] text-slate-100 flex items-center justify-center p-4">
      <main className="max-w-md w-full rounded-xl bg-[#081a33] border border-[#d4af37]/40 p-6 sm:p-8 text-center space-y-5 shadow-2xl">
        <div className="mx-auto h-16 w-16 rounded-full bg-white p-1 border border-[#d4af37]/60 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.jpg"
            alt="Logo FC HĐH Gò Nổi tại TP.HCM"
            className="h-full w-full object-contain rounded-full"
          />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#fde047] text-xs font-bold uppercase tracking-wider">
          <Compass className="h-3.5 w-3.5" />
          Lỗi 404 • Không tìm thấy trang
        </div>

        <div className="space-y-2">
          <h1 className="font-display font-black uppercase text-2xl text-white">
            TRANG KHÔNG TỒN TẠI
          </h1>
          <p className="text-sm text-slate-300 font-light leading-relaxed">
            Đường dẫn bạn truy cập không tồn tại hoặc đã được di chuyển khỏi hệ thống{" "}
            <span className="font-semibold text-white">FC HĐH Gò Nổi tại TP.HCM</span>.
          </p>
          <p className="text-[11px] text-slate-400 uppercase tracking-widest">
            Xã Gò Nổi • TP. Đà Nẵng
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#d4af37] hover:bg-[#fde047] text-[#040e1a] text-xs font-extrabold uppercase tracking-wider transition"
          >
            <Home className="h-4 w-4" />
            Về trang chủ
          </Link>

          <Link
            href="/cau-thu"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0b2447] hover:bg-[#11315f] border border-white/15 text-white text-xs font-bold uppercase tracking-wider transition"
          >
            <Users className="h-4 w-4" />
            Danh sách cầu thủ
          </Link>
        </div>
      </main>
    </div>
  );
}
