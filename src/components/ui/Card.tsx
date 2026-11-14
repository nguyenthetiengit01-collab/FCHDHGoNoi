"use client";

import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  tone?: "default" | "navy" | "subtle";
}

const TONE_CLASSES: Record<NonNullable<CardProps["tone"]>, string> = {
  default: "bg-white border border-slate-200/90 text-slate-900 shadow-xs",
  navy: "bg-[#0d2e5b] border border-[#17488c] text-white shadow-sm",
  subtle: "bg-slate-50/90 border border-slate-200 text-slate-900",
};

export function Card({
  padded = true,
  tone = "default",
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-xl ${TONE_CLASSES[tone]} ${padded ? "p-4 sm:p-5" : ""} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200/80 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-base sm:text-lg font-bold tracking-tight text-[#092244] ${className}`}
      {...rest}
    >
      {children}
    </h3>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "navy" | "emerald" | "rose" | "amber" | "gold" | "sky";
  className?: string;
}

const ACCENT_MAP: Record<
  NonNullable<StatCardProps["accent"]>,
  { border: string; iconBg: string; valueText: string }
> = {
  navy: {
    border: "border-l-4 border-l-[#0d2e5b]",
    iconBg: "bg-[#0d2e5b]/10 text-[#0d2e5b]",
    valueText: "text-[#092244]",
  },
  emerald: {
    border: "border-l-4 border-l-emerald-600",
    iconBg: "bg-emerald-50 text-emerald-700",
    valueText: "text-emerald-700",
  },
  rose: {
    border: "border-l-4 border-l-rose-600",
    iconBg: "bg-rose-50 text-rose-700",
    valueText: "text-rose-700",
  },
  amber: {
    border: "border-l-4 border-l-amber-500",
    iconBg: "bg-amber-50 text-amber-700",
    valueText: "text-amber-700",
  },
  gold: {
    border: "border-l-4 border-l-[#d4af37]",
    iconBg: "bg-amber-50 text-[#8a6d14]",
    valueText: "text-[#092244]",
  },
  sky: {
    border: "border-l-4 border-l-sky-600",
    iconBg: "bg-sky-50 text-sky-700",
    valueText: "text-sky-700",
  },
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "navy",
  className = "",
}: StatCardProps) {
  const styles = ACCENT_MAP[accent];
  return (
    <div
      className={`rounded-xl bg-white border border-slate-200/90 p-4 shadow-xs ${styles.border} ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p
            className={`mt-1.5 text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums ${styles.valueText}`}
          >
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-xs text-slate-500 leading-snug">{hint}</p>
          )}
        </div>
        {icon && (
          <div
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles.iconBg}`}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

