import { put } from "@vercel/blob";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_MEDIA_UPLOAD_BYTES,
  hasValidImageMagicBytes,
  isSafeMediaUrl,
  type MediaEntityType,
  type MediaVisibility,
} from "./validation";

export interface MediaAsset {
  pathname: string;
  buffer: Buffer;
  contentType: string;
  visibility: MediaVisibility;
  entity: MediaEntityType;
}

export interface MediaUploadResult {
  url: string;
  pathname: string;
  contentType: string;
  sizeBytes: number;
}

export interface MediaReference {
  url: string;
  pathname: string | null;
  visibility: MediaVisibility;
  legacy: boolean;
}

export interface MediaStorageProvider {
  readonly name: string;
  uploadPublicAsset(asset: MediaAsset): Promise<MediaUploadResult>;
}

export class MediaStorageError extends Error {
  readonly code:
    | "MEDIA_STORAGE_UNAVAILABLE"
    | "MEDIA_PRIVATE_FORBIDDEN"
    | "MEDIA_INVALID_INPUT"
    | "MEDIA_UPLOAD_FAILED";
  readonly status: number;

  constructor(
    code: MediaStorageError["code"],
    message: string,
    status = 500
  ) {
    super(message);
    this.name = "MediaStorageError";
    this.code = code;
    this.status = status;
  }
}

export function validatePublicMediaAsset(asset: MediaAsset): void {
  if (asset.visibility !== "public") {
    throw new MediaStorageError(
      "MEDIA_PRIVATE_FORBIDDEN",
      "Không được phép tải media riêng tư lên kho lưu trữ công khai.",
      403
    );
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.has(asset.contentType.toLowerCase())) {
    throw new MediaStorageError(
      "MEDIA_INVALID_INPUT",
      "Định dạng MIME ảnh không được hỗ trợ.",
      400
    );
  }
  if (!Buffer.isBuffer(asset.buffer) || asset.buffer.length === 0) {
    throw new MediaStorageError(
      "MEDIA_INVALID_INPUT",
      "Dữ liệu ảnh rỗng hoặc không hợp lệ.",
      400
    );
  }
  if (asset.buffer.length > MAX_MEDIA_UPLOAD_BYTES) {
    throw new MediaStorageError(
      "MEDIA_INVALID_INPUT",
      "Kích thước ảnh vượt quá giới hạn tối đa 10MB.",
      413
    );
  }
  if (!hasValidImageMagicBytes(asset.buffer, asset.contentType)) {
    throw new MediaStorageError(
      "MEDIA_INVALID_INPUT",
      "Nội dung byte của ảnh không khớp định dạng khai báo.",
      400
    );
  }
  if (
    !asset.pathname ||
    asset.pathname.includes("..") ||
    asset.pathname.startsWith("/") ||
    !asset.pathname.startsWith("public-media/")
  ) {
    throw new MediaStorageError(
      "MEDIA_INVALID_INPUT",
      "Đường dẫn lưu trữ media không hợp lệ.",
      400
    );
  }
}

export class VercelBlobMediaStorageProvider implements MediaStorageProvider {
  readonly name = "vercel-blob";
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  async uploadPublicAsset(asset: MediaAsset): Promise<MediaUploadResult> {
    validatePublicMediaAsset(asset);
    try {
      const blob = await put(asset.pathname, asset.buffer, {
        access: "public",
        contentType: asset.contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
        token: this.token,
      });

      if (!isSafeMediaUrl(blob.url)) {
        throw new MediaStorageError(
          "MEDIA_UPLOAD_FAILED",
          "URL trả về từ Object Storage không hợp lệ.",
          502
        );
      }

      return {
        url: blob.url,
        pathname: blob.pathname || asset.pathname,
        contentType: blob.contentType || asset.contentType,
        sizeBytes: asset.buffer.length,
      };
    } catch (err) {
      if (err instanceof MediaStorageError) throw err;
      throw new MediaStorageError(
        "MEDIA_UPLOAD_FAILED",
        "Không thể tải ảnh lên Object Storage.",
        502
      );
    }
  }
}

let testProviderOverride: MediaStorageProvider | null = null;

export function __setMediaStorageProviderForTest(
  provider: MediaStorageProvider | null
): void {
  testProviderOverride = provider;
}

export function getMediaStorageProvider(
  env: Record<string, string | undefined> = process.env
): MediaStorageProvider {
  if (testProviderOverride) {
    return testProviderOverride;
  }
  const token =
    typeof env.BLOB_READ_WRITE_TOKEN === "string"
      ? env.BLOB_READ_WRITE_TOKEN.trim()
      : "";
  if (!token) {
    throw new MediaStorageError(
      "MEDIA_STORAGE_UNAVAILABLE",
      "Chưa cấu hình BLOB_READ_WRITE_TOKEN cho Object Storage.",
      503
    );
  }
  return new VercelBlobMediaStorageProvider(token);
}
