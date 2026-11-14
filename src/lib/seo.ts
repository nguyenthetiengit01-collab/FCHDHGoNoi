import type { Metadata } from "next";
import { FANPAGE_URL, OFFICIAL_COVER_URL, OFFICIAL_LOGO_URL } from "@/types/app";

export const SITE_URL = "https://fchdhgonoi.vercel.app";
export const SITE_NAME = "FC HĐH Gò Nổi tại TP.HCM";
export const DEFAULT_OG_IMAGE = OFFICIAL_COVER_URL;

export const PUBLIC_STATIC_ROUTES = [
  { path: "/", changeFrequency: "weekly" as const, priority: 1.0 },
  { path: "/cau-chuyen-go-noi", changeFrequency: "monthly" as const, priority: 0.85 },
  { path: "/hoat-dong", changeFrequency: "weekly" as const, priority: 0.9 },
  { path: "/nha-tai-tro", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/bao-cao-tai-chinh", changeFrequency: "weekly" as const, priority: 0.8 },
];

export function buildPageMetadata(params: {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
}): Metadata {
  const {
    title,
    description,
    path,
    image = DEFAULT_OG_IMAGE,
    type = "website",
  } = params;

  const normalizedImage = image.startsWith("http")
    ? image
    : `${SITE_URL}${image.startsWith("/") ? image : `/${image}`}`;

  const canonicalUrl = path === "/" ? SITE_URL : `${SITE_URL}${path}`;

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type,
      locale: "vi_VN",
      siteName: SITE_NAME,
      title,
      description,
      url: canonicalUrl,
      images: [
        {
          url: normalizedImage,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [normalizedImage],
    },
  };
}

export function buildSportsOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name: SITE_NAME,
    alternateName: "FC HĐH Gò Nổi",
    sport: "Football",
    url: SITE_URL,
    logo: `${SITE_URL}${OFFICIAL_LOGO_URL}`,
    image: `${SITE_URL}${OFFICIAL_COVER_URL}`,
    sameAs: [FANPAGE_URL],
    description:
      "Đội bóng cộng đồng người con Xã Gò Nổi, TP. Đà Nẵng (cội nguồn Điện Quang, Điện Trung, Điện Phong) đang sinh sống và làm việc tại TP. Hồ Chí Minh.",
  };
}
