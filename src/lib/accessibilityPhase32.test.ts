import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  getFocusableElements,
  handleDialogKeyDownEvent,
  restoreDialogFocus,
} from "@/components/useDialogA11y";

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("Phase 3.2 – Accessibility & Blocking Dialog Remediation", () => {
  describe("UX-01 & UX-07: ModalDialog, LoginModal, ImageLightboxModal, Mobile Menu & Focus Ring", () => {
    it("ModalDialog uses native <dialog>, useDialogA11y, aria-labelledby, and gold focus ring", () => {
      const src = readSrc("src/components/ModalDialog.tsx");
      expect(src).toContain("<dialog");
      expect(src).toContain("useDialogA11y");
      expect(src).toContain("aria-labelledby={titleId}");
      expect(src).toContain('aria-label="Đóng hộp thoại"');
      expect(src).toContain("focus-visible:outline-[#d4af37]");
      expect(src).not.toContain("outline-emerald-600");
    });

    it("LoginModal uses native <dialog>, useDialogA11y, aria-modal, aria-labelledby, and gold focus ring", () => {
      const src = readSrc("src/components/LoginModal.tsx");
      expect(src).toContain("<dialog");
      expect(src).toContain("useDialogA11y");
      expect(src).toContain('aria-modal="true"');
      expect(src).toContain('aria-labelledby="login-modal-title"');
      expect(src).toContain('aria-label="Đóng cửa sổ đăng nhập"');
      expect(src).toContain("focus-visible:outline-[#d4af37]");
    });

    it("ImageLightboxModal avoids nested role=dialog and provides accessible labels + gold focus rings", () => {
      const src = readSrc("src/components/ImageLightboxModal.tsx");
      expect(src).toContain("<dialog");
      expect(src).toContain("useDialogA11y");
      expect(src).toContain('aria-label="Xem ảnh phóng to"');
      expect(src).not.toContain('role="dialog"');
      expect(src).toContain('aria-label="Đóng xem ảnh"');
      expect(src).toContain('aria-label="Mở hoặc tải ảnh gốc"');
      expect(src).toContain('aria-label="Ảnh trước"');
      expect(src).toContain('aria-label="Ảnh tiếp theo"');
      expect(src).toContain("focus-visible:outline-[#d4af37]");
    });

    it("Mobile More Menu in TeamManagerApp uses useDialogA11y with drawerCloseBtnRef", () => {
      const src = readSrc("src/components/TeamManagerApp.tsx");
      expect(src).toContain("useDialogA11y({");
      expect(src).toContain("containerRef: mobileDrawerRef");
      expect(src).toContain("initialFocusRef: drawerCloseBtnRef");
      expect(src).toContain('aria-label="Tất cả chức năng ứng dụng"');
    });

    it("Keyboard navigation: Escape closes modal and prevents default", () => {
      const onClose = vi.fn();
      const preventDefault = vi.fn();

      handleDialogKeyDownEvent(
        { key: "Escape", shiftKey: false, preventDefault },
        null,
        onClose
      );

      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("Focus trap: filters inert/aria-hidden elements and wraps Tab & Shift+Tab inside dialog", () => {
      const makeBtn = (hidden = false) =>
        ({
          focus: vi.fn(),
          hasAttribute: () => false,
          getAttribute: (attr: string) =>
            attr === "aria-hidden" && hidden ? "true" : null,
        }) as unknown as HTMLElement;

      const firstBtn = makeBtn();
      const hiddenBtn = makeBtn(true);
      const secondBtn = makeBtn();

      const mockContainer = {
        querySelectorAll: () => [firstBtn, hiddenBtn, secondBtn],
        contains: (el: HTMLElement | null) =>
          el === firstBtn || el === secondBtn,
        focus: vi.fn(),
      } as unknown as HTMLElement;

      expect(getFocusableElements(mockContainer)).toEqual([firstBtn, secondBtn]);

      const preventTab = vi.fn();
      handleDialogKeyDownEvent(
        { key: "Tab", shiftKey: false, preventDefault: preventTab },
        mockContainer,
        () => {},
        { activeElement: secondBtn }
      );
      expect(preventTab).toHaveBeenCalledTimes(1);
      expect(firstBtn.focus).toHaveBeenCalledTimes(1);

      const preventShiftTab = vi.fn();
      handleDialogKeyDownEvent(
        { key: "Tab", shiftKey: true, preventDefault: preventShiftTab },
        mockContainer,
        () => {},
        { activeElement: firstBtn }
      );
      expect(preventShiftTab).toHaveBeenCalledTimes(1);
      expect(secondBtn.focus).toHaveBeenCalledTimes(1);
    });

    it("Focus trap falls back to container focus when no focusable children exist", () => {
      const mockContainer = {
        querySelectorAll: () => [],
        contains: () => false,
        focus: vi.fn(),
      } as unknown as HTMLElement;

      const preventDefault = vi.fn();
      handleDialogKeyDownEvent(
        { key: "Tab", shiftKey: false, preventDefault },
        mockContainer,
        () => {},
        { activeElement: null }
      );

      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(mockContainer.focus).toHaveBeenCalledTimes(1);
    });

    it("Focus restoration: restores focus only when triggering element is still connected", () => {
      const connectedTrigger = {
        isConnected: true,
        focus: vi.fn(),
      } as unknown as HTMLElement;
      restoreDialogFocus(connectedTrigger);
      expect(connectedTrigger.focus).toHaveBeenCalledTimes(1);

      const disconnectedTrigger = {
        isConnected: false,
        focus: vi.fn(),
      } as unknown as HTMLElement;
      restoreDialogFocus(disconnectedTrigger);
      expect(disconnectedTrigger.focus).not.toHaveBeenCalled();
    });
  });

  describe("UX-02: ConfirmDialog, Error Feedback, and Zero Blocking Browser Popups", () => {
    it("Removes all window.confirm and blocking alert() calls from UI components", () => {
      const checkedFiles = [
        "src/components/TeamManagerApp.tsx",
        "src/components/ClubPostsTab.tsx",
        "src/components/ScheduleTab.tsx",
        "src/components/SponsorsTab.tsx",
      ];

      for (const file of checkedFiles) {
        const content = readSrc(file);
        expect(content, `${file} should not call window.confirm`).not.toMatch(
          /\bwindow\.confirm\s*\(/
        );
        expect(content, `${file} should not call window.alert`).not.toMatch(
          /\bwindow\.alert\s*\(/
        );
        expect(content, `${file} should not call alert()`).not.toMatch(
          /(?<![.\w])alert\s*\(/
        );
      }

      expect(readSrc("src/components/ClubPostsTab.tsx")).toContain("<ConfirmDialog");
      expect(readSrc("src/components/ScheduleTab.tsx")).toContain("<ConfirmDialog");
      expect(readSrc("src/components/SponsorsTab.tsx")).toContain("<ConfirmDialog");
      expect(readSrc("src/components/SponsorsTab.tsx")).toContain('role="alert"');
      expect(readSrc("src/components/TeamManagerApp.tsx")).toContain(
        'aria-live={toastMessage.variant === "error" ? "assertive" : "polite"}'
      );
    });
  });

  describe("UX-03: Skip-link & #main-content Landmark on Standalone Routes", () => {
    it("All standalone pages and main portal include skip-link and #main-content landmark", () => {
      const routes = [
        "src/app/bao-cao-tai-chinh/page.tsx",
        "src/app/cau-chuyen-go-noi/page.tsx",
        "src/app/hoat-dong/page.tsx",
        "src/app/hoat-dong/[id]/page.tsx",
        "src/app/nha-tai-tro/page.tsx",
        "src/app/offline/page.tsx",
        "src/components/PlayerProfileClient.tsx",
        "src/components/TeamManagerApp.tsx",
      ];

      for (const file of routes) {
        const content = readSrc(file);
        expect(content, `${file} must have skip-link`).toContain('href="#main-content"');
        expect(content, `${file} must have className="skip-link"`).toContain("skip-link");
        expect(content, `${file} must have <main id="main-content"`).toContain(
          '<main id="main-content"'
        );
      }
    });
  });
});
