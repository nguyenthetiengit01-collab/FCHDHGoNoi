"use client";

import React, { useState } from "react";
import {
  Check,
  Clock,
  Minus,
  Search,
  Eye,
  Wallet,
} from "lucide-react";
import type { FullAppData, AuthSession } from "@/types/app";
import { formatVND, formatShortVND, formatDateVN } from "@/lib/format";

interface MatrixTabProps {
  data: FullAppData;
  session: AuthSession;
  onGoToCollection?: () => void;
}

export function MatrixTab({
  data,
  session,
  onGoToCollection,
}: MatrixTabProps) {
  const { players, matches, attendances, summary } = data;
  const [searchQuery, setSearchQuery] = useState("");

  const attendanceMap = new Map<
    string,
    { attended: number; paid: number; amount: number; walk_in: number }
  >();
  for (const a of attendances) {
    attendanceMap.set(`${a.match_id}_${a.player_id}`, a);
  }

  const filteredPlayers = players.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.short_name.toLowerCase().includes(q) ||
      String(p.jersey_number ?? "").includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Thanh công cụ Bảng Thu Trận (Chế độ Chỉ Xem & Tham Khảo Tổng Quan) */}
      <div className="rounded-xl bg-white p-4 sm:p-5 border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-0.5 text-xs font-bold text-slate-700">
            <Eye className="h-3.5 w-3.5 text-emerald-700" />
            <span>Chế độ Xem Tổng Quan & Tham Khảo (Read-only)</span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            Bảng Tổng Hợp Thu Tiền Trận Hằng Tuần
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Bảng tổng hợp tự động từ dữ liệu của <strong>Phân hệ Thu Tiền Trận</strong> để toàn đội theo dõi minh bạch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Tìm cầu thủ trong bảng thu trận"
              placeholder="Tìm tên hoặc số áo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-emerald-600"
            />
          </div>

          {session.role === "manager" && onGoToCollection && (
            <button
              type="button"
              onClick={onGoToCollection}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs sm:text-sm font-bold text-white hover:bg-emerald-800 transition cursor-pointer"
            >
              <Wallet className="h-4 w-4" />
              <span>Vào Mục Nhập Thu Tiền Trận →</span>
            </button>
          )}
        </div>
      </div>

      {/* Chú thích ký hiệu */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-white">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span>Đã đóng tiền trận</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-amber-400 text-slate-950">
              <Clock className="h-3.5 w-3.5" />
            </span>
            <span>Tham gia - Chưa nộp</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-slate-400 border border-slate-200">
              <Minus className="h-3.5 w-3.5" />
            </span>
            <span>Vắng</span>
          </span>
        </div>
        <span className="text-slate-500">
          Dữ liệu chỉ xem • Cố định dòng Tổng cộng & cột Cầu thủ khi cuộn
        </span>
      </div>

      {/* Bảng Ma Trận Tham Khảo (Read-only) */}
      <div
        tabIndex={0}
        role="region"
        aria-labelledby="matrix-table-caption"
        className="table-wrapper shadow-xs"
      >
        <table className="matrix-table text-xs sm:text-sm">
          <caption id="matrix-table-caption" className="sr-only">
            Bảng tổng quan thu tiền trận hằng tuần của đội bóng HĐH Gò Nổi
          </caption>
          <thead>
            <tr className="bg-emerald-950 text-white">
              <th
                scope="col"
                className="sticky-corner bg-emerald-950 px-3 py-2.5 text-left font-bold border-b border-r border-emerald-800 min-w-[195px] sm:min-w-[220px]"
              >
                Cầu Thủ ({filteredPlayers.length})
              </th>
              <th
                scope="col"
                className="bg-emerald-900 px-2.5 py-2.5 text-center font-bold border-b border-r border-emerald-800 min-w-[72px]"
              >
                Tên
              </th>
              <th
                scope="col"
                className="bg-emerald-900 px-3 py-2.5 text-right font-bold border-b border-r border-emerald-800 min-w-[115px]"
              >
                Tổng Đã Nộp
              </th>
              {matches.map((m) => (
                <th
                  key={m.id}
                  scope="col"
                  className="bg-emerald-950 px-2 py-2 text-center font-semibold border-b border-r border-emerald-800 min-w-[86px]"
                  title={`${m.label} (${formatDateVN(m.match_date)}) - ${m.venue}`}
                >
                  <div className="font-bold text-emerald-200 whitespace-nowrap">
                    {m.label}
                  </div>
                  <div className="text-[10px] font-normal text-emerald-300/80 truncate max-w-[82px] mx-auto">
                    {m.venue.replace(/^Sân\s+/i, "")}
                  </div>
                </th>
              ))}
            </tr>

            <tr className="bg-slate-100 text-slate-700 text-xs">
              <th
                scope="row"
                className="sticky-corner bg-slate-100 px-3 py-1.5 text-left font-semibold border-b border-r border-slate-200"
              >
                Định mức thu / Trận:
              </th>
              <td className="px-2 py-1.5 text-center border-b border-r border-slate-200 text-slate-400">
                —
              </td>
              <td className="px-3 py-1.5 text-right font-semibold border-b border-r border-slate-200 text-slate-600">
                100k / trận
              </td>
              {matches.map((m) => (
                <td
                  key={m.id}
                  className="px-2 py-1.5 text-center font-medium border-b border-r border-slate-200 text-slate-600"
                >
                  {formatShortVND(m.fee_per_player)}
                </td>
              ))}
            </tr>

            <tr className="bg-emerald-50 text-emerald-950 font-bold">
              <th
                scope="row"
                className="sticky-corner bg-emerald-100 px-3 py-2.5 text-left font-extrabold border-b-2 border-r border-emerald-300 text-emerald-950"
              >
                TỔNG TIỀN THU ĐƯỢC:
              </th>
              <td className="bg-emerald-50 px-2 py-2.5 text-center border-b-2 border-r border-emerald-200 text-xs font-bold text-emerald-800">
                {attendances.filter((a) => a.paid === 1).length} lượt
              </td>
              <td className="bg-emerald-100/90 px-3 py-2.5 text-right font-extrabold border-b-2 border-r border-emerald-300 text-emerald-800 text-sm">
                {formatVND(summary.totalMatchIncome)}
              </td>
              {matches.map((m) => {
                const matchTotal = attendances
                  .filter((a) => a.match_id === m.id && a.paid === 1)
                  .reduce((s, a) => s + a.amount, 0);
                const countPaid = attendances.filter(
                  (a) => a.match_id === m.id && a.paid === 1
                ).length;
                return (
                  <td
                    key={m.id}
                    className="bg-emerald-50 px-1.5 py-2 text-center border-b-2 border-r border-emerald-200"
                  >
                    <div className="text-xs font-extrabold text-emerald-800">
                      {formatShortVND(matchTotal)}
                    </div>
                    <div className="text-[10px] font-medium text-emerald-600">
                      ({countPaid} người)
                    </div>
                  </td>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {filteredPlayers.map((player, idx) => {
              const playerPaid = attendances
                .filter((a) => a.player_id === player.id && a.paid === 1)
                .reduce((s, a) => s + a.amount, 0);
              const playerUnpaid = attendances
                .filter(
                  (a) =>
                    a.player_id === player.id && a.attended === 1 && a.paid === 0
                )
                .reduce((s, a) => s + a.amount, 0);
              const isSelf = session.playerId === player.id;

              return (
                <tr
                  key={player.id}
                  className={
                    isSelf
                      ? "bg-amber-50/70 font-semibold"
                      : "hover:bg-slate-50/90 transition-colors"
                  }
                >
                  <th
                    scope="row"
                    className={`px-3 py-2 text-left font-semibold text-slate-900 border-r border-slate-200 ${
                      isSelf ? "!bg-amber-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-xs text-slate-400 font-normal">
                        {idx + 1}.
                      </span>
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 text-white text-[11px] font-bold">
                        {player.jersey_number ?? "-"}
                      </span>
                      <span className="truncate">{player.full_name}</span>
                      {isSelf && (
                        <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-950">
                          Bạn
                        </span>
                      )}
                    </div>
                  </th>
                  <td className="px-2 py-2 text-center font-medium text-slate-600 border-r border-slate-200 whitespace-nowrap">
                    {player.short_name}
                  </td>
                  <td className="px-3 py-2 text-right font-bold border-r border-slate-200 whitespace-nowrap">
                    <span
                      className={
                        playerPaid > 0 ? "text-emerald-700" : "text-slate-400"
                      }
                    >
                      {formatVND(playerPaid)}
                    </span>
                    {playerUnpaid > 0 && (
                      <div className="text-[10px] font-semibold text-amber-700">
                        Chưa nộp: {formatShortVND(playerUnpaid)}
                      </div>
                    )}
                  </td>

                  {matches.map((m) => {
                    const cell = attendanceMap.get(`${m.id}_${player.id}`);
                    const isPaid = cell?.paid === 1;
                    const isUnpaid =
                      cell?.attended === 1 && cell?.paid === 0;

                    return (
                      <td
                        key={m.id}
                        className="p-1.5 text-center border-r border-slate-100"
                      >
                        {isPaid ? (
                          <span
                            title={`${player.full_name} - ${m.label}: Đã nộp ${formatVND(cell?.amount || 100000)}`}
                            className="mx-auto inline-flex h-7 w-11 items-center justify-center rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-xs border border-emerald-300"
                          >
                            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                          </span>
                        ) : isUnpaid ? (
                          <span
                            title={`${player.full_name} - ${m.label}: Chưa nộp`}
                            className="mx-auto inline-flex h-7 w-11 items-center justify-center rounded-md bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-300"
                          >
                            Nợ
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
