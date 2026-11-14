import { describe, it, expect, vi, beforeEach } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  buildPageMetadata,
  buildSportsOrganizationJsonLd,
  PUBLIC_STATIC_ROUTES,
  SITE_URL,
} from "./seo";
import { FANPAGE_URL } from "@/types/app";

vi.mock("@/lib/db", () => ({
  getFullAppData: vi.fn(),
}));

import { getFullAppData } from "@/lib/db";

describe("SEO & Search Optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("robots.ts disallows internal/API routes and references canonical sitemap", () => {
    const result = robots();
    const firstRule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(firstRule.allow).toBe("/");
    expect(firstRule.disallow).toContain("/api/");
    expect(firstRule.disallow).not.toContain("/_next/");
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(result.host).toBe(SITE_URL);
  });

  it("sitemap.ts includes all public routes and posts while excluding private/player routes", async () => {
    vi.mocked(getFullAppData).mockResolvedValueOnce({
      posts: [
        {
          id: "post-test-1",
          slug: "post-test-1",
          title: "Giải Gò Nổi 2026",
          category: "giaidau",
          categoryLabel: "Giải đấu",
          categoryBadgeClass: "",
          publishedDate: "2026-10-15",
          summary: "Tóm tắt",
          author: "BQL",
          featuredImage: "/images/cover-team.jpg",
          readingTime: "2 phút",
          paragraphs: ["Nội dung"],
        },
      ],
    } as never);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    for (const route of PUBLIC_STATIC_ROUTES) {
      const expected = route.path === "/" ? SITE_URL : `${SITE_URL}${route.path}`;
      expect(urls).toContain(expected);
    }
    expect(urls).toContain(`${SITE_URL}/hoat-dong/post-test-1`);
    expect(urls.every((u) => u.startsWith(SITE_URL))).toBe(true);
    expect(urls.some((u) => u.includes("/api/"))).toBe(false);
    expect(urls.some((u) => u.includes("/cau-thu/"))).toBe(false);
  });

  it("buildPageMetadata creates distinct canonical, OpenGraph, and Twitter tags", () => {
    const metaA = buildPageMetadata({
      title: "Trang A | FC HĐH Gò Nổi tại TP.HCM",
      description: "Mô tả trang A",
      path: "/nha-tai-tro",
    });
    const metaB = buildPageMetadata({
      title: "Trang B | FC HĐH Gò Nổi tại TP.HCM",
      description: "Mô tả trang B",
      path: "/bao-cao-tai-chinh",
    });

    expect(metaA.alternates?.canonical).toBe("/nha-tai-tro");
    expect(metaB.alternates?.canonical).toBe("/bao-cao-tai-chinh");
    expect(metaA.openGraph?.url).toBe(`${SITE_URL}/nha-tai-tro`);
    expect(metaA.openGraph?.locale).toBe("vi_VN");
    expect(metaA.twitter?.title).toBe("Trang A | FC HĐH Gò Nổi tại TP.HCM");
    expect(metaA.title).not.toBe(metaB.title);
  });

  it("buildSportsOrganizationJsonLd only uses verified club facts and official Fanpage", () => {
    const jsonLd = buildSportsOrganizationJsonLd();

    expect(jsonLd["@type"]).toBe("SportsOrganization");
    expect(jsonLd.name).toBe("FC HĐH Gò Nổi tại TP.HCM");
    expect(jsonLd.url).toBe(SITE_URL);
    expect(jsonLd.sameAs).toEqual([FANPAGE_URL]);
    expect("telephone" in jsonLd).toBe(false);
    expect("address" in jsonLd).toBe(false);
    expect("award" in jsonLd).toBe(false);
  });
});
