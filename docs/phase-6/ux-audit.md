# Phase 6.1 — Comprehensive UX & Accessibility Audit

- **Repository**: `nguyenthetiengit01-collab/FCHDHGoNoi`
- **Branch**: `feat/phase-6.1-ux-audit-design-system`
- **Verified Baseline SHA (`main`)**: `0e17ce9a708634a9af9f9bb99bd75fc20c534402`
- **Scope**: Documentation-only audit covering Guest/Fan, Player, and Manager journeys, historical Phase 3.1–3.6 reconciliation, WCAG 2.2 AA accessibility, responsive viewports (`360×800`, `390×844`, `768×1024`, `1440×900`), and technical UX/performance.
- **Verification Method**: Static source-code inspection across `src/app/`, `src/components/`, and `src/lib/*Phase3*.test.ts`. Live headless-browser visual rendering was **not** executed in this phase (no Production DB connection, no runtime edits); every finding below is explicitly tagged as source-code verified and lists exact file paths and line numbers.

---

## 1. Executive Summary

Since Phase 3.1, the application has made substantial progress on core accessibility and workspace standardization:
- **Resolved**: Native `<dialog>` adoption for `ModalDialog`, `LoginModal`, `ImageLightboxModal`, and `AvatarCropperModal`; complete removal of blocking `window.confirm()` / `alert()` calls; automatic `FormField` ARIA wiring (`id`, `aria-describedby`, `aria-invalid`, `hasError`); mobile card views in `FinanceTab` and sticky player column in `MatrixTab`; WCAG 2.2 AA focus-ring contrast tokens (`--color-focus-on-light`, `--color-focus-on-dark`, `--color-focus-halo`); elimination of `rounded-3xl` and `!important` overrides.
- **Remaining Gaps**:
  - **2 P0 / P1 Modal & Drawer Accessibility gaps**: `MatchdayRosterPoster.tsx` and the `PublicGuestPortal.tsx` mobile drawer still render plain `<div>` overlays without `useDialogA11y` / focus trapping / `Escape` handling.
  - **Touch-target & Motion gaps**: Several secondary icon buttons (`h-7 w-7` / `min-h-8` / `min-h-9`) fall below the 44×44px target on mobile, and Tailwind `animate-pulse` / `animate-spin` / `animate-fade-in` are not suppressed under `prefers-reduced-motion: reduce`.
  - **Design System Drift**: 17 `rounded-2xl` (16px) usages and 245+ hardcoded HEX values remain outside the 12 files guarded by `designTokensPhase35.test.ts`.
  - **Technical UX / Maintainability**: Five workspace/portal components exceed 1,300 lines (`ScheduleTab.tsx` at 2,783 lines; `PublicGuestPortal.tsx` at 2,162 lines), with the player profile/gallery editor duplicated across 3 tabs.

---

## 2. Historical Phase 3.1–3.6 Finding Reconciliation

