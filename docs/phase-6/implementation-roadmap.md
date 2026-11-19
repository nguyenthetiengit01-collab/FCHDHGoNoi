# Phase 6 — Implementation Roadmap (Phases 6.2 – 6.5)

- **Repository**: `nguyenthetiengit01-collab/FCHDHGoNoi`
- **Baseline**: `main` @ `0e17ce9a708634a9af9f9bb99bd75fc20c534402`
- **Guardrails**: All phases must preserve auth/RBAC boundaries, financial API logic, import/export integrity, and `MEDIA_STORAGE_ENABLED=false` / `ANALYTICS_ENABLED=false` defaults.

---

## Phase 6.2 — Design Tokens, Radius & Reduced-Motion Consolidation

- **Objective**: Eliminate remaining design-token drift (`rounded-2xl`, dialog radius, hardcoded HEX in workspace/shared files), extract `Toast` into `@/components/ui`, and close the `prefers-reduced-motion` gap.
- **Scope**:
  1. Add missing navy/gold semantic tokens in `src/app/globals.css` (`@theme` + `:root`).
  2. Align `dialog:modal` (`1rem` → `0.75rem`) and `dialog.cropper-dialog` (`1.25rem` → `0.75rem`) in `src/app/globals.css:374,389`, and replace all `rounded-2xl` usages across TSX files with `rounded-xl` (12px).
  3. Extend `@media (prefers-reduced-motion: reduce)` in `src/app/globals.css:203-225` to suppress `.animate-pulse`, `.animate-spin`, and `.animate-fade-in`.
  4. Extract `Toast` into `src/components/ui/Toast.tsx` (with `min-h-11 min-w-11` close button) and fix `showToast(..., "error")` at `TeamManagerApp.tsx:344,353,361`.
  5. Re-export `ModalDialog` from `src/components/ui/index.ts`.
- **Files Affected**: `src/app/globals.css`, `src/components/ui/Toast.tsx` (new), `src/components/ui/index.ts`, `src/components/TeamManagerApp.tsx`, `src/components/ClubPostsTab.tsx`, `src/components/ScheduleTab.tsx`, `src/components/LoginModal.tsx`, `src/components/ImageLightboxModal.tsx`, `src/components/MatchdayRosterPoster.tsx`, `src/components/PlayerProfileClient.tsx`, `src/components/PublicGuestPortal.tsx`, `src/app/hoat-dong/page.tsx`, `src/app/hoat-dong/[id]/page.tsx`, `src/app/cau-thu/[id]/page.tsx`.
- **Risk**: Low — CSS/class-level changes only; no business logic touched.
- **Acceptance Criteria**:
  - `0` occurrences of `rounded-2xl` and `rounded-3xl` across `src/`.
  - `Toast` primitive passes `role="alert"`/`role="status"` and `>=44px` close target.
  - `prefers-reduced-motion: reduce` disables all decorative animations.
- **Required Regression Tests**:
  - Update `src/lib/visualPolishPhase36.test.ts` to enforce `rounded-2xl` prohibition.
  - Update `src/lib/designTokensPhase35.test.ts` to cover `TeamManagerApp.tsx`, `LoginModal.tsx`, `ClubPostsTab.tsx`, `ScheduleTab.tsx`, `PlayerPersonalTab.tsx`, `PlayerProfileClient.tsx`.

---

## Phase 6.3 — Accessibility (WCAG 2.2 AA) & Mobile Touch-Target Remediation

- **Objective**: Close all remaining P0/P1 accessibility and mobile ergonomics gaps across Guest, Player, and Manager flows.
- **Scope**:
  1. Migrate `MatchdayRosterPoster.tsx:102` to native `<dialog>` + `useDialogA11y` (focus trap, `Escape`, focus restoration).
  2. Add `useDialogA11y` (`role="dialog"`, `aria-modal="true"`, `Escape`, focus restoration) to `PublicGuestPortal.tsx:554-633` mobile navigation drawer, and upgrade hamburger button (`PublicGuestPortal.tsx:546`) to `min-h-11 min-w-11`.
  3. Add `<a href="#main-content" className="skip-link">` and `<main id="main-content">` to `src/app/cau-thu/[id]/page.tsx:74-96` not-found view.
  4. Upgrade all sub-44px mobile touch targets to `min-h-11` (`min-w-11` for icon buttons) on `<640px` (`Button` `sm`, gallery `h-7 w-7` actions in `ScheduleTab`/`PlayerPersonalTab`/`PlayersTab`, `FinanceTab` edit/delete icons, `CollectionTab` filter buttons, `PlayersTab` `min-h-8` pills).
  5. Add inline/modal import error summary for Manager Excel import failures on mobile and desktop (`TeamManagerApp.tsx:297`).
