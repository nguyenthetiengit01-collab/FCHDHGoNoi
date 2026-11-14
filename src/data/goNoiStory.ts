import { FANPAGE_URL, OFFICIAL_COVER_URL, OFFICIAL_LOGO_URL } from "@/types/app";

export interface GoNoiHeritageVillage {
  id: "dien-quang" | "dien-trung" | "dien-phong";
  name: string;
  roleLabel: string;
  description: string;
}

export interface GoNoiStoryPillar {
  id: string;
  badge: string;
  title: string;
  paragraphs: string[];
}

export interface GoNoiGalleryPhoto {
  src: string;
  alt: string;
  caption: string;
}

export const GO_NOI_IDENTITY = {
  clubName: "FC HĐH Gò Nổi tại TP.HCM",
  currentLocation: "Xã Gò Nổi • TP. Đà Nẵng",
  historicalContext: "Gò Nổi – Điện Bàn – Quảng Nam (cũ)",
  riverName: "Sông Thu Bồn",
  slogan: "Đá phủi hết mình • Đoàn kết • Nghĩa tình • Hướng về quê hương",
  quote: "Dù đi trăm nẻo bốn phương, hồn quê Gò Nổi vẫn vẹn nguyên trong từng bước chạy.",
  logoUrl: OFFICIAL_LOGO_URL,
  coverUrl: OFFICIAL_COVER_URL,
  fanpageUrl: FANPAGE_URL,
} as const;

export const GO_NOI_VILLAGES: readonly GoNoiHeritageVillage[] = [
  {
    id: "dien-quang",
    name: "Xã Điện Quang (cũ)",
    roleLabel: "Cội nguồn Gò Nổi",
    description:
      "Một trong ba xã hợp thành vùng đất Gò Nổi bên dòng Thu Bồn; tên gọi được giữ nguyên trong hồ sơ cầu thủ và thẻ VĐV để anh em đồng hương nhận xóm làng và nhớ về nguồn gốc.",
  },
  {
    id: "dien-trung",
    name: "Xã Điện Trung (cũ)",
    roleLabel: "Cội nguồn Gò Nổi",
    description:
      "Vùng đất trung tâm của bãi bồi Gò Nổi, gắn bó với truyền thống hiếu học và tinh thần tương trợ bền chặt của bà con đồng hương từ quê nhà đến TP.HCM.",
  },
  {
    id: "dien-phong",
    name: "Xã Điện Phong (cũ)",
    roleLabel: "Cội nguồn Gò Nổi",
    description:
      "Mảnh đất giàu truyền thống cách mạng và nghĩa tình, góp phần hun đúc bản lĩnh thi đấu quả cảm, đoàn kết của tập thể FC HĐH Gò Nổi tại TP.HCM.",
  },
] as const;

export const GO_NOI_STORY_PILLARS: readonly GoNoiStoryPillar[] = [
  {
    id: "geo-thu-bon",
    badge: "Địa lý & Cội nguồn",
    title: "Mảnh đất bãi bồi bên hai nhánh sông Thu Bồn",
    paragraphs: [
      "Vùng đất Gò Nổi — nay là xã Gò Nổi thuộc TP. Đà Nẵng, trong ngữ cảnh lịch sử là vùng Gò Nổi – Điện Bàn – Quảng Nam (cũ) gồm ba xã Điện Quang, Điện Trung và Điện Phong — là dải đất bãi bồi trù phú được bao bọc bởi hai nhánh sông Thu Bồn.",
      "Dòng Thu Bồn không chỉ bồi đắp phù sa cho làng quê mà còn nuôi dưỡng nếp sống cần cù, thủy chung và sự gắn bó cộng đồng của nhiều thế hệ người con Gò Nổi.",
    ],
  },
  {
    id: "history-identity",
    badge: "Lịch sử & Bản sắc",
    title: "Truyền thống hiếu học, kiên cường và nghĩa tình",
    paragraphs: [
      "Trong ký ức của mỗi người con xa quê, Gò Nổi vốn nức tiếng là vùng đất hiếu học, kiên cường và giàu truyền thống cách mạng. Dù hành chính hiện tại đã hợp nhất thành Xã Gò Nổi • TP. Đà Nẵng, tên gọi ba xã cũ Điện Quang, Điện Trung, Điện Phong vẫn được trân trọng lưu giữ như một phần bản sắc quê hương.",
      "Trên hệ thống hồ sơ vận động viên của CLB, cội nguồn quê quán của từng cầu thủ vẫn ghi nhận rõ gốc gác 3 xã cũ để anh em gặp nhau giữa TP.HCM dễ nhận người cùng xóm, cùng làng.",
    ],
  },
  {
    id: "culture-fellowship",
    badge: "Văn hóa & Đồng hương",
    title: "Tinh thần đồng hương từ quê nhà vào sân cỏ TP.HCM",
    paragraphs: [
      "Rời quê hương vào TP.HCM lập nghiệp, mỗi người mang một công việc và hành trình riêng, nhưng điểm chung luôn là nỗi nhớ quê và tinh thần đùm bọc lẫn nhau. Ý tưởng thành lập FC HĐH Gò Nổi tại TP.HCM khởi nguồn từ buổi gặp mặt thân mật của anh em yêu bóng đá vào giữa năm 2024.",
      "Từ những buổi sinh hoạt đầu tiên, đội bóng trở thành nhịp cầu kết nối thế hệ, giữ gìn giọng nói, tình làng nghĩa xóm và tổ chức các trận giao lưu thường niên cùng các CLB đồng hương Điện Bàn, Duy Xuyên, Đại Lộc và cộng đồng người Quảng tại TP.HCM.",
    ],
  },
] as const;

export const GO_NOI_GALLERY: readonly GoNoiGalleryPhoto[] = [
  {
    src: OFFICIAL_COVER_URL,
    alt: "Tập thể FC HĐH Gò Nổi tại TP.HCM",
    caption: "Tập thể FC HĐH Gò Nổi tại TP.HCM — Xã Gò Nổi • TP. Đà Nẵng.",
  },
  {
    src: "/images/hinhanh-webp/anhbia/DSC06734.webp",
    alt: "Đội hình FC HĐH Gò Nổi trong màu áo truyền thống",
    caption: "Màu cờ sắc áo và tinh thần đoàn kết trên sân cỏ TP.HCM.",
  },
  {
    src: "/images/hinhanh-webp/anhbia/673ca5fcf835786b21245.webp",
    alt: "Khoảnh khắc kết nối anh em ba xã Điện Quang - Điện Trung - Điện Phong",
    caption: "Anh em con em Điện Quang, Điện Trung, Điện Phong chung một mái nhà.",
  },
  {
    src: "/images/hinhanh-webp/giaoluu/29c7f1c6ac0f2c51751e1.webp",
    alt: "Giao lưu bóng đá đồng hương tại TP.HCM",
    caption: "Những buổi giao lưu nghĩa tình kết nối cộng đồng đồng hương xa quê.",
  },
] as const;
