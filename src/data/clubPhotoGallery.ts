import {
  ACTIVITY_CATEGORIES,
  type ActivityCategory,
  type ClubActivityPost,
} from "@/data/clubActivities";

export type GalleryCategoryId = Exclude<ActivityCategory, "all">;

export interface ClubGalleryPhoto {
  id: string;
  src: string;
  category: GalleryCategoryId;
  categoryLabel: string;
  title: string;
  caption: string;
  alt: string;
  eventYear?: string;
  publishedDate?: string;
  postId?: string;
  source: "post" | "archive";
}

export interface ClubGalleryAlbum {
  id: GalleryCategoryId;
  label: string;
  description: string;
  coverImage: string;
  photoCount: number;
  photos: ClubGalleryPhoto[];
}

export const INITIAL_GALLERY_LIMIT = 12;
export const GALLERY_LOAD_STEP = 12;

const CATEGORY_META: Record<
  GalleryCategoryId,
  { label: string; fallbackTitle: string; fallbackCaption: string }
> = {
  giaidau: {
    label: "Giải Đấu & Phong Trào",
    fallbackTitle: "Khoảnh khắc Giải Đấu & Phong Trào",
    fallbackCaption:
      "Tư liệu hình ảnh nội bộ FC HĐH Gò Nổi tại các trận đấu phong trào.",
  },
  giaoluu: {
    label: "Giao Lưu Kết Nối",
    fallbackTitle: "Khoảnh khắc Giao Lưu Kết Nối",
    fallbackCaption:
      "Hình ảnh giao lưu thể thao và gắn kết cộng đồng đồng hương Gò Nổi.",
  },
  cauthu: {
    label: "Cầu Thủ Gò Nổi",
    fallbackTitle: "Khoảnh khắc Cầu Thủ Gò Nổi",
    fallbackCaption:
      "Hình ảnh sinh hoạt và thi đấu của các thành viên FC HĐH Gò Nổi.",
  },
  taitro: {
    label: "Đồng Hành & Tài Trợ",
    fallbackTitle: "Đồng Hành & Tài Trợ CLB",
    fallbackCaption:
      "Tư liệu đồng hành và tiếp sức cùng hoạt động của FC HĐH Gò Nổi.",
  },
  anhbia: {
    label: "Ảnh Bìa & Khí Thế",
    fallbackTitle: "Ảnh Tập Thể & Khí Thế CLB",
    fallbackCaption:
      "Khung hình tập thể và không khí sinh hoạt của FC HĐH Gò Nổi tại TP.HCM.",
  },
};

export const VERIFIED_GALLERY_ARCHIVE_ASSETS: Record<
  GalleryCategoryId,
  readonly string[]
