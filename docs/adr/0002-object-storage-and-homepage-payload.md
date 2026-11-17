# ADR 0002: Object Storage Media Offload & Minimal Public Homepage Payload

- **Status**: Accepted (Workstream B — Phase 4.4.3)
- **Date**: 2026-11-17

## Context
Measurement of Production `/` (`dpl_D1NKXYsYXp5GWZbtfZPtm7i2uvPH`) showed ~14.44 MB uncompressed HTML (`11.35 MB` serialized `self.__next_f` RSC payload) and 3.69s–7.48s TTFB because:
1. `HomePage` (`src/app/page.tsx`) called `getFullAppData()` for unauthenticated guests, serializing `SELECT *` rows (including full article `paragraphs_json`, full `gallery_urls_json` / `gallery_images_json`, and ledger structures) into `TeamManagerApp`.
2. Uploaded images were stored in Turso/SQLite as inline `data:image/webp;base64,...` strings (103 data URIs embedded in `/`).

## Decisions
1. **Minimal Public Homepage DTO (`getPublicHomePageData`)**: Guest requests to `/` run explicit SQL projections omitting `pin_code`, `phone`, `notes`, `paragraphs_json`, `gallery_urls_json`, `gallery_images_json`, `other_incomes`, `expenses`, and internal sponsor `note`, with `club_posts` bounded to 12 summaries.
2. **Legacy Compatibility Endpoint (`GET /api/media/legacy`)**: Any existing `data:image/...;base64,...` in public DB fields is mapped to `/api/media/legacy?entity=...&id=...&field=...` on homepage/public routes so `0` Base64 URIs appear in `/` HTML while legacy images continue rendering cleanly.
3. **Object Storage Abstraction (`MediaStorageProvider` / `@vercel/blob`)**: Public media uploads route through `POST /api/media/upload` (CSRF + session + RBAC + ownership + magic-byte validation + Sharp WebP normalization + deterministic PII-free pathname `public-media/<prefix>/<entity>/<sha256>.webp`).
4. **Media Visibility Policy**: Only public player, post, and sponsor media are eligible for public Blob storage (`visibility === "public"`). Private/financial documents are rejected (`403`).
5. **Feature Flag (`MEDIA_STORAGE_ENABLED`)**: Defaults to `false` to preserve Production behavior until `BLOB_READ_WRITE_TOKEN` is provisioned. When `true`, missing config fails closed (`503`), and `ensureWebpDataUrlServer` rejects new Base64 writes (`400`) with no silent Base64 fallback.
6. **Idempotent Migration & Rollback**: `migrateLegacyMedia` supports dry-run by default, content-hashed object keys, compare-and-swap DB updates, and safe orphan reporting on partial failure. Production CLI execution is blocked; rollback uses DB snapshot restoration without deleting legacy objects prematurely.

## Production Activation Prerequisites
1. Provision Vercel Blob store and configure `BLOB_READ_WRITE_TOKEN` on Vercel.
2. Take a Production DB backup (`scripts/db-backup.mjs`), migrate legacy Base64 fields under an authorized maintenance run, verify zero broken images, and only then set `MEDIA_STORAGE_ENABLED=true`.
