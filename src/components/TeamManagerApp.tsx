"use client";

import React, { useState } from "react";
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
  KeyRound,
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
import { ModalDialog } from "./ModalDialog";

type ActiveTab =
  | "public"
  | "personal"
  | "dashboard"
  | "schedule"
  | "collection"
  | "matrix"
  | "players"
  | "finance";

interface TeamManagerAppProps {
  initialData: FullAppData;
}

function buildSessionFromPlayer(p: Player): AuthSession {
  return {
    role: p.access_role === "manager" ? "manager" : "player",
    playerId: p.id,
    fullName: p.full_name,
    shortName: p.short_name,
    jerseyNumber: p.jersey_number,
    position: p.position,
    teamRole: p.role,
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

  const defaultCaptain =
    initialData.players.find((p) => p.full_name === "Nguyễn Thế Tiếng") ||
    initialData.players[0];

  // Login modal states
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [selectedLoginPlayerId, setSelectedLoginPlayerId] = useState<string>(
    String(defaultCaptain?.id || "")
  );
  const [pinInput, setPinInput] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const handleMutate = async (
    action: string,
    payload: Record<string, unknown>
  ) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Có lỗi xảy ra");
        return;
      }
      setData(json);
      if (action === "change_own_password") {
        showToast("Đã cập nhật mật khẩu (PIN) mới thành công!");
      } else if (action === "reset_player_password") {
        showToast("Đã reset mật khẩu cầu thủ về mặc định (1234)!");
      } else if (
        action !== "collect_match_fee" &&
        action !== "set_rsvp"
      ) {
        showToast("Đã lưu thay đổi vào Cơ sở dữ liệu!");
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
      showToast(`Đã đồng bộ dữ liệu từ file ${file.name}!`);
    } catch (err) {
      console.error(err);
      alert("Lỗi khi tải file Excel lên");
    } finally {
      setIsSaving(false);
      e.target.value = "";
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = data.players.find(
      (pl) => String(pl.id) === selectedLoginPlayerId
    );
    if (!p) {
      setLoginError("Vui lòng chọn tên cầu thủ");
      return;
    }
    const expectedPin = p.pin_code || "1234";
    if (pinInput.trim() !== expectedPin) {
      setLoginError(
        "Mã PIN không chính xác. Vui lòng kiểm tra lại hoặc liên hệ Ban Quản Lý để được hỗ trợ."
      );
      return;
    }
    const newSession = buildSessionFromPlayer(p);
    setSession(newSession);
    setLoginModalOpen(false);
    setLoginError("");
    // Ưu tiên mở tab Lịch, thông báo và điểm danh ngay khi cầu thủ đăng nhập
    setActiveTab("schedule");
    showToast(`Xin chào ${p.full_name} (#${p.jersey_number ?? "-"})!`);
  };

  const handleQuickSwitchRole = (targetPlayer: Player | null) => {
    if (!targetPlayer) {
      setSession(GUEST_SESSION);
      setActiveTab("public");
      showToast("Đã đăng xuất về Trang Khách");
      setLoginModalOpen(false);
      return;
    }
    const newSession = buildSessionFromPlayer(targetPlayer);
    setSession(newSession);
    // Khi cầu thủ đăng nhập -> ưu tiên hiện Lịch, Thông báo & Điểm danh tuần
    setActiveTab("schedule");
    showToast(
      `Đã đăng nhập: ${targetPlayer.full_name} (${
        newSession.role === "manager" ? "Ban Quản Lý" : "Cầu thủ"
      })`
    );
    setLoginModalOpen(false);
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
    <div className="min-h-dvh flex flex-col pb-20 md:pb-8">
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
                        ? "border-[#ffc933] text-[#ffc933] bg-[#2f66dd] rounded-t-xl"
                        : "border-transparent text-sky-100/80 hover:text-white hover:bg-[#2f66dd]/50 rounded-t-xl"
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

      {/* Main Content Area */}
      <main id="main-content" key={`${session.role}-${activeTab}`} className="tab-enter mx-auto w-full max-w-7xl flex-1 px-3 sm:px-6 py-4 sm:py-5">
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
      </main>

      {/* Mobile Bottom Navigation Bar — Thiết kế hiện đại, khoa học, ưu tiên Điểm danh */}
      {session.role !== "guest" && (
        <nav
          aria-label="Điều hướng di động"
          className="md:hidden safe-bottom fixed bottom-0 inset-x-0 z-40 bg-[#1e4fc2] text-white border-t border-[#4a7fe8] grid grid-cols-5 shadow-md"
        >
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center justify-center py-2.5 px-1 text-[11px] font-bold transition cursor-pointer ${
                  isActive
                    ? "text-[#ffc933] bg-[#2f66dd] border-t-2 border-[#ffc933]"
                    : "text-sky-200/80 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5 mb-0.5" />
                <span className="truncate max-w-full">{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Modal Đăng Nhập Thành Viên & Ban Quản Lý */}
      <ModalDialog
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        title="Đăng Nhập Thành Viên FC HĐH Gò Nổi"
        subtitle="Cổng thông tin & điều hành nội bộ dành riêng cho Cầu thủ và Ban Quản Lý CLB."
      >
        <div className="space-y-5">
          {/* Logo & Tiêu đề CLB */}
          <div className="flex items-center gap-3.5 rounded-xl bg-[#0f2239] text-white p-3.5 border border-blue-900/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_LOGO_URL}
              alt="Logo FC HĐH Gò Nổi"
              className="h-12 w-12 rounded-xl object-contain bg-white p-0.5 border border-[#ffc933] shrink-0"
            />
            <div className="text-xs">
              <div className="font-extrabold text-sm text-[#ffc933] uppercase">
                CLB BÓNG ĐÁ HĐH GÒ NỔI (TP.HCM)
              </div>
              <p className="text-slate-300 mt-0.5">
                Vui lòng chọn tài khoản thành viên và nhập mã PIN cá nhân để truy cập hệ thống.
              </p>
            </div>
          </div>

          {/* Form đăng nhập dành cho mọi cầu thủ và quản lý */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-player-select"
                className="block text-sm font-bold text-slate-700 mb-1"
              >
                Tài khoản Thành viên / Cầu thủ
              </label>
              <select
                id="login-player-select"
                value={selectedLoginPlayerId}
                onChange={(e) => {
                  setSelectedLoginPlayerId(e.target.value);
                  setLoginError("");
                }}
                className="form-select font-semibold"
              >
                {data.players.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    #{p.jersey_number ?? "-"} - {p.full_name} ({p.access_role === "manager" ? "Ban Quản Lý" : "Cầu thủ"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="login-pin-input"
                className="block text-sm font-bold text-slate-700 mb-1"
              >
                Mật khẩu / Mã PIN cá nhân
              </label>
              <div className="relative">
                <KeyRound className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-pin-input"
                  type="password"
                  value={pinInput}
                  placeholder="Nhập mã PIN cá nhân"
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setLoginError("");
                  }}
                  className="form-input !pl-9 font-bold tracking-widest"
                  autoFocus
                />
              </div>
              {loginError && (
                <p className="mt-1.5 text-xs font-bold text-rose-600">
                  {loginError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setLoginModalOpen(false);
                  setLoginError("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Đóng
              </button>

              <button
                type="submit"
                className="rounded-lg bg-[#0D5EF4] hover:bg-blue-600 px-6 py-2.5 text-sm font-extrabold text-white transition shadow-sm cursor-pointer"
              >
                Đăng Nhập Hệ Thống
              </button>
            </div>
          </form>
        </div>
      </ModalDialog>
    </div>
  );
}
