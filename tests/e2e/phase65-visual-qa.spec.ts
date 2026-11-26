import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { QA_DB_PATH, SCREENSHOT_DIR } from "./qaPaths";

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

const ROUTES = ["/", "/hoat-dong", "/hoat-dong/post-gd-1", "/cau-thu/1"] as const;

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  expect(fs.existsSync(QA_DB_PATH)).toBe(true);
});

test.describe("Phase 6.5 – Live Browser Visual, Contrast & Layout QA", () => {
  for (const vp of VIEWPORTS) {
    test(`home page passes overflow, axe-core WCAG 2.2 AA, and visual checks at ${vp.width}x${vp.height}`, async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      page.on("pageerror", (err) => consoleErrors.push(err.message));

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/", { waitUntil: "load" });
      const ctaButton = page.getByRole("button", { name: /Vào khu thành viên/i });
      if (!(await ctaButton.isVisible().catch(() => false))) {
        await page.waitForTimeout(1000);
        await page.reload({ waitUntil: "load" });
      }
      await expect(ctaButton).toBeVisible();

      // 1. Zero horizontal overflow
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);

      // 2. Desktop 1440px header nav single-line check
      if (vp.width >= 1024) {
        const headerMetrics = await page.evaluate(() => {
          const nav = document.querySelector('header nav[aria-label="Điều hướng trang khách"]');
          const loginBtn = Array.from(document.querySelectorAll("header button")).find((b) =>
            b.textContent?.includes("Đăng nhập")
          );
          const navItems = nav ? Array.from(nav.querySelectorAll("button, a")) : [];
          const wrappedItems = navItems
            .filter((el) => el.getBoundingClientRect().height > 36)
            .map((el) => el.textContent?.trim());
          return {
            navHeight: nav ? nav.getBoundingClientRect().height : 0,
            loginHeight: loginBtn ? loginBtn.getBoundingClientRect().height : 0,
            wrappedItems,
          };
        });
        expect(headerMetrics.wrappedItems).toEqual([]);
        expect(headerMetrics.loginHeight).toBeLessThanOrEqual(52);
      }

      // 3. Mobile checks: PWA bottom clearance & drawer dialog
      if (vp.width < 768) {
        const ctaBox = await ctaButton.boundingBox();
        expect(ctaBox).toBeTruthy();
        // Ensure CTA bottom stays above a typical 84px bottom-4 PWA banner
        expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(vp.height - 64);

        const menuBtn = page.getByRole("button", { name: /Mở menu điều hướng/i });
        await menuBtn.click();
        const drawer = page.getByRole("dialog", { name: /DANH MỤC TRANG CHỦ/i });
        await expect(drawer).toBeVisible();
        await expect(drawer).toHaveAttribute("aria-modal", "true");
        await page.keyboard.press("Escape");
        await expect(drawer).toBeHidden();
        await expect(menuBtn).toBeFocused();
      }

      // 4. Axe-core WCAG 2.2 AA audit
      const axeResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
      expect(axeResults.violations, JSON.stringify(axeResults.violations, null, 2)).toEqual([]);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `home-${vp.name}.png`),
        fullPage: false,
      });

      expect(consoleErrors).toEqual([]);
    });
  }

  // Note: Native browser UI zoom 200% is a separate manual check; this tests the 720x450
  // CSS reflow viewport equivalent (1440px at 200% scale) per WCAG 1.4.10 Reflow.
  test("200%-equivalent CSS reflow viewport (720x450) preserves layout, CTA, and navigation", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 720, height: 450 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "load" });
    await page.waitForLoadState("networkidle");

    const mainContent = page.locator("main#main-content");
    await expect(mainContent).toBeVisible();

    const ctaButton = page.getByRole("button", { name: /Vào khu thành viên/i });
    await expect(ctaButton).toBeVisible();

    const menuBtn = page.getByRole("button", { name: /Mở menu điều hướng/i });
    await expect(menuBtn).toBeVisible();

    const layoutCheck = await page.evaluate(() => {
      const header = document.querySelector("header");
      const cta = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Vào khu thành viên")
      );
      const headerRect = header?.getBoundingClientRect();
      const ctaRect = cta?.getBoundingClientRect();
      const overlapsHeader =
        Boolean(headerRect && ctaRect) &&
        ctaRect!.top < headerRect!.bottom &&
        ctaRect!.bottom > headerRect!.top;
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        overlapsHeader,
      };
    });

    expect(layoutCheck.scrollWidth).toBeLessThanOrEqual(layoutCheck.innerWidth);
    expect(layoutCheck.overlapsHeader).toBe(false);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "home-reflow-720x450.png"),
      fullPage: false,
    });
    await context.close();
  });

  test("measures lab LCP and CLS on /", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.addInitScript(() => {
      (window as unknown as { __qaVitals?: { lcp: number; cls: number } }).__qaVitals = {
        lcp: 0,
        cls: 0,
      };
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          (window as unknown as { __qaVitals: { lcp: number; cls: number } }).__qaVitals.lcp =
            last.startTime;
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
          if (!entry.hadRecentInput && entry.value) {
            (window as unknown as { __qaVitals: { lcp: number; cls: number } }).__qaVitals.cls +=
              entry.value;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    await page.goto("/", { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /Vào khu thành viên/i })).toBeVisible();
    await page.waitForTimeout(800);
    const vitals = await page.evaluate(
      () => (window as unknown as { __qaVitals: { lcp: number; cls: number } }).__qaVitals
    );
    console.log("LAB_VITALS_HOME:", JSON.stringify(vitals));
    expect(vitals.cls).toBeLessThan(0.1);
    expect(vitals.lcp).toBeGreaterThan(0);
  });

  for (const route of ROUTES.slice(1)) {
    test(`public route ${route} passes overflow and axe-core WCAG 2.2 AA`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main#main-content")).toBeVisible();
      const overflowMobile = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(overflowMobile.scrollWidth).toBeLessThanOrEqual(overflowMobile.innerWidth);

      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(page.locator("main#main-content")).toBeVisible();
      const overflowDesktop = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(overflowDesktop.scrollWidth).toBeLessThanOrEqual(overflowDesktop.innerWidth);
      const axeResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
      expect(axeResults.violations, `${route}: ${JSON.stringify(axeResults.violations, null, 2)}`).toEqual([]);
    });
  }

  test("public routes load all images and optimize DSC06522.webp without errors", async ({ page }) => {
    const failedImageResponses: Array<{ url: string; status: number }> = [];
    page.on("response", (res) => {
      const url = res.url();
      if ((url.includes("/images/") || url.includes("/_next/image")) && res.status() >= 400) {
        failedImageResponses.push({ url, status: res.status() });
      }
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: "load" });
      await expect(page.locator("main#main-content")).toBeVisible();
      const brokenImgs = await page.evaluate(() =>
        Array.from(document.querySelectorAll("img"))
          .filter((img) => img.complete && img.naturalWidth === 0)
          .map((img) => img.getAttribute("src") || "")
      );
      expect(brokenImgs, `${route} has broken <img> elements`).toEqual([]);
    }

    const optRes = await page.request.get(
      "/_next/image?url=%2Fimages%2Fhinhanh-webp%2Fgiaidau%2FDSC06522.webp&w=1080&q=75",
      { timeout: 20_000 }
    );
    expect(optRes.status()).toBe(200);
    expect(optRes.headers()["content-type"] || "").toMatch(/^image\//);
    expect(failedImageResponses).toEqual([]);
  });

  test("prefers-reduced-motion suppresses CSS animations", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });

    const animDurations = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".gn-spin-slow, .animate-pulse"));
      return els.map((el) => getComputedStyle(el).animationDuration);
    });
    for (const dur of animDurations) {
      expect(["0s", "0.001ms", "0.01ms"]).toContain(dur);
    }
  });
});