| ID | Original Issue (Phase 3.1) | Current Status | Line-Level Evidence |
| :--- | :--- | :---: | :--- |
| **UX-01** | Modals without `<dialog>` / focus trap | **PARTIALLY RESOLVED** | **Resolved** in `ModalDialog.tsx:46`, `LoginModal.tsx:127`, `ImageLightboxModal.tsx:74`, `AvatarCropperModal.tsx:340`, and `TeamManagerApp.tsx:195` (`useDialogA11y` on mobile drawer). **Still Open** in `MatchdayRosterPoster.tsx:102` (plain `fixed inset-0` `<div>`, no `role="dialog"`, no `Escape`/focus-trap) and `PublicGuestPortal.tsx:554` (mobile nav drawer has no `role="dialog"`, `aria-modal`, `Escape`, or focus-trap). |
| **UX-02** | Blocking `window.confirm()` & `alert()` | **RESOLVED** | `0` occurrences of `window.confirm`, `window.alert`, `confirm(`, or `alert(` across `src/`. Destructive flows use `ConfirmDialog` (`src/components/ui/StateViews.tsx:105-145`) and `TeamManagerApp.tsx:652-678` toast. |
| **UX-03** | Missing `skip-link` on standalone pages | **PARTIALLY RESOLVED** | **Resolved** on `/hoat-dong/page.tsx`, `/hoat-dong/[id]/page.tsx`, `/bao-cao-tai-chinh/page.tsx`, `/nha-tai-tro/page.tsx`, `/cau-chuyen-go-noi/page.tsx`, `/offline/page.tsx`, `PlayerProfileClient.tsx`, and `TeamManagerApp.tsx:494`. **Still Open** on `src/app/cau-thu/[id]/page.tsx:74-96` (player-not-found fallback view lacks `<a href="#main-content" className="skip-link">` and `<main id="main-content">`). |
| **UX-04** | Low `@/components/ui` adoption | **PARTIALLY RESOLVED** | Adopted in 11 components (`ScheduleTab`, `PlayersTab`, `FinanceTab`, `PlayerPersonalTab`, `DashboardTab`, `CollectionTab`, `ClubPostsTab`, `AnalyticsCenterTab`, `SponsorsTab`, `MatrixTab`, `PlayerInsights`). **Still Open** in `TeamManagerApp.tsx` (custom toast & header buttons), `LoginModal.tsx`, `MatchdayRosterPoster.tsx`, `AvatarCropperModal.tsx`, and `PublicGuestPortal.tsx`. |
| **UX-05** | `FormField` missing auto-ARIA | **RESOLVED** | `src/components/ui/FormControls.tsx:82-138` automatically injects `id`, `aria-describedby`, `aria-invalid`, and `hasError` into single-element children (verified by `uiStandardizationPhase33.test.ts`). |
| **UX-06** | Mobile table usability (`FinanceTab`, `MatrixTab`) | **RESOLVED** | `FinanceTab.tsx:719,992` renders `md:hidden` mobile cards for expenses and other incomes. `MatrixTab.tsx:212,226,338` uses `.ds-table-wrap`, `.sticky-corner`/`.sticky-col`, and mobile scroll hint. |
| **UX-07** | Focus ring conflict (`outline-emerald-600` vs Gold) | **RESOLVED** | `ModalDialog.tsx:80` uses `focus-visible:outline-focus-on-light` (`#092244`). `globals.css:42-44,227-238` standardizes `--color-focus-on-light` (`#092244`), `--color-focus-on-dark` (`#ffd700`), and `--color-focus-halo` (`#ffffff`), mathematically verified in `contrastPhase351.test.ts`. |
| **UX-08** | >350 hardcoded HEX colors | **PARTIALLY RESOLVED** | 12 files have 0 hardcoded HEX (`designTokensPhase35.test.ts`). **Still Open** in `BroadcastAthleteCard.tsx` (88), `PublicGuestPortal.tsx` (63), `MatchdayRosterPoster.tsx` (39 — justified for canvas/PNG export), `TeamManagerApp.tsx` (17), `ScheduleTab.tsx` (11), `ClubPostsTab.tsx` (6), `PlayerProfileClient.tsx` (6), `LoginModal.tsx` (5), `PlayerPersonalTab.tsx` (3), `bao-cao-tai-chinh/page.tsx` (3), `nha-tai-tro/page.tsx` (3), `hoat-dong/page.tsx` (2), `AvatarCropperModal.tsx` (2), `AnalyticsCenterTab.tsx` (1), `PwaManager.tsx` (1), `layout.tsx` (1), `offline/page.tsx` (1). |
| **UX-09** | Bubble radius (`rounded-3xl`, `>12px`) | **PARTIALLY RESOLVED** | `rounded-3xl` is completely eliminated (`visualPolishPhase36.test.ts`). **Still Open**: `rounded-2xl` (16px) still appears 17 times across 10 files (`hoat-dong/page.tsx`, `hoat-dong/[id]/page.tsx`, `cau-thu/[id]/page.tsx`, `PublicGuestPortal.tsx`, `ClubPostsTab.tsx`, `ScheduleTab.tsx`, `LoginModal.tsx`, `MatchdayRosterPoster.tsx`, `PlayerProfileClient.tsx`, `ImageLightboxModal.tsx`), and `globals.css:374,389` uses `1rem`/`1.25rem` on `<dialog>`. |
| **UX-10** | Banner dot touch target (`min-h-6 min-w-6`) | **RESOLVED** | `PublicGuestPortal.tsx:923` uses `min-h-11 min-w-11` (44×44px) with `focus-visible:outline-focus-on-dark` and `aria-current`. |
| **UX-11** | `.bg-brand-navy` `!important` override | **RESOLVED** | `globals.css:47-57` places `.bg-brand-navy` and `.bg-brand-navy-mid` inside `@layer components` with zero `!important`. |

