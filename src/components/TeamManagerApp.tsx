"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import type { FullAppData, AuthSession, Player } from "@/types/app";
import { FANPAGE_URL, OFFICIAL_LOGO_URL } from "@/types/app";
import { formatVND } from "@/lib/format";
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

  // Login modal states
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dismissSecurityBanner, setDismissSecurityBanner] = useState(false);

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
          setSession(restoredSession);
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
      setSession(GUEST_SESSION);
      setActiveTab("public");
      showToast("Đã đăng xuất về Trang Khách");
      setLoginModalOpen(false);
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
      setSession(newSession);
      // Khi cầu thủ đăng nhập -> ưu tiên hiện Lịch, Thông báo & Điểm danh tuần
      setActiveTab("schedule");
      showToast(
        `Đã đăng nhập: ${safePlayer.full_name} (${
          newSession.role === "manager" ? "Ban Quản Lý" : "Cầu thủ"
        })`
      );
      setLoginModalOpen(false);
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
        <header className="sticky top-0 z-40 app-header text-white border-b border-[#4a7fe8] shadow-md">
          <div className="mx-auto max-w-7xl px-3 sm:px-6">
            <div className="flex h-16 items-center justify-between gap-2.5">
              {/* Logo Chính Thức & Tên Đội */}
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={OFFICIAL_LOGO_URL}
                  alt="Logo FC HĐH Gò Nổi"
                  className="h-11 w-11 shrink-0 rounded-xl object-contain bg-white p-0.5 border-2 border-[#ffc933] shadow-xs"
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
                      className="hidden lg:inline-flex items-center gap-1 rounded-full bg-[#1877F2] hover:bg-[#166fe5] px-2.5 py-0.5 text-[11px] font-bold text-white transition"
                    >
                      <span>Fanpage Chính Thức</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                  <p className="text-[11px] text-[#ffc933] font-semibold truncate">
                    Tại TP. Hồ Chí Minh
                  </p>
                </div>
              </div>

              {/* Khu vực Tài khoản đang đăng nhập & Công cụ */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:block rounded-xl bg-[#2f66dd] border border-[#4a7fe8] px-3 py-1 text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-sky-300 font-bold">
                    Tồn Quỹ Đội
                  </span>
                  <span className="text-sm font-extrabold text-[#ffc933]">
                    {formatVND(data.summary.currentBalance)}
                  </span>
                </div>

                {session.role === "manager" && (
                  <>
                    <label
                      className="hidden xl:inline-flex items-center gap-1.5 rounded-xl bg-[#2f66dd] hover:bg-[#4a7fe8] border border-sky-700/60 px-3 py-2 text-xs font-bold text-white transition cursor-pointer"
                      title="Nhập dữ liệu từ file Excel (.xlsx)"
                    >
                      <Upload className="h-3.5 w-3.5 text-[#ffc933]" />
                      <span>Nhập Excel</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleUploadExcel}
                        className="sr-only"
                      />
                    </label>

                    <a
                      href="/api/export"
                      className="hidden xl:inline-flex items-center gap-1.5 rounded-xl bg-[#2f66dd] hover:bg-[#4a7fe8] border border-sky-700/60 px-3 py-2 text-xs font-bold text-white transition"
                      title="Tải file Excel 5 sheets chuẩn GONOIFC"
                    >
                      <Download className="h-3.5 w-3.5 text-[#ffc933]" />
                      <span>Xuất Excel</span>
                    </a>
                  </>
                )}

                {/* Nút hiển thị Vai trò hiện tại & Đổi tài khoản */}
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#ffc933] hover:bg-[#ffd95e] px-3 py-1.5 text-xs font-extrabold text-slate-950 transition cursor-pointer shadow-xs"
                >
                  {currentPlayerObj?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentPlayerObj.avatar_url}
                      alt={session.shortName}
                      className="h-6 w-6 rounded-full object-cover border border-slate-900"
                    />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-slate-950" />
                  )}
                  <div className="text-left leading-tight">
                    <div className="text-[9px] uppercase font-extrabold text-slate-800">
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
                  className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-[#2f66dd] hover:bg-rose-700 text-sky-200 hover:text-white border border-[#4a7fe8] transition cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>

                {/* Nút mở Menu trên Mobile */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  title="Mở toàn bộ menu chức năng"
                  aria-label="Mở menu điều hướng"
                  className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-xl bg-[#ffc933] hover:bg-[#ffd95e] text-slate-950 font-black shadow-xs transition cursor-pointer"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav
              aria-label="Điều hướng chính"
              className="hidden md:flex items-center gap-1 pt-1 -mb-px overflow-x-auto"
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
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs lg:text-sm font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "border-[#ffd700] text-[#ffd700] bg-[#10346a] rounded-t-xl font-extrabold shadow-sm"
                        : "border-transparent text-sky-100/90 hover:text-white hover:bg-[#10346a]/50 rounded-t-xl"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
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
          className="fixed bottom-20 md:bottom-6 right-4 z-50 rounded-xl bg-[#1e4fc2] text-white px-4 py-3 text-sm font-bold shadow-md border-2 border-[#ffc933] flex items-center gap-2"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffc933]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cảnh báo bảo mật tài khoản nếu đang dùng mật khẩu mặc định */}
      {session.role !== "guest" &&
        session.mustChangePassword &&
        !dismissSecurityBanner && (
          <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 pt-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 border border-amber-500/40 shadow-sm backdrop-blur-sm">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="text-xs sm:text-sm">
                  <p className="font-bold text-amber-200">
                    Cảnh báo bảo mật tài khoản
                  </p>
                  <p className="text-slate-300 text-xs mt-0.5">
                    Tài khoản của bạn đang dùng mật khẩu mặc định (1234). Vui
                    lòng đổi mật khẩu cá nhân mới để bảo vệ thông tin.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setActiveTab("personal")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs shadow-sm transition cursor-pointer"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Đổi mật khẩu ngay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDismissSecurityBanner(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
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
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
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
        onSuccess={(player, mustChangePassword) => {
          const newSession = buildSessionFromPlayer(player, mustChangePassword);
          setSession(newSession);
          setLoginModalOpen(false);
          setActiveTab("schedule");
          showToast(
            `Xin chào ${player.full_name} (#${player.jersey_number ?? "-"})!`
          );
        }}
      />
    </div>
  );
}
