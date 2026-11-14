import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  GO_NOI_GALLERY,
  GO_NOI_IDENTITY,
  GO_NOI_STORY_PILLARS,
  GO_NOI_VILLAGES,
} from "@/data/goNoiStory";

describe("Phase 3 Batch 1 – Go Noi Story Data & Asset Integrity", () => {
  it("contains accurate current and historical place naming without fabricating personal data", () => {
    expect(GO_NOI_IDENTITY.currentLocation).toBe("Xã Gò Nổi • TP. Đà Nẵng");
    expect(GO_NOI_IDENTITY.historicalContext).toBe(
      "Gò Nổi – Điện Bàn – Quảng Nam (cũ)"
    );
    expect(GO_NOI_IDENTITY.riverName).toContain("Thu Bồn");

    const villageNames = GO_NOI_VILLAGES.map((v) => v.name).join(" ");
    expect(villageNames).toContain("Điện Quang");
    expect(villageNames).toContain("Điện Trung");
    expect(villageNames).toContain("Điện Phong");

    const allText = [
      ...GO_NOI_VILLAGES.map((v) => v.description),
      ...GO_NOI_STORY_PILLARS.flatMap((p) => [p.title, ...p.paragraphs]),
    ].join(" ");
    expect(allText).toContain("Thu Bồn");
    expect(allText).toContain("Điện Quang");
    expect(allText).toContain("Điện Trung");
    expect(allText).toContain("Điện Phong");
    expect(allText).not.toMatch(/pin_code|09\d{8}/i);
  });

  it("references only verified local club assets that exist under public/", () => {
    const publicDir = path.join(process.cwd(), "public");
    const assetPaths = [
      GO_NOI_IDENTITY.logoUrl,
      GO_NOI_IDENTITY.coverUrl,
      ...GO_NOI_GALLERY.map((g) => g.src),
    ];

    for (const rel of assetPaths) {
      expect(rel.startsWith("/images/")).toBe(true);
      const absPath = path.join(publicDir, rel.replace(/^\//, ""));
      expect(fs.existsSync(absPath)).toBe(true);
    }
  });
});
