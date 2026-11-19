"use client";

import React from "react";
import { Check, Crop, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { FormField, Input, Select } from "../ui";

const DEFAULT_PRESET_AVATARS = Array.from(
  { length: 14 },
  (_, i) => `/uploads/avatars/member-${i + 1}.jpg`
);

const DEFAULT_POSITIONS = [
  "Thủ môn",
  "Hậu vệ",
  "Tiền vệ",
  "Tiền đạo",
  "Đa năng",
];

const DEFAULT_BIRTH_YEARS = Array.from({ length: 30 }, (_, i) => 2008 - i);

export interface PlayerProfileEditorProps {
  idPrefix: string;
  avatarUrl: string;
  avatarAlt: string;
  webpInfo: string;
  profileImageUrl: string;
  profileWebpInfo: string;
  galleryUrls: string[];
  presetAvatars?: string[];
  positions?: string[];
  birthYearOptions?: number[];
  fullName: string;
  shortName: string;
  jerseyNumber: string;
  birthYear: string;
  position: string;
  phone: string;
  hometown: string;
  nickname: string;
  playingStyle: string;
  bio: string;
  emptyActivityGalleryHint?: string;
  syncNoticeTitle?: string;
  syncNoticeBody?: string;
  onChangeFullName: (v: string) => void;
  onChangeShortName: (v: string) => void;
  onChangeJerseyNumber: (v: string) => void;
  onChangeBirthYear: (v: string) => void;
  onChangePosition: (v: string) => void;
  onChangePhone: (v: string) => void;
  onChangeHometown: (v: string) => void;
  onChangeNickname: (v: string) => void;
  onChangePlayingStyle: (v: string) => void;
  onChangeBio: (v: string) => void;
  onAvatarFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenAvatarCropper: () => void;
  onSelectPresetAvatar: (url: string) => void;
  onProfileFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenProfileCropper: (sourceUrl: string) => void;
  onClearProfileImage: () => void;
  onSelectActivityForProfile: (url: string, idx: number) => void;
  onCropActivityForProfile: (url: string) => void;
  hideFullNameField?: boolean;
}

export function PlayerProfileEditor({
  idPrefix,
  avatarUrl,
  avatarAlt,
  webpInfo,
  profileImageUrl,
  profileWebpInfo,
  galleryUrls,
  presetAvatars = DEFAULT_PRESET_AVATARS,
  positions = DEFAULT_POSITIONS,
  birthYearOptions = DEFAULT_BIRTH_YEARS,
  fullName,
  shortName,
  jerseyNumber,
  birthYear,
  position,
  phone,
  hometown,
  nickname,
  playingStyle,
  bio,
  emptyActivityGalleryHint = "Chưa có ảnh trong Album hoạt động bên dưới.",
  syncNoticeTitle,
  syncNoticeBody,
  onChangeFullName,
  onChangeShortName,
  onChangeJerseyNumber,
  onChangeBirthYear,
  onChangePosition,
  onChangePhone,
  onChangeHometown,
  onChangeNickname,
  onChangePlayingStyle,
  onChangeBio,
  onAvatarFileUpload,
  onOpenAvatarCropper,
  onSelectPresetAvatar,
  onProfileFileUpload,
  onOpenProfileCropper,
  onClearProfileImage,
  onSelectActivityForProfile,
  onCropActivityForProfile,
  hideFullNameField = false,
}: PlayerProfileEditorProps) {
  return (
    <div className="space-y-4">
      {/* 1. Ảnh đại diện Avatar thi đấu (Chuẩn 3:4) */}
      <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Crop className="h-4 w-4 text-royal-600" aria-hidden="true" />
            <span>1. Ảnh Avatar Thi Đấu (Chuẩn 3:4)</span>
          </span>
          <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700">
            Chân dung 3:4 WebP HD
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl || "/uploads/avatars/member-1.jpg"}
            alt={avatarAlt}
            className="h-28 w-21 rounded-xl object-cover object-top border-2 border-royal-600 shadow-sm shrink-0"
          />
          <div className="space-y-2 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <label className="inline-flex min-h-11 md:min-h-9 items-center gap-1.5 rounded-lg bg-royal-600 hover:bg-royal-500 px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition shadow-xs">
                <Upload className="h-3.5 w-3.5 text-gold-400" aria-hidden="true" />
                <span>Tải Avatar Mới</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onAvatarFileUpload}
                  className="sr-only"
                />
              </label>

              <button
                type="button"
                onClick={onOpenAvatarCropper}
                className="inline-flex min-h-11 md:min-h-9 items-center gap-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-900 px-3 py-2 text-xs font-bold transition cursor-pointer"
                title="Mở Studio để kéo thả, phóng to và cắt ảnh Avatar chuẩn 3:4"
              >
                <Crop className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                <span>Canh Chỉnh 3:4</span>
              </button>
            </div>
            {webpInfo && (
              <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                {webpInfo}
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              Hoặc chọn nhanh ảnh chân dung từ ảnh mẫu:
            </p>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {presetAvatars.map((url, idx) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => onSelectPresetAvatar(url)}
                  aria-label={`Chọn ảnh mẫu thành viên #${idx + 1}`}
                  className={`h-8 w-8 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                    avatarUrl === url
                      ? "border-gold-400 ring-2 ring-royal-600"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                  title={`Ảnh thành viên #${idx + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Avatar ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Ảnh Giới Thiệu Profile / Hoạt Động (Khung Rộng 16:9 hoặc 4:3) */}
      <div className="rounded-xl bg-sky-50/60 p-4 border border-sky-200 space-y-3">
        <div className="flex items-center justify-between border-b border-sky-200/60 pb-2">
          <span className="text-xs font-black uppercase tracking-wider text-sky-950 flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4 text-royal-600" aria-hidden="true" />
            <span>2. Ảnh Giới Thiệu Profile (Khung Rộng 16:9 / 4:3)</span>
          </span>
          <span className="rounded-md bg-sky-100 border border-sky-300 px-2 py-0.5 text-[10px] font-black text-sky-800">
            Ảnh Toàn Thân / Hoạt Động
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:w-44 aspect-[16/10] rounded-xl overflow-hidden border-2 border-sky-300 bg-navy-800 flex items-center justify-center shrink-0 relative">
            {profileImageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profileImageUrl}
                  alt="Ảnh profile rộng"
                  className="w-full h-full object-cover"
                />
              </>
            ) : (
              <div className="text-center p-2 text-sky-300/60">
                <ImageIcon className="h-6 w-6 mx-auto mb-1 opacity-50" aria-hidden="true" />
                <span className="text-[10px] font-medium block">Chưa chọn ảnh rộng</span>
              </div>
            )}
          </div>

          <div className="space-y-2 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <label className="inline-flex min-h-11 md:min-h-9 items-center gap-1.5 rounded-lg bg-navy-800 hover:bg-navy-500 px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition shadow-xs">
                <Upload className="h-3.5 w-3.5 text-gold-400" aria-hidden="true" />
                <span>Tải Ảnh Khung Rộng Mới</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onProfileFileUpload}
                  className="sr-only"
                />
              </label>

              {(profileImageUrl || avatarUrl) && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenProfileCropper(
                      profileImageUrl || avatarUrl || "/uploads/avatars/member-1.jpg"
                    )
                  }
                  className="inline-flex min-h-11 md:min-h-9 items-center gap-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-900 px-3 py-2 text-xs font-bold transition cursor-pointer"
                  title="Mở Studio cắt chỉnh ảnh Profile theo tỷ lệ rộng 16:9 hoặc 4:3"
                >
                  <Crop className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                  <span>Cắt 16:9 / 4:3</span>
                </button>
              )}

              {profileImageUrl && (
                <button
                  type="button"
                  onClick={onClearProfileImage}
                  aria-label="Gỡ ảnh profile rộng"
                  className="inline-flex min-h-11 md:min-h-9 items-center gap-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-2.5 py-2 text-xs font-bold transition cursor-pointer"
                  title="Gỡ ảnh profile rộng này"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            {profileWebpInfo && (
              <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                {profileWebpInfo}
              </p>
            )}
            <p className="text-[11px] text-sky-900/75">
              Ảnh rộng sẽ hiển thị làm ảnh bìa Thẻ Vận Động Viên Truyền Hình. Bạn cũng có thể chọn trực tiếp từ Album ảnh thi đấu &amp; hoạt động bên dưới.
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-sky-200/70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-950">
              Hoặc chọn nhanh từ Album ảnh thi đấu &amp; hoạt động ({galleryUrls.length} ảnh):
            </span>
          </div>
          {galleryUrls.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {galleryUrls.map((url, idx) => {
                const isSelected = profileImageUrl === url;
                return (
                  <div key={idx} className="relative shrink-0 group">
                    <button
                      type="button"
                      onClick={() => onSelectActivityForProfile(url, idx)}
                      className={`h-16 w-24 rounded-lg overflow-hidden border-2 transition cursor-pointer relative block ${
                        isSelected
                          ? "border-gold-400 ring-2 ring-royal-600 shadow-md"
                          : "border-sky-200 opacity-85 hover:opacity-100"
                      }`}
                      title={`Chọn ảnh hoạt động #${idx + 1} làm ảnh Profile`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Ảnh hoạt động ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <span className="absolute bottom-0 inset-x-0 bg-navy-800/85 text-[9px] font-black text-gold-400 text-center py-0.5 flex items-center justify-center gap-0.5">
                          <Check className="h-2.5 w-2.5" aria-hidden="true" />
                          <span>Đang chọn</span>
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onCropActivityForProfile(url)}
                      aria-label={`Canh chỉnh & cắt ảnh hoạt động #${idx + 1}`}
                      className="absolute top-1 right-1 inline-flex min-h-11 min-w-11 md:min-h-7 md:min-w-7 items-center justify-center bg-black/80 hover:bg-black text-gold-400 p-1.5 md:p-1 rounded-md opacity-100 [@media(hover:none)]:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition shadow cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
                      title="Canh chỉnh & cắt ảnh này theo khung rộng 16:9 / 4:3"
                    >
                      <Crop className="h-3.5 w-3.5 md:h-3 md:w-3" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg bg-sky-100/50 border border-dashed border-sky-300 p-2 text-center text-xs text-sky-800">
              {emptyActivityGalleryHint}
            </div>
          )}
        </div>
      </div>

      {syncNoticeTitle && (
        <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-start gap-2">
          <span className="text-base" aria-hidden="true">
            💡
          </span>
          <div>
            <p className="font-bold text-navy-500">{syncNoticeTitle}</p>
            {syncNoticeBody && <p className="text-slate-600 mt-0.5">{syncNoticeBody}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!hideFullNameField && (
          <FormField label="Họ và Tên đầy đủ" htmlFor={`${idPrefix}-fullname`} required>
            <Input
              id={`${idPrefix}-fullname`}
              type="text"
              required
              value={fullName}
              onChange={(e) => onChangeFullName(e.target.value)}
            />
          </FormField>
        )}
        <FormField label="Tên gọi trên sân" htmlFor={`${idPrefix}-shortname`} required>
          <Input
            id={`${idPrefix}-shortname`}
            type="text"
            required
            value={shortName}
            onChange={(e) => onChangeShortName(e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Số áo đăng ký thi đấu" htmlFor={`${idPrefix}-jersey`}>
          <Input
            id={`${idPrefix}-jersey`}
            type="text"
            inputMode="numeric"
            placeholder="VD: 10, 7, 23..."
            value={jerseyNumber}
            onChange={(e) => onChangeJerseyNumber(e.target.value.replace(/[^0-9]/g, ""))}
            className="font-bold"
          />
        </FormField>
        <FormField label="Năm sinh" htmlFor={`${idPrefix}-birthyear`}>
          <Select
            id={`${idPrefix}-birthyear`}
            value={birthYear}
            onChange={(e) => onChangeBirthYear(e.target.value)}
          >
            <option value="">-- Chọn năm sinh --</option>
            {birthYearOptions.map((y) => (
              <option key={y} value={String(y)}>
                {y} ({new Date().getFullYear() - y} tuổi)
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Vị trí sở trường" htmlFor={`${idPrefix}-position`}>
          <Select
            id={`${idPrefix}-position`}
            value={position}
            onChange={(e) => onChangePosition(e.target.value)}
          >
            {positions.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Số điện thoại liên hệ" htmlFor={`${idPrefix}-phone`}>
          <Input
            id={`${idPrefix}-phone`}
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => onChangePhone(e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Quê quán tại Gò Nổi" htmlFor={`${idPrefix}-hometown`}>
          <Select
            id={`${idPrefix}-hometown`}
            value={hometown}
            onChange={(e) => onChangeHometown(e.target.value)}
          >
            <option value="Điện Quang">Xã Điện Quang</option>
            <option value="Điện Trung">Xã Điện Trung</option>
            <option value="Điện Phong">Xã Điện Phong</option>
            <option value="Gò Nổi">Gò Nổi chung</option>
          </Select>
        </FormField>
        <FormField label="Biệt danh sân cỏ" htmlFor={`${idPrefix}-nickname`}>
          <Input
            id={`${idPrefix}-nickname`}
            type="text"
            placeholder="VD: Nhạc trưởng, Sát thủ, Lá chắn thép..."
            value={nickname}
            onChange={(e) => onChangeNickname(e.target.value)}
          />
        </FormField>
      </div>

      <FormField label="Phong cách thi đấu / Điểm mạnh" htmlFor={`${idPrefix}-style`}>
        <Input
          id={`${idPrefix}-style`}
          type="text"
          placeholder="VD: Chạy cánh tốc độ, sút xa uy lực, chuyền dài chính xác..."
          value={playingStyle}
          onChange={(e) => onChangePlayingStyle(e.target.value)}
        />
      </FormField>

      <FormField
        label="Bài viết giới thiệu / Lời ngỏ / Châm ngôn"
        htmlFor={`${idPrefix}-bio`}
      >
        <textarea
          id={`${idPrefix}-bio`}
          rows={3}
          placeholder="Đôi dòng giới thiệu bản thân, kỷ niệm cùng FC HĐH Gò Nổi..."
          value={bio}
          onChange={(e) => onChangeBio(e.target.value)}
          className="form-textarea"
        />
      </FormField>
    </div>
  );
}
