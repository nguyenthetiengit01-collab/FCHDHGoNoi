import sharp from "sharp";
import { isMediaStorageEnabled, isSafeMediaUrl } from "@/lib/media/validation";

export class MediaValidationError extends Error {
  readonly status = 400 as const;
  constructor(message: string) {
    super(message);
    this.name = "MediaValidationError";
  }
}

/**
 * Normalizes legacy Data URLs to WebP when MEDIA_STORAGE_ENABLED is off.
 * When MEDIA_STORAGE_ENABLED=true, rejects new Base64 data:image writes and validates safe URLs.
 */
export async function ensureWebpDataUrlServer(
  input: string | undefined | null,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<string> {
  if (!input || typeof input !== "string") return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  if (!trimmed.startsWith("data:image/")) {
    if (!isSafeMediaUrl(trimmed)) {
      throw new MediaValidationError("URL hình ảnh không hợp lệ hoặc giao thức không an toàn.");
    }
    return trimmed;
  }

  if (isMediaStorageEnabled()) {
    throw new MediaValidationError(
      "Kho lưu trữ Object Storage đang bật; không chấp nhận lưu chuỗi Base64 mới."
    );
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
      .rotate()
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
