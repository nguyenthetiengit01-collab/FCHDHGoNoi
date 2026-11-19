import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("Phase 6.4 – Component Decomposition & Token Consolidation", () => {
  it("extracts shared PlayerProfileEditor and PlayerGalleryManager and adopts them across PlayerPersonalTab, ScheduleTab, and PlayersTab", () => {
    const editorSrc = readSrc("src/components/shared/PlayerProfileEditor.tsx");
    const gallerySrc = readSrc("src/components/shared/PlayerGalleryManager.tsx");

    expect(editorSrc).toContain("export function PlayerProfileEditor");
    expect(editorSrc).toContain("min-h-11 min-w-11 md:min-h-7 md:min-w-7");
    expect(editorSrc).toContain("aria-label={`Canh chỉnh & cắt ảnh hoạt động #${idx + 1}`}");

    expect(gallerySrc).toContain("export function PlayerGalleryManager");
    expect(gallerySrc).toContain("min-h-11 min-w-11 md:min-h-8 md:min-w-8");
    expect(gallerySrc).toContain("aria-label={`Đặt ảnh #${idx + 1} làm ảnh Profile rộng`}");
    expect(gallerySrc).toContain("aria-label={`Cắt ảnh #${idx + 1} làm ảnh Profile rộng`}");
    expect(gallerySrc).toContain("aria-label={`Xoá ảnh #${idx + 1} khỏi Album`}");

    for (const consumer of [
      "src/components/PlayerPersonalTab.tsx",
      "src/components/ScheduleTab.tsx",
      "src/components/PlayersTab.tsx",
    ]) {
      const src = readSrc(consumer);
      expect(src, `${consumer} should use PlayerProfileEditor`).toContain("<PlayerProfileEditor");
      expect(src, `${consumer} should use PlayerGalleryManager`).toContain("<PlayerGalleryManager");
    }
  });

  it("decomposes PublicGuestPortal into focused guest section modules and keeps orchestrator concise", () => {
    const portalSrc = readSrc("src/components/PublicGuestPortal.tsx");
    const lineCount = portalSrc.split(/\r?\n/).length;
    expect(lineCount).toBeLessThan(400);

    const expectedModules = [
      "src/components/guest/shared.tsx",
      "src/components/guest/GuestHeaderNav.tsx",
      "src/components/guest/HeroBanner.tsx",
      "src/components/guest/MatchdaySection.tsx",
      "src/components/guest/RosterShowcase.tsx",
      "src/components/guest/ActivitiesMagazine.tsx",
      "src/components/guest/SponsorsFooter.tsx",
    ];

    for (const mod of expectedModules) {
      expect(fs.existsSync(path.join(ROOT, mod)), `${mod} must exist`).toBe(true);
    }

    for (const comp of [
      "<GuestHeaderNav",
      "<HeroBanner",
      "<MatchdaySection",
      "<RosterShowcase",
      "<ActivitiesMagazine",
      "<SponsorsFooter",
    ]) {
      expect(portalSrc).toContain(comp);
    }
  });

  it("decomposes FinanceTab into ExpenseLedgerSection, OtherIncomeSection, and FinanceTransactionModal", () => {
    const financeSrc = readSrc("src/components/FinanceTab.tsx");
    expect(financeSrc.split(/\r?\n/).length).toBeLessThan(900);

    expect(financeSrc).toContain("<ExpenseLedgerSection");
    expect(financeSrc).toContain("<OtherIncomeSection");
    expect(financeSrc).toContain("<FinanceTransactionModal");

    const expenseSrc = readSrc("src/components/finance/ExpenseLedgerSection.tsx");
    const incomeSrc = readSrc("src/components/finance/OtherIncomeSection.tsx");
    const modalSrc = readSrc("src/components/finance/FinanceTransactionModal.tsx");

    expect(expenseSrc).toContain("if (totalFiltered === 0) return formatVND(0);");
    expect(expenseSrc).toContain("min-h-11 min-w-11 md:min-h-9 md:min-w-9");
    expect(incomeSrc).toContain("min-h-11 min-w-11 md:min-h-9 md:min-w-9");
    expect(modalSrc).toContain("<ModalDialog");
  });
});
