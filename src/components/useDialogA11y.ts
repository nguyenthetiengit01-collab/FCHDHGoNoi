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

let activeScrollLockCount = 0;
let savedBodyOverflow = "";

export function acquireBodyScrollLock() {
  if (typeof document === "undefined") return;
  if (activeScrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  activeScrollLockCount += 1;
}

export function releaseBodyScrollLock() {
  if (typeof document === "undefined") return;
  if (activeScrollLockCount <= 0) {
    activeScrollLockCount = 0;
    return;
  }
  activeScrollLockCount -= 1;
  if (activeScrollLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
    savedBodyOverflow = "";
  }
}

export function resetBodyScrollLockForTest() {
  activeScrollLockCount = 0;
  savedBodyOverflow = "";
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("inert") && el.getAttribute("aria-hidden") !== "true"
  );
}

export function capturePreviousFocus(
  existing: HTMLElement | null,
  activeEl: HTMLElement | null,
  container: HTMLElement | null
): HTMLElement | null {
  if (existing && existing.isConnected) {
    return existing;
  }
  if (!activeEl) return null;
  if (container && container.contains(activeEl)) {
    return existing;
  }
  return activeEl;
}

export function restoreDialogFocus(previousEl: HTMLElement | null) {
  if (previousEl && previousEl.isConnected && typeof previousEl.focus === "function") {
    previousEl.focus();
  }
}

export function createDialogCloseCoordinator(onClose: () => void) {
  let notified = false;
  let suppressNativeClose = false;

  return {
    notifyOnce() {
      if (notified) return;
      notified = true;
      onClose();
    },
    handleNativeClose(dialog?: { returnValue?: string } | null) {
      if (suppressNativeClose) {
        suppressNativeClose = false;
        return;
      }
      if (dialog) {
        dialog.returnValue = "";
      }
      if (notified) return;
      notified = true;
      onClose();
    },
    runProgrammaticClose(closeFn: () => void) {
      suppressNativeClose = true;
      try {
        closeFn();
      } finally {
        suppressNativeClose = false;
      }
    },
  };
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
  handleEscape?: boolean;
}

/**
 * Provides consistent WCAG 2.2 AA dialog accessibility across native <dialog>
 * and custom drawer overlays: focus capture/restoration, Tab focus trap,
 * Escape/native-close deduplication, Strict-Mode-safe body scroll locking,
 * and native showModal()/close() lifecycle management.
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
    if (!isOpen) {
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    previousFocusRef.current = capturePreviousFocus(
      previousFocusRef.current,
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null,
      container
    );

    acquireBodyScrollLock();

    const coordinator = createDialogCloseCoordinator(() => {
      onCloseRef.current();
    });

    const isNativeDialog =
      Boolean(container) &&
      typeof HTMLDialogElement !== "undefined" &&
      container instanceof HTMLDialogElement;

    if (
      container &&
      "showModal" in container &&
      typeof (container as HTMLDialogElement).showModal === "function"
    ) {
      const dialog = container as HTMLDialogElement;
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          // Ignore if already open or non-standard environment throws
        }
      }
    }

    const handleNativeClose = () => {
      coordinator.handleNativeClose(
        isNativeDialog ? (container as HTMLDialogElement) : null
      );
    };

    const handleNativeCancel = (e: Event) => {
      if (handleEscape) {
        e.preventDefault();
        coordinator.notifyOnce();
      }
    };

    if (container) {
      container.addEventListener("close", handleNativeClose);
      container.addEventListener("cancel", handleNativeCancel);
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
      handleDialogKeyDownEvent(
        e,
        containerRef.current,
        () => coordinator.notifyOnce(),
        { handleEscape }
      );
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      if (container) {
        container.removeEventListener("close", handleNativeClose);
        container.removeEventListener("cancel", handleNativeCancel);
      }
      releaseBodyScrollLock();

      if (
        container &&
        "close" in container &&
        typeof (container as HTMLDialogElement).close === "function"
      ) {
        const dialog = container as HTMLDialogElement;
        if (dialog.open) {
          coordinator.runProgrammaticClose(() => {
            try {
              dialog.close();
            } catch {
              // Ignore in non-browser environments
            }
          });
        }
      }

      restoreDialogFocus(previousFocusRef.current);
    };
  }, [isOpen, containerRef, initialFocusRef, handleEscape]);
}
