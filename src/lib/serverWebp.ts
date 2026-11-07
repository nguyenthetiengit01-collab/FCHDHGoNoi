import sharp from "sharp";

/**
 * Đảm bảo mọi chuỗi ảnh Data URL gửi lên máy chủ đều được chuẩn hóa sang định dạng WebP (data:image/webp;base64,...).
 * Nếu đã là data:image/webp hoặc đường dẫn tĩnh (/uploads/..., /images/...), giữ nguyên để tối ưu tốc độ.
 */
export async function ensureWebpDataUrlServer(
  input: string | undefined | null,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<string> {
  if (!input || typeof input !== "string") return "";
  const trimmed = input.trim();

  // Nếu là đường dẫn tĩnh hoặc đã là chuẩn WebP thì trả về ngay
  if (!trimmed.startsWith("data:image/")) {
    return trimmed;
  }
  if (trimmed.startsWith("data:image/webp;base64,")) {
    return trimmed;
  }

  try {
    const commaIdx = trimmed.indexOf(",");
    if (commaIdx === -1) return trimmed;
    const base64Data = trimmed.slice(commaIdx + 1);
    const buffer = Buffer.from(base64Data, "base64");

    const { maxWidth = 1280, maxHeight = 960, quality = 84 } = options;

    const webpBuffer = await sharp(buffer)
      .rotate() // Tự động xoay đúng chiều EXIF của điện thoại
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer();

    return `data:image/webp;base64,${webpBuffer.toString("base64")}`;
  } catch (err) {
    console.error("ensureWebpDataUrlServer error:", err);
    return trimmed;
  }
}

