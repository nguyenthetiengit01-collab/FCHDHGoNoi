"use client";

import React, { useState } from "react";
import {
  Plus,
  Edit3,
  Trash2,
  Download,
  RotateCcw,
  Settings,
  Receipt,
  HandCoins,
  Search,
  Zap,
} from "lucide-react";
import type {
  FullAppData,
  MutateActionFn,
  ExpenseRecord,
  OtherIncome,
} from "@/types/app";
import { EXPENSE_CATEGORIES } from "@/types/app";
import { formatVND, formatDateVN, VIET_BANKS } from "@/lib/format";
import { ModalDialog } from "./ModalDialog";

const VENUE_PRESETS = [
  { venue: "Sân Vĩnh Lộc", cost: 900000, shortLabel: "Vĩnh Lộc (900k)" },
  { venue: "Sân Vũ Khánh", cost: 1335000, shortLabel: "Vũ Khánh (1.335k)" },
  { venue: "Sân Gò Mây", cost: 950000, shortLabel: "Gò Mây (950k)" },
  { venue: "Sân DEMI", cost: 600000, shortLabel: "DEMI (600k)" },
];

const QUICK_PAYERS = ["Tiếng", "Tín", "H.Sơn", "Thịnh", "Huy", "Trí"];

interface FinanceTabProps {
  data: FullAppData;
  onMutate: MutateActionFn;
  isSaving: boolean;
}

