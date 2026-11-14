import type { Metadata, Viewport } from "next";
import { Barlow_Condensed } from "next/font/google";
import {
  buildSportsOrganizationJsonLd,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
import "./globals.css";

const displayFont = Barlow_Condensed({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "FC HĐH Gò Nổi | Quản Lý Hồ Sơ, Quỹ & Lịch Thi Đấu Tại TP.HCM",
  description:
    "Cổng thông tin và ứng dụng quản lý Hồ sơ cầu thủ, Quỹ đội bóng, Điểm danh & Lịch thi đấu của Đội bóng FC HĐH Gò Nổi tại TP. Hồ Chí Minh.",
  manifest: "/manifest.json",
  icons: {
    icon: "/images/logo.jpg",
    apple: "/images/logo.jpg",
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: SITE_NAME,
    title: "FC HĐH Gò Nổi | Quản Lý Hồ Sơ, Quỹ & Lịch Thi Đấu Tại TP.HCM",
    description:
      "Cổng thông tin và ứng dụng quản lý Hồ sơ cầu thủ, Quỹ đội bóng, Điểm danh & Lịch thi đấu của Đội bóng FC HĐH Gò Nổi tại TP. Hồ Chí Minh.",
    url: SITE_URL,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FC HĐH Gò Nổi | Quản Lý Hồ Sơ, Quỹ & Lịch Thi Đấu Tại TP.HCM",
    description:
      "Cổng thông tin và ứng dụng quản lý Hồ sơ cầu thủ, Quỹ đội bóng, Điểm danh & Lịch thi đấu của Đội bóng FC HĐH Gò Nổi tại TP. Hồ Chí Minh.",
    images: [DEFAULT_OG_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#1e4fc2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const orgJsonLd = buildSportsOrganizationJsonLd();

  return (
    <html lang="vi" className={displayFont.variable}>
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
