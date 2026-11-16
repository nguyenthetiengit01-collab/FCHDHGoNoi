import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, "");
  if (clean.length !== 6) {
    throw new Error(`Expected 6-digit hex color, got: ${hex}`);
  }
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function linearizeChannel(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(linearizeChannel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractThemeTokens(css: string): Map<string, string> {
  const themeMatch = css.match(/@theme\s*\{([\s\S]*?)\}/);
  if (!themeMatch) return new Map();
  const map = new Map<string, string>();
  const re = /(--color-[a-z0-9-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(themeMatch[1])) !== null) {
    map.set(m[1], m[2].trim());
  }
  return map;
}

describe("Phase 3.5.1 – WCAG 2.2 Contrast & Design Token Integrity", () => {
  const css = readSrc("src/app/globals.css");
  const themeTokens = extractThemeTokens(css);

  describe("WCAG 2.2 Relative Luminance & Focus Indicator Contrast (>= 3:1)", () => {
    it("proves legacy #d4af37 alone on light surfaces failed WCAG 1.4.11 (< 3:1)", () => {
      expect(contrastRatio("#d4af37", "#ffffff")).toBeLessThan(3);
      expect(contrastRatio("#d4af37", "#f1f5f9")).toBeLessThan(3);
      expect(contrastRatio("#d4af37", "#f8fafc")).toBeLessThan(3);
    });

    it("verifies focus-on-light (#092244) passes >= 3:1 across light & intermediate surfaces", () => {
      const focusLight = themeTokens.get("--color-focus-on-light")!;
      expect(focusLight).toBe("#092244");
      expect(contrastRatio(focusLight, "#ffffff")).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(focusLight, "#f8fafc")).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(focusLight, "#f1f5f9")).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(focusLight, "#e2e8f0")).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(focusLight, "#94a3b8")).toBeGreaterThanOrEqual(3);
    });

    it("verifies dual-ring halo (#ffffff) passes >= 3:1 against dark interactive buttons", () => {
      const halo = themeTokens.get("--color-focus-halo")!;
      expect(halo).toBe("#ffffff");
      expect(contrastRatio(halo, themeTokens.get("--color-navy-600")!)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(halo, themeTokens.get("--color-navy-800")!)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(halo, themeTokens.get("--color-navy-500")!)).toBeGreaterThanOrEqual(3);
    });

    it("verifies focus-on-dark (#ffd700) passes >= 3:1 across all dark navy surfaces", () => {
      const focusDark = themeTokens.get("--color-focus-on-dark")!;
      expect(focusDark).toBe("#ffd700");
      expect(contrastRatio(focusDark, themeTokens.get("--color-navy-950")!)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(focusDark, themeTokens.get("--color-navy-900")!)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(focusDark, themeTokens.get("--color-navy-800")!)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(focusDark, themeTokens.get("--color-navy-700")!)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(focusDark, themeTokens.get("--color-navy-600")!)).toBeGreaterThanOrEqual(3);
    });

    it("verifies normal text (>= 4.5:1) and large UI text (>= 3:1) contrast on primary surfaces", () => {
      expect(contrastRatio(themeTokens.get("--color-ink-primary")!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(themeTokens.get("--color-ink-secondary")!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(themeTokens.get("--color-ink-muted")!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(themeTokens.get("--color-gold-700")!, "#fffbeb")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio("#ffffff", themeTokens.get("--color-navy-600")!)).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("Design Token Integrity & Anti-Drift", () => {
    it("all :root var(--color-...) references resolve to valid @theme tokens", () => {
      const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/);
      expect(rootMatch).toBeTruthy();
      const varRefs = rootMatch![1].match(/var\((--color-[a-z0-9-]+)\)/g) || [];
      expect(varRefs.length).toBeGreaterThan(10);

      for (const ref of varRefs) {
        const tokenName = ref.slice(4, -1);
        expect(themeTokens.has(tokenName), `Missing @theme token ${tokenName}`).toBe(true);
      }
    });

    it("all custom theme color utilities used across src/ resolve to @theme definitions", () => {
      const customTokenPrefixes = [
        "navy",
        "royal",
        "gold",
        "brand",
        "surface",
        "ink",
        "line",
        "feedback",
        "focus",
      ];
      const classRe = new RegExp(
        `(?:bg|text|border(?:-[tblr])?|outline|ring|from|via|to)-((?:${customTokenPrefixes.join("|")})-[a-z0-9-]+)`,
        "g"
      );

      const missing: string[] = [];
      function scan(dir: string) {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) scan(full);
          else if (ent.name.endsWith(".tsx")) {
            const txt = fs.readFileSync(full, "utf8");
            let m: RegExpExecArray | null;
            while ((m = classRe.exec(txt)) !== null) {
              const token = `--color-${m[1]}`;
              if (!themeTokens.has(token)) {
                missing.push(`${path.relative(ROOT, full)}: ${token}`);
              }
            }
          }
        }
      }
      scan(path.join(ROOT, "src"));
      expect(missing).toEqual([]);
    });

    it("no component suppresses focus outline with focus:outline-none without replacement", () => {
      const violations: string[] = [];
      function scan(dir: string) {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) scan(full);
          else if (ent.name.endsWith(".tsx")) {
            const txt = fs.readFileSync(full, "utf8");
            if (/\bfocus:outline-none\b/.test(txt)) {
              violations.push(path.relative(ROOT, full));
            }
          }
        }
      }
      scan(path.join(ROOT, "src"));
      expect(violations).toEqual([]);
    });

    it("globals.css includes @media (forced-colors: active) focus fallback", () => {
      expect(css).toContain("@media (forced-colors: active)");
      expect(css).toContain("Highlight");
    });
  });
});
