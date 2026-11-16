import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getAuthSession } from "@/lib/auth";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

function clampInt(raw: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để tải và xử lý ảnh" },
        { status: 401 }
      );
    }

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          { error: "Không tìm thấy file ảnh tải lên" },
          { status: 400 }
        );
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "Kích thước ảnh vượt quá giới hạn tối đa 10MB" },
          { status: 413 }
        );
      }

      const maxWidth = clampInt(formData.get("maxWidth"), 1280, 64, 2560);
      const maxHeight = clampInt(formData.get("maxHeight"), 960, 64, 2560);
      const quality = clampInt(formData.get("quality"), 85, 40, 95);

      const arrayBuffer = await file.arrayBuffer();
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
      return NextResponse.json({
        dataUrl,
        originalSizeKB: Math.max(1, Math.round(inputBuffer.length / 1024)),
        webpSizeKB: Math.max(1, Math.round(webpBuffer.length / 1024)),
      });
    }

    return NextResponse.json(
      { error: "Định dạng yêu cầu không hợp lệ" },
      { status: 400 }
    );
  } catch (err) {
    console.error("POST /api/webp error:", err);
    return NextResponse.json(
      { error: "Không thể chuyển đổi ảnh sang chuẩn WebP" },
      { status: 500 }
    );
  }
}
