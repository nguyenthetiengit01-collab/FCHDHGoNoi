import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đang Ngoại Tuyến | FC HĐH Gò Nổi tại TP.HCM",
  description: "Thiết bị đang mất kết nối mạng.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OfflineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
