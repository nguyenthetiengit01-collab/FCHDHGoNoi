/**
 * Bộ công cụ tự động chuyển đổi mọi định dạng ảnh (JPG, PNG, HEIC, BMP, GIF...)
 * sang chuẩn WebP chất lượng cao ngay trên trình duyệt trước khi tải lên máy chủ.
 */

export interface WebpConversionResult {
  /** Chuỗi Data URL định dạng data:image/webp;base64,... */
  dataUrl: string;
  /** Dung lượng file gốc (KB) */
  originalSizeKB: number;
  /** Dung lượng sau khi chuyển sang WebP (KB) */
  webpSizeKB: number;
  /** Phần trăm dung lượng tiết kiệm được */
  savedPercent: number;
  /** Chiều rộng ảnh WebP sau xử lý */
  width: number;
  /** Chiều cao ảnh WebP sau xử lý */
  height: number;
  /** Tên file đã đổi đuôi sang .webp */
  webpFileName: string;
}

export interface ConvertToWebpOptions {
  /** Chiều rộng tối đa (mặc định 1280px cho bài viết, 720px cho chân dung cầu thủ) */
  maxWidth?: number;
  /** Chiều cao tối đa (mặc định 960px) */
  maxHeight?: number;
  /** Chất lượng nén WebP từ 0.1 -> 1.0 (mặc định 0.85) */
  quality?: number;
  /**
   * Chế độ khung hình:
   * - "portrait": Tối ưu ảnh cầu thủ (ưu tiên lấy nửa thân trên rõ nét, tỉ lệ 3:4 hoặc giữ nguyên nếu hợp lý)
   * - "contain": Giữ nguyên tỉ lệ gốc của ảnh bài viết/hoạt động, thu phóng vừa khung maxWidth x maxHeight
   */
  mode?: "portrait" | "contain";
}

function estimateBase64SizeKB(dataUrl: string): number {
  const base64Part = dataUrl.split(",")[1] || "";
  const byteLength = Math.round((base64Part.length * 3) / 4);
  return Math.max(1, Math.round(byteLength / 1024));
}

function toWebpFileName(originalName: string): string {
  const base = originalName.replace(/\.[^/.]+$/, "");
  return `${base || "image"}.webp`;
}

/**
 * Chuyển đổi 1 file ảnh bất kỳ sang chuẩn WebP trước khi upload lên website
 */
export async function convertFileToWebp(
  file: File,
  options: ConvertToWebpOptions = {}
): Promise<WebpConversionResult> {
  const {
    maxWidth = 1280,
    maxHeight = 960,
    quality = 0.85,
    mode = "contain",
  } = options;

  const originalSizeKB = Math.max(1, Math.round(file.size / 1024));
  const webpFileName = toWebpFileName(file.name);

  return new Promise<WebpConversionResult>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không thể đọc file hình ảnh."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Định dạng hình ảnh không hợp lệ."));
      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas");
          let sx = 0;
          let sy = 0;
          let sWidth = img.width;
          let sHeight = img.height;
          let targetW = img.width;
          let targetH = img.height;

          if (mode === "portrait") {
            // Tỉ lệ chuẩn chân dung nửa thân trên 3:4 (ví dụ 600x800)
            const targetRatio = 3 / 4;
            const currentRatio = img.width / img.height;

            if (currentRatio > targetRatio) {
              // Ảnh quá ngang -> cắt đều 2 bên, giữ trung tâm
              sWidth = Math.round(img.height * targetRatio);
              sx = Math.round((img.width - sWidth) / 2);
            } else if (currentRatio < targetRatio) {
              // Ảnh quá dài dọc -> ưu tiên lấy từ đỉnh đầu xuống nửa thân trên (top-biased)
              sHeight = Math.round(img.width / targetRatio);
              sy = Math.min(
                Math.round((img.height - sHeight) * 0.12),
                img.height - sHeight
              );
            }

            const maxPortraitW = Math.min(maxWidth, 600);
            const maxPortraitH = Math.min(maxHeight, 800);
            const scale = Math.min(
              1,
              maxPortraitW / sWidth,
              maxPortraitH / sHeight
            );
            targetW = Math.max(1, Math.round(sWidth * scale));
            targetH = Math.max(1, Math.round(sHeight * scale));
          } else {
            // Chế độ "contain" cho ảnh bìa & ảnh bài viết hoạt động CLB
            const scale = Math.min(1, maxWidth / sWidth, maxHeight / sHeight);
            targetW = Math.max(1, Math.round(sWidth * scale));
            targetH = Math.max(1, Math.round(sHeight * scale));
          }

          canvas.width = targetW;
          canvas.height = targetH;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Trình duyệt không hỗ trợ xử lý ảnh Canvas 2D.");
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH);

          // Xuất trực tiếp sang định dạng image/webp
          let webpDataUrl = canvas.toDataURL("image/webp", quality);

          // Nếu trình duyệt cũ không hỗ trợ xuất image/webp trực tiếp từ canvas,
          // gọi API server /api/webp (dùng sharp) để ép chuyển sang WebP 100%
          if (!webpDataUrl.startsWith("data:image/webp")) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("maxWidth", String(targetW));
            formData.append("maxHeight", String(targetH));
            const resp = await fetch("/api/webp", {
              method: "POST",
              body: formData,
            });
            if (resp.ok) {
              const json = await resp.json();
              if (json.dataUrl) {
                webpDataUrl = json.dataUrl;
              }
            }
          }

          const webpSizeKB = estimateBase64SizeKB(webpDataUrl);
          const savedPercent =
            originalSizeKB > webpSizeKB
              ? Math.round(((originalSizeKB - webpSizeKB) / originalSizeKB) * 100)
              : 0;

          resolve({
            dataUrl: webpDataUrl,
            originalSizeKB,
            webpSizeKB,
            savedPercent,
            width: targetW,
            height: targetH,
            webpFileName,
          });
        } catch (err) {
          reject(err);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Chuyển đổi danh sách nhiều file ảnh sang WebP (dùng cho thư viện ảnh bài viết)
 */
export async function convertMultipleFilesToWebp(
  files: FileList | File[],
  options: ConvertToWebpOptions = {}
): Promise<WebpConversionResult[]> {
  const arr = Array.from(files);
  const results: WebpConversionResult[] = [];
  for (const file of arr) {
    const converted = await convertFileToWebp(file, options);
    results.push(converted);
  }
  return results;
}

export interface AvatarCropTransform {
  zoom: number; // 1.0 -> 4.0
  panX: number; // Offset X tính trên viewport
  panY: number; // Offset Y tính trên viewport
  rotation: number; // 0, 90, 180, 270 độ
  flipH: boolean; // Lật ngang
  brightness: number; // -50 đến +50 (0 là bình thường)
  contrast: number; // -50 đến +50 (0 là bình thường)
  viewportWidth: number; // Kích thước viewport hiển thị (ví dụ 300)
  viewportHeight: number; // Kích thước viewport hiển thị (ví dụ 400)
  targetWidth?: number; // Độ phân giải xuất ra (mặc định 900px)
  targetHeight?: number; // Độ phân giải xuất ra (mặc định 1200px)
  quality?: number; // 0.88
  fileName?: string;
}

/**
 * Tải ảnh an toàn từ File, DataURL hoặc URL để vẽ lên Canvas
 */
export function loadImageElement(source: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Không thể tải hình ảnh để xử lý."));

    if (typeof source === "string") {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = String(reader.result);
      };
      reader.onerror = () => reject(new Error("Không thể đọc file hình ảnh."));
      reader.readAsDataURL(source);
    }
  });
}

