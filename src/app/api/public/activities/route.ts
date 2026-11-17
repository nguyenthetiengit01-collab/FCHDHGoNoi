import { NextRequest, NextResponse } from "next/server";
import { getAsyncDb } from "@/lib/db";
import { CLUB_ACTIVITIES_POSTS, type ClubActivityPost } from "@/data/clubActivities";
import { toPublicMediaSrc } from "@/lib/publicHome";

export const dynamic = "force-dynamic";

function safeParseArr(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const idParam = (sp.get("id") || "").trim();
    const limitRaw = Number(sp.get("limit") || "50");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.floor(limitRaw)) : 50;

    const db = getAsyncDb();

    if (idParam) {
      const row = await db
        .queryOne<{
          rowid: number;
          id: string;
          category: string;
          category_label: string;
          category_badge_class: string;
          title: string;
          slug: string;
          summary: string;
          published_date: string;
          event_year: string;
          author: string;
          featured_image: string;
          gallery_images_json: string;
          reading_time: string;
          paragraphs_json: string;
          quote: string | null;
          highlights_json: string;
          tagged_players_json: string;
        }>(
          `SELECT rowid, id, category, category_label, category_badge_class, title, slug, summary,
                  published_date, event_year, author, featured_image, gallery_images_json,
                  reading_time, paragraphs_json, quote, highlights_json, tagged_players_json
           FROM club_posts
           WHERE id = ? OR slug = ?
           LIMIT 1`,
          [idParam, idParam]
        )
        .catch(() => null);

      const post: ClubActivityPost | undefined = row
        ? {
            id: row.id,
            category: row.category as ClubActivityPost["category"],
            categoryLabel: row.category_label,
            categoryBadgeClass: row.category_badge_class,
            title: row.title,
            slug: row.slug,
            summary: row.summary,
            publishedDate: row.published_date,
            eventYear: row.event_year || "2026",
            author: row.author,
            featuredImage: toPublicMediaSrc(row.featured_image, {
              entity: "post",
              id: Number(row.rowid || 0),
              field: "featured",
            }),
            galleryImages: safeParseArr(row.gallery_images_json),
            readingTime: row.reading_time || "3 phút đọc",
            paragraphs: safeParseArr(row.paragraphs_json),
            quote: row.quote || undefined,
            highlights: safeParseArr(row.highlights_json),
            taggedPlayerNames: safeParseArr(row.tagged_players_json),
          }
        : CLUB_ACTIVITIES_POSTS.find((p) => p.id === idParam || p.slug === idParam);

      if (!post) {
        return NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });
      }

      return NextResponse.json(
        { post },
        { status: 200, headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
      );
    }

    const rows = await db
      .query<{
        rowid: number;
        id: string;
        category: string;
        category_label: string;
        category_badge_class: string;
        title: string;
        slug: string;
        summary: string;
        published_date: string;
        event_year: string;
        author: string;
        featured_image: string;
        gallery_images_json: string;
        reading_time: string;
        tagged_players_json: string;
      }>(
        `SELECT rowid, id, category, category_label, category_badge_class, title, slug, summary,
                published_date, event_year, author, featured_image, gallery_images_json,
                reading_time, tagged_players_json
         FROM club_posts
         ORDER BY published_date DESC, rowid DESC
         LIMIT ?`,
        [limit]
      )
      .catch(() => null);

    const posts: ClubActivityPost[] =
      rows && rows.length > 0
        ? rows.map((row) => ({
            id: row.id,
            category: row.category as ClubActivityPost["category"],
            categoryLabel: row.category_label,
            categoryBadgeClass: row.category_badge_class,
            title: row.title,
            slug: row.slug,
            summary: row.summary,
            publishedDate: row.published_date,
            eventYear: row.event_year || "2026",
            author: row.author,
            featuredImage: toPublicMediaSrc(row.featured_image, {
              entity: "post",
              id: Number(row.rowid || 0),
              field: "featured",
            }),
            galleryImages: safeParseArr(row.gallery_images_json),
            readingTime: row.reading_time || "3 phút đọc",
            paragraphs: [],
            highlights: [],
            taggedPlayerNames: safeParseArr(row.tagged_players_json),
          }))
        : CLUB_ACTIVITIES_POSTS.slice(0, limit);

    return NextResponse.json(
      { posts },
      { status: 200, headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json({ error: "Không thể tải danh sách hoạt động" }, { status: 500 });
  }
}
