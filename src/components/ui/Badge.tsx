"use client";

import React from "react";

export type BadgeVariant =
  | "neutral"
  | "navy"
  | "gold"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  surface?: "light" | "dark";
}

const BADGE_CLASSES_LIGHT: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  navy: "bg-[#0d2e5b]/10 text-[#0d2e5b] border-[#0d2e5b]/20",
  gold: "bg-amber-50 text-[#8a6d14] border-amber-300/70",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
};

const BADGE_CLASSES_DARK: Record<BadgeVariant, string> = {
  neutral: "bg-white/10 text-slate-200 border-white/15",
  navy: "bg-[#0d2e5b] text-sky-100 border-sky-400/30",
  gold: "bg-[#d4af37]/20 text-[#fde047] border-[#d4af37]/40",
  success: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
  warning: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  danger: "bg-rose-500/20 text-rose-300 border-rose-400/30",
  info: "bg-sky-500/20 text-sky-300 border-sky-400/30",
  purple: "bg-purple-500/20 text-purple-300 border-purple-400/30",
};

export function Badge({
  variant = "neutral",
  size = "sm",
  surface = "light",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  const sizeClass =
    size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  const palette = surface === "dark" ? BADGE_CLASSES_DARK : BADGE_CLASSES_LIGHT;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-bold tracking-wide leading-none whitespace-nowrap ${palette[variant]} ${sizeClass} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

/**
 * Technical position badge following AGENTS.md color standards:
 * GK: Emerald | DF: Blue | MF: Amber | FW: Rose | ĐN: Purple
 */
export function PositionBadge({
  position,
  surface = "light",
  className = "",
}: {
  position?: string;
  surface?: "light" | "dark";
  className?: string;
}) {
  const norm = (position || "").trim().toUpperCase();
  let variant: BadgeVariant = "neutral";
  if (norm === "GK" || norm.includes("THỦ MÔN")) variant = "success";
  else if (norm === "DF" || norm.includes("HẬU VỆ")) variant = "info";
  else if (norm === "MF" || norm.includes("TIỀN VỆ")) variant = "warning";
  else if (norm === "FW" || norm.includes("TIỀN ĐẠO")) variant = "danger";
  else if (norm === "ĐN" || norm === "DN" || norm.includes("ĐA NĂNG"))
    variant = "purple";

  return (
    <Badge variant={variant} surface={surface} className={className}>
      {position || "—"}
    </Badge>
  );
}

