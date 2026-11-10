"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  X,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
} from "lucide-react";
import { OFFICIAL_LOGO_URL, type Player } from "@/types/app";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (player: Player, mustChangePassword?: boolean) => void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Reset trạng thái khi modal mở lại
  useEffect(() => {
    if (isOpen) {
      setErrorMessage("");
      setShowHelp(false);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Bộ đếm ngược thời gian khóa đăng nhập nếu bị rate-limited
  useEffect(() => {
    if (lockoutSeconds === null || lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState("CapsLock"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    const cleanPin = pin.trim();

    if (!cleanUsername) {
      setErrorMessage("Vui lòng nhập Tên đăng nhập, SĐT hoặc Số áo.");
      return;
    }
    if (!cleanPin) {
      setErrorMessage("Vui lòng nhập Mật khẩu bảo mật.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          username: cleanUsername,
          pin: cleanPin,
          rememberMe,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorText = data.error || "Tên đăng nhập hoặc mật khẩu không chính xác.";
        setErrorMessage(errorText);

        // Kiểm tra nếu có thời gian tạm khóa
        const matchLock = errorText.match(/(\d+)\s*giây/i);
        if (matchLock && matchLock[1]) {
          setLockoutSeconds(parseInt(matchLock[1], 10));
        }
        return;
      }

      // Đăng nhập thành công
      setUsername("");
      setPin("");
      setErrorMessage("");
      setLockoutSeconds(null);
      onSuccess(data.player, data.mustChangePassword);
    } catch {
      setErrorMessage("Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra đường truyền.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-md my-auto rounded-2xl bg-gradient-to-b from-[#0f3468] via-[#0d2e5b] to-[#092244] border-2 border-[#ffd700]/70 text-white shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* Nút đóng */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer z-10"
          title="Đóng cửa sổ"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header huy hiệu CLB Hoàng Gia Sapphire & Gold */}
        <div className="p-6 pb-4 border-b border-white/15 bg-gradient-to-r from-[#144485] to-[#0f3468] relative">
          <div className="flex items-center gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_LOGO_URL}
              alt="Logo FC HĐH Gò Nổi"
              className="h-13 w-13 rounded-xl object-contain bg-white p-0.5 border-2 border-[#ffd700] shadow-md shrink-0"
            />
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ffd700] block">
                CỔNG XÁC THỰC THÀNH VIÊN
              </span>
              <h2 className="font-display font-black text-lg sm:text-xl text-white uppercase tracking-tight truncate">
                FC HĐH GÒ NỔI
              </h2>
              <p className="text-xs text-sky-200 mt-0.5 truncate">
                Đăng nhập để điểm danh &amp; quản lý tài khoản
              </p>
            </div>
          </div>
        </div>

        {/* Nội dung form */}
        <div className="p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Ô Tên đăng nhập */}
            <div>
              <label
                htmlFor="login-username-field"
                className="block text-xs font-bold uppercase tracking-wider text-sky-200 mb-1.5"
              >
                Tên đăng nhập / Số điện thoại / Số áo
              </label>
              <div className="relative">
                <User className="h-4 w-4 text-sky-300 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-username-field"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  disabled={isLoading || lockoutSeconds !== null}
                  placeholder="VD: tieng, 0905..., hoặc #12"
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#09254d] border border-white/20 text-white placeholder-sky-200/50 text-sm font-medium focus:outline-none focus:border-[#ffd700] focus:ring-2 focus:ring-[#ffd700]/30 transition disabled:opacity-60"
                  autoFocus
                  required
                />
                {username && (
                  <button
                    type="button"
                    onClick={() => setUsername("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-300 hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-[11px] text-sky-200/70 mt-1">
                Có thể nhập tên gọi sân, tên đăng nhập (@username), SĐT hoặc số áo (#).
              </p>
            </div>

            {/* Ô Mật khẩu */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password-field"
                  className="block text-xs font-bold uppercase tracking-wider text-sky-200"
                >
                  Mật khẩu bảo mật
                </label>
                <button
                  type="button"
                  onClick={() => setShowHelp(!showHelp)}
                  className="text-[11px] text-[#ffd700] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="h-3 w-3" />
                  <span>Quên mật khẩu?</span>
                </button>
              </div>

              <div className="relative">
                <Lock className="h-4 w-4 text-sky-300 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password-field"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyDown}
                  disabled={isLoading || lockoutSeconds !== null}
                  placeholder="Nhập mật khẩu của bạn"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#09254d] border border-white/20 text-white placeholder-sky-200/50 text-sm font-medium focus:outline-none focus:border-[#ffd700] focus:ring-2 focus:ring-[#ffd700]/30 transition disabled:opacity-60 tracking-wider"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-300 hover:text-white p-1 cursor-pointer transition"
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Cảnh báo bật Caps Lock */}
              {capsLockOn && (
                <p className="mt-1.5 text-[11px] text-amber-300 flex items-center gap-1 font-semibold animate-pulse">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Phím Caps Lock đang bật. Chú ý chữ in hoa!</span>
                </p>
              )}
            </div>

            {/* Checkbox Ghi nhớ đăng nhập */}
            <div className="flex items-center justify-between pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-sky-100 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-white/30 bg-[#09254d] text-[#ffd700] focus:ring-[#ffd700]/50 accent-[#ffd700]"
                />
                <span>Ghi nhớ đăng nhập trên máy này (30 ngày)</span>
              </label>
            </div>

            {/* Hộp Thông báo lỗi nếu có */}
            {errorMessage && (
              <div className="rounded-xl bg-rose-950/70 border border-rose-500/50 p-3 text-xs text-rose-200 flex items-start gap-2.5 animate-shake">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold leading-relaxed">{errorMessage}</p>
                  {lockoutSeconds !== null && lockoutSeconds > 0 && (
                    <p className="mt-1 text-[11px] font-bold text-amber-300">
                      Tự động mở khóa sau: {lockoutSeconds} giây.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Hướng dẫn khi quên mật khẩu */}
            {showHelp && (
              <div className="rounded-xl bg-[#09254d] border border-[#ffd700]/40 p-3.5 text-xs text-slate-200 space-y-2 animate-fade-in">
                <div className="flex items-center gap-1.5 font-bold text-[#ffd700]">
                  <PhoneCall className="h-4 w-4" />
                  <span>Cấp lại mật khẩu nhanh:</span>
                </div>
                <p className="leading-relaxed text-[11px] text-sky-100">
                  Để đảm bảo an toàn cho quỹ đội và hồ sơ cầu thủ, nếu bạn quên mật khẩu hoặc chưa được cấp mã, vui lòng liên hệ trực tiếp Ban Quản Lý:
                </p>
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                  <div className="p-2 rounded bg-white/10 border border-white/10">
                    <strong className="text-white block">Nguyễn Thế Tiếng</strong>
                    <span className="text-sky-200">Đội trưởng</span>
                  </div>
                  <div className="p-2 rounded bg-white/10 border border-white/10">
                    <strong className="text-white block">Hồ Viết Tín</strong>
                    <span className="text-sky-200">Đội phó</span>
                  </div>
                </div>
              </div>
            )}

            {/* Nút hành động */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-white/20 text-xs font-bold text-slate-200 hover:bg-white/10 transition cursor-pointer"
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={isLoading || lockoutSeconds !== null}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#ffd700] to-[#f5c518] hover:from-[#f5c518] hover:to-[#ffd700] text-slate-950 text-xs font-black uppercase tracking-wider transition shadow-lg hover:shadow-xl cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                    <span>Đang xác thực...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 text-slate-950" />
                    <span>Đăng Nhập Ngay</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Chân trang bảo mật */}
          <div className="pt-3 border-t border-white/15 flex items-center justify-between text-[10px] text-sky-200/80">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-300">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              <span>Bảo mật Scrypt &amp; HMAC-SHA256</span>
            </span>
            <span className="text-slate-400 font-mono">FC Gò Nổi TP.HCM</span>
          </div>
        </div>
      </div>
    </div>
  );
}
