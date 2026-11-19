import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("Phase 3.6 – UI Consistency & Visual Polish (UX-09, UX-10, UX-11)", () => {
  it("UX-09: eliminates rounded-2xl and rounded-3xl bubble radii across src/", () => {
    const violations: string[] = [];
    function scan(dir: string) {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) scan(full);
        else if (ent.name.endsWith(".tsx")) {
          const txt = fs.readFileSync(full, "utf8");
          if (/\brounded-(?:[tlbr]-)?(?:2|3)xl\b/.test(txt)) {
            violations.push(path.relative(ROOT, full));
          }
        }
      }
    }
    scan(path.join(ROOT, "src"));
    expect(violations).toEqual([]);
  });

  it("UX-10: banner navigation dots meet 44px touch target (min-h-11 min-w-11) with dark focus ring", () => {
    const portalSrc = readSrc("src/components/guest/MatchdaySection.tsx");
    expect(portalSrc).not.toContain("min-h-6 min-w-6");
    expect(portalSrc).toContain("min-h-11 min-w-11 flex items-center justify-center rounded-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-focus-on-dark");
    expect(portalSrc).toContain('aria-current={i === activeBannerIdx ? "true" : undefined}');
  });

  it("UX-11: .bg-brand-navy and .bg-brand-navy-mid avoid !important and sit inside @layer components", () => {
    const css = readSrc("src/app/globals.css");
    const layerMatch = css.match(/@layer\s+components\s*\{\s*\.bg-brand-navy\s*\{[\s\S]*?\.bg-brand-navy-mid\s*\{[\s\S]*?\}\s*\}/);
    expect(layerMatch).toBeTruthy();
    expect(layerMatch![0]).not.toContain("!important");
  });

  it("Typography & Brand rules: Barlow Condensed display font configured and zero generic purple-pink gradients", () => {
    const layoutSrc = readSrc("src/app/layout.tsx");
    expect(layoutSrc).toContain("Barlow_Condensed");
    expect(layoutSrc).toContain("--font-display");

    const portalSrc = readSrc("src/components/PublicGuestPortal.tsx");
    expect(portalSrc).not.toMatch(/from-purple-.*to-pink|from-pink-.*to-purple|from-indigo-.*to-pink/);
  });

  it("Phase 3.7 Radius Token Alignment: :root radius tokens match Tailwind v4 defaults and AGENTS.md 8-12px", () => {
    const css = readSrc("src/app/globals.css");
    expect(css).toContain("--radius-sm: 0.25rem;");
    expect(css).toContain("--radius-md: 0.375rem;");
    expect(css).toContain("--radius-lg: 0.5rem;");
    expect(css).toContain("--radius-xl: 0.75rem;");
  });
});