---

## 3. Complete UX Audit by User Role

### 3.1 Guest / Fan
- **Inspected**: `PublicGuestPortal.tsx` (2,162 lines), `BroadcastAthleteCard.tsx` (813 lines), `MatchdayRosterPoster.tsx` (365 lines), `PlayerProfileClient.tsx` (291 lines), `/hoat-dong/page.tsx`, `/hoat-dong/[id]/page.tsx`, `/bao-cao-tai-chinh/page.tsx`, `/nha-tai-tro/page.tsx`, `/cau-chuyen-go-noi/page.tsx`, `/cau-thu/[id]/page.tsx`.
- **Strengths**:
  - Strong club identity (`Xã Gò Nổi • TP. Đà Nẵng` in header/footer; `Điện Quang - Điện Trung - Điện Phong` preserved in story & athlete cards).
  - Clear visual hierarchy on `/` with `Barlow Condensed` display headings, `100svh` hero, matchday scoreboard, 50/50 athlete showcase + searchable roster, magazine-style activities, sponsor tiers, and public financial transparency link (`/bao-cao-tai-chinh`).
- **Friction & Findings**:
  - **G-01 (P0)**: `MatchdayRosterPoster.tsx:102` opens a full-screen modal without `<dialog>`, `role="dialog"`, `aria-modal`, `Escape` close, or focus trap.
  - **G-02 (P1)**: `PublicGuestPortal.tsx:554-633` renders the mobile navigation drawer as a plain `<div>` without `role="dialog"`, `aria-modal`, `Escape` handler, or focus trap; hamburger trigger at `PublicGuestPortal.tsx:541-549` uses `p-2` (~36×36px, below 44×44px).
  - **G-03 (P1)**: `src/app/cau-thu/[id]/page.tsx:74-96` player-not-found state omits `skip-link` and `<main id="main-content">`.
  - **G-04 (P2)**: Raw `<img>` elements in `PublicGuestPortal.tsx`, `hoat-dong/page.tsx`, `hoat-dong/[id]/page.tsx` bypass `next/image` (only `SponsorsTab.tsx:4` uses `next/image`), missing automatic responsive `srcset` optimization.
  - **G-05 (P2)**: `rounded-2xl` (16px) in `PublicGuestPortal.tsx:820,1914,1936`, `hoat-dong/page.tsx:237,498,589`, `hoat-dong/[id]/page.tsx:255,353,401`, `PlayerProfileClient.tsx:157` drifts from the 8–12px radius standard.

### 3.2 Player
- **Inspected**: `TeamManagerApp.tsx` (nav, security banner, toast), `ScheduleTab.tsx` (RSVP, upcoming vs. finished), `PlayerPersonalTab.tsx` (profile, gallery, change PIN), `PlayersTab.tsx` (roster), `MatrixTab.tsx`, `DashboardTab.tsx`.
- **Strengths**:
  - Mobile Bottom Navigation Bar (`TeamManagerApp.tsx:880-950`) puts `Điểm danh`, `Đội hình`, `Cá nhân`, `Quỹ đội`, and `Thêm` within thumb reach with `safe-bottom`.
  - Default-PIN security alert banner (`TeamManagerApp.tsx:681-705`) guides players to change PIN immediately.
  - `MatrixTab.tsx:212-360` provides sticky player name column and mobile scroll guidance.
