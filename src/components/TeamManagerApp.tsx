"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
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
  BarChart3,
  Eye,
  EyeOff,
} from "lucide-react";
import type { FullAppData, AuthSession, Player } from "@/types/app";
import { FANPAGE_URL, OFFICIAL_LOGO_URL } from "@/types/app";
import { formatVND } from "@/lib/format";
import { validatePasswordStrength } from "@/lib/passwordStrength";
import {
  createTransitionSafeData,
  executeSessionHydration,
} from "@/lib/sessionHydration";
import { PublicGuestPortal } from "./PublicGuestPortal";
import { useDialogA11y } from "./useDialogA11y";
import { Button, ModalDialog, Toast, type ToastVariant } from "./ui";

const DashboardTab = dynamic(
  () => import("./DashboardTab").then((m) => m.DashboardTab),
  { ssr: false }
);
const AnalyticsCenterTab = dynamic(
  () => import("./AnalyticsCenterTab").then((m) => m.AnalyticsCenterTab),
  { ssr: false }
);
const ScheduleTab = dynamic(
  () => import("./ScheduleTab").then((m) => m.ScheduleTab),
  { ssr: false }
);
const CollectionTab = dynamic(
  () => import("./CollectionTab").then((m) => m.CollectionTab),
  { ssr: false }
);
const MatrixTab = dynamic(
  () => import("./MatrixTab").then((m) => m.MatrixTab),
  { ssr: false }
);
const PlayersTab = dynamic(
  () => import("./PlayersTab").then((m) => m.PlayersTab),
  { ssr: false }
);
const FinanceTab = dynamic(
  () => import("./FinanceTab").then((m) => m.FinanceTab),
  { ssr: false }
);
const PlayerPersonalTab = dynamic(
  () => import("./PlayerPersonalTab").then((m) => m.PlayerPersonalTab),
  { ssr: false }
);
const ClubPostsTab = dynamic(() => import("./ClubPostsTab"), { ssr: false });
const SponsorsTab = dynamic(
  () => import("./SponsorsTab").then((m) => m.SponsorsTab),
  { ssr: false }
);
const LoginModal = dynamic(
  () => import("./LoginModal").then((m) => m.LoginModal),
  { ssr: false }
);

