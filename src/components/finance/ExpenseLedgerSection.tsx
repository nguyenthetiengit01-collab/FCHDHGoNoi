"use client";

import React from "react";
import { Edit3, Search, Trash2, X, Zap } from "lucide-react";
import {
  EXPENSE_CATEGORIES,
  type ExpenseRecord,
  type MatchRecord,
  type MutateActionFn,
} from "@/types/app";
import { formatDateVN, formatVND } from "@/lib/format";
import { Badge, Button, Card, EmptyState, Input, Select } from "../ui";

const VENUE_PRESETS = [
  { venue: "Sân Vĩnh Lộc", cost: 900000, shortLabel: "Vĩnh Lộc (900k)" },
  { venue: "Sân Vũ Khánh", cost: 1335000, shortLabel: "Vũ Khánh (1.335k)" },
  { venue: "Sân Gò Mây", cost: 950000, shortLabel: "Gò Mây (950k)" },
  { venue: "Sân DEMI", cost: 600000, shortLabel: "DEMI (600k)" },
];

const QUICK_PAYERS = ["Tiếng", "Tín", "H.Sơn", "Thịnh", "Huy", "Trí"];

export interface ExpenseLedgerSectionProps {
  matches: MatchRecord[];
  expenses: ExpenseRecord[];
  filteredExpenses: ExpenseRecord[];
  hasActiveFilters: boolean;
  quickMatchId: string;
  setQuickMatchId: React.Dispatch<React.SetStateAction<string>>;
  quickVenue: string;
  setQuickVenue: React.Dispatch<React.SetStateAction<string>>;
  quickCost: string;
  setQuickCost: React.Dispatch<React.SetStateAction<string>>;
  quickPayer: string;
  setQuickPayer: React.Dispatch<React.SetStateAction<string>>;
  filterCategory: string;
  setFilterCategory: React.Dispatch<React.SetStateAction<string>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  fromDate: string;
  setFromDate: React.Dispatch<React.SetStateAction<string>>;
  toDate: string;
  setToDate: React.Dispatch<React.SetStateAction<string>>;
  isSaving: boolean;
  onMutate: MutateActionFn;
  clearAllFilters: () => void;
  openEditExpense: (exp: ExpenseRecord) => void;
  onRequestDeleteExpense: (exp: ExpenseRecord) => void;
}