- **Friction & Findings**:
  - **P-01 (P1)**: `TeamManagerApp.tsx:673` toast close button is `h-7 w-7` (28×28px); `TeamManagerApp.tsx:652-678` toast is coupled to `TeamManagerApp.tsx` rather than a reusable UI primitive, and error calls at `TeamManagerApp.tsx:344,353,361` omit the `"error"` variant (rendering navy/gold instead of danger styling).
  - **P-02 (P1)**: `ScheduleTab.tsx:2415,2427,2435` and `PlayerPersonalTab.tsx:1023,1035,1043` use `h-7 w-7` (28×28px) action buttons on gallery cards.
  - **P-03 (P1)**: `ScheduleTab.tsx` (2,783 lines) duplicates the entire player profile/gallery/cropper modal from `PlayerPersonalTab.tsx` (1,341 lines), risking UX divergence when editing personal info from Schedule vs. Personal tab.
  - **P-04 (P2)**: `TeamManagerApp.tsx:954-962` Mobile More Menu uses `useDialogA11y` on a `<div role="dialog">` rather than native `<dialog showModal()>`.

### 3.3 Manager
- **Inspected**: `DashboardTab.tsx`, `AnalyticsCenterTab.tsx`, `ScheduleTab.tsx`, `CollectionTab.tsx`, `FinanceTab.tsx`, `PlayersTab.tsx`, `SponsorsTab.tsx`, `ClubPostsTab.tsx`, `TeamManagerApp.tsx` (Excel import/export).
- **Strengths**:
  - `CollectionTab.tsx` local draft engine (`0ms` optimistic UI + bottom batch bar + `ConfirmDialog` / single-transaction `collect_match_fees_batch`) prevents lag and accidental partial writes.
  - `FinanceTab.tsx` has mobile card fallbacks (`md:hidden` at lines 719, 992) and `tabular-nums` alignment.
  - Strict CSRF & Manager RBAC boundaries are preserved across all actions.
- **Friction & Findings**:
  - **M-01 (P1)**: Touch targets on dense manager controls drop below 44px on mobile: `FinanceTab.tsx:891,905,1156,1170` (`min-h-9 min-w-9` = 36×36px edit/delete buttons), `CollectionTab.tsx:504,545,649,907` (`min-h-9` = 36px filter/quick-select buttons), `PlayersTab.tsx:648,833` (`min-h-8` = 32px) and `1599,1611` (`h-7 w-7` = 28×28px).
  - **M-02 (P1)**: Excel Import/Export controls (`TeamManagerApp.tsx:540-567`) are `hidden md:inline-flex` in the top header; on mobile (`360px`/`390px`), managers must open the "Thêm" drawer to find them, and there is no inline validation summary modal when `/api/import` returns HTTP 400 (only a transient 4s toast at `TeamManagerApp.tsx:297`).
  - **M-03 (P2)**: `ClubPostsTab.tsx:391,472` and `ScheduleTab.tsx:1161` use `rounded-2xl` (16px) instead of `rounded-xl` (12px).

---

## 4. Accessibility & Responsive Audit (WCAG 2.2 AA)

