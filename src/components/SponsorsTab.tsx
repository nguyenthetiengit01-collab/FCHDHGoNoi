"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Award,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Calendar,
  Eye,
  CheckSquare,
  Square,
  Upload,
} from "lucide-react";
import type { FullAppData, MutateActionFn, Sponsor, SponsorTier } from "@/types/app";
import {
  SPONSOR_TIERS,
  DISPLAY_POSITION_OPTIONS,
  getSponsorStatus,
} from "@/lib/sponsors";
import { convertFileToWebp } from "@/lib/imageToWebp";

interface SponsorsTabProps {
  data: FullAppData;
  onMutate: MutateActionFn;
  isSaving: boolean;
}

interface SponsorFormData {
  id?: number;
  name: string;
  tier: SponsorTier;
  logo_url: string;
  banner_url: string;
  website_url: string;
  description: string;
  start_date: string;
  end_date: string;
  display_positions: string[];
  is_active: boolean;
  sort_order: number;
  note: string;
}

const DEFAULT_FORM: SponsorFormData = {
  name: "",
  tier: "gold",
  logo_url: "",
  banner_url: "",
  website_url: "",
  description: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  display_positions: ["home_banner", "home_partners", "footer"],
  is_active: true,
  sort_order: 1,
  note: "",
};

