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

describe("Phase 3.3 – UI Component Standardization", () => {
  const FormControls = loadTsxModule<{
    FormField: React.ComponentType<Record<string, unknown>>;
    Input: React.ComponentType<Record<string, unknown>>;
    Select: React.ComponentType<Record<string, unknown>>;
    Textarea: React.ComponentType<Record<string, unknown>>;
  }>("src/components/ui/FormControls.tsx");

  const ButtonMod = loadTsxModule<{
    Button: React.ComponentType<Record<string, unknown>>;
  }>("src/components/ui/Button.tsx");

  const BadgeMod = loadTsxModule<{
    Badge: React.ComponentType<Record<string, unknown>>;
    PositionBadge: React.ComponentType<Record<string, unknown>>;
  }>("src/components/ui/Badge.tsx");

  const StateViews = loadTsxModule<{
    LoadingState: React.ComponentType<Record<string, unknown>>;
    EmptyState: React.ComponentType<Record<string, unknown>>;
    ErrorState: React.ComponentType<Record<string, unknown>>;
  }>("src/components/ui/StateViews.tsx");

  describe("FormField & Form Controls (Input, Select, Textarea)", () => {
    it("generates stable unique IDs and wires htmlFor + aria-describedby for hint", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          FormControls.FormField,
          { label: "Tên cầu thủ", hint: "Nhập họ tên đầy đủ", required: true },
          React.createElement(FormControls.Input, { type: "text" })
        )
      );

      const labelMatch = html.match(/for="([^"]+)"/);
      const inputIdMatch = html.match(/<input[^>]*id="([^"]+)"/);
      const hintIdMatch = html.match(/<p id="([^"]+)"[^>]*>Nhập họ tên đầy đủ/);
      const describedByMatch = html.match(/aria-describedby="([^"]+)"/);

      expect(labelMatch).toBeTruthy();
      expect(inputIdMatch).toBeTruthy();
      expect(labelMatch![1]).toBe(inputIdMatch![1]);
      expect(hintIdMatch).toBeTruthy();
      expect(describedByMatch![1]).toBe(hintIdMatch![1]);
      expect(html).toContain("*");
    });

    it("wires aria-invalid=true and error role=alert with matching aria-describedby", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          FormControls.FormField,
          { label: "Đơn vị", error: "Vui lòng nhập tên đơn vị tài trợ." },
          React.createElement(FormControls.Input, { type: "text" })
        )
      );

      const errIdMatch = html.match(/<p id="([^"]+)"[^>]*role="alert"/);
      const describedByMatch = html.match(/aria-describedby="([^"]+)"/);

      expect(errIdMatch).toBeTruthy();
      expect(describedByMatch![1]).toBe(errIdMatch![1]);
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain("!border-rose-500");
    });

    it("preserves explicit htmlFor/id and appends aria-describedby without overwriting", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          FormControls.FormField,
          { label: "Ghi chú", htmlFor: "custom-note", error: "Lỗi nhập liệu" },
          React.createElement(FormControls.Textarea, {
            id: "custom-note",
            "aria-describedby": "external-desc",
          })
        )
      );

      expect(html).toContain('for="custom-note"');
      expect(html).toContain('id="custom-note"');
      expect(html).toMatch(/aria-describedby="external-desc [^"]+"/);
      expect(html).toContain('aria-invalid="true"');
    });

    it("renders Select with focus-visible gold outline and error border", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          FormControls.FormField,
          { label: "Hạng", error: "Bắt buộc chọn" },
          React.createElement(
            FormControls.Select,
            null,
            React.createElement("option", { value: "gold" }, "Vàng")
          )
        )
      );

      expect(html).toContain("<select");
      expect(html).toContain("focus-visible:outline-focus-on-light");
      expect(html).toContain('aria-invalid="true"');
    });
  });

  describe("Button, Badge & StateViews", () => {
    it("Button enforces type=button default, aria-busy when loading, disabled state, and gold focus ring", () => {
      const normalHtml = renderToStaticMarkup(
        React.createElement(
          ButtonMod.Button,
          { variant: "primary", leftIcon: React.createElement("span", null, "+") },
          "Thêm mới"
        )
      );
      expect(normalHtml).toContain('type="button"');
      expect(normalHtml).toContain("focus-visible:outline-focus-on-light");
      expect(normalHtml).toContain('aria-hidden="true"');

      const loadingHtml = renderToStaticMarkup(
        React.createElement(ButtonMod.Button, { loading: true }, "Đang lưu")
      );
      expect(loadingHtml).toContain("disabled");
      expect(loadingHtml).toContain('aria-busy="true"');
    });

    it("Badge & PositionBadge map AGENTS.md position colors on both light and dark surfaces", () => {
      const gkLight = renderToStaticMarkup(
        React.createElement(BadgeMod.PositionBadge, { position: "GK" })
      );
      const fwDark = renderToStaticMarkup(
        React.createElement(BadgeMod.PositionBadge, {
          position: "Tiền đạo",
          surface: "dark",
        })
      );
      expect(gkLight).toContain("bg-emerald-50");
      expect(fwDark).toContain("bg-rose-500/20");
    });

    it("LoadingState, EmptyState, and ErrorState render semantic ARIA roles", () => {
      const loadingHtml = renderToStaticMarkup(
        React.createElement(StateViews.LoadingState, { label: "Đang tải..." })
      );
      const emptyHtml = renderToStaticMarkup(
        React.createElement(StateViews.EmptyState, {
          title: "Trống",
          compact: true,
        })
      );
      const errorHtml = renderToStaticMarkup(
        React.createElement(StateViews.ErrorState, {
          title: "Lỗi",
          description: "Thử lại sau",
          onRetry: () => {},
        })
      );

      expect(loadingHtml).toContain('role="status"');
      expect(loadingHtml).toContain('aria-live="polite"');
      expect(emptyHtml).toContain("py-6");
      expect(errorHtml).toContain('role="alert"');
      expect(errorHtml).toContain("Thử lại");
    });
  });

  describe("Regression: Standardized Components Adopted in Target Tabs", () => {
    it("SponsorsTab uses ModalDialog (eliminates duplicate overlay), EmptyState, FormField, Input, Select, Textarea, and Button", () => {
      const src = readSrc("src/components/SponsorsTab.tsx");
      expect(src).toContain('import { ModalDialog } from "./ModalDialog"');
      expect(src).not.toContain("fixed inset-0 z-50 bg-slate-950/70");
      expect(src).toContain("<ModalDialog");
      expect(src).toContain("<EmptyState");
      expect(src).toContain("<FormField");
      expect(src).toContain("<Input");
      expect(src).toContain("<Select");
      expect(src).toContain("<Textarea");
      expect(src).toContain("<Button");
    });

    it("ClubPostsTab uses EmptyState, FormField, Input, Select, Textarea, and Button", () => {
      const src = readSrc("src/components/ClubPostsTab.tsx");
      expect(src).toContain("<EmptyState");
      expect(src).toContain("<FormField");
      expect(src).toContain("<Input");
      expect(src).toContain("<Select");
      expect(src).toContain("<Textarea");
      expect(src).toContain("<Button");
    });

    it("PlayerPersonalTab uses FormField, Input, Select, Button, and accessible password error role=alert", () => {
      const src = readSrc("src/components/PlayerPersonalTab.tsx");
      expect(src).toContain("<FormField");
      expect(src).toContain("<Input");
      expect(src).toContain("<Select");
      expect(src).toContain("<Button");
      expect(src).toContain('role="alert"');
    });
  });
});
