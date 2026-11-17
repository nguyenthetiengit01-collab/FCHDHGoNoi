import crypto from "node:crypto";

export type MediaEntityType = "player" | "post" | "sponsor";
export type MediaVisibility = "public" | "private";

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/avif",
]);

export const MAX_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB (Direct Client Upload)
export const MAX_SERVER_MULTIPART_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB (under Vercel 4.5MB Function body limit)

export function isMediaStorageEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.MEDIA_STORAGE_ENABLED?.trim().toLowerCase() === "true";
}

export function isDataImageUri(value: string | null | undefined): boolean {
  return typeof value === "string" && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value.trim());
}

/**
 * Validates that a string is a safe media URL (HTTPS, safe local relative path,
 * or optionally legacy data:image URI). Rejects javascript:, file:, data:text/html, etc.
 */
export function isSafeMediaUrl(
  value: string | null | undefined,
  options: { allowDataImage?: boolean } = {}
): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (isDataImageUri(trimmed)) {
    return Boolean(options.allowDataImage);
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return !/[\r\n\0]/.test(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export interface ParsedDataImageUri {
  mimeType: string;
  buffer: Buffer;
}

/**
 * Safely parses and decodes a data:image/<type>;base64,... URI.
 * Validates MIME allowlist, base64 encoding, and actual image magic bytes.
 */
export function parseAndValidateDataImageUri(raw: string): ParsedDataImageUri | null {
  if (typeof raw !== "string") return null;
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(raw.trim());
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    return null;
  }

  const base64Clean = match[2].replace(/\s+/g, "");
  if (!base64Clean || base64Clean.length % 4 !== 0) {
    return null;
  }

  const buffer = Buffer.from(base64Clean, "base64");
  if (buffer.length === 0 || buffer.length > MAX_MEDIA_UPLOAD_BYTES) {
    return null;
  }

  if (!hasValidImageMagicBytes(buffer, mimeType)) {
    return null;
  }

  return { mimeType, buffer };
}

/**
 * Verifies magic bytes of WebP, JPEG, PNG, or AVIF buffers.
 */
export function hasValidImageMagicBytes(buffer: Buffer, declaredMime?: string): boolean {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;

  const isWebp =
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  const isAvif =
    buffer.subarray(4, 8).toString("ascii") === "ftyp" &&
    /^(avif|avis|mif1)/i.test(buffer.subarray(8, 12).toString("ascii"));

  if (!declaredMime) {
    return isWebp || isJpeg || isPng || isAvif;
  }

  switch (declaredMime.toLowerCase()) {
    case "image/webp":
      return isWebp;
    case "image/jpeg":
      return isJpeg;
    case "image/png":
      return isPng;
    case "image/avif":
      return isAvif;
    default:
      return false;
  }
}

/**
 * Builds a deterministic, PII-free object storage pathname.
 */
export function buildSafePublicMediaPathname(params: {
  entity: MediaEntityType;
  buffer: Buffer;
  prefix?: "uploads" | "migrated";
  extension?: "webp";
}): string {
  const hash = crypto.createHash("sha256").update(params.buffer).digest("hex");
  const prefix = params.prefix || "uploads";
  const ext = params.extension || "webp";
  return `public-media/${prefix}/${params.entity}/${hash.slice(0, 32)}.${ext}`;
}

export function isValidSafePublicMediaPathname(
  pathname: string,
  expectedEntity?: MediaEntityType
): boolean {
  if (typeof pathname !== "string") return false;
  const match = /^public-media\/(uploads|migrated)\/(player|post|sponsor)\/([a-f0-9-]{16,64})\.webp$/.exec(
    pathname.trim()
  );
  if (!match) return false;
  if (expectedEntity && match[2] !== expectedEntity) return false;
  return true;
}
