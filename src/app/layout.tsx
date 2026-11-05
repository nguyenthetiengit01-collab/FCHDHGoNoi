import type { Metadata, Viewport } from "next";
import { Barlow_Condensed } from "next/font/google";
import "./globals.css";

const displayFont = Barlow_Condensed({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FC HĐH Gò Nổi | Quản Lý Hồ Sơ, Quỹ & Lịch Thi Đấu Tại TP.HCM",
  description:
    "Cổng thông tin và ứng dụng quản lý Hồ sơ cầu thủ, Quỹ đội bóng, Điểm danh & Lịch thi đấu của Đội bóng FC HĐH Gò Nổi tại TP. Hồ Chí Minh.",
  manifest: "/manifest.json",
  icons: {
    icon: "/images/logo.jpg",
    apple: "/images/logo.jpg",
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
  return (
    <html lang="vi" className={displayFont.variable}>
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
