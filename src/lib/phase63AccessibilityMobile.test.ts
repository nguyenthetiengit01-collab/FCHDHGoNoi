import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import {
  acquireBodyScrollLock,
  capturePreviousFocus,
  handleDialogKeyDownEvent,
  releaseBodyScrollLock,
  resetBodyScrollLockForTest,
  restoreDialogFocus,
} from "@/components/useDialogA11y";

const ROOT = process.cwd();
const require = createRequire(import.meta.url);

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function loadTsxModule<T = Record<string, unknown>>(relPath: string): T {
  const fullPath = path.join(ROOT, relPath);
  const source = fs.readFileSync(fullPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });

  const mod: { exports: unknown } = { exports: {} };
  const localRequire = (specifier: string) => {
    if (specifier.startsWith("@/")) {
      const resolved = path.join(ROOT, "src", specifier.slice(2));
      if (fs.existsSync(resolved + ".tsx")) {
        return loadTsxModule(path.relative(ROOT, resolved + ".tsx"));
      }
      if (fs.existsSync(resolved + ".ts")) {
        return loadTsxModule(path.relative(ROOT, resolved + ".ts"));
      }
      return require(resolved);
    }
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const dir = path.dirname(fullPath);
      const resolved = path.resolve(dir, specifier);
      if (fs.existsSync(resolved + ".tsx")) {
        return loadTsxModule(path.relative(ROOT, resolved + ".tsx"));
      }
      if (fs.existsSync(resolved + ".ts")) {
        return loadTsxModule(path.relative(ROOT, resolved + ".ts"));
      }
      return require(resolved);
    }
    return require(specifier);
  };

  const fn = new Function("exports", "require", "module", outputText);
  fn(mod.exports, localRequire, mod);
  return mod.exports as T;
}

