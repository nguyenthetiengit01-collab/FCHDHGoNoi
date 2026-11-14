"use client";

import React, { useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Download, Sparkles } from "lucide-react";

export interface LightboxImage {
  src: string;
  title?: string;
  caption?: string;
  tag?: string;
}

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: LightboxImage[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export function ImageLightboxModal({
  isOpen,
  onClose,
  images,
  currentIndex,
  onNavigate,
}: ImageLightboxModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        if (images.length > 1) {
          onNavigate((currentIndex - 1 + images.length) % images.length);
        }
      } else if (e.key === "ArrowRight") {
        if (images.length > 1) {
          onNavigate((currentIndex + 1) % images.length);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, currentIndex, images.length, onClose, onNavigate]);

  if (!isOpen || images.length === 0) return null;

  const current = images[currentIndex] || images[0];
  const hasMultiple = images.length > 1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate((currentIndex - 1 + images.length) % images.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate((currentIndex + 1) % images.length);
  };

  return (
    <dialog
      ref={dialogRef}
      className="lightbox-dialog"
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Xem ảnh phóng to"
        onClick={onClose}
        className="w-full h-full flex flex-col items-center justify-between p-3 sm:p-6 select-none bg-black/90 backdrop-blur-xl animate-in fade-in duration-200"
      >
        {/* Thanh công cụ phía trên */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-6xl flex items-center justify-between text-white py-2 z-10 shrink-0"
        >
          <div className="flex items-center gap-3">
            {current.tag && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/50 text-xs font-black text-[#fde047] uppercase tracking-wider backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-[#d4af37]" />
                <span>{current.tag}</span>
              </span>
            )}
            {hasMultiple && (
              <span className="text-xs sm:text-sm font-bold text-sky-200 bg-white/10 px-3 py-1 rounded-full border border-white/15">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {current.src && (
              <a
                href={current.src}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-sky-100 hover:text-white transition"
                title="Mở hoặc tải ảnh gốc"
              >
                <Download className="h-5 w-5" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-full bg-white/10 hover:bg-rose-600/80 text-white transition cursor-pointer"
              title="Đóng (phím Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Khu vực ảnh chính */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-6xl flex-1 flex items-center justify-center my-2 overflow-hidden"
        >
          {/* Nút lùi ảnh */}
          {hasMultiple && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 sm:left-4 z-20 p-3 sm:p-3.5 rounded-full bg-black/60 hover:bg-[#1e4fc2] text-white border border-white/20 transition cursor-pointer shadow-lg hover:scale-105"
              title="Ảnh trước (Mũi tên trái)"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Khung ảnh tối ưu */}
          <div className="relative max-h-[75vh] max-w-full flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.src}
              alt={current.title || "Ảnh hoạt động FC HĐH Gò Nổi"}
              className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/15 transition-transform duration-200"
            />
          </div>

          {/* Nút tiến ảnh */}
          {hasMultiple && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 sm:right-4 z-20 p-3 sm:p-3.5 rounded-full bg-black/60 hover:bg-[#1e4fc2] text-white border border-white/20 transition cursor-pointer shadow-lg hover:scale-105"
              title="Ảnh tiếp theo (Mũi tên phải)"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Chú thích ảnh & Dải ảnh thu nhỏ phía dưới */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl text-center space-y-2.5 z-10 pb-1 shrink-0"
        >
          {current.title && (
            <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
              {current.title}
            </h4>
          )}
          {current.caption && (
            <p className="text-xs sm:text-sm text-sky-200/90 font-light max-w-2xl mx-auto italic leading-relaxed">
              &ldquo;{current.caption}&rdquo;
            </p>
          )}

          {/* Dải thumbnail xem nhanh */}
          {hasMultiple && (
            <div className="flex items-center justify-center gap-2 overflow-x-auto py-1 max-w-full">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onNavigate(idx)}
                  className={`relative h-12 w-16 sm:h-14 sm:w-20 rounded-lg overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                    currentIndex === idx
                      ? "border-[#ffc933] ring-2 ring-[#ffc933]/50 scale-105 opacity-100"
                      : "border-white/20 opacity-50 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={`Thumbnail ${idx + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
