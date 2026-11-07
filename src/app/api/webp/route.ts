import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  try {
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

      const maxWidth = Number(formData.get("maxWidth")) || 1280;
      const maxHeight = Number(formData.get("maxHeight")) || 960;
      const quality = Number(formData.get("quality")) || 85;

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

