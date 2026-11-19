# Phase 6.1 — Unified Design System Specification (Delta & Consolidation)

- **Project**: FC HĐH Gò Nổi tại TP.HCM (`FCHDHGoNoi`)
- **Baseline**: `main` @ `0e17ce9a708634a9af9f9bb99bd75fc20c534402`
- **Source of Truth**: `AGENTS.md`, `src/app/globals.css`, `src/components/ui/`
- **Principle**: Evolve and consolidate existing `@theme` and `:root` tokens — do **not** create a parallel design system.

---

## 1. Brand Identity & 70-25-5 Visual Rule

- **70% Surface & Backdrop**: Deep Sport Navy (`#040e1a` → `#081a33` → `#0b2447`) for Public Broadcast pages; Technical Slate (`#f1f5f9` / `#ffffff`) for high-density Player/Manager Workspace.
- **25% Typography & Technical Borders**: High-contrast Slate/White (`#092244` on light, `#f8fafc`/`#cbd5e1` on dark, `border-white/10`, `border-slate-200`).
- **5% Brand Accents**: Royal Gold (`#d4af37` / `#ffd700` / `#fde047`) & Pitch Emerald (`#059669` / `#10b981`).
- **Anti-AI-Template Guardrails**: Zero generic purple-pink gradients; sharp `8px–12px` corners (`rounded-lg`, `rounded-[10px]`, `rounded-xl`); `tabular-nums` on all financial/match numbers; `Barlow Condensed` uppercase display headers.
- **Geographic Identity**: Club-wide label `Xã Gò Nổi • TP. Đà Nẵng`; player hometown badges preserve `Điện Phong - Điện Trung - Điện Quang`.

---

## 2. Color Palette & Semantic Tokens (`src/app/globals.css`)

### 2.1 Existing `@theme` Primitives (Keep & Enforce)
| Group | Token | Hex | Usage |
| :--- | :--- | :--- | :--- |
| **Navy Scale** | `--color-navy-950` | `#040e1a` | Deepest public/footer backdrop |
| | `--color-navy-900` | `#081a33` | Public portal primary surface |
| | `--color-navy-800` | `#092244` | Dark card base / primary ink on light |
| | `--color-navy-700` | `#0b2447` | Elevated dark card / mobile nav bar |
| | `--color-navy-600` | `#0d2e5b` | Brand primary button / active header |
| | `--color-navy-500` | `#17488c` | Hover / secondary navy |
| | `--color-royal-600` / `500` | `#1e4fc2` / `#2f66dd` | Broadcast accent gradients |
| **Gold Scale** | `--color-gold-300` | `#fde047` | Highlight text on dark navy |
| | `--color-gold-400` | `#ffd700` | Active borders & dark focus ring |
| | `--color-gold-500` | `#d4af37` | Primary Royal Gold accent |
| | `--color-gold-600` | `#b89635` | Gold button border / hover |
| | `--color-gold-700` | `#8a6d14` | Accessible Gold text on light (`>=4.5:1` on `#fffbeb`) |
| **Light Workspace** | `--color-surface-page` | `#f1f5f9` | Workspace page background |
| | `--color-surface-card` | `#ffffff` | Card, table, input surface |
| | `--color-surface-subtle` | `#f8fafc` | Subtle header/empty surface |
| | `--color-ink-primary` | `#092244` | Primary text (`>12:1` on white) |
| | `--color-ink-secondary` | `#334155` | Secondary labels (`>9:1` on white) |
| | `--color-ink-muted` | `#64748b` | Muted metadata (`>=4.7:1` on white) |
| | `--color-line-default` / `subtle` | `#cbd5e1` / `#e2e8f0` | Input & card borders |
| **Feedback** | `--color-feedback-success` | `#059669` | Paid / attending / success |
| | `--color-feedback-warning` | `#d97706` | Pending / default PIN warning |
| | `--color-feedback-danger` | `#dc2626` | Unpaid / error / destructive |
| | `--color-feedback-info` | `#0284c7` | Info / Facebook / DF accent |
| **Focus (WCAG 2.2)** | `--color-focus-on-light` | `#092244` | `>=3:1` on all light/slate surfaces |
| | `--color-focus-on-dark` | `#ffd700` | `>=3:1` on all navy-950..600 surfaces |
| | `--color-focus-halo` | `#ffffff` | Outer dual-ring halo (`>=3:1` on dark buttons) |

