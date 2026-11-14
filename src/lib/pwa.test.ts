import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../app/manifest";

const ROOT_DIR = process.cwd();

describe("PWA manifest & assets", () => {
  it("generates a valid standalone web manifest for FC HĐH Gò Nổi", () => {
    const data = manifest();

    expect(data.name).toBe("FC HĐH Gò Nổi tại TP.HCM");
    expect(data.short_name).toBe("FC Gò Nổi");
    expect(data.display).toBe("standalone");
    expect(data.start_url).toBe("/");
    expect(data.theme_color).toBe("#040e1a");
    expect(data.background_color).toBe("#040e1a");
    expect(Array.isArray(data.icons)).toBe(true);
    expect(data.icons).toHaveLength(3);

    const sizes = data.icons?.map((icon) => icon.sizes);
    expect(sizes).toEqual(["192x192", "512x512", "512x512"]);
    expect(data.icons?.[2]?.purpose).toBe("maskable");
  });

  it("provides generated PNG icons for Android and iOS", () => {
    const requiredIcons = [
      "public/icons/icon-192.png",
      "public/icons/icon-512.png",
      "public/icons/icon-maskable-512.png",
      "public/icons/apple-touch-icon.png",
    ];

    for (const relPath of requiredIcons) {
      const fullPath = path.join(ROOT_DIR, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      const stat = fs.statSync(fullPath);
      expect(stat.size).toBeGreaterThan(1000);
    }
  });
});

describe("Service Worker cache security invariants", () => {
  const swPath = path.join(ROOT_DIR, "public/sw.js");
  const swSource = fs.readFileSync(swPath, "utf8");

  it("bypasses non-GET requests, cross-origin requests, and all /api/* endpoints", () => {
    expect(swSource).toMatch(/request\.method\s*!==\s*"GET"/);
    expect(swSource).toMatch(/url\.origin\s*!==\s*self\.location\.origin/);
    expect(swSource).toMatch(/url\.pathname\.startsWith\("\/api\/"\)/);
  });

  it("pre-caches /offline and falls back to /offline for navigation requests without caching HTML", () => {
    expect(swSource).toMatch(/OFFLINE_URL\s*=\s*"\/offline"/);
    expect(swSource).toMatch(/PRECACHE_URLS\s*=\s*\[[\s\S]*OFFLINE_URL/);
    expect(swSource).toMatch(/request\.mode\s*===\s*"navigate"/);
    expect(swSource).toMatch(/caches\.match\(OFFLINE_URL\)/);
  });

  it("supports immediate activation via SKIP_WAITING message", () => {
    expect(swSource).toMatch(/SKIP_WAITING/);
    expect(swSource).toMatch(/self\.skipWaiting\(\)/);
  });
});
