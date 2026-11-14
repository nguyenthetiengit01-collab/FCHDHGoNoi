import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Hoạt Động & Thư Viện Ảnh CLB | FC HĐH Gò Nổi tại TP.HCM",
  description:
    "Tổng hợp tin tức, giải đấu, giao hữu, thiện nguyện và thư viện ảnh cộng đồng của FC HĐH Gò Nổi tại TP.HCM (Xã Gò Nổi • TP. Đà Nẵng).",
  path: "/hoat-dong",
});

export default function HoatDongLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
