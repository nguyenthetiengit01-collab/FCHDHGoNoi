"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Grid,
  Users,
  Wallet,
  Download,
  Upload,
  ShieldCheck,
  HandCoins,
  UserCircle2,
  Globe,
  LogOut,
  ExternalLink,
  ShieldAlert,
  KeyRound,
  X,
  Newspaper,
  Award,
  Menu,
  MoreHorizontal,
  ChevronRight,
  Loader2,
} from "lucide-react";
import type { FullAppData, AuthSession, Player } from "@/types/app";
import { FANPAGE_URL, OFFICIAL_LOGO_URL } from "@/types/app";
import { formatVND } from "@/lib/format";
import {
  createTransitionSafeData,
  executeSessionHydration,
} from "@/lib/sessionHydration";
import { DashboardTab } from "./DashboardTab";
import { ScheduleTab } from "./ScheduleTab";
import { CollectionTab } from "./CollectionTab";
import { MatrixTab } from "./MatrixTab";
import { PlayersTab } from "./PlayersTab";
import { FinanceTab } from "./FinanceTab";
import { PlayerPersonalTab } from "./PlayerPersonalTab";
import { PublicGuestPortal } from "./PublicGuestPortal";
import ClubPostsTab from "./ClubPostsTab";
import { SponsorsTab } from "./SponsorsTab";
import { LoginModal } from "./LoginModal";

type ActiveTab =
  | "public"
  | "personal"
  | "dashboard"
  | "schedule"
  | "collection"
  | "matrix"
  | "players"
  | "finance"
  | "posts"
  | "sponsors";

interface TeamManagerAppProps {
  initialData: FullAppData;
}

function buildSessionFromPlayer(
  p: Player,
  mustChangePassword?: boolean
): AuthSession {
  return {
    role: p.access_role === "manager" ? "manager" : "player",
    playerId: p.id,
    fullName: p.full_name,
    shortName: p.short_name,
    jerseyNumber: p.jersey_number,
    position: p.position,
    teamRole: p.role,
    mustChangePassword: !!mustChangePassword,
  };
}

const GUEST_SESSION: AuthSession = {
  role: "guest",
  playerId: null,
  fullName: "Khách thăm quan",
  shortName: "Khách",
  jerseyNumber: null,
  position: "",
  teamRole: "Khách vãng lai",
};

