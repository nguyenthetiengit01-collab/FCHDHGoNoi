import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FC HĐH Gò Nổi tại TP.HCM",
    short_name: "FC Gò Nổi",
    description:
      "Cổng thông tin, hồ sơ cầu thủ, lịch thi đấu, hoạt động và minh bạch tài chính của FC HĐH Gò Nổi tại TP.HCM (Xã Gò Nổi • TP. Đà Nẵng).",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#040e1a",
    theme_color: "#040e1a",
    lang: "vi",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
