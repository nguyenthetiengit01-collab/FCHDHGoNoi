"use client";

import React from "react";
import { Edit3, Search, Trash2, Trophy } from "lucide-react";
import type { FinancialSummary, OtherIncome, TeamSettings } from "@/types/app";
import { formatDateVN, formatVND } from "@/lib/format";
import { Badge, Button, Card, EmptyState, Input } from "../ui";

export interface OtherIncomeSectionProps {
  settings: TeamSettings;
  summary: FinancialSummary;
  otherIncomes: OtherIncome[];
  filteredIncomes: OtherIncome[];
  incomeSearch: string;
  setIncomeSearch: React.Dispatch<React.SetStateAction<string>>;
  fromDate: string;
  setFromDate: React.Dispatch<React.SetStateAction<string>>;
  toDate: string;
  setToDate: React.Dispatch<React.SetStateAction<string>>;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  openEditIncome: (inc: OtherIncome) => void;
  onRequestDeleteIncome: (inc: OtherIncome) => void;
}

export function OtherIncomeSection({
  settings,
  summary,
  otherIncomes,
  filteredIncomes,
  incomeSearch,
  setIncomeSearch,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  hasActiveFilters,
  clearAllFilters,
  openEditIncome,
  onRequestDeleteIncome,
}: OtherIncomeSectionProps) {
  const setPendingDelete = (payload: { kind: "income"; id: number; label: string }) => {
    const found = filteredIncomes.find((i) => i.id === payload.id);
    if (found) onRequestDeleteIncome(found);
  };

  return (
        <div className="space-y-4">
          <div className="rounded-xl bg-navy-800 text-white border border-gold-500 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-300">
                <Trophy className="h-3.5 w-3.5" />
                <span>
                  Quỹ Giải Đội Bóng (Theo dõi tách riêng ngoài quỹ sinh hoạt tuần)
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {settings.tournament_fund_note}
              </p>
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-gold-300 shrink-0 tabular-nums">
              Còn lại: {formatVND(settings.tournament_fund_reserve)}
            </div>
          </div>

          <Card className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
            <div className="sm:col-span-6 relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="search"
                aria-label="Tìm khoản thu khác"
                placeholder="Tìm người ủng hộ, loại quỹ, ghi chú..."
                value={incomeSearch}
                onChange={(e) => setIncomeSearch(e.target.value)}
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
          </Card>

          {/* Mobile Card List (< 768px) */}
          <div className="md:hidden space-y-2.5" aria-label="Bảng các khoản thu ngoài và tài trợ (di động)">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-emerald-950">
                TỔNG THU KHÁC CỘNG QUỸ ĐỘI
              </span>
              <span className="text-sm font-extrabold text-emerald-700 tabular-nums whitespace-nowrap">
                +{formatVND(summary.totalOtherIncome)}
              </span>
            </div>

            {filteredIncomes.map((inc, idx) => (
              <Card key={inc.id} className="p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-medium text-slate-600 tabular-nums">
                      {formatDateVN(inc.income_date)}
                    </span>
                    <Badge
                      variant={
                        inc.fund_type === "Ghi chú Quỹ giải"
                          ? "gold"
                          : "success"
                      }
                    >
                      {inc.fund_type}
                    </Badge>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-700 tabular-nums whitespace-nowrap shrink-0">
                    +{formatVND(inc.amount)}
                  </span>
                </div>

                <p className="text-sm font-semibold text-ink-primary break-words">
                  {inc.contributor}
                </p>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-600 truncate">
                    {inc.note || "Không có ghi chú"}
                  </span>
                  <div className="inline-flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditIncome(inc)}
                      aria-label={`Sửa khoản thu ${inc.contributor}`}
                      className="inline-flex items-center justify-center min-h-11 min-w-11 md:min-h-9 md:min-w-9 p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-focus-on-light cursor-pointer"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingDelete({
                          kind: "income",
                          id: inc.id,
                          label: inc.contributor,
                        })
                      }
                      aria-label={`Xoá khoản thu ${inc.contributor}`}
                      className="inline-flex items-center justify-center min-h-11 min-w-11 md:min-h-9 md:min-w-9 p-2 rounded-lg text-rose-600 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-focus-on-light cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}

            {filteredIncomes.length === 0 && (
              <EmptyState
                title={
                  otherIncomes.length === 0
                    ? "Chưa có khoản thu khác nào"
                    : "Không tìm thấy khoản thu phù hợp"
                }
                description={
                  otherIncomes.length === 0
                    ? "Nhấn Ghi Khoản Thu Khác để thêm nguồn thu tài trợ hoặc ủng hộ quỹ đội."
                    : "Thử thay đổi bộ lọc tìm kiếm hoặc khoảng ngày."
                }
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
            aria-label="Bảng các khoản thu ngoài và tài trợ"
            className="hidden md:block ds-table-wrap focus-visible:outline-2 focus-visible:outline-focus-on-light"
          >
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-navy-600 text-white">
                  <th className="px-3.5 py-3 font-bold">STT</th>
                  <th className="px-3.5 py-3 font-bold">Ngày</th>
                  <th className="px-3.5 py-3 font-bold">
                    Người Ủng Hộ / Nguồn Thu
                  </th>
                  <th className="px-3.5 py-3 font-bold">Loại Quỹ</th>
                  <th className="px-3.5 py-3 font-bold text-right">
                    Số Tiền Cộng Quỹ Đội
                  </th>
                  <th className="px-3.5 py-3 font-bold">Ghi Chú / Mục Đích</th>
                  <th className="px-3.5 py-3 font-bold text-right">Thao tác</th>
                </tr>
                <tr className="bg-emerald-50 text-emerald-950 font-bold border-b border-emerald-200">
                  <td colSpan={4} className="px-3.5 py-2.5 text-right">
                    TỔNG THU KHÁC CỘNG VÀO QUỸ ĐỘI:
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-emerald-700 font-extrabold text-sm tabular-nums">
                    +{formatVND(summary.totalOtherIncome)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredIncomes.map((inc, idx) => (
                  <tr key={inc.id} className="hover:bg-slate-50">
                    <td className="px-3.5 py-2.5 text-slate-500 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap tabular-nums">
                      {formatDateVN(inc.income_date)}
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-ink-primary">
                      {inc.contributor}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Badge
                        variant={
                          inc.fund_type === "Ghi chú Quỹ giải"
                            ? "gold"
                            : "success"
                        }
                      >
                        {inc.fund_type}
                      </Badge>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700 whitespace-nowrap tabular-nums">
                      +{formatVND(inc.amount)}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-700">{inc.note}</td>
                    <td className="px-3.5 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditIncome(inc)}
                          aria-label={`Sửa khoản thu ${inc.contributor}`}
                          className="inline-flex items-center justify-center min-h-11 min-w-11 md:min-h-9 md:min-w-9 p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 cursor-pointer"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              kind: "income",
                              id: inc.id,
                              label: inc.contributor,
                            })
                          }
                          aria-label={`Xoá khoản thu ${inc.contributor}`}
                          className="inline-flex items-center justify-center min-h-11 min-w-11 md:min-h-9 md:min-w-9 p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredIncomes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4">
                      <EmptyState
                        title={
                          otherIncomes.length === 0
                            ? "Chưa có khoản thu khác nào"
                            : "Không tìm thấy khoản thu phù hợp"
                        }
                        description={
                          otherIncomes.length === 0
                            ? "Nhấn Ghi Khoản Thu Khác để thêm nguồn thu tài trợ hoặc ủng hộ quỹ đội."
                            : "Thử thay đổi bộ lọc tìm kiếm hoặc khoảng ngày."
                        }
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