export function TeamManagerApp({ initialData }: TeamManagerAppProps) {
  const [data, setData] = useState<FullAppData>(initialData);

  // Mặc định vào trang luôn là Giao diện Khách (Guest Portal) theo đúng yêu cầu
  const [session, setSession] = useState<AuthSession>(GUEST_SESSION);
  const [activeTab, setActiveTab] = useState<ActiveTab>("public");
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Login modal & session hydration states
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dismissSecurityBanner, setDismissSecurityBanner] = useState(false);
  const [isHydratingSession, setIsHydratingSession] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const hydrationEpochRef = useRef(0);
  const hydrationAbortRef = useRef<AbortController | null>(null);
  const drawerCloseBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusedBeforeDrawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      hydrationAbortRef.current?.abort();
    };
  }, []);

  const hydrateForSession = async (
    nextSession: AuthSession,
    nextTab: ActiveTab
  ): Promise<boolean> => {
    hydrationEpochRef.current += 1;
    const epoch = hydrationEpochRef.current;
    hydrationAbortRef.current?.abort();
    const controller = new AbortController();
    hydrationAbortRef.current = controller;

    return executeSessionHydration<ActiveTab>({
      epoch,
      getCurrentEpoch: () => hydrationEpochRef.current,
      isMounted: () => isMountedRef.current,
      nextSession,
      nextTab,
      signal: controller.signal,
      onStartTransition: () => {
        setIsHydratingSession(true);
        setHydrationError(null);
        setData((prev) => createTransitionSafeData(prev));
      },
      onSuccess: (freshData, resolvedSession, resolvedTab) => {
        setData(freshData);
        setSession(resolvedSession);
        setActiveTab(resolvedTab);
        setHydrationError(null);
        setIsHydratingSession(false);
      },
      onError: (message, failedSession) => {
        setSession(failedSession);
        setHydrationError(message);
        setIsHydratingSession(false);
      },
    });
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;
    lastFocusedBeforeDrawerRef.current =
      document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      drawerCloseBtnRef.current?.focus();
    }, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
      lastFocusedBeforeDrawerRef.current?.focus?.();
    };
  }, [mobileMenuOpen]);

  // Tự động khôi phục phiên làm việc an toàn từ Server Cookie khi khởi tạo
  useEffect(() => {
    let mounted = true;
    fetch("/api/auth")
      .then((res) => res.json())
      .then((res) => {
        if (!mounted) return;
        if (res.authenticated && res.player) {
          const restoredSession = buildSessionFromPlayer(
            res.player,
            res.mustChangePassword
          );
          void hydrateForSession(restoredSession, "public");
        }
      })
      .catch(() => {});

    // Xoá cache localStorage cũ để luôn lấy dữ liệu chuẩn mới nhất từ Turso Cloud Database
    try {
      localStorage.removeItem("gonoi_fc_cached_data_v1");
    } catch {
      // ignore
    }

    return () => {
      mounted = false;
    };
  }, [initialData]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const handleMutate = async (
    action: string,
    payload?: unknown
  ) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload: payload ?? {} }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Có lỗi xảy ra");
        return;
      }
      setData(json);
      if (action === "change_own_password") {
        setSession((prev) => ({ ...prev, mustChangePassword: false }));
        showToast("Đã cập nhật mật khẩu mới thành công!");
      } else if (action === "reset_player_password") {
        showToast("Đã reset mật khẩu cầu thủ về mặc định (1234)!");
      } else if (action === "upsert_club_post") {
        showToast("Đã đăng / cập nhật bài viết CLB (Ảnh chuẩn WebP)!");
      } else if (action === "delete_club_post") {
        showToast("Đã xoá bài viết khỏi trang Hoạt Động CLB!");
      } else if (action === "upsert_sponsor") {
        showToast("Đã cập nhật thông tin đơn vị tài trợ / đối tác!");
      } else if (action === "delete_sponsor") {
        showToast("Đã xóa đơn vị tài trợ khỏi hệ thống!");
      } else if (action === "collect_match_fees_batch") {
        showToast("Đã lưu phiếu thu trận thành công!");
      } else if (
        action !== "collect_match_fee" &&
        action !== "set_rsvp"
      ) {
        showToast("Đã lưu thay đổi vào Cơ sở dữ liệu Cloud!");
      }
    } catch (err) {
      console.error(err);
      alert("Không thể kết nối máy chủ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Không thể nhập file Excel");
        return;
      }
      setData(json);
      try {
        localStorage.setItem("gonoi_fc_cached_data_v1", JSON.stringify(json));
      } catch {
        // ignore
      }
      showToast(`Đã đồng bộ dữ liệu từ file ${file.name}!`);
    } catch (err) {
      console.error(err);
      alert("Lỗi khi tải file Excel lên");
    } finally {
      setIsSaving(false);
      e.target.value = "";
    }
  };

  const handleQuickSwitchRole = async (targetPlayer: Player | null) => {
    if (!targetPlayer) {
      try {
        await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "logout" }),
        });
      } catch {
        // ignore
      }
      setLoginModalOpen(false);
      await hydrateForSession(GUEST_SESSION, "public");
      showToast("Đã đăng xuất về Trang Khách");
      return;
    }

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "switch_role",
          playerId: targetPlayer.id,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showToast(json.error || "Không thể chuyển quyền.");
        return;
      }
      const safePlayer: Player = json.player || targetPlayer;
      const newSession = buildSessionFromPlayer(safePlayer);
      setLoginModalOpen(false);
      // Đồng bộ toàn bộ dữ liệu theo quyền mới trước khi mở giao diện điều hành
      const ok = await hydrateForSession(newSession, "schedule");
      if (ok) {
        showToast(
          `Đã đăng nhập: ${safePlayer.full_name} (${
            newSession.role === "manager" ? "Ban Quản Lý" : "Cầu thủ"
          })`
        );
      }
    } catch (err) {
      console.error("switch_role error:", err);
      showToast("Lỗi kết nối phiên làm việc máy chủ");
    }
  };

  // Danh sách menu điều hướng theo đúng Phân Quyền & Ưu tiên Điểm Danh đầu tiên
  const getVisibleNavItems = () => {
    if (session.role === "guest") {
      return [
        {
          id: "public" as ActiveTab,
          label: "Trang Khách & Fanpage",
          shortLabel: "Trang chủ",
          icon: Globe,
        },
      ];
    }

    if (session.role === "player") {
      return [
        {
          id: "schedule" as ActiveTab,
          label: "Lịch, Thông Báo & Điểm Danh",
          shortLabel: "Điểm danh",
          icon: CalendarDays,
        },
        {
          id: "personal" as ActiveTab,
          label: "Cá Nhân & Đổi Mật Khẩu",
          shortLabel: "Cá nhân",
          icon: UserCircle2,
        },
        {
          id: "players" as ActiveTab,
          label: `Đội Hình (${data.players.length})`,
          shortLabel: "Đội hình",
          icon: Users,
        },
        {
          id: "dashboard" as ActiveTab,
          label: "Quỹ & Thông Tin Chung",
          shortLabel: "Quỹ đội",
          icon: LayoutDashboard,
        },
        {
          id: "matrix" as ActiveTab,
          label: "Bảng Thu Trận (Tham Khảo)",
          shortLabel: "Bảng thu",
          icon: Grid,
        },
        {
          id: "posts" as ActiveTab,
          label: "Bài Viết & Hoạt Động CLB",
          shortLabel: "Bài viết",
          icon: Newspaper,
        },
      ];
    }

    // session.role === "manager" (Ban Quản Lý / Thủ Quỹ) — Khi đã đăng nhập không hiển thị Trang khách
    return [
      {
        id: "schedule" as ActiveTab,
        label: "1. Lịch & Điểm Danh Tuần",
        shortLabel: "Điểm danh",
        icon: CalendarDays,
      },
      {
        id: "collection" as ActiveTab,
        label: "2. Thu Tiền & Chi Sân",
        shortLabel: "Thu / Chi sân",
        icon: HandCoins,
      },
      {
        id: "players" as ActiveTab,
        label: `Đội Hình & DS Thi Đấu (${data.players.length})`,
        shortLabel: "Đội hình",
        icon: Users,
      },
      {
        id: "posts" as ActiveTab,
        label: "Đăng Bài Viết CLB (WebP)",
        shortLabel: "Bài viết",
        icon: Newspaper,
      },
      {
        id: "dashboard" as ActiveTab,
        label: "Tổng Quan Quỹ",
        shortLabel: "Tổng quan",
        icon: LayoutDashboard,
      },
      {
        id: "finance" as ActiveTab,
        label: "Sổ Quỹ & Chi Tiêu",
        shortLabel: "Sổ quỹ",
        icon: Wallet,
      },
      {
        id: "sponsors" as ActiveTab,
        label: "Tài Trợ & Đối Tác",
        shortLabel: "Tài trợ",
        icon: Award,
      },
      {
        id: "matrix" as ActiveTab,
        label: "Bảng Thu Trận",
        shortLabel: "Bảng thu",
        icon: Grid,
      },
      {
        id: "personal" as ActiveTab,
        label: "Cá Nhân",
        shortLabel: "Cá nhân",
        icon: UserCircle2,
      },
    ];
  };

  const navItems = getVisibleNavItems();
  const fanpageUrl = data.settings.fanpage_url || FANPAGE_URL;
  const currentPlayerObj = data.players.find((p) => p.id === session.playerId);

  return (
    <div
      className={`min-h-dvh flex flex-col ${
        session.role === "guest" ? "bg-[#050e20]" : "pb-20 md:pb-8"
      }`}
    >
      <a href="#main-content" className="skip-link">Bỏ qua điều hướng, tới nội dung chính</a>
      {/* Top Navigation Bar — Khi đã đăng nhập (Cầu thủ / Quản lý) hiển thị App Header; khi là Khách hiển thị thanh công khai */}
      {session.role !== "guest" ? (
        <header className="sticky top-0 z-40 app-header text-white border-b border-white/15 shadow-md">
          <div className="mx-auto max-w-7xl px-3 sm:px-6">
            <div className="flex h-16 items-center justify-between gap-2.5">
              {/* Logo Chính Thức & Tên Đội */}
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={OFFICIAL_LOGO_URL}
                  alt="Logo FC HĐH Gò Nổi"
                  className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-lg object-contain bg-white p-0.5 border border-[#d4af37] shadow-xs"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white truncate">
                      FC HĐH GÒ NỔI
                    </h1>
                    <a
                      href={fanpageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden lg:inline-flex items-center gap-1 rounded-md bg-[#1877F2] hover:bg-[#166fe5] px-2 py-0.5 text-[11px] font-bold text-white transition"
                    >
                      <span>Fanpage</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                  <p className="text-[11px] text-[#fde047] font-semibold truncate">
                    Xã Gò Nổi • TP. Đà Nẵng — Tại TP.HCM
                  </p>
                </div>
              </div>

              {/* Khu vực Tài khoản đang đăng nhập & Công cụ */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <div className="hidden sm:block rounded-lg bg-[#092244]/70 border border-white/15 px-3 py-1 text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-sky-200 font-bold">
                    Tồn Quỹ Đội
                  </span>
                  <span className="text-sm font-extrabold tabular-nums text-[#fde047]">
                    {formatVND(data.summary.currentBalance)}
                  </span>
                </div>

                {session.role === "manager" && (
                  <>
                    <label
                      className="hidden md:inline-flex items-center gap-1.5 min-h-10 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 lg:px-3 py-2 text-xs font-bold text-white transition cursor-pointer focus-within:outline-2 focus-within:outline-[#d4af37]"
                      title="Nhập dữ liệu từ file Excel (.xlsx)"
                    >
                      <Upload className="h-3.5 w-3.5 text-[#fde047] shrink-0" />
                      <span className="hidden lg:inline">Nhập Excel</span>
                      <span className="lg:hidden">Nhập</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleUploadExcel}
                        className="sr-only"
                      />
                    </label>

                    <a
                      href="/api/export"
                      className="hidden md:inline-flex items-center gap-1.5 min-h-10 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 lg:px-3 py-2 text-xs font-bold text-white transition focus-visible:outline-2 focus-visible:outline-[#d4af37]"
                      title="Tải file Excel 5 sheets chuẩn GONOIFC"
                    >
                      <Download className="h-3.5 w-3.5 text-[#fde047] shrink-0" />
                      <span className="hidden lg:inline">Xuất Excel</span>
                      <span className="lg:hidden">Xuất</span>
                    </a>
                  </>
                )}

                {/* Nút hiển thị Vai trò hiện tại & Đổi tài khoản */}
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(true)}
                  className="inline-flex items-center gap-2 min-h-10 rounded-lg bg-[#d4af37] hover:bg-[#e5c14d] px-2.5 sm:px-3 py-1.5 text-xs font-extrabold text-[#092244] transition shadow-xs focus-visible:outline-2 focus-visible:outline-white"
                >
                  {currentPlayerObj?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentPlayerObj.avatar_url}
                      alt={session.shortName}
                      className="h-6 w-6 rounded-full object-cover border border-[#092244]"
                    />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-[#092244]" />
                  )}
                  <div className="text-left leading-tight">
                    <div className="text-[9px] uppercase font-extrabold text-[#092244]/80">
                      {session.role === "manager"
                        ? "Ban Quản Lý"
                        : "Cầu Thủ"}
                    </div>
                    <div className="font-extrabold">
                      #{session.jerseyNumber ?? "-"} {session.shortName}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickSwitchRole(null)}
                  title="Đăng xuất về Trang Khách công khai"
                  aria-label="Đăng xuất về Trang Khách"
                  className="inline-flex items-center justify-center min-h-10 min-w-10 rounded-lg bg-white/10 hover:bg-rose-600 text-sky-100 hover:text-white border border-white/15 transition focus-visible:outline-2 focus-visible:outline-[#d4af37]"
                >
                  <LogOut className="h-4 w-4" />
                </button>

                {/* Nút mở Menu trên Mobile */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  title="Mở toàn bộ menu chức năng"
                  aria-label="Mở menu điều hướng"
                  aria-expanded={mobileMenuOpen}
                  className="md:hidden inline-flex items-center justify-center min-h-10 min-w-10 rounded-lg bg-[#d4af37] hover:bg-[#e5c14d] text-[#092244] font-black shadow-xs transition focus-visible:outline-2 focus-visible:outline-white"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav
              aria-label="Điều hướng chính"
              className="hidden md:flex items-center gap-1 pt-1 -mb-px overflow-x-auto gn-hide-scroll"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-flex items-center gap-1.5 min-h-10 px-3 py-2 text-xs lg:text-sm font-bold border-b-2 transition whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#d4af37] ${
                      isActive
                        ? "border-[#d4af37] text-[#fde047] bg-[#092244]/75 rounded-t-lg font-extrabold"
                        : "border-transparent text-sky-100/85 hover:text-white hover:bg-white/10 rounded-t-lg"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </header>
      ) : null}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 right-4 z-50 rounded-xl bg-[#092244] text-white px-4 py-3 text-sm font-bold shadow-lg border border-[#d4af37] flex items-center gap-2.5"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-[#d4af37] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cảnh báo bảo mật tài khoản nếu đang dùng mật khẩu mặc định */}
      {session.role !== "guest" &&
        session.mustChangePassword &&
        !dismissSecurityBanner && (
          <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 pt-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-amber-50 border border-amber-300 shadow-xs">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="text-xs sm:text-sm">
                  <p className="font-bold text-amber-950">
                    Cảnh báo bảo mật tài khoản
                  </p>
                  <p className="text-amber-800 text-xs mt-0.5">
                    Tài khoản của bạn đang dùng mật khẩu mặc định (1234). Vui
                    lòng đổi mật khẩu cá nhân mới để bảo vệ thông tin.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setActiveTab("personal")}
                  className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Đổi mật khẩu ngay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDismissSecurityBanner(true)}
                  aria-label="Đóng cảnh báo bảo mật"
                  className="inline-flex items-center justify-center min-h-9 min-w-9 rounded-lg text-amber-700 hover:text-amber-950 hover:bg-amber-200/60 transition"
                  title="Bỏ qua nhắc nhở"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Main Content Area */}
      <main id="main-content" key={`${session.role}-${activeTab}`} className={
          session.role === "guest"
            ? "tab-enter w-full flex-1"
            : "tab-enter mx-auto w-full max-w-7xl flex-1 px-3 sm:px-6 py-4 sm:py-5"
        }>
        {isHydratingSession ? (
          <div
            role="status"
            aria-live="polite"
            className="mx-auto my-12 max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm"
          >
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1e4fc2]" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-slate-900">
              Đang đồng bộ dữ liệu theo phiên làm việc...
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Vui lòng chờ trong giây lát để tải đầy đủ sổ quỹ và thông tin đội bóng.
            </p>
          </div>
        ) : hydrationError && session.role !== "guest" ? (
          <div
            role="alert"
            className="mx-auto my-12 max-w-lg rounded-xl border border-rose-200 bg-white p-6 text-center shadow-sm space-y-3"
          >
            <ShieldAlert className="mx-auto h-8 w-8 text-rose-600" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-slate-900">
              Không thể tải dữ liệu phiên làm việc
            </h2>
            <p className="text-xs text-slate-600">{hydrationError}</p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => void hydrateForSession(session, activeTab)}
                className="rounded-lg bg-[#1e4fc2] hover:bg-[#2f66dd] px-4 py-2 text-xs font-bold text-[#ffc933] cursor-pointer"
              >
                Thử tải lại dữ liệu
              </button>
              <button
                type="button"
                onClick={() => void handleQuickSwitchRole(null)}
                className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Đăng xuất về Trang Khách
              </button>
            </div>
          </div>
        ) : (
          <>
        {session.role === "guest" && (
          <PublicGuestPortal
            data={data}
            onOpenLogin={() => setLoginModalOpen(true)}
          />
        )}

        {session.role !== "guest" && activeTab === "personal" && (
          <PlayerPersonalTab
            data={data}
            session={session}
            onMutate={handleMutate}
            isSaving={isSaving}
          />
        )}

        {session.role !== "guest" && activeTab === "dashboard" && (
          <DashboardTab
            data={data}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onGoToCollection={
              session.role === "manager"
                ? () => setActiveTab("collection")
                : undefined
            }
          />
        )}

        {session.role !== "guest" && activeTab === "schedule" && (
          <ScheduleTab
            data={data}
            session={session}
            onMutate={handleMutate}
            isSaving={isSaving}
            onGoToCollection={
              session.role === "manager"
                ? () => setActiveTab("collection")
                : undefined
            }
          />
        )}

        {session.role === "manager" && activeTab === "collection" && (
          <CollectionTab
            data={data}
            session={session}
            onMutate={handleMutate}
            isSaving={isSaving}
          />
        )}

        {session.role !== "guest" && activeTab === "matrix" && (
          <MatrixTab
            data={data}
            session={session}
            onGoToCollection={
              session.role === "manager"
                ? () => setActiveTab("collection")
                : undefined
            }
          />
        )}

        {session.role !== "guest" && activeTab === "players" && (
          <PlayersTab
            data={data}
            session={session}
            onMutate={handleMutate}
            isSaving={isSaving}
          />
        )}

        {session.role === "manager" && activeTab === "finance" && (
          <FinanceTab
            data={data}
            onMutate={handleMutate}
            isSaving={isSaving}
          />
        )}

        {session.role === "manager" && activeTab === "sponsors" && (
          <SponsorsTab
            data={data}
            onMutate={handleMutate}
            isSaving={isSaving}
          />
        )}

        {session.role !== "guest" && activeTab === "posts" && (
          <ClubPostsTab
            data={data}
            session={session}
            onMutate={handleMutate}
            isSaving={isSaving}
          />
        )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar — Thiết kế hiện đại, khoa học, ưu tiên Điểm danh */}
      {session.role !== "guest" && (
        <nav
          aria-label="Điều hướng di động"
          className="md:hidden safe-bottom fixed bottom-0 inset-x-0 z-40 bg-[#0a2347] text-white border-t border-[#4a7fe8]/60 grid grid-cols-5 shadow-2xl backdrop-blur-lg"
        >
          {(() => {
            const isManager = session.role === "manager";
            const primaryTabs: Array<{
              id: ActiveTab;
              label: string;
              icon: React.ComponentType<{ className?: string }>;
            }> = isManager
              ? [
                  { id: "schedule", label: "Điểm danh", icon: CalendarDays },
                  { id: "collection", label: "Thu tiền", icon: HandCoins },
                  { id: "players", label: "Đội hình", icon: Users },
                  { id: "finance", label: "Sổ quỹ", icon: Wallet },
                ]
              : [
                  { id: "schedule", label: "Điểm danh", icon: CalendarDays },
                  { id: "players", label: "Đội hình", icon: Users },
                  { id: "personal", label: "Cá nhân", icon: UserCircle2 },
                  { id: "dashboard", label: "Quỹ đội", icon: LayoutDashboard },
                ];

            const isMoreActive =
              !primaryTabs.some((t) => t.id === activeTab) && activeTab !== "public";

            return (
              <>
                {primaryTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex flex-col items-center justify-center py-2 px-1 text-[11px] font-bold transition cursor-pointer ${
                        isActive
                          ? "text-[#ffc933] bg-[#164ea0]/80 border-t-2 border-[#ffc933]"
                          : "text-sky-200/80 hover:text-white"
                      }`}
                    >
                      <Icon className="h-5 w-5 mb-0.5" />
                      <span className="truncate max-w-full">{tab.label}</span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-expanded={mobileMenuOpen}
                  className={`flex flex-col items-center justify-center py-2 px-1 text-[11px] font-bold transition cursor-pointer relative ${
                    isMoreActive
                      ? "text-[#ffc933] bg-[#164ea0]/80 border-t-2 border-[#ffc933]"
                      : "text-sky-200/80 hover:text-white"
                  }`}
                >
                  <MoreHorizontal className="h-5 w-5 mb-0.5" />
                  <span className="truncate max-w-full">Thêm</span>
                  {isMoreActive && (
                    <span className="absolute top-1.5 right-4 h-2 w-2 rounded-full bg-[#ffc933]" />
                  )}
                </button>
              </>
            );
          })()}
        </nav>
      )}

      {/* ===================== MOBILE MORE MENU BOTTOM SHEET / DRAWER ===================== */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tất cả chức năng ứng dụng"
          className="md:hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col justify-end"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-full max-h-[85vh] bg-gradient-to-b from-[#0a2752] via-[#081f42] to-[#05142b] border-t-2 border-[#ffd700] rounded-t-3xl p-5 overflow-y-auto space-y-5 shadow-2xl text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Drawer với Thông tin Thành Viên */}
            <div className="flex items-center justify-between pb-4 border-b border-white/15">
              <div className="flex items-center gap-3">
                {currentPlayerObj?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentPlayerObj.avatar_url}
                    alt={session.shortName}
                    className="h-12 w-12 rounded-full object-cover border-2 border-[#ffd700] shadow"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-[#0b2b57] border-2 border-[#ffd700] flex items-center justify-center font-black text-sm text-[#ffd700]">
                    #{session.jerseyNumber ?? "-"}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white">
                      #{session.jerseyNumber ?? "-"} {session.fullName}
                    </span>
                    <span className="rounded bg-[#ffd700] px-1.5 py-0.2 text-[9px] font-black uppercase text-slate-950">
                      {session.role === "manager" ? "BQL" : "Cầu thủ"}
                    </span>
                  </div>
                  <div className="text-xs text-sky-200 mt-0.5">
                    Quỹ đội:{" "}
                    <strong className="text-[#ffd700]">
                      {formatVND(data.summary.currentBalance)}
                    </strong>
                  </div>
                </div>
              </div>

              <button
                ref={drawerCloseBtnRef}
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Đóng menu điều hướng"
                className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl bg-white/10 hover:bg-white/20 text-white transition focus-visible:outline-2 focus-visible:outline-[#d4af37]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Danh sách tất cả các tab theo phân quyền */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-[#ffd700] block">
                TẤT CẢ CHỨC NĂNG HỆ THỐNG
              </span>
              <div className="grid grid-cols-1 gap-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer text-left ${
                        isActive
                          ? "bg-[#164ea0] border-[#ffd700] text-[#ffd700] shadow-md"
                          : "bg-[#0c2e5c]/70 hover:bg-[#123e7a] border-white/10 text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isActive
                              ? "bg-[#ffd700] text-slate-950"
                              : "bg-[#071d3a] text-[#ffd700]"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-sm">{item.label}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-60" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Công cụ thêm cho Ban Quản Lý (Nhập / Xuất Excel) */}
            {session.role === "manager" && (
              <div className="pt-2 border-t border-white/15 space-y-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-sky-300 block">
                  DỮ LIỆU BẢNG TÍNH EXCEL
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center justify-center gap-2 rounded-xl bg-[#0b2b57] hover:bg-[#123e7a] border border-white/15 p-3 text-xs font-bold text-white transition cursor-pointer">
                    <Upload className="h-4 w-4 text-[#ffd700]" />
                    <span>Nhập Excel</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        handleUploadExcel(e);
                        setMobileMenuOpen(false);
                      }}
                      className="sr-only"
                    />
                  </label>

                  <a
                    href="/api/export"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#0b2b57] hover:bg-[#123e7a] border border-white/15 p-3 text-xs font-bold text-white transition"
                  >
                    <Download className="h-4 w-4 text-[#ffd700]" />
                    <span>Xuất Excel</span>
                  </a>
                </div>
              </div>
            )}

            {/* Lối tắt hệ thống: Trang Khách, Đổi vai trò, Đăng xuất */}
            <div className="pt-2 border-t border-white/15 space-y-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">
                HỆ THỐNG & ĐĂNG XUẤT
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleQuickSwitchRole(null);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 p-2.5 text-xs font-bold text-white transition cursor-pointer"
                >
                  <Globe className="h-4 w-4 text-sky-300" />
                  <span>Trang Khách</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLoginModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 p-2.5 text-xs font-bold text-white transition cursor-pointer"
                >
                  <KeyRound className="h-4 w-4 text-[#ffd700]" />
                  <span>Đổi Tài Khoản</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  handleQuickSwitchRole(null);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-900/60 hover:bg-rose-800 border border-rose-500/50 p-3 text-xs font-black uppercase tracking-wider text-white transition cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Đăng Xuất Khỏi Thiết Bị</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Đăng Nhập Thành Viên & Ban Quản Lý Chuyên Nghiệp */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={async (player, mustChangePassword) => {
          const newSession = buildSessionFromPlayer(player, mustChangePassword);
          setLoginModalOpen(false);
          const ok = await hydrateForSession(newSession, "schedule");
          if (ok) {
            showToast(
              `Xin chào ${player.full_name} (#${player.jersey_number ?? "-"})!`
            );
          }
        }}
      />
    </div>
  );
}
