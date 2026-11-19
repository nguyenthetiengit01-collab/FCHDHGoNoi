"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, RefreshCw, X } from "lucide-react";
import { trackProductEvent } from "@/lib/analytics/clientTracker";

function normalizeRouteGroup(pathname: string): string {
  if (pathname === "/" || pathname === "") return "/";
  if (pathname.startsWith("/hoat-dong/")) return "/hoat-dong/[id]";
  if (pathname === "/hoat-dong") return "/hoat-dong";
  if (pathname.startsWith("/cau-thu/")) return "/cau-thu/[id]";
  if (pathname === "/bao-cao-tai-chinh") return "/bao-cao-tai-chinh";
  if (pathname === "/nha-tai-tro") return "/nha-tai-tro";
  if (pathname === "/cau-chuyen-go-noi") return "/cau-chuyen-go-noi";
  if (pathname === "/offline") return "/offline";
  return "/";
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_DISMISSED_KEY = "fc_gonoi_pwa_install_dismissed";

export function PwaManager() {
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null
  );
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  useEffect(() => {
    const routeKey = normalizeRouteGroup(pathname || "/");
    trackProductEvent({ eventName: "page_view", routeKey });
    if (pathname?.startsWith("/cau-thu/")) {
      const id = Number(pathname.split("/")[2]);
      if (Number.isInteger(id) && id > 0) {
        trackProductEvent({
          eventName: "player_profile_view",
          routeKey,
          contentType: "player_profile",
          contentId: id,
        });
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setInstallPrompt(promptEvent);
      try {
        if (!sessionStorage.getItem(INSTALL_DISMISSED_KEY)) {
          setShowInstallBanner(true);
        }
      } catch {
        setShowInstallBanner(true);
      }
    };

    const handleAppInstalled = () => {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        handleControllerChange
      );

      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setShowUpdateBanner(true);
          }

          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                setWaitingWorker(installing);
                setShowUpdateBanner(true);
              }
            });
          });
        })
        .catch(() => {
          // Bỏ qua lỗi đăng ký SW trên trình duyệt không hỗ trợ
        });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          handleControllerChange
        );
      }
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setShowInstallBanner(false);
    setInstallPrompt(null);
  };

  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    try {
      sessionStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  };

  const handleApplyUpdate = () => {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    setShowUpdateBanner(false);
  };

  if (!showUpdateBanner && !showInstallBanner) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 space-y-2 pointer-events-none">
      {showUpdateBanner && (
        <div className="pointer-events-auto rounded-xl bg-navy-900 border border-gold-500/70 p-4 shadow-2xl text-slate-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase tracking-wider text-gold-300">
              Có phiên bản mới
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Cập nhật ngay để dùng dữ liệu và giao diện mới nhất.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleApplyUpdate}
              className="inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-300 text-navy-950 text-xs font-extrabold uppercase tracking-wider transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Cập nhật
            </button>
            <button
              type="button"
              aria-label="Đóng thông báo cập nhật"
              onClick={() => setShowUpdateBanner(false)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showInstallBanner && (
        <div className="pointer-events-auto rounded-xl bg-navy-900 border border-white/15 p-3 sm:p-3.5 shadow-2xl text-slate-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">
              Cài đặt ứng dụng FC Gò Nổi
            </div>
            <p className="text-[11px] text-slate-300 truncate">
              Mở nhanh lịch đấu &amp; quỹ đội ngay từ màn hình chính
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-700 hover:bg-navy-600 border border-gold-500/50 text-gold-300 text-xs font-bold transition"
            >
              <Download className="h-3.5 w-3.5" />
              Cài đặt
            </button>
            <button
              type="button"
              aria-label="Đóng gợi ý cài đặt"
              onClick={handleDismissInstall}
              className="inline-flex min-h-11 min-w-11 items-center justify-center p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
