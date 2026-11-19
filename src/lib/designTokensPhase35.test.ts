import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("Phase 3.5 – Design Token Consolidation & Hardcoded Color Cleanup", () => {
  it("globals.css defines unified @theme primitive and semantic tokens", () => {
    const css = readSrc("src/app/globals.css");
    const requiredTokens = [
      "--color-navy-975:",
      "--color-navy-950:",
      "--color-navy-900:",
      "--color-navy-850:",
      "--color-navy-800:",
      "--color-navy-700:",
      "--color-navy-600:",
      "--color-navy-500:",
      "--color-royal-600:",
      "--color-royal-500:",
      "--color-gold-300:",
      "--color-gold-400:",
      "--color-gold-450:",
      "--color-gold-500:",
      "--color-gold-600:",
      "--color-gold-700:",
      "--color-brand-navy:",
      "--color-brand-gold:",
      "--color-ink-primary:",
      "--color-surface-page:",
      "--color-surface-card:",
      "--color-feedback-success:",
      "--color-feedback-danger:",
    ];

    for (const token of requiredTokens) {
      expect(css, `globals.css must define ${token}`).toContain(token);
    }
  });

  it("UI primitives, ModalDialog, and Phase 6.2 workspace/shared components contain zero hardcoded HEX colors", () => {
    const cleanFiles = [
      "src/components/ui/Button.tsx",
      "src/components/ui/Badge.tsx",
      "src/components/ui/Card.tsx",
      "src/components/ui/FormControls.tsx",
      "src/components/ui/StateViews.tsx",
      "src/components/ui/Toast.tsx",
      "src/components/ModalDialog.tsx",
      "src/components/FinanceTab.tsx",
      "src/components/MatrixTab.tsx",
      "src/components/CollectionTab.tsx",
      "src/components/DashboardTab.tsx",
      "src/components/PlayersTab.tsx",
      "src/components/ImageLightboxModal.tsx",
      "src/components/TeamManagerApp.tsx",
      "src/components/ScheduleTab.tsx",
      "src/components/PlayerPersonalTab.tsx",
      "src/components/ClubPostsTab.tsx",
      "src/components/LoginModal.tsx",
      "src/components/PlayerProfileClient.tsx",
      "src/components/PublicGuestPortal.tsx",
      "src/components/BroadcastAthleteCard.tsx",
      "src/components/guest/shared.tsx",
      "src/components/guest/MatchdaySection.tsx",
      "src/components/guest/RosterShowcase.tsx",
      "src/components/guest/ActivitiesMagazine.tsx",
      "src/components/guest/SponsorsFooter.tsx",
      "src/components/finance/ExpenseLedgerSection.tsx",
      "src/components/finance/OtherIncomeSection.tsx",
      "src/components/finance/FinanceTransactionModal.tsx",
      "src/components/shared/PlayerProfileEditor.tsx",
      "src/components/shared/PlayerGalleryManager.tsx",
    ];

    for (const file of cleanFiles) {
      const content = readSrc(file);
      const matches = content.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
      expect(matches, `${file} should have zero hardcoded HEX`).toEqual([]);
    }

    const documentedHexExceptions: Array<{ file: string; allowed: string[] }> = [
      { file: "src/components/guest/GuestHeaderNav.tsx", allowed: ["#1877F2"] },
      { file: "src/components/guest/HeroBanner.tsx", allowed: ["#d4af37"] },
    ];
    for (const { file, allowed } of documentedHexExceptions) {
      const content = readSrc(file);
      const matches = content.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
      const unexpected = matches.filter((m) => !allowed.includes(m));
      expect(unexpected, `${file} should only contain documented HEX exceptions`).toEqual([]);
    }
  });

  it("Preserves technical position badge colors GK/DF/MF/FW/ĐN in Badge.tsx", () => {
    const badgeSrc = readSrc("src/components/ui/Badge.tsx");
    expect(badgeSrc).toContain('variant = "success"'); // GK Emerald
    expect(badgeSrc).toContain('variant = "info"');    // DF Blue/Sky
    expect(badgeSrc).toContain('variant = "warning"'); // MF Amber
    expect(badgeSrc).toContain('variant = "danger"');  // FW Rose
    expect(badgeSrc).toContain('variant = "purple"');  // ĐN Purple
  });
});
