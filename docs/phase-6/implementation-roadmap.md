# Phase 6 — Implementation Roadmap (Phases 6.2 – 6.5)

- **Repository**: `nguyenthetiengit01-collab/FCHDHGoNoi`
- **Baseline**: `main` @ `0e17ce9a708634a9af9f9bb99bd75fc20c534402`
- **Guardrails**: All phases must preserve auth/RBAC boundaries, financial API logic, import/export integrity, and `MEDIA_STORAGE_ENABLED=false` / `ANALYTICS_ENABLED=false` defaults.

---

## Phase 6.2 — Design Tokens, Radius, Reduced-Motion & P0 Dialog Hotfix (Implemented)

- **Baseline SHA**: `e61107749b6b14763e6ee458fd60c5b6c0176090` (`main`)
- **Objective**: Eliminate remaining design-token drift (`rounded-2xl`, dialog radius, hardcoded HEX in workspace/shared files), extract `Toast` into `@/components/ui`, close the `prefers-reduced-motion` gap, and remediate P0 `A11Y-01` (`MatchdayRosterPoster` native `<dialog>`).
- **Scope Implemented**:
  1. Added `--color-navy-975`, `--color-navy-850`, `--color-gold-450` and `:root` aliases `--brand-navy-deepest`, `--brand-navy-dark`, `--brand-gold-light` in `src/app/globals.css`, and cleaned hardcoded HEX in the 9 workspace/shared components.
  2. Aligned `dialog:modal` and `dialog.cropper-dialog:modal` to `0.75rem` (12px) and replaced all `rounded-2xl` usages across `src/**/*.tsx` with `rounded-xl`.
  3. Extended `@media (prefers-reduced-motion: reduce)` in `src/app/globals.css` to suppress `.animate-pulse`, `.animate-spin`, and `.animate-fade-in`.
  4. Extracted `Toast` / `ToastVariant` into `src/components/ui/Toast.tsx`, re-exported `Toast` and `ModalDialog` from `src/components/ui/index.ts`, and fixed `showToast(..., "error")` on error branches in `TeamManagerApp.tsx`.
  5. Remediated P0 `A11Y-01` early by migrating `MatchdayRosterPoster.tsx` to native `<dialog>` + `useDialogA11y` while preserving `posterRef` PNG export (`pixelRatio: 2.5`, `quality: 0.98`).
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

## Phase 6.3 — Accessibility (WCAG 2.2 AA) & Mobile Touch-Target Remediation (Implemented)

- **Baseline SHA**: `3320e5599d0712c004386b22aa8a07a95f9d595b` (`main`)
- **Objective**: Close all remaining P1 accessibility and mobile ergonomics gaps across Guest, Player, and Manager flows (`A11Y-01` `MatchdayRosterPoster` was resolved early in Phase 6.2).
- **Scope Implemented**:
  1. Added `useDialogA11y` (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `Escape`, focus trap/restoration, body scroll lock) to `PublicGuestPortal.tsx` mobile navigation drawer, and upgraded hamburger + close buttons to `min-h-11 min-w-11` (`aria-expanded`, `aria-controls`).
  2. Added `<a href="#main-content" className="skip-link">`, `<main id="main-content">`, and `<h1>` to `src/app/cau-thu/[id]/page.tsx` not-found fallback view.
  3. Upgraded mobile touch targets to `>=44px` (`min-h-11` / `min-h-11 min-w-11` on `<640px`) in `Button.tsx` (`sm`), `ScheduleTab.tsx` / `PlayerPersonalTab.tsx` / `PlayersTab.tsx` gallery actions (also visible on touch without hover + `aria-label`), `PlayersTab.tsx` roster/PIN/action controls, `FinanceTab.tsx` edit/delete & filter buttons, and `CollectionTab.tsx` presets/quick-payers/filters.
  4. Added persistent Excel import error summary (`ModalDialog` + reopenable error banner) in `TeamManagerApp.tsx` using safe `json.error` string validation and clearing on successful import.
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