> = {
  anhbia: [
    "/images/cover-team.jpg",
    "/images/hinhanh-webp/anhbia/DSC06734.webp",
    "/images/hinhanh-webp/anhbia/673ca5fcf835786b21245.webp",
    "/images/hinhanh-webp/anhbia/IMG_5574.webp",
    "/images/hinhanh-webp/anhbia/IMG_5575.webp",
    "/images/hinhanh-webp/anhbia/IMG_5576.webp",
    "/images/hinhanh-webp/anhbia/2aOboR76r2U83BVWX6KpLhDL2iDvrSDGCLgI0Z5U.webp",
    "/images/hinhanh-webp/anhbia/47529193cc5a4c04154b7.webp",
    "/images/hinhanh-webp/anhbia/fcf0b634ebfd6ba332ec6.webp",
  ],
  giaidau: [
    "/images/hinhanh-webp/giaidau/1c025d36688be9d5b09a18.webp",
    "/images/hinhanh-webp/giaidau/4dd2f2e6c75b46051f4a14.webp",
    "/images/hinhanh-webp/giaidau/DSC06290.webp",
    "/images/hinhanh-webp/giaidau/DSC06297.webp",
    "/images/hinhanh-webp/giaidau/DSC06300.webp",
    "/images/hinhanh-webp/giaidau/DSC06301.webp",
    "/images/hinhanh-webp/giaidau/DSC06361.webp",
    "/images/hinhanh-webp/giaidau/DSC06363.webp",
    "/images/hinhanh-webp/giaidau/DSC06522.webp",
    "/images/hinhanh-webp/giaidau/DSC06523.webp",
    "/images/hinhanh-webp/giaidau/DSC06524.webp",
    "/images/hinhanh-webp/giaidau/DSC06525.webp",
    "/images/hinhanh-webp/giaidau/DSC06526.webp",
    "/images/hinhanh-webp/giaidau/DSC06527.webp",
    "/images/hinhanh-webp/giaidau/DSC06528.webp",
    "/images/hinhanh-webp/giaidau/DSC06530.webp",
    "/images/hinhanh-webp/giaidau/DSC06532.webp",
    "/images/hinhanh-webp/giaidau/DSC06533.webp",
    "/images/hinhanh-webp/giaidau/DSC06534.webp",
    "/images/hinhanh-webp/giaidau/DSC06535.webp",
    "/images/hinhanh-webp/giaidau/DSC06553.webp",
    "/images/hinhanh-webp/giaidau/DSC06575.webp",
    "/images/hinhanh-webp/giaidau/DSC06729.webp",
    "/images/hinhanh-webp/giaidau/DSC06730.webp",
    "/images/hinhanh-webp/giaidau/DSC06731.webp",
    "/images/hinhanh-webp/giaidau/DSC06732.webp",
    "/images/hinhanh-webp/giaidau/DSC06733.webp",
    "/images/hinhanh-webp/giaidau/DSC06735.webp",
    "/images/hinhanh-webp/giaidau/DSC06750.webp",
    "/images/hinhanh-webp/giaidau/DSC06751.webp",
  ],
  giaoluu: [
    "/images/hinhanh-webp/giaoluu/29c7f1c6ac0f2c51751e1.webp",
    "/images/hinhanh-webp/giaoluu/2a0ee93bb4f234ac6de32.webp",
    "/images/hinhanh-webp/giaoluu/30a151040ccd8c93d5dc8.webp",
    "/images/hinhanh-webp/giaoluu/f799b42fe9e669b830f79.webp",
  ],
  taitro: [
    "/images/hinhanh-webp/taitro/16a77ea82361a33ffa703.webp",
    "/images/hinhanh-webp/taitro/d120b134ecfd6ca335ec4.webp",
  ],
  cauthu: [
    "/images/hinhanh-webp/cauthu/05f39aceaf732e2d776225.webp",
    "/images/hinhanh-webp/cauthu/06101b902e2daf73f63c44.webp",
    "/images/hinhanh-webp/cauthu/0f3aa0a1951c14424d0d4.webp",
    "/images/hinhanh-webp/cauthu/19abf530c08d41d3189c8.webp",
    "/images/hinhanh-webp/cauthu/1cdc89e8bc553d0b64442.webp",
    "/images/hinhanh-webp/cauthu/26f561c85475d52b8c6429.webp",
    "/images/hinhanh-webp/cauthu/2ded5b6baa722a2c7363.webp",
    "/images/hinhanh-webp/cauthu/31d890bda500245e7d1142.webp",
    "/images/hinhanh-webp/cauthu/37c76df3584ed910805f9.webp",
    "/images/hinhanh-webp/cauthu/38a1ea3adf875ed907967.webp",
    "/images/hinhanh-webp/cauthu/3ccbbeff8b420a1c535317.webp",
    "/images/hinhanh-webp/cauthu/420f523b6786e6d8bf973.webp",
    "/images/hinhanh-webp/cauthu/42fc8c67b9da388461cb1.webp",
    "/images/hinhanh-webp/cauthu/4b8e28b31d0e9c50c51f23.webp",
    "/images/hinhanh-webp/cauthu/5250316404d98587dcc87.webp",
    "/images/hinhanh-webp/cauthu/53bf36c3037e8220db6f.webp",
    "/images/hinhanh-webp/cauthu/592ad13e2027a079f936.webp",
    "/images/hinhanh-webp/cauthu/635c79084cb5cdeb94a4.webp",
    "/images/hinhanh-webp/cauthu/671f762b4396c2c89b871.webp",
    "/images/hinhanh-webp/cauthu/6d9d35a90014814ad8058.webp",
    "/images/hinhanh-webp/cauthu/713ee57bd0c6519808d736.webp",
    "/images/hinhanh-webp/cauthu/7a4dfc79c9c4489a11d55.webp",
    "/images/hinhanh-webp/cauthu/7e5d526067dde683bfcc20.webp",
    "/images/hinhanh-webp/cauthu/807d64e6515bd005894a2.webp",
    "/images/hinhanh-webp/cauthu/87c8047a31c7b099e9d6.webp",
    "/images/hinhanh-webp/cauthu/8c6cda51efec6eb237fd30.webp",
    "/images/hinhanh-webp/cauthu/8f70834db6f037ae6ee131.webp",
    "/images/hinhanh-webp/cauthu/90dc0b813e3cbf62e62d34.webp",
    "/images/hinhanh-webp/cauthu/91199d45a8f829a670e935.webp",
    "/images/hinhanh-webp/cauthu/917197f1a24c23127a5d43.webp",
    "/images/hinhanh-webp/cauthu/93229b1faea22ffc76b321.webp",
    "/images/hinhanh-webp/cauthu/94d00e8d3b30ba6ee32133.webp",
    "/images/hinhanh-webp/cauthu/97e06bad5e10df4e860140.webp",
    "/images/hinhanh-webp/cauthu/9eb2c38ff632776c2e2322.webp",
    "/images/hinhanh-webp/cauthu/aa102d24189999c7c08813.webp",
    "/images/hinhanh-webp/cauthu/aa9c30a80515844bdd0415.webp",
    "/images/hinhanh-webp/cauthu/abf9f5c4c0794127186824.webp",
    "/images/hinhanh-webp/cauthu/ac544c1979a4f8faa1b539.webp",
    "/images/hinhanh-webp/cauthu/ad0b363f038282dcdb9316.webp",
    "/images/hinhanh-webp/cauthu/ad2d04b6310bb055e91a3.webp",
    "/images/hinhanh-webp/cauthu/ae5c306805d5848bddc46.webp",
    "/images/hinhanh-webp/cauthu/ae6abef08b4d0a13535c5.webp",
    "/images/hinhanh-webp/cauthu/aedc2ab91f049e5ac71541.webp",
    "/images/hinhanh-webp/cauthu/b38d2fb91a049b5ac21510.webp",
    "/images/hinhanh-webp/cauthu/b65d351800a581fbd8b437.webp",
    "/images/hinhanh-webp/cauthu/b80086917788f7d6ae99.webp",
    "/images/hinhanh-webp/cauthu/b963f9c808d1888fd1c0.webp",
    "/images/hinhanh-webp/cauthu/b9a8b8958d280c76553926.webp",
    "/images/hinhanh-webp/cauthu/c07bb9eb8c560d085447.webp",
    "/images/hinhanh-webp/cauthu/c44a8e77bbca3a9463db32.webp",
    "/images/hinhanh-webp/cauthu/cfbf2cca19779829c166.webp",
    "/images/hinhanh-webp/cauthu/d352ce6ffbd27a8c23c327.webp",
    "/images/hinhanh-webp/cauthu/d7338c07b9ba38e461ab12.webp",
    "/images/hinhanh-webp/cauthu/e764ca21ff9c7ec2278d38.webp",
    "/images/hinhanh-webp/cauthu/e9b70082353fb461ed2e11.webp",
    "/images/hinhanh-webp/cauthu/ebc40a5f3fe2bebce7f36.webp",
    "/images/hinhanh-webp/cauthu/edacc691f32c72722b3d19.webp",
    "/images/hinhanh-webp/cauthu/fcbf6282573fd6618f2e28.webp",
  ],
};

