"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Shield,
  QrCode,
  Calendar,
  BellRing,
  XCircle,
  KeyRound,
  Edit3,
  Upload,
} from "lucide-react";
import type {
  FullAppData,
  AuthSession,
  MutateActionFn,
  RsvpStatus,
} from "@/types/app";
import { OFFICIAL_QR_URL } from "@/types/app";
import { formatVND, formatDateVN } from "@/lib/format";
import { ModalDialog } from "./ModalDialog";

interface PlayerPersonalTabProps {
  data: FullAppData;
  session: AuthSession;
  onMutate: MutateActionFn;
  isSaving: boolean;
}

const POSITIONS = ["Thủ môn", "Hậu vệ", "Tiền vệ", "Tiền đạo", "Đa năng"];
const PRESET_AVATARS = Array.from(
  { length: 14 },
  (_, i) => `/uploads/avatars/member-${i + 1}.jpg`
);

export function PlayerPersonalTab({
  data,
  session,
  onMutate,
  isSaving,
}: PlayerPersonalTabProps) {
  const { players, matches, attendances } = data;
  const me = players.find((p) => p.id === session.playerId);

  // State cho Modal sửa thông tin & ảnh hồ sơ cá nhân
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [shortName, setShortName] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [position, setPosition] = useState("Tiền vệ");
  const [phone, setPhone] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [notes, setNotes] = useState("");

  // State cho Modal đổi mật khẩu cá nhân
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pwdError, setPwdError] = useState("");

  if (!me) {
    return (
      <div className="rounded-xl bg-white p-8 text-center border border-slate-200">
        Vui lòng đăng nhập tài khoản cầu thủ để xem hồ sơ cá nhân.
      </div>
    );
  }

  const openEditMyProfile = () => {
    setShortName(me.short_name);
    setJerseyNumber(me.jersey_number !== null ? String(me.jersey_number) : "");
    setPosition(me.position);
    setPhone(me.phone || "");
    setBirthYear(me.birth_year ? String(me.birth_year) : "1991");
    setAvatarUrl(me.avatar_url || "/uploads/avatars/member-1.jpg");
    setBio(me.bio || "");
    setNotes(me.notes || "");
    setProfileModalOpen(true);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 360;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          setAvatarUrl(canvas.toDataURL("image/jpeg", 0.85));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await onMutate("update_own_profile", {
      player_id: me.id,
      short_name: shortName,
      jersey_number: jerseyNumber === "" ? null : Number(jerseyNumber),
      position,
      phone,
      birth_year: birthYear === "" ? null : Number(birthYear),
      avatar_url: avatarUrl,
      bio,
      notes,
    });
    setProfileModalOpen(false);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError("");
    if (newPin.trim().length < 4) {
      setPwdError("Mật khẩu / Mã PIN mới cần ít nhất 4 ký tự");
      return;
    }
    if (newPin.trim() !== confirmPin.trim()) {
      setPwdError("Xác nhận mật khẩu mới chưa khớp");
      return;
    }
    await onMutate("change_own_password", {
      player_id: me.id,
      old_pin: oldPin.trim(),
      new_pin: newPin.trim(),
    });
    setPwdModalOpen(false);
    setOldPin("");
    setNewPin("");
    setConfirmPin("");
  };

  const myAtts = attendances.filter((a) => a.player_id === me.id);
  const matchesPlayed = myAtts.filter(
    (a) => a.attended === 1 || a.paid === 1
  ).length;
  const totalPaid = myAtts
    .filter((a) => a.paid === 1)
    .reduce((s, a) => s + a.amount, 0);
  const totalUnpaid = myAtts
    .filter((a) => a.attended === 1 && a.paid === 0)
    .reduce((s, a) => s + a.amount, 0);
  const rate =
    matches.length > 0 ? Math.round((matchesPlayed / matches.length) * 100) : 0;

  const latestMatch = matches[matches.length - 1];
  const latestAtt = myAtts.find((a) => a.match_id === latestMatch?.id);

  const handleSetRsvp = async (rsvpStatus: RsvpStatus) => {
    if (!latestMatch) return;
    await onMutate("set_rsvp", {
      match_id: latestMatch.id,
      player_id: me.id,
      rsvp_status: rsvpStatus,
    });
  };

  return (
    <div className="space-y-6">
      {/* Thẻ Hồ Sơ Cá Nhân Cầu Thủ (Đồng bộ màu Xanh Navy & Vàng Hoàng Kim của Logo) */}
      <section className="rounded-xl bg-brand-navy text-white p-5 sm:p-6 border border-[#4a7fe8] shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={me.avatar_url || "/uploads/avatars/member-1.jpg"}
                alt={me.full_name}
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover border-2 border-[#ffc933] bg-slate-800 shadow-sm"
              />
              <span className="absolute -bottom-2 -right-2 rounded-lg bg-[#ffc933] text-slate-950 px-2 py-0.5 text-xs font-extrabold border border-[#1e4fc2] shadow-xs">
                #{me.jersey_number ?? "-"}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  {me.full_name}
                </h2>
                <span className="rounded-full bg-[#2f66dd] px-2.5 py-0.5 text-xs font-bold text-[#ffc933] border border-[#ffc933]/40">
                  Tên sân: {me.short_name}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-sky-100/90 mt-1">
                Vị trí: <strong className="text-white">{me.position}</strong> •{" "}
                Năm sinh:{" "}
                <strong className="text-white">{me.birth_year || "—"}</strong>
                {me.phone ? ` • SĐT: ${me.phone}` : ""}
              </p>
              {me.access_role === "manager" && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#ffc933]/20 border border-[#ffc933]/50 px-2.5 py-1 text-xs font-extrabold text-[#ffc933]">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Thành viên Ban Quản Lý & Thu Quỹ</span>
                </span>
              )}

              {me.bio && (
                <p className="mt-2.5 text-xs text-sky-100/95 italic bg-white/10 rounded-lg p-2.5 border border-white/15 max-w-xl">
                  &ldquo;{me.bio}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Nút Cầu thủ tự sửa thông tin hồ sơ & đổi mật khẩu cá nhân */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openEditMyProfile}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#ffc933] hover:bg-[#ffd95e] px-3.5 py-2.5 text-xs font-extrabold text-slate-950 transition cursor-pointer shadow-xs"
            >
              <Edit3 className="h-4 w-4" />
              <span>Cập Nhật Hồ Sơ & Ảnh Của Tôi</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPwdError("");
                setPwdModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 px-3.5 py-2.5 text-xs font-bold text-white transition cursor-pointer"
            >
              <KeyRound className="h-4 w-4 text-[#ffc933]" />
              <span>Đổi Mật Khẩu (PIN)</span>
            </button>
          </div>
        </div>

        {/* 4 Thống kê cá nhân */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-white/15">
          <div className="rounded-xl bg-[#173f9e]/70 p-3.5 border border-white/10">
            <span className="text-xs text-sky-200 block">
              Số trận đã tham gia
            </span>
            <span className="text-xl font-extrabold text-white">
              {matchesPlayed}/{matches.length} trận
            </span>
          </div>
          <div className="rounded-xl bg-[#173f9e]/70 p-3.5 border border-white/10">
            <span className="text-xs text-sky-200 block">
              Tỷ lệ chuyên cần
            </span>
            <span className="text-xl font-extrabold text-[#ffc933]">
              {rate}%
            </span>
          </div>
          <div className="rounded-xl bg-[#173f9e]/70 p-3.5 border border-white/10">
            <span className="text-xs text-sky-200 block">
              Tổng tiền quỹ đã nộp
            </span>
            <span className="text-xl font-extrabold text-emerald-400">
              {formatVND(totalPaid)}
            </span>
          </div>
          <div className="rounded-xl bg-[#173f9e]/70 p-3.5 border border-white/10">
            <span className="text-xs text-sky-200 block">
              Tiền trận chưa nộp
            </span>
            <span
              className={`text-xl font-extrabold ${
                totalUnpaid > 0 ? "text-rose-400" : "text-white"
              }`}
            >
              {formatVND(totalUnpaid)}
            </span>
          </div>
        </div>
      </section>

      {/* Điểm danh nhanh cho trận tuần hiện tại */}
      {latestMatch && (
        <section className="rounded-xl bg-white p-4 sm:p-5 border-2 border-[#1e4fc2] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <BellRing className="h-5 w-5 text-[#1e4fc2] shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0284c7]">
                Điểm Danh Lịch Thi Đấu Tuần Này
              </span>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                {latestMatch.label} — {latestMatch.kickoff_time} ngày{" "}
                {formatDateVN(latestMatch.match_date)} ({latestMatch.venue})
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Trạng thái điểm danh của bạn:{" "}
                <strong className="text-slate-900">
                  {latestAtt?.rsvp_status === "registered"
                    ? "✅ Đã đăng ký tham gia"
                    : latestAtt?.rsvp_status === "absent_notice"
                    ? "❌ Đã báo vắng"
                    : "⏳ Chưa phản hồi"}
                </strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSetRsvp("registered")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-extrabold transition cursor-pointer ${
                latestAtt?.rsvp_status === "registered"
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-100 text-slate-800 hover:bg-emerald-100"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Có Mặt</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSetRsvp("absent_notice")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-xs font-bold transition cursor-pointer ${
                latestAtt?.rsvp_status === "absent_notice"
                  ? "bg-rose-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-rose-100"
              }`}
            >
              <XCircle className="h-4 w-4" />
              <span>Báo Vắng</span>
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái: Lịch sử tham gia & đóng quỹ cá nhân qua từng trận */}
        <section className="lg:col-span-8 rounded-xl bg-white p-5 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#1e4fc2]" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Lịch Sử Ra Sân & Đóng Quỹ Cá Nhân ({me.full_name})
                </h3>
                <p className="text-xs text-slate-500">
                  Chi tiết điểm danh và tiền trận của riêng bạn qua{" "}
                  {matches.length} trận đấu
                </p>
              </div>
            </div>
            <span className="text-xs font-extrabold text-emerald-700">
              Tổng đã đóng: {formatVND(totalPaid)}
            </span>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden max-h-[460px] overflow-y-auto">
            {matches
              .slice()
              .reverse()
              .map((m) => {
                const att = myAtts.find((a) => a.match_id === m.id);
                const isPaid = att?.paid === 1;
                const isUnpaid = att?.attended === 1 && att?.paid === 0;
                const rsvp = att?.rsvp_status || "none";

                return (
                  <div
                    key={m.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-sm hover:bg-slate-50"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {m.label}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({formatDateVN(m.match_date)} • {m.venue})
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Điểm danh trước trận:{" "}
                        <strong>
                          {rsvp === "registered"
                            ? "Đăng ký tham gia"
                            : rsvp === "absent_notice"
                            ? "Báo vắng"
                            : "—"}
                        </strong>
                        {att?.walk_in === 1
                          ? " • Tham gia bổ sung tại sân"
                          : ""}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Đã đóng {formatVND(att?.amount || 100000)}</span>
                        </span>
                      ) : isUnpaid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            Chưa nộp ({formatVND(att?.amount || 100000)})
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">
                          Không tham gia
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        {/* Cột phải: Mã QR Chính Xác Của Thủ Quỹ NGUYEN THE TIENG */}
        <section className="lg:col-span-4 rounded-xl bg-white p-5 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <QrCode className="h-5 w-5 text-[#1e4fc2]" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Mã QR Đóng Quỹ Đội Bóng
              </h3>
              <p className="text-xs text-slate-500">
                Quét mã chuyển tiền từ mọi ứng dụng ngân hàng & ZaloPay
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-center space-y-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_QR_URL}
              alt="Mã QR nhận tiền quỹ NGUYEN THE TIENG"
              className="mx-auto max-w-[260px] w-full rounded-xl border border-slate-200 bg-white shadow-2xs"
            />
            <div className="text-xs text-slate-700 space-y-1">
              <p className="font-extrabold text-sm text-[#1e4fc2]">
                NGUYEN THE TIENG
              </p>
              <p>
                Nội dung CK:{" "}
                <strong className="text-slate-900">
                  {me.short_name} #{me.jersey_number ?? ""} dong quy GONOIFC
                </strong>
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Modal 1: Cầu thủ tự cập nhật thông tin & ảnh hồ sơ cá nhân */}
      <ModalDialog
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title={`Cập Nhật Hồ Sơ Cá Nhân: ${me.full_name}`}
        subtitle="Bạn chỉ có thể thay đổi thông tin và ảnh hồ sơ của chính mình để phục vụ lập danh sách thi đấu."
      >
        <form onSubmit={handleSaveMyProfile} className="space-y-4">
          {/* Ảnh đại diện */}
          <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl || "/uploads/avatars/member-1.jpg"}
              alt={me.full_name}
              className="h-20 w-20 rounded-xl object-cover border-2 border-[#1e4fc2] shrink-0"
            />
            <div className="space-y-2 flex-1 text-center sm:text-left">
              <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e4fc2] hover:bg-[#2f66dd] px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition">
                <Upload className="h-3.5 w-3.5 text-[#ffc933]" />
                <span>Tải Ảnh Chân Dung Từ Điện Thoại / Máy Tính</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileUpload}
                  className="sr-only"
                />
              </label>
              <p className="text-[11px] text-slate-500">
                Hoặc chọn nhanh ảnh chân dung từ ảnh tập thể của đội bên dưới:
              </p>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={`h-9 w-9 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                      avatarUrl === url
                        ? "border-[#ffc933] ring-2 ring-[#1e4fc2]"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="my-shortname"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Tên gọi trên sân
              </label>
              <input
                id="my-shortname"
                type="text"
                required
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label
                htmlFor="my-jersey"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Số áo đăng ký
              </label>
              <input
                id="my-jersey"
                type="text"
                inputMode="numeric"
                value={jerseyNumber}
                onChange={(e) =>
                  setJerseyNumber(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="form-input"
              />
            </div>
            <div>
              <label
                htmlFor="my-birthyear"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Năm sinh
              </label>
              <input
                id="my-birthyear"
                type="text"
                inputMode="numeric"
                placeholder="VD: 1992"
                value={birthYear}
                onChange={(e) =>
                  setBirthYear(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="form-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="my-position"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Vị trí sở trường
              </label>
              <select
                id="my-position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="form-select"
              >
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="my-phone"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Số điện thoại liên hệ
              </label>
              <input
                id="my-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="my-notes"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Ghi chú cá nhân (Size áo, quê quán Gò Nổi...)
            </label>
            <input
              id="my-notes"
              type="text"
              placeholder="VD: Size XL - Điện Trung, Gò Nổi"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label
              htmlFor="my-bio"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Bài viết / Lời tự giới thiệu sân cỏ (Hiển thị thẻ Profile ngoài trang chủ)
            </label>
            <textarea
              id="my-bio"
              rows={3}
              placeholder="Chia sẻ về phong cách thi đấu, sở trường, kỷ niệm hoặc lời nhắn nhủ anh em FC HĐH Gò Nổi..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="form-input text-sm leading-relaxed"
            />
            <p className="text-xs text-slate-500 mt-1">
              Bài viết này được hiển thị nổi bật trên Thẻ Profile 3D tương tác ngoài Trang chủ để cổ động viên và người hâm mộ theo dõi.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setProfileModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#1e4fc2] px-5 py-2 text-sm font-bold text-[#ffc933] hover:bg-[#2f66dd] cursor-pointer"
            >
              Lưu Hồ Sơ Của Tôi
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal 2: Cầu thủ tự đổi mật khẩu (PIN) cá nhân */}
      <ModalDialog
        isOpen={pwdModalOpen}
        onClose={() => setPwdModalOpen(false)}
        title="Đổi Mật Khẩu (Mã PIN) Đăng Nhập"
        subtitle={`Tài khoản cầu thủ: ${me.full_name} (#${me.jersey_number ?? "-"})`}
      >
        <form onSubmit={handleSavePassword} className="space-y-4">
          <div>
            <label
              htmlFor="old-pin"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Mật khẩu (PIN) hiện tại
            </label>
            <input
              id="old-pin"
              type="password"
              required
              placeholder="Nhập mật khẩu hiện tại"
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="new-pin"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Mật khẩu (PIN) mới
              </label>
              <input
                id="new-pin"
                type="password"
                required
                placeholder="Ít nhất 4 ký tự"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label
                htmlFor="confirm-pin"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Nhập lại mật khẩu mới
              </label>
              <input
                id="confirm-pin"
                type="password"
                required
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {pwdError && (
            <p className="text-xs font-bold text-rose-600">{pwdError}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setPwdModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#1e4fc2] px-5 py-2 text-sm font-bold text-[#ffc933] hover:bg-[#2f66dd] cursor-pointer"
            >
              Cập Nhật Mật Khẩu
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
