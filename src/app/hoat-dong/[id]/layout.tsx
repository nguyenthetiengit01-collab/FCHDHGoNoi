import type { Metadata } from "next";
import { CLUB_ACTIVITIES_POSTS } from "@/data/clubActivities";
import { getFullAppData } from "@/lib/db";
import { buildPageMetadata, DEFAULT_OG_IMAGE } from "@/lib/seo";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let posts = CLUB_ACTIVITIES_POSTS;
  try {
    const data = await getFullAppData();
    if (Array.isArray(data.posts) && data.posts.length > 0) {
      posts = data.posts;
    }
  } catch {
    // Fallback to static posts
  }

  const post = posts.find((p) => p.id === id || p.slug === id);
  if (!post) {
    return buildPageMetadata({
      title: "Chi Tiết Hoạt Động CLB | FC HĐH Gò Nổi tại TP.HCM",
      description:
        "Thông tin hoạt động, giải đấu và sự kiện cộng đồng của FC HĐH Gò Nổi tại TP.HCM.",
      path: `/hoat-dong/${encodeURIComponent(id)}`,
      type: "article",
    });
  }

  return buildPageMetadata({
    title: `${post.title} | FC HĐH Gò Nổi tại TP.HCM`,
    description:
      post.summary?.trim() ||
      `Bài viết hoạt động ${post.title} của FC HĐH Gò Nổi tại TP.HCM.`,
    path: `/hoat-dong/${encodeURIComponent(post.id || id)}`,
    image: post.featuredImage || DEFAULT_OG_IMAGE,
    type: "article",
  });
}

export default function HoatDongDetailLayout({ children }: LayoutProps) {
  return children;
}
