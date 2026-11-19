# Phase 6.1 — Component & Route Inventory

- **Repository**: `nguyenthetiengit01-collab/FCHDHGoNoi`
- **Baseline**: `main` @ `0e17ce9a708634a9af9f9bb99bd75fc20c534402`

---

## 1. Design System Primitives (`src/components/ui/` & Core Dialogs)

| Component | File | Lines | Status | Notes |
| :--- | :--- | :---: | :--- | :--- |
| `Button` | `src/components/ui/Button.tsx` | 92 | Adopted in 11 tabs | `sm` size is `min-h-9` (needs `min-h-11 sm:min-h-9` for mobile 44px target). |
| `Card`, `CardHeader`, `CardTitle`, `StatCard` | `src/components/ui/Card.tsx` | 147 | Adopted in workspace | Zero hardcoded HEX; `rounded-xl` (12px). |
| `Badge`, `PositionBadge` | `src/components/ui/Badge.tsx` | 93 | Adopted in workspace | Supports `surface="light \| dark"`; 5 position tones (`GK`, `DF`, `MF`, `FW`, `ĐN`). |
| `FormField`, `Input`, `Select`, `Textarea`, `useFieldIds` | `src/components/ui/FormControls.tsx` | 176 | Adopted in workspace | Auto-wires `id`, `aria-describedby`, `aria-invalid`, `hasError`. |
| `LoadingState`, `EmptyState`, `ErrorState`, `ConfirmDialog` | `src/components/ui/StateViews.tsx` | 146 | Partial adoption | `ConfirmDialog` used everywhere (`0` native popups); `LoadingState`/`ErrorState` underused in `ClubPostsTab`/`SponsorsTab`. |
| `ModalDialog` | `src/components/ModalDialog.tsx` | 90 | Active | Native `<dialog showModal()>` + `useDialogA11y`; should be re-exported from `@/components/ui`. |
| `useDialogA11y` | `src/components/useDialogA11y.ts` | 280+ | Active | Focus trap, `Escape`, scroll-lock, focus restoration. |
| `Toast` *(Missing)* | `TeamManagerApp.tsx:652-678` | — | **To Extract** | Currently inline in `TeamManagerApp.tsx` with `h-7 w-7` close button. |

---

## 2. Application Components (`src/components/`)

