"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("inert") && el.getAttribute("aria-hidden") !== "true"
  );
}

export function restoreDialogFocus(previousEl: HTMLElement | null) {
  if (previousEl && previousEl.isConnected && typeof previousEl.focus === "function") {
    previousEl.focus();
  }
}

export function handleDialogKeyDownEvent(
  e: Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault">,
  container: HTMLElement | null,
  onClose: () => void,
  options?: { handleEscape?: boolean; activeElement?: HTMLElement | null }
) {
  const handleEscape = options?.handleEscape ?? true;
  if (handleEscape && e.key === "Escape") {
    e.preventDefault();
    onClose();
    return;
  }

  if (e.key !== "Tab" || !container) return;

  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    e.preventDefault();
    container.focus();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active =
    options?.activeElement !== undefined
      ? options.activeElement
      : (document.activeElement as HTMLElement | null);

  if (e.shiftKey) {
    if (!active || active === first || !container.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (!active || active === last || !container.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  }
}

interface UseDialogA11yOptions {
  isOpen: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Set true if the container itself handles backdrop click or Escape via native <dialog> */
  handleEscape?: boolean;
}

/**
 * Provides consistent WCAG 2.2 AA dialog accessibility across native <dialog>
 * and custom drawer overlays: focus initialization, Tab focus trap, Escape close,
 * body scroll locking, and focus restoration to the triggering element on close.
 */
export function useDialogA11y({
  isOpen,
  onClose,
  containerRef,
  initialFocusRef,
  handleEscape = true,
}: UseDialogA11yOptions) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const prevFocus = previousFocusRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const container = containerRef.current;
    if (container && "showModal" in container && typeof (container as HTMLDialogElement).showModal === "function") {
      const dialog = container as HTMLDialogElement;
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          // Ignore if already open or JSDOM throws
        }
      }
    }

    const focusTimer = window.setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;

      if (initialFocusRef?.current && el.contains(initialFocusRef.current)) {
        initialFocusRef.current.focus();
        return;
      }

      const focusables = getFocusableElements(el);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        if (!el.hasAttribute("tabindex")) {
          el.setAttribute("tabindex", "-1");
        }
        el.focus();
      }
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      handleDialogKeyDownEvent(e, containerRef.current, () => onCloseRef.current(), {
        handleEscape,
      });
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;

      if (
        container &&
        "close" in container &&
        typeof (container as HTMLDialogElement).close === "function"
      ) {
        const dialog = container as HTMLDialogElement;
        if (dialog.open) {
          try {
            dialog.close();
          } catch {
            // Ignore in non-browser environments
          }
        }
      }

      restoreDialogFocus(prevFocus);
    };
  }, [isOpen, containerRef, initialFocusRef, handleEscape]);
}
