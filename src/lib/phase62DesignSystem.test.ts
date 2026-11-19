import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

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
      if (fs.existsSync(path.join(resolved, "index.ts"))) {
        return loadTsxModule(
          path.relative(ROOT, path.join(resolved, "index.ts"))
        );
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
      if (fs.existsSync(path.join(resolved, "index.ts"))) {
        return loadTsxModule(
          path.relative(ROOT, path.join(resolved, "index.ts"))
        );
      }
      return require(resolved);
    }
    return require(specifier);
  };

  const fn = new Function("exports", "require", "module", outputText);
  fn(mod.exports, localRequire, mod);
  return mod.exports as T;
}

describe("Phase 6.2 – Premium Design System & P0 Dialog Remediation", () => {
  const css = readSrc("src/app/globals.css");

  it("1. globals.css defines navy-975, navy-850, gold-450 tokens and :root semantic aliases", () => {
    expect(css).toContain("--color-navy-975: #030912;");
    expect(css).toContain("--color-navy-850: #071933;");
    expect(css).toContain("--color-gold-450: #e6c466;");
    expect(css).toContain("--brand-navy-deepest: var(--color-navy-975);");
    expect(css).toContain("--brand-navy-dark: var(--color-navy-850);");
    expect(css).toContain("--brand-gold-light: var(--color-gold-450);");
  });

  it("2. dialog:modal and cropper-dialog:modal use 0.75rem border-radius", () => {
    const dialogModalMatch = css.match(/dialog:modal\s*\{[\s\S]*?\}/);
    const cropperModalMatch = css.match(/dialog\.cropper-dialog:modal\s*\{[\s\S]*?\}/);
    expect(dialogModalMatch).toBeTruthy();
    expect(cropperModalMatch).toBeTruthy();
    expect(dialogModalMatch![0]).toContain("border-radius: 0.75rem;");
    expect(cropperModalMatch![0]).toContain("border-radius: 0.75rem;");
  });

  it("3. prefers-reduced-motion suppresses animate-pulse, animate-spin, and animate-fade-in", () => {
    const reducedMotionMatch = css.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/
    );
    expect(reducedMotionMatch).toBeTruthy();
    const block = reducedMotionMatch![1];
    expect(block).toContain(".animate-pulse");
    expect(block).toContain(".animate-spin");
    expect(block).toContain(".animate-fade-in");
    expect(block).toContain("animation: none !important;");
    expect(block).toContain("scroll-behavior: auto !important;");
  });

  it("4-6. Toast primitive renders accessible status/alert semantics and >=44px close button", () => {
    const ToastMod = loadTsxModule<{
      Toast: React.ComponentType<{
        message: string;
        variant?: "success" | "error";
        onClose: () => void;
      }>;
    }>("src/components/ui/Toast.tsx");

    const successHtml = renderToStaticMarkup(
      React.createElement(ToastMod.Toast, {
        message: "Đã lưu thành công",
        variant: "success",
        onClose: () => {},
      })
    );
    expect(successHtml).toContain('role="status"');
    expect(successHtml).toContain('aria-live="polite"');
    expect(successHtml).toContain('aria-atomic="true"');
    expect(successHtml).toContain("min-h-11");
    expect(successHtml).toContain("min-w-11");
    expect(successHtml).toContain('aria-label="Đóng thông báo"');
    expect(successHtml).toContain("bg-navy-800");

    const errorHtml = renderToStaticMarkup(
      React.createElement(ToastMod.Toast, {
        message: "Có lỗi xảy ra",
        variant: "error",
        onClose: () => {},
      })
    );
    expect(errorHtml).toContain('role="alert"');
    expect(errorHtml).toContain('aria-live="assertive"');
    expect(errorHtml).toContain('aria-atomic="true"');
    expect(errorHtml).toContain("bg-rose-950");
  });

  it("7 & 11. TeamManagerApp uses <Toast /> from UI barrel and marks error branches without altering success branches", () => {
    const appSrc = readSrc("src/components/TeamManagerApp.tsx");
    expect(appSrc).toContain("Toast");
    expect(appSrc).toContain("ToastVariant");
    expect(appSrc).toContain("<Toast");
    expect(appSrc).not.toContain('role={toastMessage.variant === "error"');
    expect(appSrc).toContain('showToast(json.error || "Không thể chuyển quyền.", "error")');
    expect(appSrc).toContain('showToast("Lỗi kết nối phiên làm việc máy chủ", "error")');
    expect(appSrc).toMatch(/if\s*\(ok\)\s*\{\s*showToast\(\s*`Đã đăng nhập:/);
  });

  it("8 & 9. MatchdayRosterPoster uses native <dialog> + useDialogA11y while preserving posterRef PNG export", () => {
    const posterSrc = readSrc("src/components/MatchdayRosterPoster.tsx");
    expect(posterSrc).toContain("useDialogA11y");
    expect(posterSrc).toContain("<dialog");
    expect(posterSrc).toContain('aria-modal="true"');
    expect(posterSrc).toContain("aria-labelledby={titleId}");
    expect(posterSrc).toContain("useRef<HTMLDialogElement>(null)");
    expect(posterSrc).toContain("ref={posterRef}");
    expect(posterSrc).toContain("downloadElementAsPng(posterRef.current");
    expect(posterSrc).toContain("pixelRatio: 2.5");
    expect(posterSrc).toContain("quality: 0.98");
    // Hooks must be declared before conditional early return
    const hookIdx = posterSrc.indexOf("useDialogA11y({");
    const returnNullIdx = posterSrc.indexOf("if (!isOpen) return null;");
    expect(hookIdx).toBeGreaterThan(-1);
    expect(returnNullIdx).toBeGreaterThan(hookIdx);
  });

  it("10. src/components/ui/index.ts exports Toast, ToastVariant, and ModalDialog", () => {
    const barrelSrc = readSrc("src/components/ui/index.ts");
    expect(barrelSrc).toContain("export { Toast }");
    expect(barrelSrc).toContain("ToastVariant");
    expect(barrelSrc).toContain("export { ModalDialog }");
  });
});
