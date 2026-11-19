import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("Phase 6.5 – Image Optimization, Live Browser Visual QA & Polish", () => {
  it("migrates public portal and hoat-dong views to next/image while keeping BroadcastAthleteCard exportable with img", () => {
    const nextImageConsumers = [
      "src/components/guest/GuestHeaderNav.tsx",
      "src/components/guest/HeroBanner.tsx",
      "src/components/guest/MatchdaySection.tsx",
      "src/components/guest/RosterShowcase.tsx",
      "src/components/guest/ActivitiesMagazine.tsx",
      "src/components/guest/SponsorsFooter.tsx",
      "src/app/hoat-dong/page.tsx",
      "src/app/hoat-dong/[id]/page.tsx",
    ];

    for (const file of nextImageConsumers) {
      const src = readSrc(file);
      expect(src, `${file} should import next/image`).toContain('from "next/image"');
      expect(src, `${file} should render <Image`).toContain("<Image");
    }

    const cardSrc = readSrc("src/components/BroadcastAthleteCard.tsx");
    expect(cardSrc).toContain("<img");
    expect(cardSrc).not.toContain('from "next/image"');
  });

  it("sets priority LCP loading and mobile CTA clearance on HeroBanner, single-line desktop nav, and accessible PwaManager", () => {
    const heroSrc = readSrc("src/components/guest/HeroBanner.tsx");
    expect(heroSrc).toContain("priority={i === 0}");
    expect(heroSrc).toContain("pb-28 sm:pb-20");

    const navSrc = readSrc("src/components/guest/GuestHeaderNav.tsx");
    expect(navSrc).toContain("whitespace-nowrap shrink-0");

    const pwaSrc = readSrc("src/components/PwaManager.tsx");
    expect(pwaSrc).toContain("hover:bg-navy-600");
    expect(pwaSrc).toContain("min-h-11");
    expect(pwaSrc.match(/#[0-9a-fA-F]{3,8}\b/g) || []).toEqual([]);
  });

  it("ensures position badges and article author badge meet WCAG 2.2 AA contrast on dark navy surfaces", () => {
    const profileSrc = readSrc("src/lib/athleteProfile.ts");
    expect(profileSrc).toContain("bg-blue-950/60 text-blue-200");
    expect(profileSrc).toContain("bg-emerald-950/60 text-emerald-200");
    expect(profileSrc).toContain("bg-amber-950/60 text-amber-200");
    expect(profileSrc).toContain("bg-rose-950/60 text-rose-200");
    expect(profileSrc).toContain("bg-purple-950/60 text-purple-200");

    const postPageSrc = readSrc("src/app/hoat-dong/[id]/page.tsx");
    expect(postPageSrc).toContain("bg-navy-800 border border-gold-500");
    expect(postPageSrc).toContain("text-gold-300");
  });
});
