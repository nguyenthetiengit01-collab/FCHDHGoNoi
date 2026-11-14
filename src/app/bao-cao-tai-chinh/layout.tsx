import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Báo Cáo Tài Chính Minh Bạch | FC HĐH Gò Nổi tại TP.HCM",
  description:
    "Tổng hợp công khai tình hình thu chi quỹ sinh hoạt, cơ cấu chi phí 6 nhóm và quỹ giải độc lập của FC HĐH Gò Nổi tại TP.HCM.",
  path: "/bao-cao-tai-chinh",
});

export default function BaoCaoTaiChinhLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