export function FinanceTab({ data, onMutate, isSaving }: FinanceTabProps) {
  const { expenses, otherIncomes, summary, settings, matches } = data;
  const latestMatch = matches[matches.length - 1];

  const [subView, setSubView] = useState<"expenses" | "incomes" | "settings">(
    "expenses"
  );
  const [filterCategory, setFilterCategory] = useState<string>("Tất cả");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Quick Pitch Expense states
  const [quickMatchId, setQuickMatchId] = useState<string>(
    String(latestMatch?.id || "")
  );
  const [quickVenue, setQuickVenue] = useState<string>(
    latestMatch?.venue || "Sân Vĩnh Lộc"
  );
  const [quickCost, setQuickCost] = useState<string>(
    String(latestMatch?.pitch_cost || 900000)
  );
  const [quickPayer, setQuickPayer] = useState<string>(
    (latestMatch?.payer_name || "Tiếng").split("-")[0].trim() || "Tiếng"
  );

  // Expense modal state
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(
    null
  );
  const [expDate, setExpDate] = useState("2026-11-03");
  const [expCategory, setExpCategory] = useState<string>("Tiền sân");
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expPayer, setExpPayer] = useState("Tiếng");

  // Other income modal state
  const [incModalOpen, setIncModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<OtherIncome | null>(null);
  const [incDate, setIncDate] = useState("2026-11-03");
  const [incContributor, setIncContributor] = useState("");
  const [incAmount, setIncAmount] = useState("");
  const [incFundType, setIncFundType] = useState("Quỹ sinh hoạt");
  const [incNote, setIncNote] = useState("");

  // Settings form state
  const [teamName, setTeamName] = useState(settings.team_name);
  const [shortName] = useState(settings.short_name);
  const [defaultFee, setDefaultFee] = useState(
    String(settings.default_match_fee)
  );
  const [bankBin, setBankBin] = useState(settings.bank_bin);
  const [bankAccountNo, setBankAccountNo] = useState(settings.bank_account_no);
  const [bankAccountName, setBankAccountName] = useState(
    settings.bank_account_name
  );
  const [tournamentReserve, setTournamentReserve] = useState(
    String(settings.tournament_fund_reserve)
  );
  const [tournamentNote, setTournamentNote] = useState(
    settings.tournament_fund_note
  );

  function openAddExpense() {
    setEditingExpense(null);
    setExpDate(new Date().toISOString().slice(0, 10));
    setExpCategory("Tiền sân");
    setExpDesc("");
    setExpAmount("");
    setExpPayer("Tiếng");
    setExpModalOpen(true);
  }

  function openEditExpense(exp: ExpenseRecord) {
    setEditingExpense(exp);
    setExpDate(exp.expense_date);
    setExpCategory(exp.category);
    setExpDesc(exp.description);
    setExpAmount(String(exp.amount));
    setExpPayer(exp.payer);
    setExpModalOpen(true);
  }

  async function handleSaveExpense(e: React.FormEvent) {
    e.preventDefault();
    await onMutate("upsert_expense", {
      id: editingExpense?.id,
      expense_date: expDate,
      category: expCategory,
      description: expDesc,
      amount: Number(expAmount) || 0,
      payer: expPayer,
      match_id: editingExpense?.match_id ?? null,
    });
    setExpModalOpen(false);
  }

  function openAddIncome() {
    setEditingIncome(null);
    setIncDate(new Date().toISOString().slice(0, 10));
    setIncContributor("");
    setIncAmount("");
    setIncFundType("Quỹ sinh hoạt");
    setIncNote("");
    setIncModalOpen(true);
  }

  function openEditIncome(inc: OtherIncome) {
    setEditingIncome(inc);
    setIncDate(inc.income_date);
    setIncContributor(inc.contributor);
    setIncAmount(String(inc.amount));
    setIncFundType(inc.fund_type);
    setIncNote(inc.note);
    setIncModalOpen(true);
  }

  async function handleSaveIncome(e: React.FormEvent) {
    e.preventDefault();
    await onMutate("upsert_other_income", {
      id: editingIncome?.id,
      income_date: incDate,
      contributor: incContributor,
      amount: Number(incAmount) || 0,
      fund_type: incFundType,
      note: incNote,
    });
    setIncModalOpen(false);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    const matchedBank = VIET_BANKS.find((b) => b.bin === bankBin);
    await onMutate("update_settings", {
      team_name: teamName,
      short_name: shortName,
      default_match_fee: Number(defaultFee) || 100000,
      bank_bin: bankBin,
      bank_name: matchedBank?.shortName || "MB Bank",
      bank_account_no: bankAccountNo,
      bank_account_name: bankAccountName,
      tournament_fund_reserve: Number(tournamentReserve) || 0,
      tournament_fund_note: tournamentNote,
    });
  }

  const filteredExpenses = expenses
    .slice()
    .reverse()
    .filter((e) => {
      if (filterCategory !== "Tất cả" && e.category !== filterCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        e.description.toLowerCase().includes(q) ||
        e.payer.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    });

  return (
    <div className="space-y-5">
      {/* Thanh điều hướng phụ & Xuất Excel */}
      <div className="rounded-xl bg-white p-4 sm:p-5 border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubView("expenses")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              subView === "expenses"
                ? "bg-emerald-800 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>Sổ Chi Tiêu ({expenses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView("incomes")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              subView === "incomes"
                ? "bg-emerald-800 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <HandCoins className="h-4 w-4" />
            <span>Thu Khác & Quỹ Giải ({otherIncomes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView("settings")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              subView === "settings"
                ? "bg-emerald-800 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>Cấu Hình VietQR & Quỹ</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/api/export"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-emerald-800 hover:bg-emerald-100 transition"
          >
            <Download className="h-4 w-4" />
            <span>Xuất File Excel (.xlsx)</span>
          </a>

          {subView === "expenses" && (
            <button
              type="button"
              onClick={openAddExpense}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs sm:text-sm font-bold text-white hover:bg-rose-700 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Ghi Khoản Chi Mới</span>
            </button>
          )}

          {subView === "incomes" && (
            <button
              type="button"
              onClick={openAddIncome}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs sm:text-sm font-bold text-white hover:bg-emerald-800 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Ghi Khoản Thu Khác</span>
            </button>
          )}
        </div>
      </div>

      {/* SUBVIEW 1: SỔ CHI TIÊU QUỸ ĐỘI BÓNG (Sheet '5. Chi') */}
      {subView === "expenses" && (
        <div className="space-y-4">
          {/* Hộp Ghi Nhanh Chi Tiền Sân 1 Chạm Dành Cho Ban Quản Lý */}
          <div className="rounded-xl bg-amber-50/90 border-2 border-[#ffc933] p-4 space-y-3 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#1e4fc2]">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e4fc2] text-[#ffc933]">
                  <Zap className="h-4 w-4" />
                </span>
                <span>
                  Ghi Nhanh Chi Tiền Sân 1 Chạm (Không cần mở biểu mẫu dài):
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      quickVenue === preset.venue &&
                      Number(quickCost) === preset.cost
                        ? "bg-[#1e4fc2] text-[#ffc933] border-[#1e4fc2]"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    🏟️ {preset.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
              <div className="sm:col-span-3">
                <select
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
                >
                  {matches
                    .slice()
                    .reverse()
                    .map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.label} ({m.venue})
                      </option>
                    ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  aria-label="Tên sân"
                  value={quickVenue}
                  onChange={(e) => setQuickVenue(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Số tiền sân"
                  value={quickCost}
                  onChange={(e) =>
                    setQuickCost(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-extrabold text-rose-600"
                />
              </div>
              <div className="sm:col-span-3 flex flex-wrap items-center gap-1">
                {QUICK_PAYERS.map((pName) => (
                  <button
                    key={pName}
                    type="button"
                    onClick={() => setQuickPayer(pName)}
                    className={`px-2 py-1 rounded-md text-xs font-bold border transition cursor-pointer ${
                      quickPayer === pName
                        ? "bg-[#1e4fc2] text-[#ffc933] border-[#1e4fc2]"
                        : "bg-white text-slate-700 border-slate-300"
                    }`}
                  >
                    {pName}
                  </button>
                ))}
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() =>
                    onMutate("quick_pitch_expense", {
                      match_id: quickMatchId ? Number(quickMatchId) : undefined,
                      venue: quickVenue,
                      pitch_cost:
                        Number(quickCost.replace(/[^0-9]/g, "")) || 0,
                      payer_name: quickPayer,
                    })
                  }
                  className="w-full rounded-lg bg-rose-600 hover:bg-rose-700 px-3 py-1.5 text-xs font-extrabold text-white transition cursor-pointer"
                >
                  Lưu Chi Tiền Sân
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {["Tất cả", ...EXPENSE_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    filterCategory === cat
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative min-w-[220px]">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="Tìm khoản chi"
                placeholder="Tìm nội dung, sân, người chi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Sổ chi tiêu quỹ đội bóng"
            className="table-wrapper"
          >
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
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
                  <td className="px-3.5 py-2.5 text-right text-rose-700 font-extrabold text-sm">
                    {formatVND(
                      filteredExpenses.reduce((s, e) => s + e.amount, 0)
                    )}
                  </td>
                  <td colSpan={2} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredExpenses.map((exp, index) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="px-3.5 py-2.5 text-slate-500">
                      {filteredExpenses.length - index}
                    </td>
                    <td className="px-3.5 py-2.5 font-medium whitespace-nowrap">
                      {formatDateVN(exp.expense_date)}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          exp.category === "Tiền sân"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                      {exp.description}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-rose-600 whitespace-nowrap">
                      {formatVND(exp.amount)}
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
                          className="p-1.5 rounded text-slate-600 hover:bg-slate-200 cursor-pointer"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Xoá khoản chi "${exp.description}"?`
                              )
                            ) {
                              onMutate("delete_expense", { id: exp.id });
                            }
                          }}
                          aria-label={`Xoá khoản chi ${exp.description}`}
                          className="p-1.5 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW 2: CÁC KHOẢN THU NGOÀI & TÀI TRỢ (Sheet '4. Thu Khác') */}
      {subView === "incomes" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                Quỹ Giải Đội Bóng (Theo dõi riêng ngoài quỹ sinh hoạt tuần)
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                {settings.tournament_fund_note}
              </p>
            </div>
            <div className="text-lg font-extrabold text-amber-900 shrink-0">
              Còn lại: {formatVND(settings.tournament_fund_reserve)}
            </div>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Bảng các khoản thu ngoài và tài trợ"
            className="table-wrapper"
          >
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
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
                  <td className="px-3.5 py-2.5 text-right text-emerald-700 font-extrabold text-sm">
                    {formatVND(summary.totalOtherIncome)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {otherIncomes.map((inc, idx) => (
                  <tr key={inc.id} className="hover:bg-slate-50">
                    <td className="px-3.5 py-2.5 text-slate-500">{idx + 1}</td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      {formatDateVN(inc.income_date)}
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                      {inc.contributor}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        {inc.fund_type}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700">
                      {formatVND(inc.amount)}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-700">{inc.note}</td>
                    <td className="px-3.5 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditIncome(inc)}
                          aria-label="Sửa khoản thu"
                          className="p-1.5 rounded text-slate-600 hover:bg-slate-200 cursor-pointer"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Xoá khoản thu này?")) {
                              onMutate("delete_other_income", { id: inc.id });
                            }
                          }}
                          aria-label="Xoá khoản thu"
                          className="p-1.5 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW 3: CẤU HÌNH ĐỘI BÓNG & VIETQR THỦ QUỸ */}
      {subView === "settings" && (
        <div className="rounded-xl bg-white p-5 border border-slate-200 max-w-2xl space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Cấu Hình Thông Tin Đội Bóng & Tài Khoản Thủ Quỹ (VietQR)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Thông tin tài khoản ngân hàng dùng để tạo mã QR đóng tiền trận tự động cho anh em trong đội
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="cfg-team-name"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Tên Đội Bóng
                </label>
                <input
                  id="cfg-team-name"
                  name="team_name"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label
                  htmlFor="cfg-default-fee"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Định mức thu mỗi trận (VND)
                </label>
                <input
                  id="cfg-default-fee"
                  name="default_match_fee"
                  type="text"
                  inputMode="numeric"
                  value={defaultFee}
                  onChange={(e) =>
                    setDefaultFee(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  className="form-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="cfg-bank"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Ngân hàng nhận quỹ
                </label>
                <select
                  id="cfg-bank"
                  name="bank_bin"
                  value={bankBin}
                  onChange={(e) => setBankBin(e.target.value)}
                  className="form-select"
                >
                  {VIET_BANKS.map((b) => (
                    <option key={b.bin} value={b.bin}>
                      {b.shortName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="cfg-acc-no"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Số Tài Khoản Thủ Quỹ
                </label>
                <input
                  id="cfg-acc-no"
                  name="bank_account_no"
                  type="text"
                  value={bankAccountNo}
                  onChange={(e) => setBankAccountNo(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label
                  htmlFor="cfg-acc-name"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Chủ Tài Khoản (Không dấu)
                </label>
                <input
                  id="cfg-acc-name"
                  name="bank_account_name"
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="cfg-tour-reserve"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Số dư Quỹ Giải Riêng (VND)
                </label>
                <input
                  id="cfg-tour-reserve"
                  name="tournament_fund_reserve"
                  type="text"
                  inputMode="numeric"
                  value={tournamentReserve}
                  onChange={(e) =>
                    setTournamentReserve(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  className="form-input"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="cfg-tour-note"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Ghi chú Quỹ Giải
                </label>
                <input
                  id="cfg-tour-note"
                  name="tournament_fund_note"
                  type="text"
                  value={tournamentNote}
                  onChange={(e) => setTournamentNote(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Khôi phục toàn bộ dữ liệu về đúng trạng thái gốc của file Excel Quan_Ly_Thu_Chi_GONOIFC.xlsx?"
                    )
                  ) {
                    onMutate("reset_to_excel", {});
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Khôi phục dữ liệu gốc từ file Excel</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 cursor-pointer"
              >
                Lưu Cấu Hình Đội Bóng
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Thêm / Sửa Khoản Chi */}
      <ModalDialog
        isOpen={expModalOpen}
        onClose={() => setExpModalOpen(false)}
        title={editingExpense ? "Cập Nhật Khoản Chi" : "Ghi Khoản Chi Tiêu Mới"}
        subtitle="Tự động cộng luỹ kế vào hạng mục chi tương ứng trên Dashboard"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="exp-date"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Ngày chi
              </label>
              <input
                id="exp-date"
                name="expense_date"
                type="date"
                required
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label
                htmlFor="exp-cat"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Hạng Mục Chi
              </label>
              <select
                id="exp-cat"
                name="category"
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                className="form-select"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="exp-desc"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Nội dung chi tiết *
            </label>
            <input
              id="exp-desc"
              name="description"
              type="text"
              required
              placeholder="VD: Tiền sân trận tuần 16 - 04/11"
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="exp-amount"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Số tiền (VND) *
              </label>
              <input
                id="exp-amount"
                name="amount"
                type="text"
                inputMode="numeric"
                required
                placeholder="VD: 900000"
                value={expAmount}
                onChange={(e) =>
                  setExpAmount(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="form-input"
              />
            </div>
            <div>
              <label
                htmlFor="exp-payer"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Người chi / Xác nhận
              </label>
              <input
                id="exp-payer"
                name="payer"
                type="text"
                placeholder="VD: Tiếng - Vĩnh Lộc"
                value={expPayer}
                onChange={(e) => setExpPayer(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setExpModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-700 cursor-pointer"
            >
              Lưu Khoản Chi
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal Thêm / Sửa Khoản Thu Khác */}
      <ModalDialog
        isOpen={incModalOpen}
        onClose={() => setIncModalOpen(false)}
        title={
          editingIncome ? "Cập Nhật Khoản Thu Khác" : "Thêm Khoản Thu Ngoài / Tài Trợ"
        }
        subtitle="Ghi nhận tiền tài trợ, ủng hộ vào Quỹ đội hoặc ghi chú Quỹ giải"
      >
        <form onSubmit={handleSaveIncome} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="inc-date"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Ngày thu
              </label>
              <input
                id="inc-date"
                name="income_date"
                type="date"
                required
                value={incDate}
                onChange={(e) => setIncDate(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label
                htmlFor="inc-contributor"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Người ủng hộ / Nguồn thu *
              </label>
              <input
                id="inc-contributor"
                name="contributor"
                type="text"
                required
                placeholder="VD: Anh Sơn ủng hộ nước"
                value={incContributor}
                onChange={(e) => setIncContributor(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="inc-amount"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Số tiền cộng vào Quỹ Sinh Hoạt (VND)
              </label>
              <input
                id="inc-amount"
                name="amount"
                type="text"
                inputMode="numeric"
                placeholder="Nhập 0 nếu chỉ ghi chú quỹ giải riêng"
                value={incAmount}
                onChange={(e) =>
                  setIncAmount(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="form-input"
              />
            </div>
            <fieldset>
              <legend className="block text-sm font-semibold text-slate-700 mb-1">
                Phân loại
              </legend>
              <div className="flex items-center gap-3 min-h-[48px]">
                {["Quỹ sinh hoạt", "Ghi chú Quỹ giải"].map((ft) => (
                  <label
                    key={ft}
                    className="inline-flex items-center gap-1.5 text-sm cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="fund_type"
                      value={ft}
                      checked={incFundType === ft}
                      onChange={() => setIncFundType(ft)}
                      className="accent-emerald-600 h-4 w-4"
                    />
                    <span>{ft}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div>
            <label
              htmlFor="inc-note"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Ghi chú / Mục đích
            </label>
            <input
              id="inc-note"
              name="note"
              type="text"
              placeholder="Nội dung chi tiết..."
              value={incNote}
              onChange={(e) => setIncNote(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIncModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 cursor-pointer"
            >
              Lưu Khoản Thu
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
