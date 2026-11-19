"use client";

import React from "react";
import { Check, Crop, Image as ImageIcon, Trash2, Upload } from "lucide-react";

export interface PlayerGalleryManagerProps {
  title: string;
  galleryUrls: string[];
  profileImageUrl: string;
  isConvertingGallery: boolean;
  galleryWebpInfo: string;
  emptyHint?: string;
  onUploadFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectAsProfile: (url: string, idx: number) => void;
  onCropForProfile: (url: string) => void;
  onRemoveImage: (idx: number) => void;
}

export function PlayerGalleryManager({
  title,
  galleryUrls,
  profileImageUrl,
  isConvertingGallery,
  galleryWebpInfo,
  emptyHint,
  onUploadFiles,
  onSelectAsProfile,
  onCropForProfile,
  onRemoveImage,
}: PlayerGalleryManagerProps) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="block text-sm font-semibold text-slate-700">{title}</span>
        <label className="inline-flex min-h-11 md:min-h-8 items-center gap-1.5 rounded-lg bg-navy-500 hover:bg-royal-500 text-white px-3 py-1.5 text-xs font-bold cursor-pointer transition">
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{isConvertingGallery ? "Đang xử lý..." : "Thêm ảnh (WebP)"}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onUploadFiles}
            disabled={isConvertingGallery}
            className="sr-only"
          />
        </label>
      </div>
      {galleryWebpInfo && (
        <p className="text-xs text-sky-800 font-medium">{galleryWebpInfo}</p>
      )}
      {galleryUrls.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
          {galleryUrls.map((url, idx) => {
            const isProfile = profileImageUrl === url;
            return (
              <div
                key={idx}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 group bg-slate-900 transition ${
                  isProfile
                    ? "border-gold-400 ring-2 ring-sky-500 shadow-md"
                    : "border-slate-300"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Ảnh ${idx + 1}`}
                  className="w-full h-full object-cover"
                />

                {isProfile && (
                  <div className="absolute top-1 left-1 bg-navy-800/90 text-[9px] font-black text-gold-400 px-1.5 py-0.5 rounded border border-white/20 shadow flex items-center gap-0.5">
                    <Check className="h-2.5 w-2.5" aria-hidden="true" />
                    <span>Profile</span>
                  </div>
                )}

                {/* Nút hành động nổi lên khi hover / luôn hiện trên touch */}
                <div className="absolute inset-0 bg-black/60 opacity-100 [@media(hover:none)]:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition flex flex-wrap items-center justify-center gap-1.5 p-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectAsProfile(url, idx)}
                    aria-label={`Đặt ảnh #${idx + 1} làm ảnh Profile rộng`}
                    className="min-h-11 min-w-11 md:min-h-8 md:min-w-8 md:h-8 md:w-8 rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center transition shadow cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
                    title="Đặt ảnh này làm ảnh Giới thiệu Profile rộng"
                  >
                    <ImageIcon className="h-4 w-4 md:h-3.5 md:w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onCropForProfile(url)}
                    aria-label={`Cắt ảnh #${idx + 1} làm ảnh Profile rộng`}
                    className="min-h-11 min-w-11 md:min-h-8 md:min-w-8 md:h-8 md:w-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center transition shadow cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
                    title="Canh chỉnh & cắt ảnh này làm Profile rộng"
                  >
                    <Crop className="h-4 w-4 md:h-3.5 md:w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveImage(idx)}
                    aria-label={`Xoá ảnh #${idx + 1} khỏi Album`}
                    className="min-h-11 min-w-11 md:min-h-8 md:min-w-8 md:h-8 md:w-8 rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition shadow cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
                    title="Xoá ảnh này khỏi Album"
                  >
                    <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        emptyHint && <p className="text-xs text-slate-500 italic">{emptyHint}</p>
      )}
    </div>
  );
}
