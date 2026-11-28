import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAuthSession, verifyCsrfOrigin } from "@/lib/auth";
import {
  CLIENT_UPLOAD_TOKEN_TTL_MS,
  guardCutoverWrite,
} from "@/lib/cutoverFreeze";
import { handleClientUploadCompletedCallback } from "@/lib/media/clientUploadCallback";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_MEDIA_UPLOAD_BYTES,
  isMediaStorageEnabled,
  isValidSafePublicMediaPathname,
  type MediaEntityType,
} from "@/lib/media/validation";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

interface ClientUploadPayload {
  entity?: MediaEntityType;
  playerId?: number | null;
  contentType?: string;
  sizeBytes?: number;
}

function resolveClientUploadCallbackUrl(req: NextRequest): string {
  const explicitBase = process.env.VERCEL_BLOB_CALLBACK_URL?.trim();
  if (explicitBase) {
    return `${explicitBase.replace(/\/+$/, "")}/api/media/client-upload/callback`;
  }
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_BRANCH_URL) {
    return `https://${process.env.VERCEL_BRANCH_URL}/api/media/client-upload/callback`;
  }
  if (
    process.env.VERCEL_ENV === "production" &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/media/client-upload/callback`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/media/client-upload/callback`;
  }
  return new URL("/api/media/client-upload/callback", req.url).toString();
}

export async function POST(req: NextRequest) {
  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    const freezeRes = guardCutoverWrite("POST /api/media/client-upload");
    if (freezeRes) return freezeRes;
    return NextResponse.json(
      { error: "Payload JSON không hợp lệ." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // Legacy callback compatibility during Stage 1 Drain:
  // Pre-split tokens carry callbackUrl=/api/media/client-upload. Route verified
  // blob.upload-completed callbacks to the shared idempotent handler (guarded only
  // by Stage 2 P103_CUTOVER_FREEZE_CALLBACKS), while blocking all token generation
  // in Stage 1 via guardCutoverWrite().
  if (body?.type === "blob.upload-completed") {
    return handleClientUploadCompletedCallback(
      req,
      body,
      "POST /api/media/client-upload"
    );
  }

  const freezeRes = guardCutoverWrite("POST /api/media/client-upload");
  if (freezeRes) return freezeRes;

  try {
    if (!isMediaStorageEnabled()) {
      return NextResponse.json(
        { error: "Kho lưu trữ media (MEDIA_STORAGE_ENABLED) chưa được bật." },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
      return NextResponse.json(
        {
          error: "Thiếu cấu hình BLOB_READ_WRITE_TOKEN cho Object Storage.",
          code: "BLOB_STORAGE_NOT_CONFIGURED",
        },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    if (body?.type !== "blob.generate-client-token") {
      return NextResponse.json(
        { error: "Loại sự kiện upload không được hỗ trợ." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!verifyCsrfOrigin(req)) {
      return NextResponse.json(
        { error: "Yêu cầu bị từ chối do vi phạm bảo mật CSRF / Origin." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const session = getAuthSession(req);
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để tải ảnh lên." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const callbackUrl = resolveClientUploadCallbackUrl(req);

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayloadRaw) => {
        let payload: ClientUploadPayload = {};
        if (clientPayloadRaw) {
          try {
            payload = JSON.parse(clientPayloadRaw) as ClientUploadPayload;
          } catch {
            throw new Error("Thông tin upload không hợp lệ.");
          }
        }

        const entity = payload.entity;
        if (entity !== "player" && entity !== "post" && entity !== "sponsor") {
          throw new Error("Phân loại media không hợp lệ.");
        }

        if (!isValidSafePublicMediaPathname(pathname, entity)) {
          throw new Error("Đường dẫn lưu trữ media không hợp lệ.");
        }

        const targetPlayerId =
          entity === "player" ? (payload.playerId ?? session.playerId) : null;

        if (entity === "post" || entity === "sponsor") {
          if (session.accessRole !== "manager") {
            throw new Error(
              "Chỉ Ban Quản Lý mới có quyền tải ảnh bài viết hoặc nhà tài trợ."
            );
          }
        } else {
          if (
            session.accessRole !== "manager" &&
            (!Number.isInteger(targetPlayerId) ||
              targetPlayerId !== session.playerId)
          ) {
            throw new Error("Bạn không có quyền tải ảnh cho hồ sơ cầu thủ khác.");
          }
        }

        if (
          payload.contentType &&
          !ALLOWED_IMAGE_MIME_TYPES.has(payload.contentType.toLowerCase())
        ) {
          throw new Error("Định dạng ảnh không được hỗ trợ.");
        }

        if (
          typeof payload.sizeBytes !== "number" ||
          !Number.isFinite(payload.sizeBytes) ||
          payload.sizeBytes <= 0 ||
          payload.sizeBytes > MAX_MEDIA_UPLOAD_BYTES
        ) {
          throw new Error("Kích thước ảnh vượt quá giới hạn 10MB.");
        }

        const issuedAt = Date.now();
        const expiresAt = issuedAt + CLIENT_UPLOAD_TOKEN_TTL_MS;

        return {
          allowedContentTypes: Array.from(ALLOWED_IMAGE_MIME_TYPES),
          maximumSizeInBytes: MAX_MEDIA_UPLOAD_BYTES,
          addRandomSuffix: true,
          allowOverwrite: false,
          validUntil: expiresAt,
          callbackUrl,
          tokenPayload: JSON.stringify({
            entity,
            playerId: targetPlayerId,
            uploadedByPlayerId: session.playerId,
            issuedAt,
            expiresAt,
          }),
        };
      },
      onUploadCompleted: async () => {
        // New tokens route callbacks to /api/media/client-upload/callback
      },
    });

    return NextResponse.json(jsonResponse, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Không thể cấp quyền upload ảnh.";
    const status =
      message.includes("quyền") || message.includes("Ban Quản Lý") ? 403 : 400;
    return NextResponse.json(
      { error: message },
      { status, headers: NO_STORE_HEADERS }
    );
  }
}
