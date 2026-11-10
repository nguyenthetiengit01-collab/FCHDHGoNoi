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
}

type LightingPreset = "original" | "bright" | "vivid";

export function AvatarCropperModal({
  isOpen,
  onClose,
  imageSource,
  playerName = "Cầu thủ",
  jerseyNumber,
  onConfirm,
}: AvatarCropperModalProps) {
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [loadingImg, setLoadingImg] = useState(false);
  const [processing, setProcessing] = useState(false);
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

  useEffect(() => {
    if (!isOpen || !imageSource) {
      setLoadedImg(null);
      setImgError("");
      return;
    }

    let active = true;
    setLoadingImg(true);
    setImgError("");
    resetTransform();

    loadImageElement(imageSource)
      .then((img) => {
        if (!active) return;
        setLoadedImg(img);
        setLoadingImg(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load image for cropping:", err);
        setImgError("Không thể tải hình ảnh này để canh chỉnh. Vui lòng thử ảnh khác.");
        setLoadingImg(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, imageSource, resetTransform]);

  if (!isOpen) return null;

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

  // Handle Save Crop
  const handleSaveCrop = async () => {
    if (!loadedImg || processing) return;
    setProcessing(true);
    try {
      const fileName =
        typeof imageSource === "object" && imageSource && "name" in imageSource
          ? imageSource.name
          : `avatar-${jerseyNumber ?? "vdv"}.webp`;

      const result = await renderCroppedAvatarWebp(loadedImg, {
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

      onConfirm(result);
      onClose();
    } catch (err) {
      console.error("Crop error:", err);
      setImgError("Không thể cắt hình ảnh. Vui lòng thử lại.");
    } finally {
      setProcessing(false);
    }
  };

  // Base scale calculation to cover viewport
  const naturalW = loadedImg?.naturalWidth || 1;
  const naturalH = loadedImg?.naturalHeight || 1;
  const baseScale = Math.max(viewportW / naturalW, viewportH / naturalH);
  const displayW = naturalW * baseScale * zoom;
  const displayH = naturalH * baseScale * zoom;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-gradient-to-b from-[#092244] via-[#071a33] to-[#040e1a] border border-[#d4af37]/60 shadow-[0_25px_60px_rgba(0,0,0,0.8)] text-white overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#092244]/80">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#ffd700]/20 border border-[#ffd700]/50 flex items-center justify-center text-[#ffd700]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display font-black text-base sm:text-lg text-white uppercase tracking-tight">
                Studio Canh Chỉnh Ảnh Đại Diện
              </h3>
              <p className="text-xs text-sky-200">
                {playerName} {jerseyNumber ? `(#${jerseyNumber})` : ""} • Khung chuẩn 3:4 Thẻ VĐV
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {imgError ? (
            <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/30 text-center text-rose-300 text-sm">
              {imgError}
            </div>
          ) : loadingImg ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3 text-sky-200">
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
                  onWheel={handleWheel}
                >
                  {/* Ảnh gốc hiển thị tương tác */}
                  {loadedImg && (
                    <div
                      className="absolute left-1/2 top-1/2 pointer-events-none will-change-transform"
                      style={{
                        width: `${displayW}px`,
                        height: `${displayH}px`,
                        transform: `translate(-50%, -50%) translate(${panX}px, ${panY}px) rotate(${rotation}deg) scale(${
                          flipH ? -1 : 1
                        }, 1)`,
                        filter: `brightness(${100 + brightnessVal}%) contrast(${
                          100 + contrastVal
                        }%)`,
                        transition: isDraggingRef.current ? "none" : "transform 0.05s ease-out",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={loadedImg.src}
                        alt="Ảnh đang chỉnh"
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </div>
                  )}

                  {/* Lưới Quy tắc 1/3 (Rule of Thirds) */}
                  {showGrid && (
                    <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
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
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10 bg-[#06182f]">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 rounded-xl border border-white/20 text-xs font-bold text-slate-300 hover:bg-white/10 transition cursor-pointer"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={handleSaveCrop}
            disabled={!loadedImg || processing}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#ffd700] via-[#fde047] to-[#eab308] hover:from-[#fde047] hover:to-[#ffd700] text-slate-950 font-black text-xs sm:text-sm shadow-md transition cursor-pointer disabled:opacity-50"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                <span>Đang xử lý WebP HD (900x1200)...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4 text-slate-950" />
                <span>Hoàn Tất &amp; Áp Dụng Ảnh Này</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
