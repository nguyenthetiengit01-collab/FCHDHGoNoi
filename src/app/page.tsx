import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getHomePageInitialData } from "@/lib/publicHome";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/seo";
import { TeamManagerApp } from "@/components/TeamManagerApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "FC HĐH Gò Nổi tại TP.HCM | Cổng Thông Tin & Quản Lý Đội Bóng",
  description:
    "Trang chủ chính thức của Đội bóng FC Hội Đồng Hương Gò Nổi tại TP.HCM (Xã Gò Nổi • TP. Đà Nẵng): hồ sơ cầu thủ, lịch thi đấu, hoạt động cộng đồng và minh bạch tài chính.",
  path: "/",
});

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const initialData = await getHomePageInitialData(sessionCookie);
  return <TeamManagerApp initialData={initialData} />;
}

