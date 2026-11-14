import type { MetadataRoute } from "next";
import { CLUB_ACTIVITIES_POSTS } from "@/data/clubActivities";
import { getFullAppData } from "@/lib/db";
import { PUBLIC_STATIC_ROUTES, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_STATIC_ROUTES.map((route) => ({
    url: route.path === "/" ? SITE_URL : `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  let posts = CLUB_ACTIVITIES_POSTS;
  try {
    const data = await getFullAppData();
    if (Array.isArray(data.posts) && data.posts.length > 0) {
      posts = data.posts;
    }
  } catch {
    // Fallback to static posts when DB is unreachable during build
  }

  const seenIds = new Set<string>();
  const postEntries: MetadataRoute.Sitemap = [];
  for (const post of posts) {
    const postKey = post.id?.trim();
    if (!postKey || seenIds.has(postKey)) continue;
    seenIds.add(postKey);
    const parsedDate = post.publishedDate ? new Date(post.publishedDate) : now;
    postEntries.push({
      url: `${SITE_URL}/hoat-dong/${encodeURIComponent(postKey)}`,
      lastModified: Number.isNaN(parsedDate.getTime()) ? now : parsedDate,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  return [...staticEntries, ...postEntries];
}
