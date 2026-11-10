"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  FlipHorizontal,
  RotateCcw,
  Sparkles,
  SunMedium,
  Check,
  X,
  Loader2,
  Move,
  Grid3X3,
  Upload,
  Save,
} from "lucide-react";
import {
  renderCroppedAvatarWebp,
  loadImageElement,
  type WebpConversionResult,
} from "@/lib/imageToWebp";

export interface AvatarCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSource: string | File | null;
  playerName?: string;
  jerseyNumber?: number | string | null;
  onConfirm: (result: WebpConversionResult) => void;
  onDirectSave?: (result: WebpConversionResult) => Promise<void>;
}

type LightingPreset = "original" | "bright" | "vivid";

export function AvatarCropperModal({
  isOpen,
  onClose,
  imageSource,
  playerName = "Cầu thủ",
  jerseyNumber,
  onConfirm,
  onDirectSave,
}: AvatarCropperModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pressedOutsideRef = useRef(false);

  // Local image override if user uploads another file inside studio
  const [localSource, setLocalSource] = useState<File | null>(null);
  const activeSource = localSource || imageSource;

  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [loadingImg, setLoadingImg] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [directSaving, setDirectSaving] = useState(false);
  const [imgError, setImgError] = useState("");

  // Transform states
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [lighting, setLighting] = useState<LightingPreset>("bright");

  // Viewport dimensions (3:4 ratio)
  const viewportW = 300;
  const viewportH = 400;

  // Pointer dragging state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  // Reset transforms whenever modal opens or new image is passed
  const resetTransform = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setRotation(0);
    setFlipH(false);
    setLighting("bright");
  }, []);

  // HTML5 Modal dialog show/close management (Guarantees Top Layer priority over any underlying modal)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  // Load image whenever activeSource changes
  useEffect(() => {
    if (!isOpen) {
      setLocalSource(null);
      setLoadedImg(null);
      setImgError("");
      return;
    }

    if (!activeSource) {
      setLoadedImg(null);
      setImgError("Chưa có hình ảnh để canh chỉnh. Vui lòng chọn ảnh.");
      return;
    }

    let active = true;
    setLoadingImg(true);
    setImgError("");
    resetTransform();

    loadImageElement(activeSource)
      .then((img) => {
        if (!active) return;
        setLoadedImg(img);
        setLoadingImg(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load image for cropping:", err);
        setImgError("Không thể tải hình ảnh này để canh chỉnh. Vui lòng bấm 'Đổi Ảnh Khác' để thử lại.");
        setLoadingImg(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, activeSource, resetTransform]);

  // Pointer handlers for panning the image
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX,
      panY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanX(dragStartRef.current.panX + dx);
    setPanY(dragStartRef.current.panY + dy);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom((prev) => Math.min(4, Math.max(1, Number((prev + delta).toFixed(2)))));
  };

  // Rotate 90 deg clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Flip horizontal
  const handleFlip = () => {
    setFlipH((prev) => !prev);
  };

  // Determine brightness & contrast by preset
  let brightnessVal = 0;
  let contrastVal = 0;
  if (lighting === "bright") {
    brightnessVal = 8;
    contrastVal = 6;
  } else if (lighting === "vivid") {
    brightnessVal = 5;
    contrastVal = 16;
  }

  // Generate cropped result
  const generateCroppedResult = async (): Promise<WebpConversionResult | null> => {
    if (!loadedImg) return null;
    const fileName =
      typeof activeSource === "object" && activeSource && "name" in activeSource
        ? activeSource.name
        : `avatar-${jerseyNumber ?? "vdv"}.webp`;

    return await renderCroppedAvatarWebp(loadedImg, {
      zoom,
      panX,
      panY,
      rotation,
      flipH,
      brightness: brightnessVal,
      contrast: contrastVal,
      viewportWidth: viewportW,
      viewportHeight: viewportH,
      targetWidth: 900,
      targetHeight: 1200,
      quality: 0.88,
      fileName,
    });
  };

  // Action 1: Áp dụng vào biểu mẫu đang sửa
  const handleApplyCrop = async () => {
    if (!loadedImg || processing || directSaving) return;
    setProcessing(true);
    try {
      const result = await generateCroppedResult();
      if (result) {
        onConfirm(result);
        dialogRef.current?.close();
      }
    } catch (err) {
      console.error("Crop error:", err);
      setImgError("Không thể cắt hình ảnh. Vui lòng thử lại.");
    } finally {
      setProcessing(false);
    }
  };

  // Action 2: Lưu trực tiếp vào cơ sở dữ liệu ngay lập tức
  const handleDirectSaveCrop = async () => {
    if (!loadedImg || processing || directSaving || !onDirectSave) return;
    setDirectSaving(true);
    try {
      const result = await generateCroppedResult();
      if (result) {
        await onDirectSave(result);
        onConfirm(result);
        dialogRef.current?.close();
      }
    } catch (err) {
      console.error("Direct save crop error:", err);
      setImgError("Không thể lưu ảnh trực tiếp vào cơ sở dữ liệu. Vui lòng thử lại.");
    } finally {
      setDirectSaving(false);
    }
  };

  // Check if click was outside dialog card
  const isOutsideDialog = (
    e: React.PointerEvent<HTMLDialogElement>,
    dialog: HTMLDialogElement
  ) => {
    const r = dialog.getBoundingClientRect();
    return (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    );
  };

  // Base scale calculation to cover viewport
  const naturalW = loadedImg?.naturalWidth || 1;
  const naturalH = loadedImg?.naturalHeight || 1;
  const baseScale = Math.max(viewportW / naturalW, viewportH / naturalH);
  const displayW = naturalW * baseScale * zoom;
  const displayH = naturalH * baseScale * zoom;

  return (
    <dialog
      ref={dialogRef}
      className="cropper-dialog"
      onPointerDown={(e) => {
        if (dialogRef.current) {
          pressedOutsideRef.current = isOutsideDialog(e, dialogRef.current);
        }
      }}
      onPointerUp={(e) => {
        if (
          dialogRef.current &&
          pressedOutsideRef.current &&
          isOutsideDialog(e, dialogRef.current)
        ) {
          dialogRef.current.close();
        }
        pressedOutsideRef.current = false;
      }}
    >
      {/* Hidden file input for quick change */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setLocalSource(file);
          }
          e.target.value = "";
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#092244]/90 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#ffd700]/20 border border-[#ffd700]/50 flex items-center justify-center text-[#ffd700] shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display font-black text-sm sm:text-base text-white uppercase tracking-tight">
              Studio Canh Chỉnh Ảnh Đại Diện
            </h3>
            <p className="text-[11px] text-sky-200">
              {playerName} {jerseyNumber ? `(#${jerseyNumber})` : ""} • Khung chuẩn 3:4 Thẻ VĐV
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sky-200 hover:text-white text-xs font-semibold border border-white/15 transition cursor-pointer"
            title="Tải ảnh khác từ máy"
          >
            <Upload className="h-3.5 w-3.5 text-[#ffd700]" />
            <span className="hidden sm:inline">Đổi Ảnh Khác</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Body with scrolling */}
      <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(100dvh-10rem)]">
        {imgError ? (
          <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/30 text-center text-rose-300 text-xs sm:text-sm space-y-3">
            <p>{imgError}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>Chọn Ảnh Khác Từ Máy</span>
            </button>
          </div>
        ) : loadingImg ? (
          <div className="h-80 sm:h-96 flex flex-col items-center justify-center gap-3 text-sky-200">
            <Loader2 className="h-8 w-8 animate-spin text-[#ffd700]" />
            <span className="text-xs font-semibold">Đang tải ảnh vào Studio...</span>
          </div>
        ) : (
          <>
            {/* Khu vực Cắt Ảnh (Viewport 300x400) */}
            <div className="flex flex-col items-center justify-center">
              <div
                className="relative overflow-hidden rounded-xl border-2 border-[#ffd700] shadow-[0_10px_35px_rgba(0,0,0,0.6)] cursor-grab active:cursor-grabbing select-none touch-none bg-slate-900"
                style={{ width: `${viewportW}px`, height: `${viewportH}px` }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
              >
                {/* Ảnh đang được transform */}
                {loadedImg && (
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{
                      transform: `translate3d(${panX}px, ${panY}px, 0)`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={loadedImg.src}
                      alt="Crop Preview"
                      draggable={false}
                      style={{
                        width: `${displayW}px`,
                        height: `${displayH}px`,
                        maxWidth: "none",
                        transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`,
                        filter: `brightness(${100 + brightnessVal}%) contrast(${100 + contrastVal}%)`,
                      }}
                      className="select-none transition-filter duration-150 pointer-events-none"
                    />
                  </div>
                )}

                {/* Lưới bố cục 3x3 (Rule of Thirds) */}
                {showGrid && (
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-45">
                    <div className="border-r border-b border-white/25" />
                    <div className="border-r border-b border-white/25" />
                    <div className="border-b border-white/25" />
                    <div className="border-r border-b border-white/25" />
                    <div className="border-r border-b border-white/25" />
                    <div className="border-b border-white/25" />
                    <div className="border-r border-white/25" />
                    <div className="border-r border-white/25" />
                    <div />
                  </div>
                )}

                {/* Vạch gợi ý căn chỉnh mặt & vai chuyên nghiệp */}
                <div className="absolute inset-x-0 top-10 flex flex-col items-center pointer-events-none opacity-40">
                  <div className="w-28 h-36 rounded-full border border-dashed border-[#ffd700]" />
                  <div className="w-48 h-16 rounded-t-full border-t border-dashed border-[#ffd700] -mt-2" />
                  <span className="text-[10px] font-bold text-[#ffd700] tracking-wider uppercase mt-1">
                    Khu vực khuôn mặt &amp; ngực
                  </span>
                </div>

                {/* Nút chỉ dẫn kéo thả */}
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-semibold text-slate-300 flex items-center gap-1 pointer-events-none border border-white/10">
                  <Move className="h-3 w-3 text-[#ffd700]" />
                  <span>Giữ &amp; kéo để canh vị trí</span>
                </div>

                {/* Tỷ lệ chuẩn 3:4 */}
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-[#ffd700] border border-white/10 pointer-events-none">
                  Tỷ lệ 3:4
                </div>
              </div>
            </div>

            {/* Thanh Công Cụ Điều Khiển (Zoom, Rotate, Flip, Presets) */}
            <div className="space-y-3 pt-2">
              {/* Thu phóng (Zoom slider) */}
              <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(1, Number((z - 0.2).toFixed(1))))}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>

                <input
                  type="range"
                  min="1"
                  max="4"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-[#ffd700] cursor-pointer"
                />

                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(4, Number((z + 0.2).toFixed(1))))}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                  title="Phóng to"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>

                <span className="text-xs font-mono font-bold text-[#ffd700] w-12 text-right">
                  {zoom.toFixed(1)}x
                </span>
              </div>

              {/* Các nút thao tác xoay, lật, lưới, reset */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleRotate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition cursor-pointer border border-white/15"
                    title="Xoay 90 độ"
                  >
                    <RotateCw className="h-3.5 w-3.5 text-sky-300" />
                    <span>Xoay 90°</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFlip}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer border ${
                      flipH
                        ? "bg-[#ffd700]/25 text-[#ffd700] border-[#ffd700]/50"
                        : "bg-white/10 hover:bg-white/20 text-white border-white/15"
                    }`}
                    title="Lật gương ngang"
                  >
                    <FlipHorizontal className="h-3.5 w-3.5" />
                    <span>Lật ngang</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowGrid((g) => !g)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer border ${
                      showGrid
                        ? "bg-sky-500/25 text-sky-300 border-sky-400/50"
                        : "bg-white/10 hover:bg-white/20 text-slate-300 border-white/15"
                    }`}
                    title="Bật / tắt lưới căn chỉnh"
                  >
                    <Grid3X3 className="h-3.5 w-3.5" />
                    <span>Lưới</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={resetTransform}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer text-xs"
                  title="Đặt lại vị trí ban đầu"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Mặc định</span>
                </button>
              </div>

              {/* 3 Preset ánh sáng sân cỏ */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                <span className="text-[11px] font-bold text-sky-200 flex items-center gap-1 shrink-0">
                  <SunMedium className="h-3.5 w-3.5 text-[#ffd700]" />
                  <span>Bộ lọc màu:</span>
                </span>
                <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setLighting("original")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer border ${
                      lighting === "original"
                        ? "bg-[#ffd700] text-slate-950 border-[#ffd700]"
                        : "bg-white/10 text-slate-300 border-white/15 hover:text-white"
                    }`}
                  >
                    Nguyên bản
                  </button>
                  <button
                    type="button"
                    onClick={() => setLighting("bright")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer border ${
                      lighting === "bright"
                        ? "bg-[#ffd700] text-slate-950 border-[#ffd700]"
                        : "bg-white/10 text-slate-300 border-white/15 hover:text-white"
                    }`}
                  >
                    Sáng sân cỏ ✨
                  </button>
                  <button
                    type="button"
                    onClick={() => setLighting("vivid")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer border ${
                      lighting === "vivid"
                        ? "bg-[#ffd700] text-slate-950 border-[#ffd700]"
                        : "bg-white/10 text-slate-300 border-white/15 hover:text-white"
                    }`}
                  >
                    Tương phản thể thao
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-5 py-3.5 border-t border-white/10 bg-[#06182f] shrink-0">
        <button
          type="button"
          onClick={onClose}
          disabled={processing || directSaving}
          className="px-3.5 py-2 rounded-xl border border-white/20 text-xs font-bold text-slate-300 hover:bg-white/10 transition cursor-pointer text-center"
        >
          Hủy bỏ
        </button>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Action 1: Áp dụng vào biểu mẫu đang sửa */}
          <button
            type="button"
            onClick={handleApplyCrop}
            disabled={!loadedImg || processing || directSaving}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition cursor-pointer disabled:opacity-50"
            title="Đưa ảnh đã cắt vào biểu mẫu hồ sơ"
          >
            {processing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-300" />
                <span>Đang cắt ảnh WebP...</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Áp Dụng Vào Biểu Mẫu</span>
              </>
            )}
          </button>

          {/* Action 2: Lưu trực tiếp vào cơ sở dữ liệu ngay (nếu có onDirectSave) */}
          {onDirectSave && (
            <button
              type="button"
              onClick={handleDirectSaveCrop}
              disabled={!loadedImg || processing || directSaving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#ffd700] via-[#fde047] to-[#eab308] hover:from-[#fde047] hover:to-[#ffd700] text-slate-950 font-black text-xs sm:text-sm shadow-md transition cursor-pointer disabled:opacity-50"
              title="Lưu ngay lập tức vào cơ sở dữ liệu"
            >
              {directSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                  <span>Đang lưu vào hồ sơ...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 text-slate-950" />
                  <span>Cắt &amp; Lưu Vào Hồ Sơ Ngay</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
