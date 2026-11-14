"use client";

import React from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { ModalDialog } from "@/components/ModalDialog";
import { Button } from "./Button";

export function LoadingState({
  label = "Đang tải dữ liệu...",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-12 text-center ${className}`}
    >
      <Loader2
        className="h-7 w-7 animate-spin text-[#0d2e5b]"
        aria-hidden="true"
      />
      <p className="text-sm font-semibold text-slate-600">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center ${className}`}
    >
      <div
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200/70 text-slate-500"
        aria-hidden="true"
      >
        {icon || <Inbox className="h-5 w-5" />}
      </div>
      <h4 className="text-sm sm:text-base font-bold text-[#092244]">{title}</h4>
      {description && (
        <p className="max-w-md text-xs sm:text-sm text-slate-600 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Không thể tải dữ liệu",
  description,
  onRetry,
  className = "",
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 px-6 py-10 text-center ${className}`}
    >
      <div
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600"
        aria-hidden="true"
      >
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h4 className="text-sm sm:text-base font-bold text-rose-900">{title}</h4>
      {description && (
        <p className="max-w-md text-xs sm:text-sm text-rose-700">
          {description}
        </p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          Thử lại
        </Button>
      )}
    </div>
  );
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  danger = false,
  loading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <ModalDialog isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700 leading-relaxed">{description}</p>
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}