- **Files Affected**: `src/components/MatchdayRosterPoster.tsx`, `src/components/PublicGuestPortal.tsx`, `src/app/cau-thu/[id]/page.tsx`, `src/components/ui/Button.tsx`, `src/components/ScheduleTab.tsx`, `src/components/PlayerPersonalTab.tsx`, `src/components/PlayersTab.tsx`, `src/components/FinanceTab.tsx`, `src/components/CollectionTab.tsx`, `src/components/TeamManagerApp.tsx`.
- **Risk**: Medium — Modal `<dialog>` migration can affect backdrop click & `html-to-image` PNG export refs if not tested carefully.
- **Acceptance Criteria**:
  - Keyboard-only users cannot Tab behind `MatchdayRosterPoster` or `PublicGuestPortal` mobile drawer; `Escape` closes both and returns focus to trigger.
  - Every interactive button/link meets `>=44×44px` on mobile viewports (`360×800`, `390×844`).
  - `MatchdayRosterPoster` PNG export continues to work identically.
- **Required Regression Tests**:
  - Extend `src/lib/accessibilityPhase32.test.ts` to assert `useDialogA11y` in `MatchdayRosterPoster.tsx` and `PublicGuestPortal.tsx`, and `skip-link` in `cau-thu/[id]/page.tsx`.
  - Add touch-target regression checks in `src/lib/contrastPhase351.test.ts` or `accessibilityPhase32.test.ts`.

---

## Phase 6.4 — Component Decomposition & Shared Profile/Gallery Editor

- **Objective**: Break up monolithic components (>1,300 lines) and eliminate duplicated player profile/gallery/cropper code without changing API payloads or state behavior.
- **Scope**:
  1. Extract shared `<PlayerProfileEditor>` + `<PlayerGalleryManager>` from `ScheduleTab.tsx` (2,783 lines), `PlayerPersonalTab.tsx` (1,341 lines), and `PlayersTab.tsx` (1,964 lines).
  2. Split `PublicGuestPortal.tsx` (2,162 lines) into focused subcomponents (`GuestHeaderNav`, `HeroBanner`, `MatchdaySection`, `RosterShowcase`, `ActivitiesMagazine`, `SponsorsFooter`).
  3. Split `FinanceTab.tsx` (1,645 lines) into `ExpenseLedgerSection`, `OtherIncomeSection`, and `FinanceTransactionModal`.
  4. Consolidate remaining hardcoded HEX in `BroadcastAthleteCard.tsx` (88 HEX) and `PublicGuestPortal.tsx` (63 HEX) onto `@theme` tokens.
- **Files Affected**: `src/components/ScheduleTab.tsx`, `src/components/PlayerPersonalTab.tsx`, `src/components/PlayersTab.tsx`, `src/components/PublicGuestPortal.tsx`, `src/components/FinanceTab.tsx`, `src/components/BroadcastAthleteCard.tsx`, plus new modular subcomponents under `src/components/`.
- **Risk**: Medium-High — Large structural refactors require careful prop/state wiring to avoid regressions in RSVP, profile updates, or financial forms.
- **Acceptance Criteria**:
  - Zero duplicated profile/gallery editor implementations across tabs.
  - All decomposed components remain `<= 600–800` lines each.
  - Existing unit/integration tests pass with zero API contract changes.
- **Required Regression Tests**:
  - Run full Vitest suite (`npm test -- --maxWorkers=1`), `npm run lint`, `npx tsc --noEmit`, `npm run build`.
  - Extend `designTokensPhase35.test.ts` to guard `PublicGuestPortal.tsx` and `BroadcastAthleteCard.tsx` (excluding documented export-canvas constants).

---

## Phase 6.5 — Image Optimization, Live Browser Visual QA & Polish

- **Objective**: Optimize image delivery (`next/image` / explicit dimensions for zero CLS) and execute live headless-browser visual & WCAG contrast verification across all 4 target viewports (`360×800`, `390×844`, `768×1024`, `1440×900`).
- **Scope**:
  1. Audit and migrate key public `<img>` tags in `PublicGuestPortal.tsx`, `hoat-dong/page.tsx`, `hoat-dong/[id]/page.tsx`, and `BroadcastAthleteCard.tsx` to `next/image` (or explicit `width`/`height` + `aspect-*` containers where dynamic external URLs apply).
  2. Run automated browser visual + axe-core / Playwright checks against a disposable local SQLite QA instance at `360×800`, `390×844`, `768×1024`, `1440×900`, and `200%` zoom.
  3. Verify actual rendered text contrast on gradient overlays (hero badges, gold footer secondary text `text-slate-900/60`, mobile drawer `text-sky-200/70`) and adjust opacity/tokens if `< 4.5:1`.
- **Files Affected**: `src/components/PublicGuestPortal.tsx`, `src/components/BroadcastAthleteCard.tsx`, `src/app/hoat-dong/page.tsx`, `src/app/hoat-dong/[id]/page.tsx`, `next.config.ts` (if `images` config needed).
- **Risk**: Low-Medium — `next/image` requires verifying local `/images/hinhanh-webp/` and `/uploads/` paths work cleanly with `npm run build`.
- **Acceptance Criteria**:
  - Zero horizontal overflow (`scrollWidth <= innerWidth`) across all 4 viewports and 200% zoom.
  - Zero WCAG 2.2 AA contrast or focus-trap violations in live browser audit.
  - Core Web Vitals (LCP hero image `fetchPriority="high"`, CLS ~ 0) verified.
- **Required Regression Tests**:
  - Full Vitest suite, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and Playwright/DevTools visual verification report.
