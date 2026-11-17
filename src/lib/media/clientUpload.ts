"use client";

import { upload } from "@vercel/blob/client";
import type { MediaEntityType } from "./validation";

const CLIENT_MULTIPART_THRESHOLD_BYTES = 4 * 1024 * 1024; // 4MB (safe under Vercel 4.5MB Function cap)
const CLIENT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB (Direct Client Upload cap)

function dataUrlToBytesAndMime(dataUrl: string): { bytes: Uint8Array; mimeType: string } {
  const [header, base64] = dataUrl.split(",", 2);
  const mimeMatch = /data:([^;]+);base64/i.exec(header || "");
  const mimeType = (mimeMatch ? mimeMatch[1] : "image/webp").toLowerCase();
  const binary = atob(base64 || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { bytes, mimeType };
}

function hasValidClientImageMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isAvif =
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70;
  return isWebp || isJpeg || isPng || isAvif;
}

function buildClientSafePathname(entity: MediaEntityType): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}${Math.random().toString(16).slice(2, 10)}`;
  return `public-media/uploads/${entity}/${uuid.toLowerCase()}.webp`;
}

/**
 * Uploads a client-converted WebP image:
 * - <= 4MB: uses POST /api/media/upload (server-side sharp validation + Blob)
 * - > 4MB and <= 10MB: uses @vercel/blob/client direct upload via /api/media/client-upload
 * Preserves legacy WebP dataUrl flow ONLY when MEDIA_STORAGE_ENABLED=false.
 * Fails loudly on storage misconfiguration or upload errors.
 */
export async function resolvePublicMediaUpload(params: {
  dataUrl: string;
  entity: MediaEntityType;
  playerId?: number | null;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}): Promise<string> {
  const { bytes, mimeType } = dataUrlToBytesAndMime(params.dataUrl);
  if (!hasValidClientImageMagicBytes(bytes)) {
    throw new Error("Dữ liệu ảnh không hợp lệ.");
  }
  if (bytes.byteLength > CLIENT_MAX_UPLOAD_BYTES) {
    throw new Error("Kích thước ảnh vượt quá giới hạn tối đa 10MB.");
  }

  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blob = new Blob([arrayBuffer], { type: mimeType });

  if (blob.size <= CLIENT_MULTIPART_THRESHOLD_BYTES) {
    const formData = new FormData();
    formData.append("file", blob, "upload.webp");
    formData.append("entity", params.entity);
    if (params.playerId && Number.isInteger(params.playerId) && params.playerId > 0) {
      formData.append("playerId", String(params.playerId));
    }
    if (params.maxWidth) formData.append("maxWidth", String(params.maxWidth));
    if (params.maxHeight) formData.append("maxHeight", String(params.maxHeight));
    if (params.quality) formData.append("quality", String(Math.round(params.quality * 100)));

    const res = await fetch("/api/media/upload", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const json = (await res.json()) as { url?: string };
      if (!json.url) {
        throw new Error("Phản hồi upload thiếu URL hợp lệ.");
      }
      return json.url;
    }

    const errJson = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };

    // Preserve legacy WebP dataUrl behavior ONLY when MEDIA_STORAGE_ENABLED is intentionally off.
    if (res.status === 503 && !errJson.code) {
      return params.dataUrl;
    }

    throw new Error(errJson.error || "Không thể tải ảnh lên Object Storage.");
  }

  // > 4MB and <= 10MB: direct browser-to-Vercel-Blob upload via /api/media/client-upload
  const pathname = buildClientSafePathname(params.entity);
  const clientPayload = JSON.stringify({
    entity: params.entity,
    playerId:
      params.playerId && Number.isInteger(params.playerId) && params.playerId > 0
        ? params.playerId
        : undefined,
    contentType: mimeType,
    sizeBytes: blob.size,
  });

  // Pre-check handleUploadUrl availability so we distinguish MEDIA_STORAGE_ENABLED=false from misconfiguration
  try {
    const result = await upload(pathname, blob, {
      access: "public",
      contentType: mimeType,
      handleUploadUrl: "/api/media/client-upload",
      clientPayload,
    });
    return result.url;
  } catch (err) {
    // Check if storage is intentionally disabled vs misconfigured/failed
    const probe = await fetch("/api/media/client-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "blob.generate-client-token", payload: {} }),
    }).catch(() => null);

    if (probe && probe.status === 503) {
      const probeJson = (await probe.json().catch(() => ({}))) as { code?: string };
      if (!probeJson.code) {
        return params.dataUrl;
      }
    }

    throw err instanceof Error ? err : new Error("Không thể tải ảnh trực tiếp lên Object Storage.");
  }
}
