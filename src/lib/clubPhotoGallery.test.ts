import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLUB_ACTIVITIES_POSTS } from "@/data/clubActivities";
import {
  VERIFIED_GALLERY_ARCHIVE_ASSETS,
  buildClubGalleryAlbums,
  buildClubGalleryPhotos,
  filterClubGalleryPhotos,
  type GalleryCategoryId,
} from "@/data/clubPhotoGallery";

describe("clubPhotoGallery", () => {
  it("only references existing internal club photos and excludes theme/QR assets", () => {
    const publicDir = path.join(process.cwd(), "public");
    const categories = Object.keys(
      VERIFIED_GALLERY_ARCHIVE_ASSETS
    ) as GalleryCategoryId[];

    expect(categories.length).toBe(5);

    for (const category of categories) {
      for (const assetPath of VERIFIED_GALLERY_ARCHIVE_ASSETS[category]) {
        expect(assetPath).toMatch(/^\/images\//);
        expect(assetPath).not.toContain("/theme/");
        expect(assetPath).not.toContain("qr-nguyenthetieng");

        const fullPath = path.join(publicDir, assetPath.replace(/^\//, ""));
        expect(fs.existsSync(fullPath)).toBe(true);
      }
    }
  });

  it("builds deduplicated gallery photos from posts and verified archive", () => {
    const photos = buildClubGalleryPhotos(CLUB_ACTIVITIES_POSTS, true);
    const uniqueSrcs = new Set(photos.map((p) => p.src));

    expect(photos.length).toBeGreaterThan(CLUB_ACTIVITIES_POSTS.length);
    expect(uniqueSrcs.size).toBe(photos.length);

    const postPhoto = photos.find((p) => p.postId === "post-gd-1");
    expect(postPhoto).toBeDefined();
    expect(postPhoto?.category).toBe("giaidau");
    expect(postPhoto?.eventYear).toBe("2026");
    expect(postPhoto?.alt.length).toBeGreaterThan(10);
  });

  it("returns empty array when no posts and archive is disabled", () => {
    expect(buildClubGalleryPhotos([], false)).toEqual([]);
  });

  it("groups gallery photos into category albums with cover images", () => {
    const photos = buildClubGalleryPhotos(CLUB_ACTIVITIES_POSTS, true);
    const albums = buildClubGalleryAlbums(photos);

    expect(albums.length).toBe(5);
    for (const album of albums) {
      expect(album.photoCount).toBe(album.photos.length);
      expect(album.photoCount).toBeGreaterThan(0);
      expect(album.coverImage).toBe(album.photos[0].src);
    }
  });

  it("filters gallery photos by category, year, and search query", () => {
    const photos = buildClubGalleryPhotos(CLUB_ACTIVITIES_POSTS, true);

    const giaoluuPhotos = filterClubGalleryPhotos(photos, {
      category: "giaoluu",
    });
    expect(giaoluuPhotos.length).toBeGreaterThan(0);
    expect(giaoluuPhotos.every((p) => p.category === "giaoluu")).toBe(true);

    const year2025Photos = filterClubGalleryPhotos(photos, {
      year: "2025",
    });
    expect(year2025Photos.length).toBeGreaterThan(0);
    expect(year2025Photos.every((p) => p.eventYear === "2025")).toBe(true);

    const queryEmpty = filterClubGalleryPhotos(photos, {
      query: "khong-ton-tai-xyz-999",
    });
    expect(queryEmpty).toEqual([]);
  });
});