export function SponsorsTab({ data, onMutate, isSaving }: SponsorsTabProps) {
  const sponsors = data.sponsors || [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<SponsorFormData>(DEFAULT_FORM);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const handleOpenAdd = () => {
    setFormData(DEFAULT_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sp: Sponsor) => {
    setFormData({
      id: sp.id,
      name: sp.name,
      tier: sp.tier,
      logo_url: sp.logo_url || "",
      banner_url: sp.banner_url || "",
      website_url: sp.website_url || "",
      description: sp.description || "",
      start_date: sp.start_date || "",
      end_date: sp.end_date || "",
      display_positions: Array.isArray(sp.display_positions)
        ? sp.display_positions
        : ["home_banner", "home_partners"],
      is_active: sp.is_active !== false,
      sort_order: sp.sort_order || 1,
      note: sp.note || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (sp: Sponsor) => {
    const ok = window.confirm(
      `Bạn có chắc chắn muốn xóa đơn vị tài trợ "${sp.name}"?`
    );
    if (!ok) return;
    await onMutate("delete_sponsor", { id: sp.id });
  };

  const handleTogglePosition = (posId: string) => {
    setFormData((prev) => {
      const exists = prev.display_positions.includes(posId);
      const nextPositions = exists
        ? prev.display_positions.filter((p) => p !== posId)
        : [...prev.display_positions, posId];
      return { ...prev, display_positions: nextPositions };
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingLogo(true);
      const res = await convertFileToWebp(file, { maxWidth: 600, quality: 0.9 });
      setFormData((prev) => ({ ...prev, logo_url: res.dataUrl }));
    } catch (err) {
      alert("Lỗi tải ảnh logo: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingBanner(true);
      const res = await convertFileToWebp(file, { maxWidth: 1600, quality: 0.85 });
      setFormData((prev) => ({ ...prev, banner_url: res.dataUrl }));
    } catch (err) {
      alert("Lỗi tải ảnh banner: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Vui lòng nhập tên đơn vị tài trợ.");
      return;
    }
    await onMutate("upsert_sponsor", formData as unknown as Record<string, unknown>);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header khu vực quản lý tài trợ */}
      <div className="rounded-xl bg-white p-5 border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-900">
              <Award className="h-3.5 w-3.5 text-amber-700" />
              <span>Quản Lý Quyền Lợi & Nhà Tài Trợ Đội Bóng</span>
            </div>
            <h2 className="mt-1.5 text-xl font-extrabold text-slate-900">
              Đối Tác, Nhà Tài Trợ & Đơn Vị Đồng Hành
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Treo banner trang chủ theo thời hạn đã thỏa thuận để trả quyền lợi. Sau khi hết hạn banner, logo vẫn tự động được lưu giữ tại khu vực Đồng Hành.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition cursor-pointer shadow-sm self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm Đơn Vị Mới</span>
          </button>
        </div>
      </div>

      {/* Danh sách nhà tài trợ */}
      {sponsors.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center border border-slate-200 space-y-3">
          <Award className="h-10 w-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            Chưa có nhà tài trợ nào trong hệ thống
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Bấm nút &quot;Thêm Đơn Vị Mới&quot; để tạo nhà tài trợ kim cương, vàng, bạc, đối tác hoặc đơn vị hỗ trợ nước uống, trang thiết bị thi đấu.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sponsors.map((sp) => {
            const tierMeta = SPONSOR_TIERS[sp.tier] || SPONSOR_TIERS.partner;
            const statusMeta = getSponsorStatus(sp);

            return (
              <div
                key={sp.id}
                className="rounded-xl bg-white border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Banner preview nếu có */}
                  {sp.banner_url ? (
                    <div className="relative h-28 w-full bg-slate-900 overflow-hidden">
                      <Image
                        src={sp.banner_url}
                        alt={`Banner ${sp.name}`}
                        fill
                        unoptimized
                        className="object-cover opacity-90"
                      />
                      <div className="absolute top-2 right-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold border ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-3 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600" />
                  )}

                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {sp.logo_url ? (
                        <div className="relative h-12 w-12 shrink-0 rounded-lg border border-slate-200 bg-white p-1 overflow-hidden shadow-2xs">
                          <Image
                            src={sp.logo_url}
                            alt={sp.name}
                            fill
                            unoptimized
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-black text-sm">
                          LOGO
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold border ${tierMeta.badgeClass}`}
                          >
                            {tierMeta.label}
                          </span>
                          {!sp.banner_url && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${statusMeta.badgeClass}`}
                            >
                              {statusMeta.label}
                            </span>
                          )}
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-900 mt-1 truncate">
                          {sp.name}
                        </h4>
                      </div>
                    </div>

                    {sp.description && (
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {sp.description}
                      </p>
                    )}

                    {/* Thời hạn treo banner */}
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>
                          Thời hạn:{" "}
                          <strong>
                            {sp.start_date || "Không giới hạn"} →{" "}
                            {sp.end_date || "Dài hạn"}
                          </strong>
                        </span>
                      </div>

                      {/* Vị trí tích chọn */}
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 flex-wrap pt-1 border-t border-slate-200/60">
                        <Eye className="h-3 w-3 text-slate-400" />
                        <span>Vị trí:</span>
                        {Array.isArray(sp.display_positions) &&
                        sp.display_positions.length > 0 ? (
                          sp.display_positions.map((p) => {
                            const opt = DISPLAY_POSITION_OPTIONS.find(
                              (o) => o.id === p
                            );
                            return (
                              <span
                                key={p}
                                className="rounded bg-white px-1.5 py-0.2 border border-slate-200 text-[10px] font-semibold text-slate-700"
                              >
                                {opt?.label.split("(")[0].trim() || p}
                              </span>
                            );
                          })
                        ) : (
                          <span className="italic text-slate-400">Chưa chọn vị trí</span>
                        )}
                      </div>
                    </div>

                    {/* Ghi chú nội bộ BQL nếu có */}
                    {sp.note && (
                      <div className="text-[11px] text-amber-800 bg-amber-50/80 rounded px-2 py-1 border border-amber-200/60">
                        <strong>Ghi chú:</strong> {sp.note}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer action buttons */}
                <div className="border-t border-slate-100 p-3 bg-slate-50/70 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {sp.website_url && (
                      <a
                        href={sp.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-semibold"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Website</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleOpenEdit(sp)}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                    >
                      <Edit2 className="h-3 w-3" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleDelete(sp)}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Thêm / Chỉnh Sửa Nhà Tài Trợ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 my-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {formData.id ? "Chỉnh Sửa Đơn Vị Tài Trợ" : "Thêm Đơn Vị Tài Trợ Mới"}
                </h3>
                <p className="text-xs text-slate-500">
                  Cấu hình quyền lợi, thời hạn banner và vị trí hiển thị trên website.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tên đơn vị */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Tên Đơn Vị / Nhà Tài Trợ *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Công ty TNHH ABC / Cựu Cầu Thủ X"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, name: e.target.value }))
                    }
                    className="form-input text-sm"
                  />
                </div>

                {/* Hạng tài trợ */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Hạng Phân Loại
                  </label>
                  <select
                    value={formData.tier}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        tier: e.target.value as SponsorTier,
                      }))
                    }
                    className="form-select text-sm font-semibold"
                  >
                    {Object.values(SPONSOR_TIERS).map((t) => (
                      <option key={t.tier} value={t.tier}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Website / Fanpage */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Đường Dẫn Website Hoặc Fanpage Facebook
                </label>
                <input
                  type="url"
                  placeholder="https://facebook.com/... hoặc https://..."
                  value={formData.website_url}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, website_url: e.target.value }))
                  }
                  className="form-input text-sm"
                />
              </div>

              {/* Mô tả giới thiệu */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Mô Tả Giới Thiệu Ngắn Gọn
                </label>
                <textarea
                  rows={2}
                  placeholder="Giới thiệu đôi nét về đơn vị và sự đồng hành cùng FC HĐH Gò Nổi..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, description: e.target.value }))
                  }
                  className="form-input text-sm"
                />
              </div>

              {/* Upload Logo & Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-y border-slate-100 py-3">
                {/* Logo */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Logo Đơn Vị (Tự chuyển WebP)
                  </label>
                  <div className="flex items-center gap-3">
                    {formData.logo_url ? (
                      <div className="relative h-16 w-16 shrink-0 rounded-lg border border-slate-200 bg-white p-1 overflow-hidden">
                        <Image
                          src={formData.logo_url}
                          alt="Logo Preview"
                          fill
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                        Trống
                      </div>
                    )}
                    <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{uploadingLogo ? "Đang xử lý..." : "Chọn Ảnh Logo"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingLogo}
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Banner trang chủ */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Banner Quảng Bá Trang Chủ (16:9 / Rộng)
                  </label>
                  <div className="flex items-center gap-3">
                    {formData.banner_url ? (
                      <div className="relative h-16 w-28 shrink-0 rounded-lg border border-slate-200 bg-slate-900 overflow-hidden">
                        <Image
                          src={formData.banner_url}
                          alt="Banner Preview"
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-16 w-28 shrink-0 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                        Chưa có banner
                      </div>
                    )}
                    <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{uploadingBanner ? "Đang xử lý..." : "Chọn Ảnh Banner"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingBanner}
                        onChange={handleBannerUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Thời hạn treo banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Ngày Bắt Đầu Treo Banner
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, start_date: e.target.value }))
                    }
                    className="form-input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Ngày Kết Thúc Banner (Hết hạn sẽ hạ)
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, end_date: e.target.value }))
                    }
                    className="form-input text-sm"
                  />
                </div>
              </div>

              {/* Tích chọn vị trí hiển thị banner */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-slate-600">
                  Tích Chọn Vị Trí Hiển Thị Banner & Logo:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DISPLAY_POSITION_OPTIONS.map((pos) => {
                    const checked = formData.display_positions.includes(pos.id);
                    return (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => handleTogglePosition(pos.id)}
                        className={`p-2 rounded-lg border text-left text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                          checked
                            ? "bg-emerald-50 border-emerald-400 text-emerald-950"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {checked ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400 shrink-0" />
                        )}
                        <span>{pos.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ghi chú nội bộ BQL & Trạng thái kích hoạt */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Ghi Chú Nội Bộ Ban Quản Lý (Gói tài trợ, liên hệ)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Gói tài trợ 5tr giải HĐH 2026, LH qua anh Tín..."
                    value={formData.note}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, note: e.target.value }))
                    }
                    className="form-input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Trạng Thái
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, is_active: e.target.checked }))
                      }
                      className="rounded text-emerald-600"
                    />
                    <span>Kích Hoạt Hiển Thị</span>
                  </label>
                </div>
              </div>

              {/* Nút hành động */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving || uploadingLogo || uploadingBanner}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-xs font-extrabold text-white transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isSaving ? "Đang lưu..." : "Lưu Thông Tin Đơn Vị"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
