import crypto from "node:crypto";
import sharp from "sharp";
import type { AsyncDb } from "@/lib/db";
import type { MediaStorageProvider } from "./storage";
import {
  buildSafePublicMediaPathname,
  isDataImageUri,
  isSafeMediaUrl,
  parseAndValidateDataImageUri,
  type MediaEntityType,
} from "./validation";

export interface MigrationManifestEntry {
  table: "players" | "club_posts" | "sponsors";
  rowId: string | number;
  column: string;
  status:
    | "dry_run_candidate"
    | "migrated"
    | "skipped"
    | "invalid_data_uri"
    | "upload_failed"
    | "db_cas_conflict_or_failed";
  sha256?: string;
  pathname?: string;
  newUrl?: string;
  orphanUrl?: string;
  error?: string;
}

export interface LegacyMediaMigrationReport {
  dryRun: boolean;
  scannedRows: number;
  migratedFields: number;
  skippedFields: number;
  failedFields: number;
  orphanObjects: Array<{ table: string; rowId: string | number; column: string; url: string; pathname: string }>;
  entries: MigrationManifestEntry[];
}

async function normalizeToWebpBuffer(
  mimeType: string,
  buffer: Buffer
): Promise<Buffer> {
  if (mimeType === "image/webp") {
    return buffer;
  }
  return await sharp(buffer).rotate().webp({ quality: 85 }).toBuffer();
}

async function uploadSingleLegacyValue(params: {
  rawValue: string;
  entity: MediaEntityType;
  provider: MediaStorageProvider;
  dryRun: boolean;
}): Promise<
  | { ok: true; dryRun: true; sha256: string; pathname: string }
  | { ok: true; dryRun: false; sha256: string; pathname: string; url: string }
  | { ok: false; status: "invalid_data_uri" | "upload_failed"; error: string }
> {
  const parsed = parseAndValidateDataImageUri(params.rawValue);
  if (!parsed) {
    return {
      ok: false,
      status: "invalid_data_uri",
      error: "Invalid data:image URI or image bytes.",
    };
  }

  let webpBuffer: Buffer;
  try {
    webpBuffer = await normalizeToWebpBuffer(parsed.mimeType, parsed.buffer);
  } catch {
    return {
      ok: false,
      status: "invalid_data_uri",
      error: "Failed to decode image bytes.",
    };
  }

  const sha256 = crypto.createHash("sha256").update(webpBuffer).digest("hex");
  const pathname = buildSafePublicMediaPathname({
    entity: params.entity,
    buffer: webpBuffer,
    prefix: "migrated",
    extension: "webp",
  });

  if (params.dryRun) {
    return { ok: true, dryRun: true, sha256, pathname };
  }

  try {
    const uploaded = await params.provider.uploadPublicAsset({
      pathname,
      buffer: webpBuffer,
      contentType: "image/webp",
      visibility: "public",
      entity: params.entity,
    });

    if (!isSafeMediaUrl(uploaded.url) || uploaded.sizeBytes !== webpBuffer.length) {
      return {
        ok: false,
        status: "upload_failed",
        error: "Uploaded object verification failed.",
      };
    }

    return {
      ok: true,
      dryRun: false,
      sha256,
      pathname: uploaded.pathname,
      url: uploaded.url,
    };
  } catch (err) {
    return {
      ok: false,
      status: "upload_failed",
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }
}

async function hasColumn(db: AsyncDb, table: string, col: string): Promise<boolean> {
  const cols = await db.query<{ name: string }>(`PRAGMA table_info("${table}")`);
  return cols.some((c) => c.name === col);
}

async function hasTable(db: AsyncDb, table: string): Promise<boolean> {
  const row = await db.queryOne<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
    [table]
  );
  return Boolean(row?.name);
}