/**
 * Cắt & hiệu chỉnh ảnh đại diện cầu thủ với độ phân giải cao WebP (900x1200px)
 */
export async function renderCroppedAvatarWebp(
  source: string | File | HTMLImageElement,
  transform: AvatarCropTransform
): Promise<WebpConversionResult> {
  const {
    zoom = 1,
    panX = 0,
    panY = 0,
    rotation = 0,
    flipH = false,
    brightness = 0,
    contrast = 0,
    viewportWidth = 300,
    viewportHeight = 400,
    targetWidth = 900,
    targetHeight = 1200,
    quality = 0.88,
    fileName = "avatar-cau-thu.webp",
  } = transform;

  const img =
    source instanceof HTMLImageElement ? source : await loadImageElement(source);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Trình duyệt không hỗ trợ Canvas 2D.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Áp dụng bộ lọc ánh sáng & tương phản nếu có
  const filterParts: string[] = [];
  if (brightness !== 0) {
    filterParts.push(`brightness(${100 + brightness}%)`);
  }
  if (contrast !== 0) {
    filterParts.push(`contrast(${100 + contrast}%)`);
  }
  if (filterParts.length > 0) {
    ctx.filter = filterParts.join(" ");
  }

  // Tỉ lệ scale giữa viewport xem trước và canvas thực tế xuất ra
  const resMultiplier = targetWidth / viewportWidth;

  // Tính toán kích thước ảnh cơ sở để cover viewport
  const baseScale = Math.max(
    viewportWidth / img.naturalWidth,
    viewportHeight / img.naturalHeight
  );

  const finalDrawW = img.naturalWidth * baseScale * zoom * resMultiplier;
  const finalDrawH = img.naturalHeight * baseScale * zoom * resMultiplier;

  ctx.save();
  // Di chuyển tâm vẽ tới tọa độ trung tâm + pan di chuyển của người dùng
  ctx.translate(
    targetWidth / 2 + panX * resMultiplier,
    targetHeight / 2 + panY * resMultiplier
  );

  // Xoay ảnh
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }

  // Lật ảnh ngang
  if (flipH) {
    ctx.scale(-1, 1);
  }

  // Vẽ ảnh tâm đối xứng
  ctx.drawImage(img, -finalDrawW / 2, -finalDrawH / 2, finalDrawW, finalDrawH);
  ctx.restore();

  // Xuất WebP
  let webpDataUrl = canvas.toDataURL("image/webp", quality);

  // Fallback nếu trình duyệt cũ không hỗ trợ WebP từ canvas
  if (!webpDataUrl.startsWith("data:image/webp")) {
    webpDataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  const webpSizeKB = estimateBase64SizeKB(webpDataUrl);
  const originalSizeKB =
    typeof source === "object" && "size" in source
      ? Math.round(source.size / 1024)
      : webpSizeKB;

  return {
    dataUrl: webpDataUrl,
    originalSizeKB,
    webpSizeKB,
    savedPercent:
      originalSizeKB > webpSizeKB
        ? Math.round(((originalSizeKB - webpSizeKB) / originalSizeKB) * 100)
        : 0,
    width: targetWidth,
    height: targetHeight,
    webpFileName: fileName.endsWith(".webp") ? fileName : `${fileName}.webp`,
  };
}


