import { toPng, toBlob } from "html-to-image";

export interface ExportImageOptions {
  filename?: string;
  pixelRatio?: number;
  quality?: number;
  shareTitle?: string;
  shareText?: string;
  skipShare?: boolean; // Nếu true thì luôn tải file về máy thay vì mở share sheet
  preferShareOnMobile?: boolean; // Chỉ kích hoạt native share trên di động khi người dùng yêu cầu
}

/**
 * Chuyển đổi tên tiếng Việt có dấu thành slug an toàn cho tên file ảnh tải về
 */
export function sanitizeFilename(raw: string, defaultName = "anh-fc-hdh-go-noi"): string {
  if (!raw || typeof raw !== "string") return defaultName;
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || defaultName;
}

/**
 * Tạo tên file xuất chuẩn cho thẻ vận động viên
 */
export function buildAthleteCardFilename(playerName: string, jerseyNumber?: number | string | null): string {
  const safeName = sanitizeFilename(playerName, "cau-thu");
  const numStr = jerseyNumber !== undefined && jerseyNumber !== null && String(jerseyNumber).trim() !== ""
    ? `-${sanitizeFilename(String(jerseyNumber))}`
    : "";
  return `The-VDV${numStr}-${safeName}-FCHDHGoNoi.png`;
}

/**
 * Tạo tên file xuất chuẩn cho bảng điểm danh trận đấu
 */
export function buildMatchdayRosterFilename(matchLabel: string, matchDate?: string): string {
  const safeLabel = sanitizeFilename(matchLabel, "tran-dau");
  const dateStr = matchDate ? `-${sanitizeFilename(matchDate)}` : "";
  return `Diem-Danh-${safeLabel}${dateStr}-FCHDHGoNoi.png`;
}

/**
 * Kích hoạt tải Blob ảnh về máy thông qua thẻ <a> ảo trực tiếp vào thư mục Downloads của thiết bị
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.style.display = "none";
  link.href = url;
  link.setAttribute("download", filename);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 10000);
}

/**
 * Tải trực tiếp DOM Element thành file ảnh PNG về máy (Downloads folder)
 */
export async function downloadElementAsPng(
  element: HTMLElement,
  filename: string,
  options?: { pixelRatio?: number; quality?: number }
): Promise<void> {
  const blob = await captureElementToBlob(element, options);
  downloadBlob(blob, filename);
}

/**
 * Chụp DOM Element sang Blob PNG chất lượng cao (Retina pixelRatio 2x hoặc 3x)
 */
export async function captureElementToBlob(
  element: HTMLElement,
  options?: { pixelRatio?: number; quality?: number }
): Promise<Blob> {
  const pixelRatio = options?.pixelRatio ?? (typeof window !== "undefined" && window.devicePixelRatio > 1 ? 2.5 : 2);
  const quality = options?.quality ?? 0.95;

  const filter = (node: Node) => {
    if (node instanceof HTMLElement) {
      if (node.getAttribute("data-export-ignore") === "true") {
        return false;
      }
    }
    return true;
  };

  const blob = await toBlob(element, {
    pixelRatio,
    quality,
    cacheBust: true,
    filter,
  });

  if (!blob) {
    // Fallback qua toPng nếu toBlob trả null
    const dataUrl = await toPng(element, {
      pixelRatio,
      quality,
      cacheBust: true,
      filter,
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  }

  return blob;
}

/**
 * Xuất và Chia sẻ / Tải ảnh:
 * - Mặc định luôn tải trực tiếp file ảnh PNG sắc nét về máy (thư mục Downloads).
 * - Nếu ở trên điện thoại di động và có tùy chọn preferShareOnMobile, mở hộp thoại chia sẻ Zalo / AirDrop.
 */
export async function exportAndShareElement(
  element: HTMLElement,
  options: ExportImageOptions = {}
): Promise<{ shared: boolean; downloaded: boolean; cancelled?: boolean }> {
  const filename = options.filename || "FC-HDH-GoNoi.png";
  const blob = await captureElementToBlob(element, {
    pixelRatio: options.pixelRatio,
    quality: options.quality,
  });

  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

  // Chỉ mở Web Share API khi thực sự đang ở trên điện thoại di động và có yêu cầu preferShareOnMobile
  if (
    options.preferShareOnMobile &&
    isMobile &&
    !options.skipShare &&
    typeof navigator !== "undefined" &&
    typeof File !== "undefined"
  ) {
    try {
      const file = new File([blob], filename, { type: "image/png" });
      if (
        navigator.canShare &&
        navigator.canShare({ files: [file] }) &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({
          files: [file],
          title: options.shareTitle || "FC Hội Đồng Hương Gò Nổi",
          text: options.shareText || "Hình ảnh chia sẻ từ FC HĐH Gò Nổi",
        });
        return { shared: true, downloaded: false };
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return { shared: false, downloaded: false, cancelled: true };
      }
    }
  }

  // Luôn tải trực tiếp file ảnh về máy
  downloadBlob(blob, filename);
  return { shared: false, downloaded: true };
}
