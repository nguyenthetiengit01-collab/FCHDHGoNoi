import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { requirePlayerSession, verifyCsrfOrigin } from "@/lib/auth";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB an toàn dưới ngưỡng 4.5MB của Vercel Serverless
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

function clampInt(raw: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyCsrfOrigin(req)) {
      return NextResponse.json(
        { error: "Yêu cầu bị từ chối do vi phạm bảo mật CSRF / Origin." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const auth = await requirePlayerSession(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || "Vui lòng đăng nhập để tải và xử lý ảnh" },
        { status: auth.status, headers: NO_STORE_HEADERS }
      );
    }

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const contentLengthHeader = req.headers.get("content-length");
      if (contentLengthHeader !== null) {
        const parsedLength = Number(contentLengthHeader);
        if (Number.isFinite(parsedLength) && parsedLength > MAX_UPLOAD_BYTES) {
          return NextResponse.json(
            { error: "Kích thước ảnh vượt quá giới hạn tối đa 4MB của máy chủ" },
            { status: 413, headers: NO_STORE_HEADERS }
          );
        }
      }

      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          { error: "Không tìm thấy file ảnh tải lên" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      if (file.size <= 0) {
        return NextResponse.json(
          { error: "File ảnh trống (0 byte)" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      if (file.type && !file.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Chỉ hỗ trợ định dạng tệp hình ảnh hợp lệ" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "Kích thước ảnh vượt quá giới hạn tối đa 4MB của máy chủ" },
          { status: 413, headers: NO_STORE_HEADERS }
        );
      }

      const maxWidth = clampInt(formData.get("maxWidth"), 1280, 64, 2560);
      const maxHeight = clampInt(formData.get("maxHeight"), 960, 64, 2560);
      const quality = clampInt(formData.get("quality"), 85, 40, 95);

      const arrayBuffer = await file.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "Kích thước ảnh vượt quá giới hạn tối đa 4MB của máy chủ" },
          { status: 413, headers: NO_STORE_HEADERS }
        );
      }
      const inputBuffer = Buffer.from(arrayBuffer);

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

      const dataUrl = `data:image/webp;base64,${webpBuffer.toString("base64")}`;
      return NextResponse.json(
        {
          dataUrl,
          originalSizeKB: Math.max(1, Math.round(inputBuffer.length / 1024)),
          webpSizeKB: Math.max(1, Math.round(webpBuffer.length / 1024)),
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      { error: "Định dạng yêu cầu không hợp lệ" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error("POST /api/webp error:", err);
    return NextResponse.json(
      { error: "Không thể chuyển đổi ảnh sang chuẩn WebP" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