| Criterion | Status | Source-Code Evidence & Gaps |
| :--- | :---: | :--- |
| **Keyboard Navigation & Focus Trap** | **PARTIAL** | `useDialogA11y.ts` traps Tab/Shift+Tab, handles `Escape`, and restores focus for `ModalDialog`, `LoginModal`, `ImageLightboxModal`, `AvatarCropperModal`, and `TeamManagerApp` Mobile More Menu. **Gaps**: `MatchdayRosterPoster.tsx:102` and `PublicGuestPortal.tsx:554` lack focus trap and `Escape` handling. |
| **Focus Visibility & Contrast (`>= 3:1`)** | **PASS** | `globals.css:42-44,227-249` + `contrastPhase351.test.ts` verify `#092244` on light (`>12:1`), `#ffd700` on dark (`>9:1`), `#ffffff` halo (`>=3:1`), and `forced-colors: active` fallback. Zero `focus:outline-none` suppressions. |
| **Text Contrast (`>= 4.5:1`)** | **PASS (Core)** | `--color-ink-primary` (`#092244`), `--color-ink-secondary` (`#334155`), `--color-ink-muted` (`#64748b`), and `--color-gold-700` (`#8a6d14`) pass `>=4.5:1` on white/amber-50 (`contrastPhase351.test.ts:90-96`). *Note*: `text-sky-200/70` or `text-slate-900/60` on gold gradient (`PublicGuestPortal.tsx:628,2095`) should be verified visually in Phase 6.2/6.5. |
| **Touch Targets (`44×44px` on mobile)** | **PARTIAL** | `Button` `md` (`min-h-11`), `FormControls` (`min-h-11`), and banner dots (`min-h-11 min-w-11`) meet 44px. **Gaps**: `h-7 w-7` (`TeamManagerApp.tsx:673`, `ScheduleTab.tsx:2415+`, `PlayerPersonalTab.tsx:1023+`, `PlayersTab.tsx:1599+`), `p-2` hamburger (`PublicGuestPortal.tsx:546`), `min-h-8` (`PlayersTab.tsx:648,833`), `min-h-9` (`FinanceTab.tsx:891+`, `CollectionTab.tsx:504+`). |
| **Reduced Motion** | **PARTIAL** | `globals.css:203-225` disables `.gn-*`, `.tab-enter`, `.sc-hologram-sweep`, and button transitions. **Gap**: Tailwind utilities `animate-pulse` (`PublicGuestPortal.tsx:690`), `animate-spin` (`Button.tsx:74`, `StateViews.tsx:22`), and `animate-fade-in` (`LoginModal.tsx:131`) are not suppressed globally under `@media (prefers-reduced-motion: reduce)`. |
| **Landmarks & Skip Links** | **PARTIAL** | All main routes have `skip-link`, `<main id="main-content">`, `<h1>`, and `<nav aria-label>` except `src/app/cau-thu/[id]/page.tsx:74-96` (not-found fallback). |
| **200% Zoom / Reflow / Mobile Tables** | **PASS (Source)** | `globals.css:110` sets `overflow-x: clip`; `.ds-table-wrap` isolates table horizontal scroll; `FinanceTab` uses `md:hidden` mobile cards; `MatrixTab` uses sticky first column. |

### Responsive Viewport Matrix (`360×800`, `390×844`, `768×1024`, `1440×900`)
*Note: Visual rendering in a live browser was not executed in Phase 6.1; matrix reflects source-code layout inspection.*

| Surface / Flow | `360×800` & `390×844` (Mobile) | `768×1024` (Tablet) | `1440×900` (Desktop) |
| :--- | :--- | :--- | :--- |
| **Public Portal (`/`)** | 1-col stack, sticky quick-jump, hamburger drawer (**Gap**: drawer lacks focus-trap; hamburger 36px) | 2-col grids, `md:` spacing | `max-w-[1600px]` broadcast layout, 50/50 athlete showcase |
| **Workspace Shell** | Sticky header + fixed `safe-bottom` 5-tab bar + More drawer (**Gap**: toast close `28px`, import error toast transient) | `md:flex` top tabs + Excel import/export visible | `max-w-7xl` centered workspace |
| **Schedule & RSVP** | `min-h-11` primary RSVP buttons (**Gap**: gallery `h-7 w-7` buttons) | Responsive 2-col match layout | Full matchday + roster management |
| **Collection & Finance** | `md:hidden` Finance cards, bottom batch bar (**Gap**: `min-h-9` edit/delete/filter buttons) | Scrollable `.ds-table-wrap` | Full tabular ledger with `tabular-nums` |
| **Matrix** | `.sticky-col` (`132–164px` max-width) + mobile scroll hint | `.sticky-col` + horizontal scroll | Full player × match matrix |

---

## 5. Technical UX & Performance Findings

