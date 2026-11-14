"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "gold"
  | "outline"
  | "ghost"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[#0d2e5b] text-white border border-[#0d2e5b] hover:bg-[#17488c] hover:border-[#17488c] shadow-sm",
  secondary:
    "bg-slate-100 text-slate-900 border border-slate-200 hover:bg-slate-200/80",
  gold:
    "bg-[#d4af37] text-[#092244] border border-[#b89635] hover:bg-[#e0bd48] font-bold shadow-sm",
  outline:
    "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400",
  ghost:
    "bg-transparent text-slate-700 border border-transparent hover:bg-slate-100 hover:text-slate-900",
  danger:
    "bg-rose-600 text-white border border-rose-600 hover:bg-rose-700 shadow-sm",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "min-h-11 px-4 py-2 text-sm rounded-[10px] gap-2",
  lg: "min-h-12 px-5 py-2.5 text-base rounded-[10px] gap-2",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      className = "",
      children,
      type = "button",
      ...rest
    },
    ref
  ) {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={`inline-flex items-center justify-center font-semibold tracking-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4af37] disabled:cursor-not-allowed disabled:opacity-55 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...rest}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