export function ExpenseLedgerSection({
  matches,
  expenses,
  filteredExpenses,
  hasActiveFilters,
  quickMatchId,
  setQuickMatchId,
  quickVenue,
  setQuickVenue,
  quickCost,
  setQuickCost,
  quickPayer,
  setQuickPayer,
  filterCategory,
  setFilterCategory,
  searchQuery,
  setSearchQuery,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  isSaving,
  onMutate,
  clearAllFilters,
  openEditExpense,
  onRequestDeleteExpense,
}: ExpenseLedgerSectionProps) {
  const setPendingDelete = (payload: { kind: "expense"; id: number; label: string }) => {
    const found = expenses.find((e) => e.id === payload.id);
    if (found) onRequestDeleteExpense(found);
  };

  return (
        <div className="space-y-4">
          {/* Hộp Ghi Nhanh Chi Tiền Sân 1 Chạm Dành Cho Ban Quản Lý */}
          <Card className="bg-navy-800/[0.03] border-navy-600/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-ink-primary">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-navy-600 text-gold-300">
                  <Zap className="h-4 w-4" />
                </span>
                <span>
                  Ghi Nhanh Chi Tiền Sân 1 Chạm (Không cần mở biểu mẫu dài)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {VENUE_PRESETS.map((preset) => (
                  <button
                    key={preset.venue}
                    type="button"
                    onClick={() => {
                      setQuickVenue(preset.venue);
                      setQuickCost(String(preset.cost));
                    }}
                    className={`min-h-11 md:min-h-9 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      quickVenue === preset.venue &&
                      Number(quickCost) === preset.cost
                        ? "bg-navy-600 text-gold-300 border-navy-600"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {preset.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
              <div className="sm:col-span-3">
                <Select
                  aria-label="Chọn trận đấu để ghi tiền sân"
                  value={quickMatchId}
                  onChange={(e) => {
                    setQuickMatchId(e.target.value);
                    const found = matches.find(
                      (m) => String(m.id) === e.target.value
                    );
                    if (found) {
                      setQuickVenue(found.venue || "Sân Vĩnh Lộc");
                      setQuickCost(String(found.pitch_cost || 900000));
                      setQuickPayer(
                        (found.payer_name || "Tiếng").split("-")[0].trim() ||
                          "Tiếng"
                      );
                    }
                  }}
                  className="text-xs font-bold text-ink-primary"
                >
                  {matches
                    .slice()
                    .reverse()
                    .map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.label} ({m.venue})
                      </option>
                    ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Input
                  type="text"
                  aria-label="Tên sân"
                  value={quickVenue}
                  onChange={(e) => setQuickVenue(e.target.value)}
                  className="text-xs font-bold text-ink-primary"
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  aria-label="Số tiền sân"
                  value={quickCost}
                  onChange={(e) =>
                    setQuickCost(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  className="text-xs font-extrabold text-rose-600 tabular-nums"
                />
              </div>
              <div className="sm:col-span-3 flex flex-wrap items-center gap-1">
                {QUICK_PAYERS.map((pName) => (
                  <button
                    key={pName}
                    type="button"
                    onClick={() => setQuickPayer(pName)}
                    className={`min-h-11 md:min-h-9 px-2 py-1 rounded-md text-xs font-bold border transition cursor-pointer ${
                      quickPayer === pName
                        ? "bg-navy-600 text-gold-300 border-navy-600"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {pName}
                  </button>
                ))}
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={isSaving}
                  onClick={() =>
                    onMutate("quick_pitch_expense", {
                      match_id: quickMatchId ? Number(quickMatchId) : undefined,
                      venue: quickVenue,
                      pitch_cost:
                        Number(quickCost.replace(/[^0-9]/g, "")) || 0,
                      payer_name: quickPayer,
                    })
                  }
                  className="w-full min-h-11 md:min-h-9"
                >
                  Lưu Chi Tiền Sân
                </Button>
              </div>
            </div>
          </Card>

          {/* Bộ lọc Hạng mục, Khoảng ngày & Tìm kiếm */}
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {["Tất cả", ...EXPENSE_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCategory(cat)}
                  className={`min-h-11 md:min-h-9 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    filterCategory === cat
                      ? "bg-navy-600 text-white border-navy-600"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
              <div className="sm:col-span-5 relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="search"
                  aria-label="Tìm khoản chi"
                  placeholder="Tìm nội dung, sân, người chi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="sm:col-span-3">
                <Input
                  type="date"
                  aria-label="Từ ngày"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <Input
                  type="date"
                  aria-label="Đến ngày"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-1 flex justify-end">
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    aria-label="Xoá toàn bộ bộ lọc"
                    title="Xoá bộ lọc"
                    className="min-h-10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Mobile Card List (< 768px) */}
          <div className="md:hidden space-y-2.5" aria-label="Sổ chi tiêu quỹ đội bóng (di động)">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-rose-950">
                TỔNG CHI TIÊU ({filteredExpenses.length} khoản)
              </span>
              <span className="text-sm font-extrabold text-rose-700 tabular-nums whitespace-nowrap">
                {(() => {
                  const totalFiltered = filteredExpenses.reduce(
                    (s, e) => s + e.amount,
                    0
                  );
                  if (totalFiltered === 0) return formatVND(0);
                  return totalFiltered > 0
                    ? `-${formatVND(totalFiltered)}`
                    : `+${formatVND(Math.abs(totalFiltered))}`;
                })()}
              </span>
            </div>

            {filteredExpenses.map((exp, index) => (
              <Card key={exp.id} className="p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                      #{filteredExpenses.length - index}
                    </span>
                    <span className="text-xs font-medium text-slate-600 tabular-nums">
                      {formatDateVN(exp.expense_date)}
                    </span>
                    <Badge
                      variant={
                        exp.category === "Tiền sân" ? "navy" : "warning"
                      }
                    >
                      {exp.category}
                    </Badge>
                  </div>
                  <span className="text-sm font-extrabold text-rose-600 tabular-nums whitespace-nowrap shrink-0">
                    -{formatVND(exp.amount)}
                  </span>
                </div>

                <p className="text-sm font-semibold text-ink-primary break-words">
                  {exp.description}
                </p>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-600 truncate">
                    Người chi: <strong className="text-slate-800">{exp.payer}</strong>
                  </span>
                  <div className="inline-flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditExpense(exp)}
                      aria-label={`Sửa khoản chi ${exp.description}`}
                      className="inline-flex items-center justify-center min-h-11 min-w-11 md:min-h-9 md:min-w-9 p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-focus-on-light cursor-pointer"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingDelete({
                          kind: "expense",
                          id: exp.id,
                          label: exp.description,
                        })
                      }
                      aria-label={`Xoá khoản chi ${exp.description}`}
                      className="inline-flex items-center justify-center min-h-11 min-w-11 md:min-h-9 md:min-w-9 p-2 rounded-lg text-rose-600 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-focus-on-light cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}

            {filteredExpenses.length === 0 && (
              <EmptyState
                title="Không tìm thấy khoản chi nào"
                description="Thử thay đổi bộ lọc hạng mục, khoảng thời gian hoặc từ khóa tìm kiếm."
                action={
                  hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearAllFilters}
                    >
                      Xoá bộ lọc
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>

          {/* Desktop & Tablet Table (>= 768px) */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Sổ chi tiêu quỹ đội bóng"
            className="hidden md:block ds-table-wrap focus-visible:outline-2 focus-visible:outline-focus-on-light"
          >
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-navy-600 text-white">
                  <th className="px-3.5 py-3 font-bold">STT</th>
                  <th className="px-3.5 py-3 font-bold">Ngày</th>
                  <th className="px-3.5 py-3 font-bold">Hạng Mục Luỹ Kế</th>
                  <th className="px-3.5 py-3 font-bold">Nội Dung Chi Tiết</th>
                  <th className="px-3.5 py-3 font-bold text-right">
                    Số Tiền (VND)
                  </th>
                  <th className="px-3.5 py-3 font-bold">
                    Người Chi / Xác Nhận
                  </th>
                  <th className="px-3.5 py-3 font-bold text-right">Thao tác</th>
                </tr>
                <tr className="bg-rose-50 text-rose-950 font-bold border-b border-rose-200">
                  <td colSpan={4} className="px-3.5 py-2.5 text-right">
                    TỔNG CHI TIÊU ({filteredExpenses.length} khoản):
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-rose-700 font-extrabold text-sm tabular-nums">
                    {(() => {
                      const totalFiltered = filteredExpenses.reduce(
                        (s, e) => s + e.amount,
                        0
                      );
                      if (totalFiltered === 0) return formatVND(0);
                      return totalFiltered > 0
                        ? `-${formatVND(totalFiltered)}`
                        : `+${formatVND(Math.abs(totalFiltered))}`;
                    })()}
                  </td>
                  <td colSpan={2} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredExpenses.map((exp, index) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="px-3.5 py-2.5 text-slate-500 tabular-nums">
                      {filteredExpenses.length - index}
                    </td>
                    <td className="px-3.5 py-2.5 font-medium whitespace-nowrap tabular-nums">
                      {formatDateVN(exp.expense_date)}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Badge
                        variant={
                          exp.category === "Tiền sân" ? "navy" : "warning"
                        }
                      >
                        {exp.category}
                      </Badge>
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-ink-primary">
                      {exp.description}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-rose-600 whitespace-nowrap tabular-nums">
                      -{formatVND(exp.amount)}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-700">
                      {exp.payer}
                    </td>
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditExpense(exp)}
                          aria-label={`Sửa khoản chi ${exp.description}`}
                          className="inline-flex items-center justify-center min-h-11 min-w-11 md:min-h-9 md:min-w-9 p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 cursor-pointer"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              kind: "expense",
                              id: exp.id,
                              label: exp.description,
                            })
                          }
                          aria-label={`Xoá khoản chi ${exp.description}`}
                          className="inline-flex items-center justify-center min-h-11 min-w-11 md:min-h-9 md:min-w-9 p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4">
                      <EmptyState
                        title="Không tìm thấy khoản chi nào"
                        description="Thử thay đổi bộ lọc hạng mục, khoảng thời gian hoặc từ khóa tìm kiếm."
                        action={
                          hasActiveFilters ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={clearAllFilters}
                            >
                              Xoá bộ lọc
                            </Button>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
  );
}
