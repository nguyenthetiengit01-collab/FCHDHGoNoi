"use client";

import React, { useId } from "react";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className = "",
  children,
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-bold uppercase tracking-wider text-slate-600"
      >
        {label}
        {required && (
          <span className="ml-1 text-rose-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-semibold text-rose-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ hasError, className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={hasError || undefined}
        className={`form-input ${
          hasError ? "!border-rose-500 focus-visible:!outline-rose-500" : ""
        } ${className}`}
        {...rest}
      />
    );
  }
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ hasError, className = "", children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        aria-invalid={hasError || undefined}
        className={`form-select ${
          hasError ? "!border-rose-500 focus-visible:!outline-rose-500" : ""
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
    );
  }
);

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ hasError, className = "", ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={hasError || undefined}
        className={`form-textarea ${
          hasError ? "!border-rose-500 focus-visible:!outline-rose-500" : ""
        } ${className}`}
        {...rest}
      />
    );
  }
);

export function useFieldIds(prefix = "field") {
  const base = useId();
  return {
    inputId: `${prefix}-${base}`,
    hintId: `${prefix}-hint-${base}`,
    errorId: `${prefix}-err-${base}`,
  };
}