function normalizeImagePath(src: string): string {
  return src.trim();
}

/**
 * Xây dựng danh sách ảnh thư viện từ bài viết hoạt động thật và kho ảnh nội bộ đã xác minh.
 * Không tự suy đoán danh tính cá nhân hoặc sự kiện ngoài dữ liệu hiện có.
 */
export function buildClubGalleryPhotos(
  posts: ClubActivityPost[],
  includeArchive = true
): ClubGalleryPhoto[] {
  const photos: ClubGalleryPhoto[] = [];
  const seenSrc = new Set<string>();

  for (const post of posts) {
    const postImages = [post.featuredImage, ...(post.galleryImages || [])].filter(
      Boolean
    );

    postImages.forEach((rawSrc, idx) => {
      const src = normalizeImagePath(rawSrc);
      if (!src || seenSrc.has(src)) return;
      seenSrc.add(src);

      const meta = CATEGORY_META[post.category];
      const eventYear = post.eventYear || post.publishedDate?.slice(0, 4);
      const isCover = idx === 0;

      photos.push({
        id: `post-${post.id}-${idx}`,
        src,
        category: post.category,
        categoryLabel: post.categoryLabel || meta.label,
        title: isCover ? post.title : `${post.title} • Ảnh #${idx}`,
        caption: post.summary || meta.fallbackCaption,
        alt: `${post.title} - ${post.categoryLabel || meta.label}`,
        eventYear,
        publishedDate: post.publishedDate,
        postId: post.id,
        source: "post",
      });
    });
  }

  if (!includeArchive) {
    return photos;
  }

  (Object.keys(VERIFIED_GALLERY_ARCHIVE_ASSETS) as GalleryCategoryId[]).forEach(
    (category) => {
      const meta = CATEGORY_META[category];
      const list = VERIFIED_GALLERY_ARCHIVE_ASSETS[category];
      list.forEach((rawSrc, idx) => {
        const src = normalizeImagePath(rawSrc);
        if (!src || seenSrc.has(src)) return;
        seenSrc.add(src);

        photos.push({
          id: `archive-${category}-${idx + 1}`,
          src,
          category,
          categoryLabel: meta.label,
          title: `${meta.fallbackTitle} #${idx + 1}`,
          caption: meta.fallbackCaption,
          alt: `${meta.fallbackTitle} - FC HĐH Gò Nổi`,
          source: "archive",
        });
      });
    }
  );

  return photos;
}

