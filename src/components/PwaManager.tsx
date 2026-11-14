"use client";

import React, { useEffect, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_DISMISSED_KEY = "fc_gonoi_pwa_install_dismissed";

export function PwaManager() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null
  );
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

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
        <div className="pointer-events-auto rounded-xl bg-[#081a33] border border-[#d4af37]/70 p-4 shadow-2xl text-slate-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#fde047]">
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#fde047] text-[#040e1a] text-xs font-extrabold uppercase tracking-wider transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Cập nhật
            </button>
            <button
              type="button"
              aria-label="Đóng thông báo cập nhật"
              onClick={() => setShowUpdateBanner(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showInstallBanner && (
        <div className="pointer-events-auto rounded-xl bg-[#081a33] border border-white/15 p-3.5 shadow-2xl text-slate-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">
              Cài đặt ứng dụng FC Gò Nổi
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              Mở nhanh lịch đấu &amp; quỹ đội ngay từ màn hình chính
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b2447] hover:bg-[#11315f] border border-[#d4af37]/50 text-[#fde047] text-xs font-bold transition"
            >
              <Download className="h-3.5 w-3.5" />
              Cài đặt
            </button>
            <button
              type="button"
              aria-label="Đóng gợi ý cài đặt"
              onClick={handleDismissInstall}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
