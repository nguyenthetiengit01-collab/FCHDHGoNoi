import { NextRequest, NextResponse } from "next/server";
import { getAsyncDb } from "@/lib/db";
import { parseAndValidateDataImageUri } from "@/lib/media/validation";

export const dynamic = "force-dynamic";

const MAX_GALLERY_INDEX = 999;
const NUMERIC_ID_PATTERN = /^\d+$/;
const POST_TEXT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

type LegacyFieldSpec = {
  table: "players" | "club_posts" | "sponsors";
  column: string;
  idKind: "numeric" | "text";
  isGallery: boolean;
};

const ALLOWED_FIELDS: Record<string, LegacyFieldSpec> = {
  "player:avatar": { table: "players", column: "avatar_url", idKind: "numeric", isGallery: false },
  "player:profile": { table: "players", column: "profile_image_url", idKind: "numeric", isGallery: false },
  "player:gallery": { table: "players", column: "gallery_urls_json", idKind: "numeric", isGallery: true },
  "post:featured": { table: "club_posts", column: "featured_image", idKind: "text", isGallery: false },
  "post:gallery": { table: "club_posts", column: "gallery_images_json", idKind: "text", isGallery: true },
  "sponsor:logo": { table: "sponsors", column: "logo_url", idKind: "numeric", isGallery: false },
  "sponsor:banner": { table: "sponsors", column: "banner_url", idKind: "numeric", isGallery: false },
};

function parseEntityId(raw: string, idKind: "numeric" | "text"): number | string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (idKind === "numeric") {
    if (!NUMERIC_ID_PATTERN.test(trimmed)) return null;
    const num = Number(trimmed);
    return Number.isSafeInteger(num) && num > 0 ? num : null;
  }
  return POST_TEXT_ID_PATTERN.test(trimmed) ? trimmed : null;
}

function parseGalleryIndex(raw: string | null): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!NUMERIC_ID_PATTERN.test(trimmed)) return null;
  const idx = Number(trimmed);
  if (!Number.isSafeInteger(idx) || idx < 0 || idx > MAX_GALLERY_INDEX) return null;
  return idx;
}

function queryLegacyColumnSql(spec: LegacyFieldSpec): string {
  if (spec.table === "players" && spec.column === "avatar_url") {
    return "SELECT avatar_url AS val FROM players WHERE id = ? LIMIT 1";
  }
  if (spec.table === "players" && spec.column === "profile_image_url") {
    return "SELECT profile_image_url AS val FROM players WHERE id = ? LIMIT 1";
  }
  if (spec.table === "players" && spec.column === "gallery_urls_json") {
    return "SELECT gallery_urls_json AS val FROM players WHERE id = ? LIMIT 1";
  }
  if (spec.table === "club_posts" && spec.column === "featured_image") {
    return "SELECT featured_image AS val FROM club_posts WHERE id = ? LIMIT 1";
  }
  if (spec.table === "club_posts" && spec.column === "gallery_images_json") {
    return "SELECT gallery_images_json AS val FROM club_posts WHERE id = ? LIMIT 1";
  }
  if (spec.table === "sponsors" && spec.column === "logo_url") {
    return "SELECT logo_url AS val FROM sponsors WHERE id = ? LIMIT 1";
  }
  if (spec.table === "sponsors" && spec.column === "banner_url") {
    return "SELECT banner_url AS val FROM sponsors WHERE id = ? LIMIT 1";
  }
  throw new Error("Unsupported legacy media spec");
}

function extractGalleryElement(rawJson: string | null | undefined, index: number): string | null {
  if (!rawJson || typeof rawJson !== "string") return null;
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed) || index < 0 || index >= parsed.length) {
      return null;
    }
    const item = parsed[index];
    return typeof item === "string" ? item : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const entity = (sp.get("entity") || "").trim();
    const field = (sp.get("field") || "").trim();
    const idRaw = sp.get("id") || "";
    const indexParam = sp.get("index");

    const spec = ALLOWED_FIELDS[`${entity}:${field}`];
    if (!spec) {
      return NextResponse.json({ error: "Invalid media reference" }, { status: 400 });
    }

    const parsedId = parseEntityId(idRaw, spec.idKind);
    if (parsedId === null) {
      return NextResponse.json({ error: "Invalid media reference" }, { status: 400 });
    }

    let galleryIndex: number | null = null;
    if (spec.isGallery) {
      galleryIndex = parseGalleryIndex(indexParam);
      if (galleryIndex === null) {
        return NextResponse.json({ error: "Invalid gallery index" }, { status: 400 });
      }
    } else if (indexParam !== null) {
      return NextResponse.json({ error: "Index is only supported for gallery fields" }, { status: 400 });
    }

    const db = getAsyncDb();
    const sql = queryLegacyColumnSql(spec);
    const row = await db.queryOne<{ val: string | null }>(sql, [parsedId]);
    if (!row?.val) {
      return NextResponse.json({ error: "Legacy media not found" }, { status: 404 });
    }

    const rawMedia = spec.isGallery
      ? extractGalleryElement(row.val, galleryIndex!)
      : row.val;

    const parsed = rawMedia ? parseAndValidateDataImageUri(rawMedia) : null;
    if (!parsed) {
      return NextResponse.json({ error: "Legacy media not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(parsed.buffer), {
      status: 200,
      headers: {
        "Content-Type": parsed.mimeType,
        "Content-Length": String(parsed.buffer.length),
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to load legacy media" }, { status: 500 });
  }
}
