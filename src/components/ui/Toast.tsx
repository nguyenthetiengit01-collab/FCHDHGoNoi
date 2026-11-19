"use client";

import React from "react";
import { X } from "lucide-react";

export type ToastVariant = "success" | "error";

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onClose: () => void;
  className?: string;
}

export function Toast({
  message,
  variant = "success",
  onClose,
  className = "",
}: ToastProps) {
  const isError = variant === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      className={`fixed bottom-20 md:bottom-6 right-4 z-50 rounded-xl px-4 py-2.5 text-sm font-bold shadow-lg border flex items-center gap-2.5 max-w-md ${
        isError
          ? "bg-rose-950 text-rose-50 border-rose-400"
          : "bg-navy-800 text-white border-gold-500"
      } ${className}`}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
          isError ? "bg-rose-400" : "bg-gold-500"
        }`}
        aria-hidden="true"
      />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng thông báo"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-on-dark shrink-0"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