export async function migrateLegacyMedia(params: {
  db: AsyncDb;
  provider?: MediaStorageProvider;
  dryRun?: boolean;
}): Promise<LegacyMediaMigrationReport> {
  const dryRun = params.dryRun !== false;
  const provider = params.provider;
  if (!dryRun && !provider) {
    throw new Error("MediaStorageProvider is required when dryRun=false.");
  }

  const report: LegacyMediaMigrationReport = {
    dryRun,
    scannedRows: 0,
    migratedFields: 0,
    skippedFields: 0,
    failedFields: 0,
    orphanObjects: [],
    entries: [],
  };

  const dummyProvider: MediaStorageProvider = provider || {
    name: "dry-run",
    async uploadPublicAsset() {
      throw new Error("Dry-run does not upload.");
    },
  };

  async function processScalarField(spec: {
    table: "players" | "club_posts" | "sponsors";
    entity: MediaEntityType;
    rowId: string | number;
    column: string;
    value: string | null | undefined;
    updateSql: string;
  }) {
    if (!spec.value || !isDataImageUri(spec.value)) {
      report.skippedFields += 1;
      return;
    }

    const res = await uploadSingleLegacyValue({
      rawValue: spec.value,
      entity: spec.entity,
      provider: dummyProvider,
      dryRun,
    });

    if (!res.ok) {
      report.failedFields += 1;
      report.entries.push({
        table: spec.table,
        rowId: spec.rowId,
        column: spec.column,
        status: res.status,
        error: res.error,
      });
      return;
    }

    if (res.dryRun) {
      report.migratedFields += 1;
      report.entries.push({
        table: spec.table,
        rowId: spec.rowId,
        column: spec.column,
        status: "dry_run_candidate",
        sha256: res.sha256,
        pathname: res.pathname,
      });
      return;
    }

    try {
      const upd = await params.db.run(spec.updateSql, [res.url, spec.rowId, spec.value]);
      if (upd.changes !== 1) {
        report.failedFields += 1;
        report.orphanObjects.push({
          table: spec.table,
          rowId: spec.rowId,
          column: spec.column,
          url: res.url,
          pathname: res.pathname,
        });
        report.entries.push({
          table: spec.table,
          rowId: spec.rowId,
          column: spec.column,
          status: "db_cas_conflict_or_failed",
          sha256: res.sha256,
          pathname: res.pathname,
          orphanUrl: res.url,
          error: "Compare-and-swap matched 0 rows (concurrent modification).",
        });
        return;
      }

      report.migratedFields += 1;
      report.entries.push({
        table: spec.table,
        rowId: spec.rowId,
        column: spec.column,
        status: "migrated",
        sha256: res.sha256,
        pathname: res.pathname,
        newUrl: res.url,
      });
    } catch (err) {
      report.failedFields += 1;
      report.orphanObjects.push({
        table: spec.table,
        rowId: spec.rowId,
        column: spec.column,
        url: res.url,
        pathname: res.pathname,
      });
      report.entries.push({
        table: spec.table,
        rowId: spec.rowId,
        column: spec.column,
        status: "db_cas_conflict_or_failed",
        sha256: res.sha256,
        pathname: res.pathname,
        orphanUrl: res.url,
        error: err instanceof Error ? err.message : "Database update failed.",
      });
    }
  }

  async function processJsonArrayField(spec: {
    table: "players" | "club_posts";
    entity: MediaEntityType;
    rowId: string | number;
    column: string;
    rawJson: string | null | undefined;
    updateSql: string;
  }) {
    if (!spec.rawJson) {
      report.skippedFields += 1;
      return;
    }
    let arr: unknown;
    try {
      arr = JSON.parse(spec.rawJson);
    } catch {
      report.skippedFields += 1;
      return;
    }
    if (!Array.isArray(arr) || arr.length === 0) {
      report.skippedFields += 1;
      return;
    }

    const nextArr: string[] = [];
    let hasCandidate = false;
    let failedItem = false;
    const uploadedRefs: Array<{ url: string; pathname: string }> = [];

    for (const item of arr) {
      if (typeof item !== "string") continue;
      if (!isDataImageUri(item)) {
        nextArr.push(item);
        continue;
      }
      hasCandidate = true;
      const res = await uploadSingleLegacyValue({
        rawValue: item,
        entity: spec.entity,
        provider: dummyProvider,
        dryRun,
      });
      if (!res.ok) {
        failedItem = true;
        report.failedFields += 1;
        report.entries.push({
          table: spec.table,
          rowId: spec.rowId,
          column: spec.column,
          status: res.status,
          error: res.error,
        });
        nextArr.push(item);
      } else if (res.dryRun) {
        nextArr.push(item);
      } else {
        uploadedRefs.push({ url: res.url, pathname: res.pathname });
        nextArr.push(res.url);
      }
    }

    if (!hasCandidate) {
      report.skippedFields += 1;
      return;
    }

    if (dryRun) {
      if (!failedItem) {
        report.migratedFields += 1;
        report.entries.push({
          table: spec.table,
          rowId: spec.rowId,
          column: spec.column,
          status: "dry_run_candidate",
        });
      }
      return;
    }

    if (failedItem && uploadedRefs.length === 0) {
      return;
    }

    const nextJson = JSON.stringify(nextArr);
    try {
      const upd = await params.db.run(spec.updateSql, [nextJson, spec.rowId, spec.rawJson]);
      if (upd.changes !== 1) {
        report.failedFields += 1;
        for (const u of uploadedRefs) {
          report.orphanObjects.push({
            table: spec.table,
            rowId: spec.rowId,
            column: spec.column,
            url: u.url,
            pathname: u.pathname,
          });
        }
        report.entries.push({
          table: spec.table,
          rowId: spec.rowId,
          column: spec.column,
          status: "db_cas_conflict_or_failed",
          error: "Compare-and-swap matched 0 rows on JSON gallery.",
        });
        return;
      }
      if (!failedItem) {
        report.migratedFields += 1;
        report.entries.push({
          table: spec.table,
          rowId: spec.rowId,
          column: spec.column,
          status: "migrated",
        });
      }
    } catch (err) {
      report.failedFields += 1;
      for (const u of uploadedRefs) {
        report.orphanObjects.push({
          table: spec.table,
          rowId: spec.rowId,
          column: spec.column,
          url: u.url,
          pathname: u.pathname,
        });
      }
      report.entries.push({
        table: spec.table,
        rowId: spec.rowId,
        column: spec.column,
        status: "db_cas_conflict_or_failed",
        error: err instanceof Error ? err.message : "Database update failed.",
      });
    }
  }

  // 1. players
  if (await hasTable(params.db, "players")) {
    const hasAvatar = await hasColumn(params.db, "players", "avatar_url");
    const hasProfile = await hasColumn(params.db, "players", "profile_image_url");
    const hasGallery = await hasColumn(params.db, "players", "gallery_urls_json");
    const cols = ["id"];
    if (hasAvatar) cols.push("avatar_url");
    if (hasProfile) cols.push("profile_image_url");
    if (hasGallery) cols.push("gallery_urls_json");

    if (cols.length > 1) {
      const rows = await params.db.query<Record<string, unknown>>(
        `SELECT ${cols.join(", ")} FROM players ORDER BY id ASC`
      );
      for (const r of rows) {
        report.scannedRows += 1;
        const id = Number(r.id);
        if (hasAvatar) {
          await processScalarField({
            table: "players",
            entity: "player",
            rowId: id,
            column: "avatar_url",
            value: r.avatar_url as string | null,
            updateSql: "UPDATE players SET avatar_url = ? WHERE id = ? AND avatar_url = ?",
          });
        }
        if (hasProfile) {
          await processScalarField({
            table: "players",
            entity: "player",
            rowId: id,
            column: "profile_image_url",
            value: r.profile_image_url as string | null,
            updateSql:
              "UPDATE players SET profile_image_url = ? WHERE id = ? AND profile_image_url = ?",
          });
        }
        if (hasGallery) {
          await processJsonArrayField({
            table: "players",
            entity: "player",
            rowId: id,
            column: "gallery_urls_json",
            rawJson: r.gallery_urls_json as string | null,
            updateSql:
              "UPDATE players SET gallery_urls_json = ? WHERE id = ? AND gallery_urls_json = ?",
          });
        }
      }
    }
  }

  // 2. club_posts
  if (await hasTable(params.db, "club_posts")) {
    const rows = await params.db.query<{
      id: string;
      featured_image: string | null;
      gallery_images_json: string | null;
    }>("SELECT id, featured_image, gallery_images_json FROM club_posts ORDER BY rowid ASC");
    for (const r of rows) {
      report.scannedRows += 1;
      await processScalarField({
        table: "club_posts",
        entity: "post",
        rowId: r.id,
        column: "featured_image",
        value: r.featured_image,
        updateSql: "UPDATE club_posts SET featured_image = ? WHERE id = ? AND featured_image = ?",
      });
      await processJsonArrayField({
        table: "club_posts",
        entity: "post",
        rowId: r.id,
        column: "gallery_images_json",
        rawJson: r.gallery_images_json,
        updateSql:
          "UPDATE club_posts SET gallery_images_json = ? WHERE id = ? AND gallery_images_json = ?",
      });
    }
  }

  // 3. sponsors
  if (await hasTable(params.db, "sponsors")) {
    const rows = await params.db.query<{
      id: number;
      logo_url: string | null;
      banner_url: string | null;
    }>("SELECT id, logo_url, banner_url FROM sponsors ORDER BY id ASC");
    for (const r of rows) {
      report.scannedRows += 1;
      await processScalarField({
        table: "sponsors",
        entity: "sponsor",
        rowId: Number(r.id),
        column: "logo_url",
        value: r.logo_url,
        updateSql: "UPDATE sponsors SET logo_url = ? WHERE id = ? AND logo_url = ?",
      });
      await processScalarField({
        table: "sponsors",
        entity: "sponsor",
        rowId: Number(r.id),
        column: "banner_url",
        value: r.banner_url,
        updateSql: "UPDATE sponsors SET banner_url = ? WHERE id = ? AND banner_url = ?",
      });
    }
  }

  return report;
}