describe("Phase 6.3 – Accessibility & Mobile UX Remediation", () => {
  describe("1. PublicGuestPortal Mobile Drawer Accessibility", () => {
    const portalSrc = readSrc("src/components/PublicGuestPortal.tsx");

    it("wires useDialogA11y with mobileNavRef, mobileNavCloseRef, role=dialog, aria-modal, and aria-labelledby", () => {
      expect(portalSrc).toContain("useDialogA11y({");
      expect(portalSrc).toContain("isOpen: mobileNavOpen");
      expect(portalSrc).toContain("containerRef: mobileNavRef");
      expect(portalSrc).toContain("initialFocusRef: mobileNavCloseRef");
      expect(portalSrc).toContain('role="dialog"');
      expect(portalSrc).toContain('aria-modal="true"');
      expect(portalSrc).toContain("aria-labelledby={mobileNavTitleId}");
      expect(portalSrc).toContain("id={mobileNavTitleId}");
    });

    it("enforces >=44px touch targets on hamburger trigger and drawer close button with aria-expanded and aria-controls", () => {
      expect(portalSrc).toContain("aria-expanded={mobileNavOpen}");
      expect(portalSrc).toContain("aria-controls={mobileNavDrawerId}");
      expect(portalSrc).toMatch(/aria-controls=\{mobileNavDrawerId\}[\s\S]*?min-h-11 min-w-11/);
      expect(portalSrc).toContain("ref={mobileNavCloseRef}");
      expect(portalSrc).toContain('aria-label="Đóng menu điều hướng"');
    });
  });

  describe("2. Keyboard, Focus Trap, Restoration & Body Scroll Lock (useDialogA11y)", () => {
    it("closes on Escape, wraps Tab/Shift+Tab, restores focus to trigger, and releases body scroll lock", () => {
      const onClose = vi.fn();
      const preventDefault = vi.fn();

      handleDialogKeyDownEvent(
        { key: "Escape", shiftKey: false, preventDefault },
        null,
        onClose
      );
      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);

      const first = {
        focus: vi.fn(),
        hasAttribute: () => false,
        getAttribute: () => null,
      } as unknown as HTMLElement;
      const last = {
        focus: vi.fn(),
        hasAttribute: () => false,
        getAttribute: () => null,
      } as unknown as HTMLElement;
      const container = {
        querySelectorAll: () => [first, last],
        contains: (el: HTMLElement | null) => el === first || el === last,
        focus: vi.fn(),
      } as unknown as HTMLElement;

      const tabPrevent = vi.fn();
      handleDialogKeyDownEvent(
        { key: "Tab", shiftKey: false, preventDefault: tabPrevent },
        container,
        () => {},
        { activeElement: last }
      );
      expect(first.focus).toHaveBeenCalledTimes(1);

      const shiftTabPrevent = vi.fn();
      handleDialogKeyDownEvent(
        { key: "Tab", shiftKey: true, preventDefault: shiftTabPrevent },
        container,
        () => {},
        { activeElement: first }
      );
      expect(last.focus).toHaveBeenCalledTimes(1);

      const trigger = {
        isConnected: true,
        focus: vi.fn(),
      } as unknown as HTMLElement;
      const captured = capturePreviousFocus(null, trigger, container);
      restoreDialogFocus(captured);
      expect(trigger.focus).toHaveBeenCalledTimes(1);

      const fakeDoc = {
        body: { style: { overflow: "" } },
      } as unknown as Document;
      vi.stubGlobal("document", fakeDoc);
      try {
        resetBodyScrollLockForTest();
        acquireBodyScrollLock();
        expect(fakeDoc.body.style.overflow).toBe("hidden");
        releaseBodyScrollLock();
        expect(fakeDoc.body.style.overflow).toBe("");
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe("3. Player Not-Found Landmarks", () => {
    it("src/app/cau-thu/[id]/page.tsx not-found fallback includes skip-link, main#main-content, and h1", () => {
      const src = readSrc("src/app/cau-thu/[id]/page.tsx");
      const notFoundIdx = src.indexOf("if (!player)");
      expect(notFoundIdx).toBeGreaterThan(-1);
      const branch = src.slice(notFoundIdx, src.indexOf("const safePlayer"));
      expect(branch).toContain('className="skip-link"');
      expect(branch).toContain('href="#main-content"');
      expect(branch).toContain('id="main-content"');
      expect(branch).toContain("<main");
      expect(branch).toContain("<h1");
      expect(branch).toContain("Không Tìm Thấy Hồ Sơ Cầu Thủ");
      expect(branch).toContain('href="/"');
    });
  });

  describe("4. Mobile Touch Targets (>=44px on mobile)", () => {
    it("Button size='sm' renders min-h-11 sm:min-h-9", () => {
      const ButtonMod = loadTsxModule<{
        Button: React.ComponentType<{
          size?: "sm" | "md" | "lg";
          children?: React.ReactNode;
        }>;
      }>("src/components/ui/Button.tsx");
      const html = renderToStaticMarkup(
        React.createElement(ButtonMod.Button, { size: "sm" }, "Lưu")
      );
      expect(html).toContain("min-h-11 sm:min-h-9");
    });

    it("ScheduleTab & PlayerPersonalTab gallery actions use >=44px mobile targets, touch visibility, and aria-labels", () => {
      for (const file of [
        "src/components/ScheduleTab.tsx",
        "src/components/PlayerPersonalTab.tsx",
      ]) {
        const src = readSrc(file);
        expect(src).not.toContain("h-7 w-7");
        expect(src).toContain("opacity-100 sm:opacity-0 sm:group-hover:opacity-100");
        expect(src).toContain("min-h-11 min-w-11");
        expect(src).toContain("aria-label={`Đặt ảnh #${idx + 1} làm ảnh Profile rộng`}");
        expect(src).toContain("aria-label={`Cắt ảnh #${idx + 1} làm ảnh Profile rộng`}");
        expect(src).toContain("aria-label={`Xoá ảnh #${idx + 1} khỏi Album`}");
      }
    });

    it("PlayersTab, FinanceTab, and CollectionTab upgrade mobile interactive controls to >=44px", () => {
      const playersSrc = readSrc("src/components/PlayersTab.tsx");
      expect(playersSrc).not.toContain("h-7 w-7");
      expect(playersSrc).toContain("min-h-11 sm:min-h-9");
      expect(playersSrc).toContain("min-h-11 sm:min-h-8");
      expect(playersSrc).toContain("min-h-11 min-w-11 sm:min-h-8 sm:min-w-8");
      // 4. PlayersTab search clear target
      expect(playersSrc).toMatch(
        /aria-label="Xoá từ khoá tìm kiếm"[\s\S]*?min-h-11 min-w-11/
      );
      // 5. PlayersTab activity gallery crop visible on touch + dynamic aria-label
      expect(playersSrc).toMatch(
        /aria-label=\{`Canh chỉnh & cắt ảnh hoạt động #\$\{idx \+ 1\}`\}[\s\S]*?min-h-11 min-w-11[\s\S]*?opacity-100 sm:opacity-0 sm:group-hover:opacity-100/
      );

      const financeSrc = readSrc("src/components/FinanceTab.tsx");
      expect(financeSrc).toContain("min-h-11 min-w-11 sm:min-h-9 sm:min-w-9");
      expect(financeSrc).toContain("min-h-11 sm:min-h-9");
      // 1. Finance mobile expense edit/delete >=44x44
      expect(financeSrc).toMatch(
        /aria-label=\{`Sửa khoản chi \$\{exp\.description\}`\}[\s\S]*?min-h-11 min-w-11 sm:min-h-9 sm:min-w-9/
      );
      expect(financeSrc).toMatch(
        /aria-label=\{`Xoá khoản chi \$\{exp\.description\}`\}[\s\S]*?min-h-11 min-w-11 sm:min-h-9 sm:min-w-9/
      );
      // 2. Finance mobile income edit/delete >=44x44
      expect(financeSrc).toMatch(
        /aria-label=\{`Sửa khoản thu \$\{inc\.contributor\}`\}[\s\S]*?min-h-11 min-w-11 sm:min-h-9 sm:min-w-9/
      );
      expect(financeSrc).toMatch(
        /aria-label=\{`Xoá khoản thu \$\{inc\.contributor\}`\}[\s\S]*?min-h-11 min-w-11 sm:min-h-9 sm:min-w-9/
      );
      // 3. Finance category selector interactive target >=44px on mobile
      expect(financeSrc).toMatch(
        /setFilterCategory\(item\.category\)[\s\S]*?min-h-11 sm:min-h-0/
      );

      const collectionSrc = readSrc("src/components/CollectionTab.tsx");
      expect(collectionSrc).toContain("min-h-11 sm:min-h-9");
      expect(collectionSrc).not.toMatch(/className="[^"]*(?<!sm:)\bmin-h-9\b/);
    });

    it("PublicGuestPortal header login, ModalDialog close, and TeamManagerApp security banner targets meet >=44px on mobile", () => {
      // 6. PublicGuestPortal header login min-h-11
      const portalSrc = readSrc("src/components/PublicGuestPortal.tsx");
      expect(portalSrc).toMatch(
        /onClick=\{onOpenLogin\}[\s\S]*?inline-flex min-h-11 items-center[\s\S]*?Đăng nhập/
      );

      // 7. ModalDialog close button min-h-11 min-w-11
      const modalSrc = readSrc("src/components/ModalDialog.tsx");
      expect(modalSrc).toMatch(
        /aria-label="Đóng hộp thoại"[\s\S]*?min-h-11 min-w-11/
      );

      // 8. TeamManagerApp security banner targets
      const appSrc = readSrc("src/components/TeamManagerApp.tsx");
      expect(appSrc).toMatch(
        /onClick=\{\(\) => setActiveTab\("personal"\)\}[\s\S]*?min-h-11 sm:min-h-9[\s\S]*?Đổi mật khẩu ngay/
      );
      expect(appSrc).toMatch(
        /aria-label="Đóng cảnh báo bảo mật"[\s\S]*?min-h-11 min-w-11 sm:min-h-9 sm:min-w-9/
      );
    });
  });

  describe("5. Persistent Excel Import Error Summary", () => {
    it("TeamManagerApp handles string error, safe fallback, success clearing, and renders ModalDialog", () => {
      const appSrc = readSrc("src/components/TeamManagerApp.tsx");
      expect(appSrc).toContain("importErrorMessage");
      expect(appSrc).toContain("setImportErrorMessage");
      expect(appSrc).toContain("importErrorModalOpen");
      expect(appSrc).toContain('typeof (json as { error?: unknown }).error === "string"');
      expect(appSrc).toContain(
        '"Không thể nhập file Excel. Vui lòng kiểm tra cấu trúc và dữ liệu hợp lệ."'
      );
      expect(appSrc).toContain(
        '"Lỗi kết nối khi tải file Excel lên máy chủ. Vui lòng thử lại."'
      );
      expect(appSrc).toContain("setImportErrorMessage(null);");
      expect(appSrc).toContain('title="Không thể nhập file Excel"');
      expect(appSrc).toContain("<ModalDialog");
    });
  });
});
