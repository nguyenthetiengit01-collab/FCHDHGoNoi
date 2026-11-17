import { NextRequest, NextResponse } from "next/server";
import { getAsyncDb } from "@/lib/db";
import { parseAndValidateDataImageUri } from "@/lib/media/validation";

export const dynamic = "force-dynamic";

const ALLOWED_FIELDS: Record<
  string,
  { table: "players" | "club_posts" | "sponsors"; column: string }
> = {
  "player:avatar": { table: "players", column: "avatar_url" },
  "player:profile": { table: "players", column: "profile_image_url" },
  "post:featured": { table: "club_posts", column: "featured_image" },
  "sponsor:logo": { table: "sponsors", column: "logo_url" },
  "sponsor:banner": { table: "sponsors", column: "banner_url" },
};

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const entity = (sp.get("entity") || "").trim();
    const field = (sp.get("field") || "").trim();
    const idRaw = sp.get("id") || "";
    const id = Number(idRaw);

    const spec = ALLOWED_FIELDS[`${entity}:${field}`];
    if (!spec || !Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid media reference" }, { status: 400 });
    }

    const db = getAsyncDb();
    let sql = "";
    if (spec.table === "players" && spec.column === "avatar_url") {
      sql = "SELECT avatar_url AS val FROM players WHERE id = ? LIMIT 1";
    } else if (spec.table === "players" && spec.column === "profile_image_url") {
      sql = "SELECT profile_image_url AS val FROM players WHERE id = ? LIMIT 1";
    } else if (spec.table === "club_posts" && spec.column === "featured_image") {
      sql = "SELECT featured_image AS val FROM club_posts WHERE id = ? LIMIT 1";
    } else if (spec.table === "sponsors" && spec.column === "logo_url") {
      sql = "SELECT logo_url AS val FROM sponsors WHERE id = ? LIMIT 1";
    } else if (spec.table === "sponsors" && spec.column === "banner_url") {
      sql = "SELECT banner_url AS val FROM sponsors WHERE id = ? LIMIT 1";
    }

    const row = await db.queryOne<{ val: string | null }>(sql, [id]);
    const parsed = row?.val ? parseAndValidateDataImageUri(row.val) : null;
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
