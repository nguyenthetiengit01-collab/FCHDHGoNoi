# Phase 6.2 — Implementation Log

- **Repository**: `nguyenthetiengit01-collab/FCHDHGoNoi`
- **Branch**: `feat/phase-6.2-premium-design-system`
- **Verified Base SHA (`main`)**: `e61107749b6b14763e6ee458fd60c5b6c0176090`
- **Scope**: Design token consolidation, border-radius alignment (`8–12px`), `prefers-reduced-motion` completion, `Toast` UI primitive extraction, and early P0 `A11Y-01` remediation (`MatchdayRosterPoster`). No DB schema, API, auth, financial, or import/export logic changes.

---

## 1. Design Tokens Added (`src/app/globals.css`)
- `@theme`: `--color-navy-975: #030912`, `--color-navy-850: #071933`, `--color-gold-450: #e6c466`.
- `:root` aliases: `--brand-navy-deepest: var(--color-navy-975)`, `--brand-navy-dark: var(--color-navy-850)`, `--brand-gold-light: var(--color-gold-450)`.
- Hardcoded HEX cleaned up to `0` occurrences across: `TeamManagerApp.tsx`, `ScheduleTab.tsx`, `PlayersTab.tsx`, `PlayerPersonalTab.tsx`, `FinanceTab.tsx`, `CollectionTab.tsx`, `ClubPostsTab.tsx`, `LoginModal.tsx`, `PlayerProfileClient.tsx`.

## 2. Border Radius Cleanup
- `src/app/globals.css`: Aligned `dialog:modal` (`1rem` → `0.75rem`), `dialog.cropper-dialog:modal` (`1.25rem` → `0.75rem`), and added `dialog.poster-dialog:modal` (`0.75rem`, `max-width: min(48rem, calc(100vw - 1.25rem))`).
- Replaced all `17` occurrences of `rounded-2xl` with `rounded-xl` across 10 TSX files (`src/app/cau-thu/[id]/page.tsx`, `src/app/hoat-dong/page.tsx`, `src/app/hoat-dong/[id]/page.tsx`, `src/components/ClubPostsTab.tsx`, `src/components/ImageLightboxModal.tsx`, `src/components/LoginModal.tsx`, `src/components/MatchdayRosterPoster.tsx`, `src/components/PlayerProfileClient.tsx`, `src/components/PublicGuestPortal.tsx`, `src/components/ScheduleTab.tsx`).
- Remaining `rounded-2xl` / `rounded-3xl` across `src/**/*.tsx`: **0**.

## 3. Reduced Motion (`src/app/globals.css`)
- Extended `@media (prefers-reduced-motion: reduce)` to suppress `.animate-pulse`, `.animate-spin`, and `.animate-fade-in` alongside `.gn-*`, `.tab-enter`, `.sc-hologram-sweep`, `scroll-behavior: auto !important`, and button/link transitions/active transforms.

## 4. Toast UI Extraction (`src/components/ui/Toast.tsx`)
- Created `src/components/ui/Toast.tsx` exporting `Toast` and `ToastVariant` (`"success" | "error"`):
  - Success: `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, `bg-navy-800`, `border-gold-500`.
  - Error: `role="alert"`, `aria-live="assertive"`, `aria-atomic="true"`, `bg-rose-950`, `border-rose-400`.
  - Close button: `min-h-11 min-w-11` (`>=44×44px`), `aria-label="Đóng thông báo"`.
- Exported `Toast`, `ToastProps`, `ToastVariant`, and `ModalDialog` from `src/components/ui/index.ts`.
- Updated `src/components/TeamManagerApp.tsx` to render `<Toast />` and pass `"error"` variant on `handleQuickSwitchRole` failure and catch branches while preserving `"success"` on successful login.

## 5. P0 Accessibility Hotfix (`src/components/MatchdayRosterPoster.tsx`)
- Migrated `MatchdayRosterPosterModal` from a plain `fixed inset-0` `<div>` overlay to native `<dialog>` with `useDialogA11y({ isOpen, onClose, containerRef: dialogRef, initialFocusRef: closeBtnRef })` (hooks declared prior to `if (!isOpen) return null`).
- Added `aria-modal="true"`, `aria-labelledby={titleId}`, safe outside pointer click handling, `min-h-11 min-w-11` close button with `aria-label="Đóng bảng điểm danh"`.
- Preserved `posterRef` on the inner poster element and `downloadElementAsPng(posterRef.current, filename, { pixelRatio: 2.5, quality: 0.98 })` untouched.

## 6. Regression Tests & Verification Commands
- Updated `src/lib/visualPolishPhase36.test.ts`, `src/lib/designTokensPhase35.test.ts`, and `src/lib/accessibilityPhase32.test.ts`.
- Created `src/lib/phase62DesignSystem.test.ts` (7 tests).
- Commands executed (`Node v22.23.5`, `MEDIA_STORAGE_ENABLED=false`, `ANALYTICS_ENABLED=false`):
  - `npm test -- --maxWorkers=1`: **38 test files passed, 317/317 tests passed**.
  - `npm run lint`: **Passed** (exit 0).
  - `npx tsc --noEmit`: **Passed** (exit 0).
  - `npm run build` (isolated `TEMP`/`TMP`/`TMPDIR`): **Passed** (exit 0, 16/16 static pages).

## 7. Known Limitations (Scoped to Later Phases)
- `MatchdayRosterPoster.tsx` (`posterRef`) and `BroadcastAthleteCard.tsx` retain explicit hex values where required for `html-to-image` PNG export; `PublicGuestPortal.tsx` and `BroadcastAthleteCard.tsx` token consolidation/decomposition remain scoped to **Phase 6.4**.
- Remaining P1 accessibility items (`PublicGuestPortal` mobile drawer `useDialogA11y`, `cau-thu/[id]` not-found `skip-link`, sub-44px mobile touch targets on secondary buttons) remain scoped to **Phase 6.3**.
- Live headless-browser visual QA across viewports (`360×800`, `390×844`, `768×1024`, `1440×900`) was not executed in Phase 6.2 and remains scoped to **Phase 6.5**.
