import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAuthSession, verifyCsrfOrigin } from "@/lib/auth";
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as HandleUploadBody;

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

    if (body?.type === "blob.generate-client-token") {
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

          if (entity === "post" || entity === "sponsor") {
            if (session.accessRole !== "manager") {
              throw new Error("Chỉ Ban Quản Lý mới có quyền tải ảnh bài viết hoặc nhà tài trợ.");
            }
          } else {
            const targetPlayerId = payload.playerId ?? session.playerId;
            if (
              session.accessRole !== "manager" &&
              (!Number.isInteger(targetPlayerId) || targetPlayerId !== session.playerId)
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

          return {
            allowedContentTypes: Array.from(ALLOWED_IMAGE_MIME_TYPES),
            maximumSizeInBytes: MAX_MEDIA_UPLOAD_BYTES,
            addRandomSuffix: true,
            allowOverwrite: false,
            tokenPayload: JSON.stringify({
              entity,
              uploadedByPlayerId: session.playerId,
            }),
          };
        },
        onUploadCompleted: async () => {
          // URL is persisted when the client submits the entity form.
        },
      });

      return NextResponse.json(jsonResponse, { status: 200, headers: NO_STORE_HEADERS });
    }

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        throw new Error("Unsupported handleUpload event");
      },
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse, { status: 200, headers: NO_STORE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Không thể cấp quyền upload ảnh.";
    const status =
      message.includes("quyền") || message.includes("Ban Quản Lý") ? 403 : 400;
    return NextResponse.json(
      { error: message },
      { status, headers: NO_STORE_HEADERS }
    );
  }
}
