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

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ hasError, className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={hasError || undefined}
        className={`form-input focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-on-light ${
          hasError ? "!border-rose-500 focus-visible:!outline-rose-500" : ""
        } ${className}`}
        {...rest}
      />
    );
  }
);
Input.displayName = "Input";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ hasError, className = "", children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        aria-invalid={hasError || undefined}
        className={`form-select focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-on-light ${
          hasError ? "!border-rose-500 focus-visible:!outline-rose-500" : ""
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";

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
        className={`form-textarea focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-on-light ${
          hasError ? "!border-rose-500 focus-visible:!outline-rose-500" : ""
        } ${className}`}
        {...rest}
      />
    );
  }
);
Textarea.displayName = "Textarea";

function isUiFormControl(type: unknown): boolean {
  return type === Input || type === Select || type === Textarea;
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
  const autoId = useId();
  const fallbackInputId = `field-${autoId}`;
  const hintId = `field-hint-${autoId}`;
  const errorId = `field-err-${autoId}`;

  const isSingleElement = React.isValidElement(children);
  const childProps = isSingleElement
    ? (children.props as Record<string, unknown>)
    : null;

  const existingId =
    childProps && typeof childProps.id === "string" ? childProps.id : undefined;
  const resolvedInputId = htmlFor || existingId || fallbackInputId;

  const describedByTokens: string[] = [];
  if (childProps && typeof childProps["aria-describedby"] === "string") {
    for (const token of childProps["aria-describedby"].split(/\s+/)) {
      if (token) describedByTokens.push(token);
    }
  }
  if (error) {
    if (!describedByTokens.includes(errorId)) describedByTokens.push(errorId);
  } else if (hint) {
    if (!describedByTokens.includes(hintId)) describedByTokens.push(hintId);
  }

  let enhancedChild = children;
  if (isSingleElement && childProps) {
    const injectedProps: Record<string, unknown> = {};
    if (!existingId) {
      injectedProps.id = resolvedInputId;
    }
    if (describedByTokens.length > 0) {
      injectedProps["aria-describedby"] = describedByTokens.join(" ");
    }
    if (error && childProps["aria-invalid"] === undefined) {
      injectedProps["aria-invalid"] = true;
    }
    if (error && isUiFormControl(children.type) && childProps.hasError === undefined) {
      injectedProps.hasError = true;
    }
    if (Object.keys(injectedProps).length > 0) {
      enhancedChild = React.cloneElement(
        children as React.ReactElement<Record<string, unknown>>,
        injectedProps
      );
    }
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={resolvedInputId}
        className="block text-xs font-bold uppercase tracking-wider text-slate-600"
      >
        {label}
        {required && (
          <span className="ml-1 text-rose-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {enhancedChild}
      {error ? (
        <p id={errorId} className="text-xs font-semibold text-rose-600" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-xs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function useFieldIds(prefix = "field") {
  const base = useId();
  return {
    inputId: `${prefix}-${base}`,
    hintId: `${prefix}-hint-${base}`,
    errorId: `${prefix}-err-${base}`,
  };
}