| Component | Lines | `@/components/ui` | Hardcoded HEX | `rounded-2xl` | Dialog / A11y Status | Priority |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| `ScheduleTab.tsx` | 2,783 | Yes | 11 | 1 | `ModalDialog` + `ConfirmDialog`; **duplicates profile/gallery editor**; `h-7 w-7` gallery actions | **P1** (Split monolith & touch targets) |
| `PublicGuestPortal.tsx` | 2,162 | No | 63 | 3 | Mobile drawer lacks `role="dialog"` / `useDialogA11y`; hamburger `p-2` (36px); raw `<img>` | **P1** (Drawer a11y, tokens, split) |
| `PlayersTab.tsx` | 1,964 | Yes | 0 | 0 | `ModalDialog` + `ConfirmDialog`; `min-h-8` / `h-7 w-7` secondary buttons; **duplicates profile/gallery editor** | **P1** (Extract shared editor, touch targets) |
| `FinanceTab.tsx` | 1,645 | Yes | 0 | 0 | Mobile cards (`md:hidden`); `min-h-9 min-w-9` edit/delete icons on mobile | **P1** (Touch targets, split) |
| `PlayerPersonalTab.tsx` | 1,341 | Yes | 3 | 0 | `h-7 w-7` gallery actions; **duplicates profile/gallery editor** | **P1** (Extract shared editor, touch targets) |
| `TeamManagerApp.tsx` | 1,150 | No | 17 | 0 | `useDialogA11y` on `<div role="dialog">` drawer; `h-7 w-7` toast close; 3 `showToast` calls missing `"error"` | **P1** (Extract `Toast`, fix error variant) |
| `DashboardTab.tsx` | 1,124 | Yes | 0 | 0 | Clean tokens (`0` HEX, `0` `rounded-2xl`) | **P2** (Optional split) |
| `CollectionTab.tsx` | 1,053 | Yes | 0 | 0 | Clean tokens; `min-h-9` filter/quick-select buttons | **P1** (Mobile touch targets) |
| `ClubPostsTab.tsx` | 931 | Yes | 6 | 2 | `ConfirmDialog` used; `rounded-2xl` (2), 6 HEX | **P2** (Token/radius cleanup) |
| `BroadcastAthleteCard.tsx` | 813 | No | 88 | 0 | Public dark card; heavy inline hex & raw `<img>` | **P1** (Token consolidation) |
| `AnalyticsCenterTab.tsx` | 776 | Yes | 1 | 0 | Clean structure; 1 HEX | **P2** (Minor token cleanup) |
| `AvatarCropperModal.tsx` | 752 | No | 2 | 0 | Native `<dialog>` + `useDialogA11y` | **P2** (Radius alignment) |
| `SponsorsTab.tsx` | 684 | Yes | 0 | 0 | Only component using `next/image`; clean tokens | **P2** (Consistent `LoadingState`) |
| `MatrixTab.tsx` | 420 | Yes | 0 | 0 | Sticky first column + scroll hint; clean tokens | **Done** |
| `LoginModal.tsx` | 375 | No | 5 | 1 | Native `<dialog>` + `useDialogA11y`; 5 HEX, `1` `rounded-2xl` | **P2** (Token/radius cleanup) |
| `MatchdayRosterPoster.tsx` | 365 | No | 39 | 1 | **Plain `<div>` modal without `<dialog>` / `useDialogA11y`** (HEX justified for PNG export) | **P0** (Add `useDialogA11y` / `<dialog>`) |
| `PlayerProfileClient.tsx` | 291 | No | 6 | 1 | Has `skip-link`, `<main>`, `<h1>`; 6 HEX, `1` `rounded-2xl` | **P2** (Token/radius cleanup) |
| `ImageLightboxModal.tsx` | 220 | No | 0 | 1 | Native `<dialog>` + `useDialogA11y`; `1` `rounded-2xl` | **P2** (Radius alignment) |
| `PwaManager.tsx` | 219 | No | 1 | 0 | Service worker & install prompt | **P2** |
| `PlayerInsights.tsx` | 108 | Yes | 0 | 0 | Clean | **Done** |

---

## 3. App Router Pages (`src/app/`)

| Route | File | Lines | `skip-link` | `<main id="main-content">` | `<h1>` | `<footer>` | Notes |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `/` | `src/app/page.tsx` → `TeamManagerApp` | 48 | Yes | Yes | Yes | Yes | Guest Portal or Workspace depending on session. |
| `/hoat-dong` | `src/app/hoat-dong/page.tsx` | 681 | Yes | Yes | Yes | Yes | Has `3` `rounded-2xl` and `2` HEX. |
| `/hoat-dong/[id]` | `src/app/hoat-dong/[id]/page.tsx` | 441 | Yes | Yes | Yes | Yes | Has `3` `rounded-2xl`. |
| `/cau-thu/[id]` | `src/app/cau-thu/[id]/page.tsx` | 117 | **No (fallback)** | **No (fallback)** | **No (fallback)** | No | Valid player delegates to `PlayerProfileClient` (has all landmarks); not-found branch (`lines 74-96`) lacks `skip-link` & `<main>`. |
| `/bao-cao-tai-chinh` | `src/app/bao-cao-tai-chinh/page.tsx` | 532 | Yes | Yes | Yes | Yes | Has `3` HEX; good `tabular-nums`. |
| `/nha-tai-tro` | `src/app/nha-tai-tro/page.tsx` | 380 | Yes | Yes | Yes | Yes | Has `3` HEX. |
| `/cau-chuyen-go-noi` | `src/app/cau-chuyen-go-noi/page.tsx` | 329 | Yes | Yes | Yes | No | Clean (`0` HEX, `0` `rounded-2xl`). |
| `/offline` | `src/app/offline/page.tsx` | 61 | Yes | Yes | Yes | No | Has `1` HEX. |
