import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getFullAppData } from "@/lib/db";
import { getPublicHomePageData } from "@/lib/publicHome";
import {
  SESSION_COOKIE_NAME,
  getCurrentAuthContextFromToken,
  sanitizeDataForPlayer,
} from "@/lib/auth";
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

  if (!sessionCookie) {
    const initialData = await getPublicHomePageData();
    return <TeamManagerApp initialData={initialData} />;
  }

  let authCtx;
  try {
    authCtx = await getCurrentAuthContextFromToken(sessionCookie);
  } catch {
    const initialData = await getPublicHomePageData();
    return <TeamManagerApp initialData={initialData} />;
  }

  // Fail-closed: nếu session không hợp lệ, tài khoản inactive/PIN mặc định, hoặc DB outage (503) -> chỉ trả public data
  if (!authCtx.authorized || !authCtx.player) {
    const initialData = await getPublicHomePageData();
    return <TeamManagerApp initialData={initialData} />;
  }

  const data = await getFullAppData();
  const initialData =
    authCtx.player.access_role === "manager"
      ? {
        ...data,
        players: data.players.map((p) => ({ ...p, pin_code: "" })),
      }
      : sanitizeDataForPlayer(data, authCtx.player.id);

  return <TeamManagerApp initialData={initialData} />;
}