1. **Component Monoliths & Duplication (P1)**:
   - `ScheduleTab.tsx` (2,783 lines), `PublicGuestPortal.tsx` (2,162 lines), `PlayersTab.tsx` (1,964 lines), `FinanceTab.tsx` (1,645 lines), `PlayerPersonalTab.tsx` (1,341 lines), `TeamManagerApp.tsx` (1,150 lines).
   - The player profile/avatar/gallery editor is duplicated across `ScheduleTab.tsx`, `PlayerPersonalTab.tsx`, and `PlayersTab.tsx`.
2. **Image Optimization (P2)**:
   - Only `SponsorsTab.tsx:4` uses `next/image`; public pages and `BroadcastAthleteCard.tsx` use raw `<img>`, missing Next.js responsive `srcset` and automatic sizing.
3. **Toast & Error Feedback (P1)**:
   - `TeamManagerApp.tsx:652-678` embeds toast UI directly inside the root shell and lacks a persistent error-detail view for multi-line `/api/import` validation errors.

---

## 6. Priority Issue Summary (New & Open)

| Priority | ID | Issue | Primary Location(s) | Target Phase |
| :---: | :--- | :--- | :--- | :---: |
| **P0** | **A11Y-01** | `MatchdayRosterPoster` modal lacks `<dialog>` / `useDialogA11y` focus-trap & `Escape` | `src/components/MatchdayRosterPoster.tsx:102` | Phase 6.3 |
| **P1** | **A11Y-02** | `PublicGuestPortal` mobile drawer lacks `role="dialog"` / focus-trap / `Escape` | `src/components/PublicGuestPortal.tsx:554-633` | Phase 6.3 |
| **P1** | **A11Y-03** | Sub-44px mobile touch targets (`h-7 w-7`, `min-h-8`, `min-h-9`, `p-2`) | `TeamManagerApp.tsx:673`, `PublicGuestPortal.tsx:546`, `ScheduleTab.tsx:2415+`, `PlayerPersonalTab.tsx:1023+`, `PlayersTab.tsx:648,833,1599+`, `FinanceTab.tsx:891+`, `CollectionTab.tsx:504+` | Phase 6.3 |
| **P1** | **A11Y-04** | `cau-thu/[id]` not-found fallback missing `skip-link` & `<main id="main-content">` | `src/app/cau-thu/[id]/page.tsx:74-96` | Phase 6.3 |
| **P1** | **A11Y-05** | `prefers-reduced-motion` does not suppress Tailwind `animate-pulse` / `animate-spin` / `animate-fade-in` | `src/app/globals.css:203-225` | Phase 6.2 |
| **P1** | **DS-01** | 245+ hardcoded HEX colors remain in non-guarded TSX files | `BroadcastAthleteCard.tsx`, `PublicGuestPortal.tsx`, `TeamManagerApp.tsx`, `ScheduleTab.tsx`, `ClubPostsTab.tsx`, `LoginModal.tsx`, etc. | Phase 6.2 / 6.4 |
| **P1** | **DS-02** | `rounded-2xl` (16px) & dialog `1rem`/`1.25rem` drift from 8–12px radius rule | 10 TSX files + `src/app/globals.css:374,389` | Phase 6.2 / 6.4 |
| **P1** | **UX-12** | `TeamManagerApp` toast `showToast` missing `"error"` variant on lines 344, 353, 361; no shared `Toast` primitive | `src/components/TeamManagerApp.tsx:344,353,361,652-678` | Phase 6.2 / 6.4 |
| **P1** | **TECH-01** | Duplicated player profile/gallery editor & >1,300-line tab monoliths | `ScheduleTab.tsx`, `PlayerPersonalTab.tsx`, `PlayersTab.tsx`, `PublicGuestPortal.tsx`, `FinanceTab.tsx` | Phase 6.4 / 6.5 |
| **P2** | **PERF-01** | Raw `<img>` instead of `next/image` on public pages & athlete cards | `PublicGuestPortal.tsx`, `BroadcastAthleteCard.tsx`, `hoat-dong/page.tsx` | Phase 6.5 |
