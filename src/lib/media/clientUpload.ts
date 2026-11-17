"use client";

import type { MediaEntityType } from "./validation";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",", 2);
  const mimeMatch = /data:([^;]+);base64/i.exec(header || "");
  const mimeType = mimeMatch ? mimeMatch[1] : "image/webp";
  const binary = atob(base64 || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Uploads a client-converted WebP image to /api/media/upload when MEDIA_STORAGE_ENABLED=true.
 * Preserves legacy WebP dataUrl flow only when the server reports MEDIA_STORAGE_ENABLED=false.
 * Fails loudly on storage misconfiguration (missing BLOB_READ_WRITE_TOKEN) or upload errors.
 */
export async function resolvePublicMediaUpload(params: {
  dataUrl: string;
  entity: MediaEntityType;
  playerId?: number | null;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}): Promise<string> {
  const blob = dataUrlToBlob(params.dataUrl);
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