/**
 * Nhóm ảnh theo từng chuyên mục hoạt động để tạo album đại diện.
 */
export function buildClubGalleryAlbums(
  photos: ClubGalleryPhoto[]
): ClubGalleryAlbum[] {
  const categories = ACTIVITY_CATEGORIES.filter(
    (cat): cat is { id: GalleryCategoryId; label: string; iconName: string; description: string } =>
      cat.id !== "all"
  );

  return categories
    .map((cat) => {
      const albumPhotos = photos.filter((photo) => photo.category === cat.id);
      if (albumPhotos.length === 0) return null;
      return {
        id: cat.id,
        label: cat.label,
        description: cat.description,
        coverImage: albumPhotos[0].src,
        photoCount: albumPhotos.length,
        photos: albumPhotos,
      };
    })
    .filter((album): album is ClubGalleryAlbum => album !== null);
}

/**
 * Lọc ảnh thư viện theo chuyên mục, năm (nếu có) và từ khóa tìm kiếm.
 */
export function filterClubGalleryPhotos(
  photos: ClubGalleryPhoto[],
  options: {
    category?: ActivityCategory;
    year?: string;
    query?: string;
  }
): ClubGalleryPhoto[] {
  const { category = "all", year = "all", query = "" } = options;
  const normalizedQuery = query.trim().toLowerCase();

  return photos.filter((photo) => {
    const matchCategory = category === "all" || photo.category === category;
    const matchYear =
      year === "all" ? true : photo.eventYear === year;
    const matchQuery =
      !normalizedQuery ||
      photo.title.toLowerCase().includes(normalizedQuery) ||
      photo.caption.toLowerCase().includes(normalizedQuery) ||
      photo.categoryLabel.toLowerCase().includes(normalizedQuery);

    return matchCategory && matchYear && matchQuery;
  });
}
