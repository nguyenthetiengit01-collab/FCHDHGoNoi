"use client";

import React, { useState, useMemo } from "react";
import {
  Check,
  Clock,
  Minus,
  Search,
  Eye,
  Wallet,
  Table2,
} from "lucide-react";
import type { FullAppData, AuthSession } from "@/types/app";
import { formatVND, formatShortVND, formatDateVN } from "@/lib/format";
import { Badge, Button, Card, EmptyState, Input } from "@/components/ui";

type MatrixFilter = "all" | "has_unpaid" | "fully_paid";

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
  const { players, matches, attendances, summary, settings } = data;
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<MatrixFilter>("all");

  const attendanceMap = useMemo(() => {
    const map = new Map<
      string,
      { attended: number; paid: number; amount: number; walk_in: number }
    >();
    for (const a of attendances) {
      map.set(`${a.match_id}_${a.player_id}`, a);
    }
    return map;
  }, [attendances]);

  // Tính sẵn tổng đã nộp và chưa nộp theo cầu thủ (không bị ảnh hưởng bởi bộ lọc hiển thị)
  const playerTotalsMap = useMemo(() => {
    const map = new Map<number, { paid: number; unpaid: number }>();
    for (const p of players) {
      map.set(p.id, { paid: 0, unpaid: 0 });
    }
    for (const a of attendances) {
      const entry = map.get(a.player_id);
      if (!entry) continue;
      if (a.paid === 1) {
        entry.paid += a.amount;
      } else if (a.attended === 1 && a.paid === 0) {
        entry.unpaid += a.amount;
      }
    }
    return map;
  }, [players, attendances]);

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return players.filter((p) => {
      const pt = playerTotalsMap.get(p.id) ?? { paid: 0, unpaid: 0 };
      if (filterMode === "has_unpaid" && pt.unpaid <= 0) return false;
      if (filterMode === "fully_paid" && (pt.unpaid > 0 || pt.paid <= 0))
        return false;

      if (!q) return true;
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.short_name.toLowerCase().includes(q) ||
        String(p.jersey_number ?? "").includes(q)
      );
    });
  }, [players, playerTotalsMap, filterMode, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Thanh công cụ Bảng Thu Trận (Chế độ Chỉ Xem & Tham Khảo Tổng Quan) */}
      <Card className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <Badge variant="navy" className="gap-1.5">
              <Eye className="h-3.5 w-3.5 text-[#d4af37]" />
              <span>Chế độ Xem Tổng Quan & Tham Khảo (Read-only)</span>
            </Badge>
            <h2 className="text-lg font-extrabold text-[#092244] tracking-tight">
              Bảng Tổng Hợp Thu Tiền Trận Hằng Tuần
            </h2>
            <p className="text-xs text-slate-600">
              Bảng ma trận tự động tổng hợp từ dữ liệu{" "}
              <strong>Phân hệ Thu Tiền Trận</strong> để toàn đội theo dõi minh bạch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px] flex-1 sm:flex-initial">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="search"
                aria-label="Tìm cầu thủ trong bảng thu trận"
                placeholder="Tìm tên hoặc số áo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {session.role === "manager" && onGoToCollection && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onGoToCollection}
                leftIcon={<Wallet className="h-4 w-4" />}
                className="min-h-11 sm:min-h-9"
              >
                Vào Mục Nhập Thu Tiền Trận →
              </Button>
            )}
          </div>
        </div>

        {/* Bộ lọc hiển thị nhanh + Chú thích ký hiệu */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: "all", label: `Tất cả (${players.length})` },
                { key: "has_unpaid", label: "Còn nợ tiền trận" },
                { key: "fully_paid", label: "Đã đóng đủ" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilterMode(item.key)}
                className={`min-h-9 px-3 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  filterMode === item.key
                    ? "bg-[#0d2e5b] text-white border-[#0d2e5b]"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3.5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              </span>
              <span>Đã đóng tiền</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-amber-100 text-amber-900 border border-amber-300">
                <Clock className="h-3.5 w-3.5" />
              </span>
              <span>Ra sân • Chưa nộp</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-purple-100 text-purple-900 border border-purple-300">
                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              </span>
              <span>Vắng • Ủng hộ</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-slate-400 border border-slate-200">
                <Minus className="h-3.5 w-3.5" />
              </span>
              <span>Vắng</span>
            </span>
          </div>
        </div>
      </Card>

      {/* Bảng ma trận */}
      {players.length === 0 || matches.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Table2 className="h-6 w-6" />}
            title="Chưa có dữ liệu ma trận thu tiền"
            description="Cần có danh sách cầu thủ và ít nhất một trận đấu để hiển thị bảng tổng hợp."
          />
        </Card>
      ) : filteredPlayers.length === 0 ? (
        <Card>
          <EmptyState
            title="Không tìm thấy cầu thủ phù hợp"
            description="Thử thay đổi từ khóa tìm kiếm hoặc chọn lại bộ lọc Tất cả."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterMode("all");
                }}
              >
                Xoá bộ lọc
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="ds-table-wrap">
          <table className="matrix-table w-full text-xs">
            <thead>
              <tr className="bg-[#092244] text-white">
                <th
                  scope="col"
                  className="sticky-corner bg-[#092244] px-3 py-3 text-left font-bold border-b border-r border-white/10"
                >
                  Cầu Thủ ({filteredPlayers.length})
                </th>
                <th
                  scope="col"
                  className="bg-[#0d2e5b] px-2 py-3 text-center font-bold border-b border-r border-white/10 whitespace-nowrap"
                >
                  Tên
                </th>
                <th
                  scope="col"
                  className="bg-[#0d2e5b] px-3 py-3 text-right font-bold border-b border-r border-white/10 min-w-[120px]"
                >
                  Tổng Đã Nộp
                </th>
                {matches.map((m) => (
                  <th
                    key={m.id}
                    scope="col"
                    className="bg-[#092244] px-2 py-2.5 text-center font-semibold border-b border-r border-white/10 min-w-[88px]"
                    title={`${m.label} (${formatDateVN(m.match_date)}) - ${m.venue}`}
                  >
                    <div className="font-bold text-[#fde047] whitespace-nowrap">
                      {m.label}
                    </div>
                    <div className="text-[10px] font-normal text-slate-300 truncate max-w-[84px] mx-auto">
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
                <td className="px-3 py-1.5 text-right font-semibold border-b border-r border-slate-200 text-slate-600 tabular-nums">
                  {formatShortVND(settings.default_match_fee || 100000)} / trận
                </td>
                {matches.map((m) => (
                  <td
                    key={m.id}
                    className="px-2 py-1.5 text-center font-medium border-b border-r border-slate-200 text-slate-600 tabular-nums"
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
                <td className="bg-emerald-50 px-2 py-2.5 text-center border-b-2 border-r border-emerald-200 text-xs font-bold text-emerald-800 tabular-nums">
                  {attendances.filter((a) => a.paid === 1).length} lượt
                </td>
                <td className="bg-emerald-100/90 px-3 py-2.5 text-right font-extrabold border-b-2 border-r border-emerald-300 text-emerald-800 text-sm tabular-nums">
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
                      className="bg-emerald-50 px-1.5 py-2 text-center border-b-2 border-r border-emerald-200 tabular-nums"
                    >
                      <div className="text-xs font-extrabold text-emerald-800">
                        {formatShortVND(matchTotal)}
                      </div>
                      <div className="text-[10px] font-medium text-emerald-700">
                        ({countPaid} người)
                      </div>
                    </td>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredPlayers.map((player, idx) => {
                const pt = playerTotalsMap.get(player.id) ?? {
                  paid: 0,
                  unpaid: 0,
                };
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
                      className={`px-3 py-2 text-left font-semibold text-[#092244] border-r border-slate-200 ${
                        isSelf ? "!bg-amber-50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-xs text-slate-400 font-normal tabular-nums">
                          {idx + 1}.
                        </span>
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#0d2e5b] text-white text-[11px] font-bold tabular-nums">
                          {player.jersey_number ?? "-"}
                        </span>
                        <span className="truncate">{player.full_name}</span>
                        {isSelf && <Badge variant="gold">Bạn</Badge>}
                      </div>
                    </th>
                    <td className="px-2 py-2 text-center font-medium text-slate-600 border-r border-slate-200 whitespace-nowrap">
                      {player.short_name}
                    </td>
                    <td className="px-3 py-2 text-right font-bold border-r border-slate-200 whitespace-nowrap tabular-nums">
                      <span
                        className={
                          pt.paid > 0 ? "text-emerald-700" : "text-slate-400"
                        }
                      >
                        {formatVND(pt.paid)}
                      </span>
                      {pt.unpaid > 0 && (
                        <div className="text-[10px] font-semibold text-amber-700">
                          Chưa nộp: {formatShortVND(pt.unpaid)}
                        </div>
                      )}
                    </td>

                    {matches.map((m) => {
                      const cell = attendanceMap.get(`${m.id}_${player.id}`);
                      const isPaid = cell?.paid === 1;
                      const isAttended = cell?.attended === 1;
                      const isVoluntary = !isAttended && isPaid;
                      const isUnpaid = isAttended && !isPaid;

                      return (
                        <td
                          key={m.id}
                          className="p-1.5 text-center border-r border-slate-100"
                        >
                          {isVoluntary ? (
                            <span
                              title={`${player.full_name} - ${m.label}: Vắng mặt • Đóng góp ${formatVND(cell?.amount || 100000)}`}
                              className="mx-auto inline-flex h-7 w-11 items-center justify-center rounded-md bg-purple-100 text-purple-900 font-extrabold text-xs border border-purple-300"
                            >
                              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                            </span>
                          ) : isPaid ? (
                            <span
                              title={`${player.full_name} - ${m.label}: Ra sân • Đã nộp ${formatVND(cell?.amount || 100000)}`}
                              className="mx-auto inline-flex h-7 w-11 items-center justify-center rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-xs border border-emerald-300"
                            >
                              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                            </span>
                          ) : isUnpaid ? (
                            <span
                              title={`${player.full_name} - ${m.label}: Ra sân • Chưa nộp ${formatVND(cell?.amount || 100000)}`}
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
      )}
    </div>
  );
}
