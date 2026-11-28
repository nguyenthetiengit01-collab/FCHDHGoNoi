import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { requirePlayerSession, verifyCsrfOrigin } from "@/lib/auth";
import { guardCutoverWrite } from "@/lib/cutoverFreeze";
import {
  MediaStorageError,
  getMediaStorageProvider,
} from "@/lib/media/storage";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_SERVER_MULTIPART_UPLOAD_BYTES,
  buildSafePublicMediaPathname,
  hasValidImageMagicBytes,
  isMediaStorageEnabled,
  type MediaEntityType,
} from "@/lib/media/validation";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

function clampInt(
  raw: FormDataEntryValue | null,
  fallback: number,
  min: number,
  max: number
): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function POST(req: NextRequest) {
  const freezeRes = guardCutoverWrite("POST /api/media/upload");
  if (freezeRes) return freezeRes;

  try {
    if (!verifyCsrfOrigin(req)) {
      return NextResponse.json(
        { error: "Yêu cầu bị từ chối do vi phạm bảo mật CSRF / Origin." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const auth = await requirePlayerSession(req);
    if (!auth.authorized || !auth.session) {
      return NextResponse.json(
        {
          error: auth.error || "Vui lòng đăng nhập để tải ảnh lên.",
          ...(auth.errorCode ? { code: auth.errorCode } : {}),
        },
        { status: auth.status, headers: NO_STORE_HEADERS }
      );
    }
    const session = auth.session;

    if (!isMediaStorageEnabled()) {
      return NextResponse.json(
        { error: "Kho lưu trữ media (MEDIA_STORAGE_ENABLED) chưa được bật." },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Định dạng yêu cầu phải là multipart/form-data." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const formData = await req.formData();
    const entityRaw = String(formData.get("entity") || "").trim() as MediaEntityType;
    if (entityRaw !== "player" && entityRaw !== "post" && entityRaw !== "sponsor") {
      return NextResponse.json(
        { error: "Phân loại media không hợp lệ." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (entityRaw === "post" || entityRaw === "sponsor") {
      if (session.accessRole !== "manager") {
        return NextResponse.json(
          { error: "Chỉ Ban Quản Lý mới có quyền tải ảnh bài viết hoặc nhà tài trợ." },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
    } else {
      const targetPlayerIdRaw = formData.get("playerId");
      const targetPlayerId = targetPlayerIdRaw ? Number(targetPlayerIdRaw) : session.playerId;
      if (
        session.accessRole !== "manager" &&
        (!Number.isInteger(targetPlayerId) || targetPlayerId !== session.playerId)
      ) {
        return NextResponse.json(
          { error: "Bạn không có quyền tải ảnh cho hồ sơ cầu thủ khác." },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "Không tìm thấy file ảnh tải lên." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (file.size > MAX_SERVER_MULTIPART_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error:
            "Kích thước ảnh vượt quá giới hạn upload qua server (tối đa 4MB). Vui lòng dùng client upload trực tiếp cho ảnh tới 10MB.",
        },
        { status: 413, headers: NO_STORE_HEADERS }
      );
    }

    if (file.type && !ALLOWED_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: "Định dạng ảnh không được hỗ trợ (chỉ nhận WebP, JPEG, PNG, AVIF)." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    if (!hasValidImageMagicBytes(inputBuffer)) {
      return NextResponse.json(
        { error: "Dữ liệu ảnh không hợp lệ hoặc bị giả mạo định dạng." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const maxWidth = clampInt(formData.get("maxWidth"), 1280, 64, 2560);
    const maxHeight = clampInt(formData.get("maxHeight"), 960, 64, 2560);
    const quality = clampInt(formData.get("quality"), 85, 40, 95);

    const webpBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer();

    const pathname = buildSafePublicMediaPathname({
      entity: entityRaw,
      buffer: webpBuffer,
      prefix: "uploads",
      extension: "webp",
    });

    const provider = getMediaStorageProvider();
    const uploaded = await provider.uploadPublicAsset({
      pathname,
      buffer: webpBuffer,
      contentType: "image/webp",
      visibility: "public",
      entity: entityRaw,
    });

    return NextResponse.json(uploaded, { status: 200, headers: NO_STORE_HEADERS });
  } catch (err) {
    if (err instanceof MediaStorageError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: NO_STORE_HEADERS }
      );
    }
    return NextResponse.json(
      { error: "Không thể tải ảnh lên kho lưu trữ." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
