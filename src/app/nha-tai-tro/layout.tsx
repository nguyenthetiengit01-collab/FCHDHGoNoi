import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Nhà Tài Trợ & Đối Tác Đồng Hành | FC HĐH Gò Nổi tại TP.HCM",
  description:
    "Tri ân các nhà tài trợ và đối tác đồng hành cùng phong trào bóng đá cộng đồng FC HĐH Gò Nổi tại TP.HCM (Xã Gò Nổi • TP. Đà Nẵng).",
  path: "/nha-tai-tro",
});

export default function NhaTaiTroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