type ActiveTab =
  | "public"
  | "personal"
  | "dashboard"
  | "analytics"
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
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    variant: ToastVariant;
  } | null>(null);

  // Login modal & session hydration states
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [forcedOldPin, setForcedOldPin] = useState("");
  const [forcedNewPin, setForcedNewPin] = useState("");
  const [forcedConfirmPin, setForcedConfirmPin] = useState("");
  const [forcedPinError, setForcedPinError] = useState("");
  const [showForcedPins, setShowForcedPins] = useState(false);
  const [isHydratingSession, setIsHydratingSession] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const [importErrorFileName, setImportErrorFileName] = useState<string | null>(null);
  const [importErrorModalOpen, setImportErrorModalOpen] = useState(false);

  const isMountedRef = useRef(true);
  const lastPlayerIdRef = useRef<number | null>(session.playerId);
  const hydrationEpochRef = useRef(0);
  const hydrationAbortRef = useRef<AbortController | null>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const drawerCloseBtnRef = useRef<HTMLButtonElement>(null);

  const clearForcedPinState = () => {
    setForcedOldPin("");
    setForcedNewPin("");
    setForcedConfirmPin("");
    setForcedPinError("");
    setShowForcedPins(false);
  };

  useEffect(() => {
    if (lastPlayerIdRef.current !== session.playerId) {
      lastPlayerIdRef.current = session.playerId;
      clearForcedPinState();
    }
  }, [session.playerId]);

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
        if (nextSession.playerId !== lastPlayerIdRef.current) {
          clearForcedPinState();
        }
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

  useDialogA11y({
    isOpen: mobileMenuOpen,
    onClose: () => setMobileMenuOpen(false),
    containerRef: mobileDrawerRef,
    initialFocusRef: drawerCloseBtnRef,
  });

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
      .catch(() => { });

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

  const showToast = (msg: string, variant: ToastVariant = "success") => {
    setToastMessage({ message: msg, variant });
    window.setTimeout(() => {
      setToastMessage((prev) => (prev?.message === msg ? null : prev));
    }, variant === "error" ? 4500 : 2800);
  };

  const handleMutate = async (
    action: string,
    payload?: unknown
  ): Promise<{ ok: boolean; error?: string }> => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload: payload ?? {} }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message = json.error || "Có lỗi xảy ra";
        showToast(message, "error");
        return { ok: false, error: message };
      }
      setData(json);
      if (action === "change_own_password") {
        setSession((prev) => ({ ...prev, mustChangePassword: false }));
        showToast("Đã cập nhật mật khẩu mới thành công!");
      } else if (action === "reset_player_password") {
        showToast("Đã đặt lại mật khẩu (PIN) mới cho cầu thủ thành công!");
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
      return { ok: true };
    } catch (err) {
      console.error(err);
      showToast("Không thể kết nối máy chủ", "error");
      return { ok: false, error: "Không thể kết nối máy chủ" };
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
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const apiError =
          json &&
            typeof json === "object" &&
            "error" in json &&
            typeof (json as { error?: unknown }).error === "string" &&
            (json as { error: string }).error.trim().length > 0
            ? (json as { error: string }).error.trim()
            : "Không thể nhập file Excel. Vui lòng kiểm tra cấu trúc và dữ liệu hợp lệ.";
        setImportErrorFileName(file.name);
        setImportErrorMessage(apiError);
        setImportErrorModalOpen(true);
        showToast(apiError, "error");
        return;
      }
      setImportErrorMessage(null);
      setImportErrorFileName(null);
      setImportErrorModalOpen(false);
      setData(json as FullAppData);
      try {
        localStorage.setItem("gonoi_fc_cached_data_v1", JSON.stringify(json));
      } catch {
        // ignore
      }
      showToast(`Đã đồng bộ dữ liệu từ file ${file.name}!`);
    } catch {
      const fallbackError =
        "Lỗi kết nối khi tải file Excel lên máy chủ. Vui lòng thử lại.";
      setImportErrorFileName(file.name);
      setImportErrorMessage(fallbackError);
      setImportErrorModalOpen(true);
      showToast(fallbackError, "error");
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
      clearForcedPinState();
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
        showToast(json.error || "Không thể chuyển quyền.", "error");
        return;
      }
      const safePlayer: Player = json.player || targetPlayer;
      const newSession = buildSessionFromPlayer(safePlayer);
      setLoginModalOpen(false);
      // Đồng bộ toàn bộ dữ liệu theo quyền mới trước khi mở giao diện điều hành
      const ok = await hydrateForSession(newSession, "schedule");
      if (ok) {
        showToast(
          `Đã đăng nhập: ${safePlayer.full_name} (${newSession.role === "manager" ? "Ban Quản Lý" : "Cầu thủ"
          })`
        );
      }
    } catch (err) {
      console.error("switch_role error:", err);
      showToast("Lỗi kết nối phiên làm việc máy chủ", "error");
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
        id: "analytics" as ActiveTab,
        label: "Thống kê & Phân tích",
        shortLabel: "Phân tích",
        icon: BarChart3,
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
      className={`min-h-dvh flex flex-col ${session.role === "guest" ? "bg-navy-950" : "pb-20 md:pb-8"
        }`}
    >
      <a href="#main-content" className="skip-link">Bỏ qua điều hướng, tới nội dung chính</a>
      {/* Top Navigation Bar — Khi đã đăng nhập (Cầu thủ / Quản lý) hiển thị App Header; khi là Khách hiển thị thanh công khai */}
      {session.role !== "guest" ? (
        <header className="sticky top-0 z-40 app-header text-white border-b border-white/15 shadow-md pt-[env(safe-area-inset-top)]">
          <div className="mx-auto max-w-7xl px-3 sm:px-6">
            <div className="flex h-16 items-center justify-between gap-2.5">
              {/* Logo Chính Thức & Tên Đội */}
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={OFFICIAL_LOGO_URL}
                  alt="Logo FC HĐH Gò Nổi"
                  className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-lg object-contain bg-white p-0.5 border border-gold-500 shadow-xs"
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
                      className="hidden lg:inline-flex items-center gap-1 rounded-md bg-royal-600 hover:bg-royal-500 px-2 py-0.5 text-[11px] font-bold text-white transition"
                    >
                      <span>Fanpage</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                  <p className="text-[11px] text-gold-300 font-semibold truncate">
                    Xã Gò Nổi • TP. Đà Nẵng — Tại TP.HCM
                  </p>
                </div>
              </div>

              {/* Khu vực Tài khoản đang đăng nhập & Công cụ */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <div className="hidden sm:block rounded-lg bg-navy-800/70 border border-white/15 px-3 py-1 text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-sky-200 font-bold">
                    Tồn Quỹ Đội
                  </span>
                  <span className="text-sm font-extrabold tabular-nums text-gold-300">
                    {formatVND(data.summary.currentBalance)}
                  </span>
                </div>

                {session.role === "manager" && !session.mustChangePassword && (
                  <>
                    <label
                      className="hidden md:inline-flex items-center gap-1.5 min-h-10 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 lg:px-3 py-2 text-xs font-bold text-white transition cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-on-dark"
                      title="Nhập dữ liệu từ file Excel (.xlsx)"
                    >
                      <Upload className="h-3.5 w-3.5 text-gold-300 shrink-0" />
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
                      className="hidden md:inline-flex items-center gap-1.5 min-h-10 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 lg:px-3 py-2 text-xs font-bold text-white transition focus-visible:outline-2 focus-visible:outline-focus-on-dark"
                      title="Tải file Excel 5 sheets chuẩn GONOIFC"
                    >
                      <Download className="h-3.5 w-3.5 text-gold-300 shrink-0" />
                      <span className="hidden lg:inline">Xuất Excel</span>
                      <span className="lg:hidden">Xuất</span>
                    </a>
                  </>
                )}

                {/* Nút hiển thị Vai trò hiện tại & Đổi tài khoản */}
                {!session.mustChangePassword && (
                  <button
                    type="button"
                    onClick={() => setLoginModalOpen(true)}
                    className="inline-flex items-center gap-2 min-h-10 rounded-lg bg-gold-500 hover:bg-gold-450 px-2.5 sm:px-3 py-1.5 text-xs font-extrabold text-ink-primary transition shadow-xs focus-visible:outline-2 focus-visible:outline-white"
                  >
                    {currentPlayerObj?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentPlayerObj.avatar_url}
                        alt={session.shortName}
                        className="h-6 w-6 rounded-full object-cover border border-navy-800"
                      />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-ink-primary" />
                    )}
                    <div className="text-left leading-tight">
                      <div className="text-[9px] uppercase font-extrabold text-ink-primary/80">
                        {session.role === "manager"
                          ? "Ban Quản Lý"
                          : "Cầu Thủ"}
                      </div>
                      <div className="font-extrabold">
                        #{session.jerseyNumber ?? "-"} {session.shortName}
                      </div>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleQuickSwitchRole(null)}
                  title="Đăng xuất về Trang Khách công khai"
                  aria-label="Đăng xuất về Trang Khách"
                  className="inline-flex items-center justify-center min-h-10 min-w-10 rounded-lg bg-white/10 hover:bg-rose-600 text-sky-100 hover:text-white border border-white/15 transition focus-visible:outline-2 focus-visible:outline-focus-on-dark"
                >
                  <LogOut className="h-4 w-4" />
                </button>

                {/* Nút mở Menu trên Mobile */}
                {!session.mustChangePassword && (
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    title="Mở toàn bộ menu chức năng"
                    aria-label="Mở menu điều hướng"
                    aria-expanded={mobileMenuOpen}
                    className="md:hidden inline-flex items-center justify-center min-h-10 min-w-10 rounded-lg bg-gold-500 hover:bg-gold-450 text-ink-primary font-black shadow-xs transition focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            {!session.mustChangePassword && (
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
                      className={`inline-flex items-center gap-1.5 min-h-10 px-3 py-2 text-xs lg:text-sm font-bold border-b-2 transition whitespace-nowrap focus-visible:outline-2 focus-visible:outline-focus-on-dark ${isActive
                        ? "border-gold-500 text-gold-300 bg-navy-800/75 rounded-t-lg font-extrabold"
                        : "border-transparent text-sky-100/85 hover:text-white hover:bg-white/10 rounded-t-lg"
                        }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            )}
          </div>
        </header>
      ) : null}

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage.message}
          variant={toastMessage.variant}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Persistent Excel Import Error Summary Banner (when modal dismissed) */}
      {session.role === "manager" &&
        importErrorMessage &&
        !importErrorModalOpen && (
          <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 pt-3">
            <div
              role="alert"
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-rose-50 border border-rose-300 shadow-xs"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
                  <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="text-xs sm:text-sm min-w-0">
                  <p className="font-bold text-rose-950">
                    Lỗi nhập file Excel
                    {importErrorFileName ? ` (${importErrorFileName})` : ""}
                  </p>
                  <p className="text-rose-800 text-xs mt-0.5 break-words">
                    {importErrorMessage}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setImportErrorModalOpen(true)}
                >
                  Xem chi tiết
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setImportErrorMessage(null);
                    setImportErrorFileName(null);
                  }}
                  aria-label="Đóng thông báo lỗi nhập Excel"
                  className="inline-flex items-center justify-center min-h-11 min-w-11 md:min-h-9 md:min-w-9 rounded-lg text-rose-700 hover:text-rose-950 hover:bg-rose-200/60 transition"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
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
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-royal-600" aria-hidden="true" />
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
                className="rounded-lg bg-royal-600 hover:bg-royal-500 px-4 py-2 text-xs font-bold text-gold-400 cursor-pointer"
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
        ) : session.role !== "guest" && session.mustChangePassword ? (
          <div
            role="status"
            className="mx-auto my-12 max-w-lg rounded-xl border border-amber-200 bg-white p-6 text-center shadow-sm space-y-2"
          >
            <KeyRound className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-slate-900">
              Yêu cầu đổi mật khẩu bắt buộc
            </h2>
            <p className="text-xs text-slate-600">
              Vui lòng hoàn tất đổi mật khẩu mới hoặc đăng xuất để tiếp tục.
            </p>
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

            {session.role === "manager" && activeTab === "analytics" && (
              <AnalyticsCenterTab onNavigateTab={(tab) => setActiveTab(tab)} />
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
                onMutate={async (action, payload) => {
                  await handleMutate(action, payload);
                }}
                isSaving={isSaving}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar — Thiết kế hiện đại, khoa học, ưu tiên Điểm danh */}
      {session.role !== "guest" && !session.mustChangePassword && (
        <nav
          aria-label="Điều hướng di động"
          className="md:hidden safe-bottom fixed bottom-0 inset-x-0 z-40 bg-navy-800 text-white border-t border-royal-500/60 grid grid-cols-5 shadow-2xl backdrop-blur-lg"
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
                      className={`flex flex-col items-center justify-center py-2 px-1 text-[11px] font-bold transition cursor-pointer ${isActive
                        ? "text-gold-400 bg-navy-500/80 border-t-2 border-gold-400"
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
                  className={`flex flex-col items-center justify-center py-2 px-1 text-[11px] font-bold transition cursor-pointer relative ${isMoreActive
                    ? "text-gold-400 bg-navy-500/80 border-t-2 border-gold-400"
                    : "text-sky-200/80 hover:text-white"
                    }`}
                >
                  <MoreHorizontal className="h-5 w-5 mb-0.5" />
                  <span className="truncate max-w-full">Thêm</span>
                  {isMoreActive && (
                    <span className="absolute top-1.5 right-4 h-2 w-2 rounded-full bg-gold-400" />
                  )}
                </button>
              </>
            );
          })()}
        </nav>
      )}

      {/* ===================== MOBILE MORE MENU BOTTOM SHEET / DRAWER ===================== */}
      {mobileMenuOpen && !session.mustChangePassword && (
        <div
          ref={mobileDrawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Tất cả chức năng ứng dụng"
          className="md:hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col justify-end"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-full max-h-[85vh] bg-gradient-to-b from-navy-700 via-navy-800 to-navy-950 border-t-2 border-gold-400 rounded-t-xl p-5 overflow-y-auto space-y-5 shadow-2xl text-white"
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
                    className="h-12 w-12 rounded-full object-cover border-2 border-gold-400 shadow"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-navy-700 border-2 border-gold-400 flex items-center justify-center font-black text-sm text-gold-400">
                    #{session.jerseyNumber ?? "-"}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white">
                      #{session.jerseyNumber ?? "-"} {session.fullName}
                    </span>
                    <span className="rounded bg-gold-400 px-1.5 py-0.2 text-[9px] font-black uppercase text-slate-950">
                      {session.role === "manager" ? "BQL" : "Cầu thủ"}
                    </span>
                  </div>
                  <div className="text-xs text-sky-200 mt-0.5">
                    Quỹ đội:{" "}
                    <strong className="text-gold-400">
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
                className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl bg-white/10 hover:bg-white/20 text-white transition focus-visible:outline-2 focus-visible:outline-focus-on-dark"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Danh sách tất cả các tab theo phân quyền */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-gold-400 block">
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
                      className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer text-left ${isActive
                        ? "bg-navy-500 border-gold-400 text-gold-400 shadow-md"
                        : "bg-navy-800/70 hover:bg-navy-500 border-white/10 text-white"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${isActive
                            ? "bg-gold-400 text-slate-950"
                            : "bg-navy-900 text-gold-400"
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
                  <label className="flex items-center justify-center gap-2 rounded-xl bg-navy-700 hover:bg-navy-500 border border-white/15 p-3 text-xs font-bold text-white transition cursor-pointer">
                    <Upload className="h-4 w-4 text-gold-400" />
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
                    className="flex items-center justify-center gap-2 rounded-xl bg-navy-700 hover:bg-navy-500 border border-white/15 p-3 text-xs font-bold text-white transition"
                  >
                    <Download className="h-4 w-4 text-gold-400" />
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
                  <KeyRound className="h-4 w-4 text-gold-400" />
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

      {/* Persistent Excel Import Error Summary Modal */}
      <ModalDialog
        isOpen={importErrorModalOpen && Boolean(importErrorMessage)}
        onClose={() => setImportErrorModalOpen(false)}
        title="Không thể nhập file Excel"
        subtitle={
          importErrorFileName
            ? `Tệp: ${importErrorFileName}`
            : "Vui lòng kiểm tra dữ liệu bảng tính trước khi nhập lại"
        }
      >
        <div className="space-y-4">
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 leading-relaxed break-words"
          >
            {importErrorMessage}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 space-y-1.5 leading-relaxed">
            <p className="font-bold text-ink-primary">
              Hướng dẫn kiểm tra file Excel:
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                Kiểm tra tên các sheet chuẩn (<code>2. Danh sách</code>,{" "}
                <code>4. Thu Khác</code>, <code>5. Chi</code>,{" "}
                <code>6. Dữ liệu Chi tiết (App)</code>).
              </li>
              <li>
                Đảm bảo ngày tháng đúng định dạng hợp lệ (<code>DD/MM/YYYY</code>{" "}
                hoặc <code>YYYY-MM-DD</code>) và không để trống ở các dòng có phát sinh.
              </li>
              <li>
                Đảm bảo số tiền VNĐ là số nguyên không âm và không trùng tên cầu thủ / bản ghi điểm danh.
              </li>
            </ul>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setImportErrorModalOpen(false);
                setImportErrorMessage(null);
                setImportErrorFileName(null);
              }}
            >
              Xóa thông báo
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => setImportErrorModalOpen(false)}
            >
              Đóng
            </Button>
          </div>
        </div>
      </ModalDialog>

      {/* Modal Bắt Buộc Đổi Mật Khẩu Mới (Không thể bỏ qua khi mustChangePassword=true) */}
      <ModalDialog
        isOpen={session.role !== "guest" && Boolean(session.mustChangePassword)}
        preventDismiss
        onClose={() => {}}
        title="Bắt buộc đổi mật khẩu cá nhân"
        subtitle="Tài khoản đang sử dụng mật khẩu tạm thời. Bạn phải đặt mật khẩu mới để tiếp tục sử dụng hệ thống."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!session.playerId || isSaving) return;
            const oldTrimmed = forcedOldPin.trim();
            const newTrimmed = forcedNewPin.trim();
            const confirmTrimmed = forcedConfirmPin.trim();
            if (!oldTrimmed) {
              setForcedPinError("Vui lòng nhập mật khẩu tạm thời hiện tại.");
              return;
            }
            if (!newTrimmed) {
              setForcedPinError("Vui lòng nhập mật khẩu mới.");
              return;
            }
            if (newTrimmed !== confirmTrimmed) {
              setForcedPinError("Mật khẩu mới và xác nhận mật khẩu không khớp.");
              return;
            }
            if (newTrimmed === oldTrimmed) {
              setForcedPinError("Mật khẩu mới không được trùng với mật khẩu tạm thời.");
              return;
            }
            const strength = validatePasswordStrength(
              newTrimmed,
              currentPlayerObj?.username || session.fullName
            );
            if (!strength.valid) {
              setForcedPinError(
                strength.error || "Mật khẩu mới chưa đủ an toàn (tối thiểu 6 ký tự)."
              );
              return;
            }
            setForcedPinError("");
            const result = await handleMutate("change_own_password", {
              player_id: session.playerId,
              old_pin: oldTrimmed,
              new_pin: newTrimmed,
            });
            if (!result.ok) {
              setForcedPinError(result.error || "Không thể cập nhật mật khẩu mới.");
              return;
            }
            clearForcedPinState();
          }}
          className="space-y-4"
        >
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Mọi chức năng khác đang tạm khóa cho đến khi bạn hoàn tất đổi mật khẩu.
          </div>

          {forcedPinError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700"
            >
              {forcedPinError}
            </div>
          )}

          <div>
            <label
              htmlFor="forced-old-pin"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Mật khẩu tạm thời hiện tại
            </label>
            <input
              id="forced-old-pin"
              type={showForcedPins ? "text" : "password"}
              value={forcedOldPin}
              onChange={(e) => setForcedOldPin(e.target.value)}
              placeholder="Nhập mật khẩu tạm thời vừa đăng nhập"
              className="form-input"
              required
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="forced-new-pin"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Mật khẩu cá nhân mới
            </label>
            <input
              id="forced-new-pin"
              type={showForcedPins ? "text" : "password"}
              value={forcedNewPin}
              onChange={(e) => setForcedNewPin(e.target.value)}
              placeholder="Tối thiểu 6 ký tự an toàn"
              className="form-input"
              required
            />
          </div>

          <div>
            <label
              htmlFor="forced-confirm-pin"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Xác nhận mật khẩu mới
            </label>
            <input
              id="forced-confirm-pin"
              type={showForcedPins ? "text" : "password"}
              value={forcedConfirmPin}
              onChange={(e) => setForcedConfirmPin(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              className="form-input"
              required
            />
          </div>

          <button
            type="button"
            onClick={() => setShowForcedPins((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            {showForcedPins ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span>{showForcedPins ? "Ẩn mật khẩu" : "Hiện mật khẩu"}</span>
          </button>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleQuickSwitchRole(null)}
              disabled={isSaving}
            >
              Đăng xuất
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? "Đang lưu..." : "Cập nhật mật khẩu & tiếp tục"}
            </Button>
          </div>
        </form>
      </ModalDialog>

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