### 2.2 Phase 6 Delta Tokens to Add (Consolidating Hardcoded Hex)
- `--color-navy-975: #030912` / `--color-navy-850: #071933` (or normalize `#061730`, `#06182f`, `#050e20` in `PublicGuestPortal.tsx` & `PlayerProfileClient.tsx` to `navy-950` / `navy-900` / `navy-800`).
- `--color-gold-450: #e6c466` (or consolidate button hover `#e5c14d` / `#e6c466` to `gold-400` / `gold-500`).
- **Exception**: `MatchdayRosterPoster.tsx` (39 hex) and `BroadcastAthleteCard.tsx` export-safe SVG/canvas layers may retain explicit hex constants inside a single documented palette constant when required by `html-to-image` / Canvas rendering.

---

## 3. Typography

- **Display Font**: `Barlow Condensed` (`--font-display`, weights `600`, `700`, `800`, subsets `latin`, `vietnamese`, `display: "swap"` in `src/app/layout.tsx:12-17`), applied via `.font-display` (`uppercase tracking-tight`).
- **Body Font**: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` (`src/app/globals.css:107`), `line-height: 1.5`, `antialiased`.
- **Tabular Numbers**: Mandatory `tabular-nums` on all VND amounts, match scores, jersey numbers, dates, and attendance counts.
- **Responsive Type Scale**:
  - Hero Display: `clamp` / responsive `text-[18vw] sm:text-[14vw] lg:text-[11rem]–[13rem]` (leading `0.82`).
  - Page `<h1>` (Workspace / Standalone): `text-xl sm:text-3xl font-extrabold tracking-tight`.
  - Section `<h2>`: `text-lg sm:text-2xl font-bold`.
  - Card `<h3>`: `text-base sm:text-lg font-bold` (`CardTitle`).
  - Body: `text-sm sm:text-base` (`14px–16px`); Form controls: `0.9375rem` (`15px`, prevents iOS auto-zoom while staying readable); Micro labels: `text-xs` (`12px`, avoid `<11px` for essential copy).

---

## 4. Layout, Spacing & Border Radius

- **Container Widths**:
  - Public Broadcast Portal: `max-w-[1600px] px-5 sm:px-10 lg:px-16` (`WRAP`).
  - Workspace & Standalone Subpages: `max-w-7xl mx-auto px-3 sm:px-6`.
- **Spacing Scale**: Standard Tailwind `4px` base (`gap-2`, `gap-3`, `gap-4`, `p-4 sm:p-5` for cards, `space-y-5` between workspace sections, `py-14 sm:py-20` between public sections).
- **Breakpoints**: Mobile-first `<640px` (`360×800`, `390×844`), `sm: 640px`, `md: 768px` (`768×1024`), `lg: 1024px`, `xl: 1280px` (`1440×900`).
- **Mobile Safe Areas**: `viewportFit: "cover"` (`layout.tsx:67`), `pt-[env(safe-area-inset-top)]` (`TeamManagerApp.tsx:497`), `.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }` (`globals.css:358-360`), `pb-20 md:pb-8` on authenticated shell to clear the fixed bottom nav.
- **Border Radius Contract (Strict 8px–12px)**:
  - Small chips/badges: `rounded-md` (`6px` in Tailwind v4 utility / `0.375rem`).
  - Buttons, inputs, selects, tabs: `rounded-lg` (`8px`) or `rounded-[10px]` (`10px`).
  - Cards, modals, tables: `rounded-xl` (`12px`).
  - **Prohibited**: `rounded-2xl` (`16px`) and `rounded-3xl` (`24px`) on cards/containers; `dialog:modal` in `globals.css:374,389` should be aligned from `1rem`/`1.25rem` to `0.75rem` (`12px`). `rounded-full` is reserved strictly for circular avatars and 8–10px status dots.

---

## 5. Component Standards (`src/components/ui/`)

| Component | Contract & Variants | Phase 6 Evolution Required |
| :--- | :--- | :--- |
| **`Button`** | `primary \| secondary \| gold \| outline \| ghost \| danger`; `sm \| md \| lg`; `loading` (`aria-busy`); `leftIcon`/`rightIcon`. | Enforce `min-h-11` (`44px`) on mobile for all interactive buttons (including `sm` on `<640px`: `min-h-11 sm:min-h-9`). Add `surface="dark"` variant or dark-surface focus ring support. |
| **`Card` / `StatCard`** | `default \| navy \| subtle` (`rounded-xl`); `StatCard` with `navy \| emerald \| rose \| amber \| gold \| sky` left accent + `tabular-nums`. | Adopt in `ClubPostsTab`, `SponsorsTab`, `PlayerPersonalTab` where raw card divs remain. |
| **`Badge` / `PositionBadge`** | `neutral \| navy \| gold \| success \| warning \| danger \| info \| purple`; `surface="light \| dark"`. `GK` Emerald, `DF` Blue, `MF` Amber, `FW` Rose, `ĐN` Purple. | Adopt `PositionBadge` consistently in `BroadcastAthleteCard` and `PlayersTab`. |
| **`Input`, `Select`, `Textarea`, `FormField`** | `min-h-11` (`44px`), `hasError`, auto `id`, `aria-describedby`, `aria-invalid`. | Adopt across `LoginModal`, `ScheduleTab`, `ClubPostsTab`, `SponsorsTab`, `PlayerPersonalTab`. |
| **`Table` (`.ds-table-wrap` / `.matrix-table`)** | Horizontal scroll containment (`overscroll-behavior-x: contain`), sticky first column on Matrix, `md:hidden` card view for wide ledgers (`FinanceTab`). | Add reusable `<DataTable>` / mobile card pattern guidance so `PlayersTab` and `CollectionTab` stay consistent. |
| **`Dialog` / `Modal` (`ModalDialog` + `useDialogA11y`)** | Native `<dialog showModal()>`, `aria-labelledby`, `closedby="any"`, `useDialogA11y` focus-trap/restore, `12px` (`rounded-xl`) radius. | Migrate `MatchdayRosterPoster` and `PublicGuestPortal` mobile drawer to `useDialogA11y` / `<dialog>`; promote `ModalDialog` into `@/components/ui`. |
| **`Toast` (New UI Primitive)** | `status` (`aria-live="polite"`) for success/info, `alert` (`aria-live="assertive"`) for errors, `min-h-11 min-w-11` close button. | Extract from `TeamManagerApp.tsx:652-678` into `src/components/ui/Toast.tsx`; fix missing `"error"` variant calls at `TeamManagerApp.tsx:344,353,361`. |
| **`LoadingState` / `EmptyState` / `ErrorState` / `ConfirmDialog`** | Unified state views in `ui/StateViews.tsx`. | Adopt `LoadingState` / `ErrorState` uniformly across `ClubPostsTab`, `SponsorsTab`, `PlayerPersonalTab`, and import error summary. |

---

## 6. Visual Interaction & Accessibility States

- **Hover**: Subtle surface/border shift (`hover:bg-navy-500`, `hover:border-gold-500`), zero layout shift.
- **Active**: `scale(0.98)` on buttons (disabled under `prefers-reduced-motion: reduce`).
- **Focus-visible**: `2px solid var(--focus-on-light)` + `2px` white halo on light surfaces; `2px solid var(--focus-on-dark)` (`#ffd700`) on dark navy surfaces; `Highlight` under `forced-colors: active`.
- **Disabled / Loading**: `opacity: 0.55–0.6`, `cursor: not-allowed`, `aria-busy="true"` + `Loader2` spinner on loading buttons.
- **Reduced Motion**: Extend `globals.css:203-225` so `@media (prefers-reduced-motion: reduce)` also disables `.animate-pulse`, `.animate-spin` (or slows/replaces decorative spins), and `.animate-fade-in`.
