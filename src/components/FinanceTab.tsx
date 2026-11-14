"use client";

import React, { useState, useMemo } from "react";
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
  PieChart,
  TrendingUp,
  Trophy,
  X,
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
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  FormField,
  Input,
  Select,
  StatCard,
} from "./ui";

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
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [incomeSearch, setIncomeSearch] = useState<string>("");

  const [pendingDelete, setPendingDelete] = useState<{
    kind: "expense" | "income";
    id: number;
    label: string;
  } | null>(null);
  const [pendingResetExcel, setPendingResetExcel] = useState(false);

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
    if (isSaving) return;
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
    if (isSaving) return;
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
    if (isSaving) return;
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

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return expenses
      .slice()
      .reverse()
      .filter((e) => {
        if (filterCategory !== "Tất cả" && e.category !== filterCategory) {
          return false;
        }
        if (fromDate && e.expense_date < fromDate) return false;
        if (toDate && e.expense_date > toDate) return false;
        if (!q) return true;
        return (
          e.description.toLowerCase().includes(q) ||
          e.payer.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
        );
      });
  }, [expenses, filterCategory, fromDate, toDate, searchQuery]);

  const filteredIncomes = useMemo(() => {
    const q = incomeSearch.trim().toLowerCase();
    return otherIncomes.filter((inc) => {
      if (fromDate && inc.income_date < fromDate) return false;
      if (toDate && inc.income_date > toDate) return false;
      if (!q) return true;
      return (
        inc.contributor.toLowerCase().includes(q) ||
        inc.fund_type.toLowerCase().includes(q) ||
        inc.note.toLowerCase().includes(q)
      );
    });
  }, [otherIncomes, fromDate, toDate, incomeSearch]);

  const hasActiveFilters =
    filterCategory !== "Tất cả" ||
    searchQuery.trim() !== "" ||
    fromDate !== "" ||
    toDate !== "" ||
    incomeSearch.trim() !== "";

  const clearAllFilters = () => {
    setFilterCategory("Tất cả");
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    setIncomeSearch("");
  };

  const matchIncomePct =
    summary.totalIncome > 0
      ? Math.round((summary.totalMatchIncome / summary.totalIncome) * 100)
      : 0;
  const otherIncomePct =
    summary.totalIncome > 0 ? Math.max(0, 100 - matchIncomePct) : 0;

  return (
    <div className="space-y-5">
      {/* 4 KPI Cốt Lõi: Tách biệt hoàn toàn Quỹ Sinh Hoạt & Quỹ Dự Phòng Giải Đấu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <StatCard
          label="Tổng Thu Quỹ Đội"
          value={formatVND(summary.totalIncome)}
          hint={`Thu trận ${formatVND(summary.totalMatchIncome)} • Thu khác ${formatVND(summary.totalOtherIncome)}`}
          accent="emerald"
        />
        <StatCard
          label="Tổng Chi Tiêu"
          value={formatVND(summary.totalExpense)}
          hint={`${expenses.length} phiếu chi đã ghi nhận`}
          accent="rose"
        />
        <StatCard
          label="Tồn Quỹ Sinh Hoạt"
          value={formatVND(summary.currentBalance)}
          hint="Số dư thực tế quỹ sinh hoạt tuần"
          accent="navy"
        />
        <StatCard
          label="Quỹ Dự Phòng Giải Đấu"
          value={formatVND(settings.tournament_fund_reserve)}
          hint="Theo dõi tách riêng • Không gộp quỹ tuần"
          accent="gold"
        />
      </div>

      {/* Phân tích cơ cấu Chi tiêu & Nguồn thu (Data-driven từ summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="space-y-3.5">
          <CardHeader className="border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-[#0d2e5b]" />
              <CardTitle className="text-sm">
                Cơ Cấu Chi Tiêu Theo Hạng Mục
              </CardTitle>
            </div>
            <span className="text-xs font-bold text-rose-600 tabular-nums">
              {formatVND(summary.totalExpense)}
            </span>
          </CardHeader>

          {summary.categoryBreakdown.length === 0 ? (
            <EmptyState
              title="Chưa có dữ liệu phân bổ chi tiêu"
              description="Các khoản chi sẽ tự động tổng hợp tỷ trọng tại đây."
            />
          ) : (
            <div className="space-y-2.5">
              {summary.categoryBreakdown.map((item) => (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => {
                    setSubView("expenses");
                    setFilterCategory(item.category);
                  }}
                  className="w-full text-left group cursor-pointer rounded-lg p-1.5 -mx-1.5 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-[#092244] group-hover:text-[#17488c]">
                      {item.category}
                    </span>
                    <span className="font-bold text-slate-700 tabular-nums">
                      {formatVND(item.amount)}{" "}
                      <span className="text-slate-400 font-medium">
                        ({item.percentage}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.category === "Tiền sân"
                          ? "bg-[#0d2e5b]"
                          : "bg-rose-500"
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(2, item.percentage))}%`,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-3.5">
          <CardHeader className="border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-700" />
              <CardTitle className="text-sm">
                Cơ Cấu Nguồn Thu & Công Nợ Trận
              </CardTitle>
            </div>
            <span className="text-xs font-bold text-emerald-700 tabular-nums">
              {formatVND(summary.totalIncome)}
            </span>
          </CardHeader>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-[#092244]">
                  Thu tiền trận hằng tuần
                </span>
                <span className="font-bold text-emerald-700 tabular-nums">
                  {formatVND(summary.totalMatchIncome)}{" "}
                  <span className="text-slate-400 font-medium">
                    ({matchIncomePct}%)
                  </span>
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${matchIncomePct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-[#092244]">
                  Thu khác & Tài trợ quỹ đội
                </span>
                <span className="font-bold text-sky-700 tabular-nums">
                  {formatVND(summary.totalOtherIncome)}{" "}
                  <span className="text-slate-400 font-medium">
                    ({otherIncomePct}%)
                  </span>
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-600"
                  style={{ width: `${otherIncomePct}%` }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                  Chưa thu tiền trận
                </span>
                <span className="text-sm font-extrabold text-amber-950 tabular-nums">
                  {formatVND(summary.totalUnpaidAmount)}
                </span>
              </div>
              <div className="rounded-lg bg-[#092244]/[0.04] border border-[#0d2e5b]/15 px-3 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0d2e5b] flex items-center gap-1">
                  <Trophy className="h-3 w-3 text-[#b89635]" />
                  Quỹ giải tách riêng
                </span>
                <span className="text-sm font-extrabold text-[#092244] tabular-nums">
                  {formatVND(settings.tournament_fund_reserve)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Thanh điều hướng phụ & Xuất Excel */}
      <Card className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubView("expenses")}
            className={`inline-flex items-center gap-2 min-h-11 sm:min-h-10 px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              subView === "expenses"
                ? "bg-[#0d2e5b] text-[#fde047]"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>Sổ Chi Tiêu ({expenses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView("incomes")}
            className={`inline-flex items-center gap-2 min-h-11 sm:min-h-10 px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              subView === "incomes"
                ? "bg-[#0d2e5b] text-[#fde047]"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <HandCoins className="h-4 w-4" />
            <span>Thu Khác & Quỹ Giải ({otherIncomes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView("settings")}
            className={`inline-flex items-center gap-2 min-h-11 sm:min-h-10 px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              subView === "settings"
                ? "bg-[#0d2e5b] text-[#fde047]"
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
            className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-10 rounded-lg border border-[#0d2e5b]/25 bg-slate-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-[#0d2e5b] hover:bg-slate-100 transition"
          >
            <Download className="h-4 w-4" />
            <span>Xuất File Excel (.xlsx)</span>
          </a>

          {subView === "expenses" && (
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={openAddExpense}
              leftIcon={<Plus className="h-4 w-4" />}
              className="min-h-11 sm:min-h-10"
            >
              Ghi Khoản Chi Mới
            </Button>
          )}

          {subView === "incomes" && (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={openAddIncome}
              leftIcon={<Plus className="h-4 w-4" />}
              className="min-h-11 sm:min-h-10"
            >
              Ghi Khoản Thu Khác
            </Button>
          )}
        </div>
      </Card>

      {/* SUBVIEW 1: SỔ CHI TIÊU QUỸ ĐỘI BÓNG (Sheet '5. Chi') */}
      {subView === "expenses" && (
        <div className="space-y-4">
          {/* Hộp Ghi Nhanh Chi Tiền Sân 1 Chạm Dành Cho Ban Quản Lý */}
          <Card className="bg-[#092244]/[0.03] border-[#0d2e5b]/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#092244]">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#0d2e5b] text-[#fde047]">
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
                    className={`min-h-9 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      quickVenue === preset.venue &&
                      Number(quickCost) === preset.cost
                        ? "bg-[#0d2e5b] text-[#fde047] border-[#0d2e5b]"
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
                  className="text-xs font-bold text-[#092244]"
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
                  className="text-xs font-bold text-[#092244]"
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
                    className={`min-h-9 px-2 py-1 rounded-md text-xs font-bold border transition cursor-pointer ${
                      quickPayer === pName
                        ? "bg-[#0d2e5b] text-[#fde047] border-[#0d2e5b]"
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
                  className="w-full min-h-10 sm:min-h-9"
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
                  className={`min-h-9 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    filterCategory === cat
                      ? "bg-[#0d2e5b] text-white border-[#0d2e5b]"
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

          <div
            tabIndex={0}
            role="region"
            aria-label="Sổ chi tiêu quỹ đội bóng"
            className="ds-table-wrap"
          >
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-[#0d2e5b] text-white">
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
                    <td className="px-3.5 py-2.5 font-semibold text-[#092244]">
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
                          className="inline-flex items-center justify-center min-h-9 min-w-9 p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 cursor-pointer"
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
                          className="inline-flex items-center justify-center min-h-9 min-w-9 p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
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
      )}

      {/* SUBVIEW 2: CÁC KHOẢN THU NGOÀI & TÀI TRỢ (Sheet '4. Thu Khác') */}
      {subView === "incomes" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-[#092244] text-white border border-[#d4af37] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#fde047]">
                <Trophy className="h-3.5 w-3.5" />
                <span>
                  Quỹ Giải Đội Bóng (Theo dõi tách riêng ngoài quỹ sinh hoạt tuần)
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {settings.tournament_fund_note}
              </p>
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-[#fde047] shrink-0 tabular-nums">
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

          <div
            tabIndex={0}
            role="region"
            aria-label="Bảng các khoản thu ngoài và tài trợ"
            className="ds-table-wrap"
          >
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-[#0d2e5b] text-white">
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
                    <td className="px-3.5 py-2.5 font-semibold text-[#092244]">
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
                          className="inline-flex items-center justify-center min-h-9 min-w-9 p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 cursor-pointer"
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
                          className="inline-flex items-center justify-center min-h-9 min-w-9 p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
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
      )}

      {/* SUBVIEW 3: CẤU HÌNH ĐỘI BÓNG & VIETQR THỦ QUỸ */}
      {subView === "settings" && (
        <Card className="max-w-2xl space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-[#092244]">
              Cấu Hình Thông Tin Đội Bóng & Tài Khoản Thủ Quỹ (VietQR)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Thông tin tài khoản ngân hàng dùng để tạo mã QR đóng tiền trận tự động cho anh em trong đội
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Tên Đội Bóng" htmlFor="cfg-team-name">
                <Input
                  id="cfg-team-name"
                  name="team_name"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </FormField>
              <FormField
                label="Định mức thu mỗi trận (VND)"
                htmlFor="cfg-default-fee"
              >
                <Input
                  id="cfg-default-fee"
                  name="default_match_fee"
                  type="text"
                  inputMode="numeric"
                  value={defaultFee}
                  onChange={(e) =>
                    setDefaultFee(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  className="tabular-nums font-bold"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <FormField label="Ngân hàng nhận quỹ" htmlFor="cfg-bank">
                <Select
                  id="cfg-bank"
                  name="bank_bin"
                  value={bankBin}
                  onChange={(e) => setBankBin(e.target.value)}
                >
                  {VIET_BANKS.map((b) => (
                    <option key={b.bin} value={b.bin}>
                      {b.shortName}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Số Tài Khoản Thủ Quỹ" htmlFor="cfg-acc-no">
                <Input
                  id="cfg-acc-no"
                  name="bank_account_no"
                  type="text"
                  value={bankAccountNo}
                  onChange={(e) => setBankAccountNo(e.target.value)}
                  className="tabular-nums"
                />
              </FormField>
              <FormField
                label="Chủ Tài Khoản (Không dấu)"
                htmlFor="cfg-acc-name"
              >
                <Input
                  id="cfg-acc-name"
                  name="bank_account_name"
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <FormField
                label="Số dư Quỹ Giải Riêng (VND)"
                htmlFor="cfg-tour-reserve"
              >
                <Input
                  id="cfg-tour-reserve"
                  name="tournament_fund_reserve"
                  type="text"
                  inputMode="numeric"
                  value={tournamentReserve}
                  onChange={(e) =>
                    setTournamentReserve(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  className="tabular-nums font-bold"
                />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label="Ghi chú Quỹ Giải" htmlFor="cfg-tour-note">
                  <Input
                    id="cfg-tour-note"
                    name="tournament_fund_note"
                    type="text"
                    value={tournamentNote}
                    onChange={(e) => setTournamentNote(e.target.value)}
                  />
                </FormField>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSaving}
                onClick={() => setPendingResetExcel(true)}
                leftIcon={<RotateCcw className="h-4 w-4" />}
                className="min-h-11 sm:min-h-10 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              >
                Khôi phục dữ liệu khởi tạo
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={isSaving}
                disabled={isSaving}
                className="min-h-11 sm:min-h-10"
              >
                Lưu Cấu Hình Đội Bóng
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Modal Thêm / Sửa Khoản Chi */}
      <ModalDialog
        isOpen={expModalOpen}
        onClose={() => {
          if (!isSaving) setExpModalOpen(false);
        }}
        title={editingExpense ? "Cập Nhật Khoản Chi" : "Ghi Khoản Chi Tiêu Mới"}
        subtitle="Tự động cộng luỹ kế vào hạng mục chi tương ứng trên Dashboard"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label="Ngày chi" htmlFor="exp-date" required>
              <Input
                id="exp-date"
                name="expense_date"
                type="date"
                required
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
              />
            </FormField>
            <FormField label="Hạng Mục Chi" htmlFor="exp-cat">
              <Select
                id="exp-cat"
                name="category"
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Nội dung chi tiết" htmlFor="exp-desc" required>
            <Input
              id="exp-desc"
              name="description"
              type="text"
              required
              placeholder="VD: Tiền sân trận tuần 16 - 04/11"
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label="Số tiền (VND)" htmlFor="exp-amount" required>
              <Input
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
                className="tabular-nums font-bold"
              />
            </FormField>
            <FormField label="Người chi / Xác nhận" htmlFor="exp-payer">
              <Input
                id="exp-payer"
                name="payer"
                type="text"
                placeholder="VD: Tiếng - Vĩnh Lộc"
                value={expPayer}
                onChange={(e) => setExpPayer(e.target.value)}
              />
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={isSaving}
              onClick={() => setExpModalOpen(false)}
            >
              Huỷ
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="md"
              loading={isSaving}
              disabled={isSaving}
            >
              Lưu Khoản Chi
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal Thêm / Sửa Khoản Thu Khác */}
      <ModalDialog
        isOpen={incModalOpen}
        onClose={() => {
          if (!isSaving) setIncModalOpen(false);
        }}
        title={
          editingIncome
            ? "Cập Nhật Khoản Thu Khác"
            : "Thêm Khoản Thu Ngoài / Tài Trợ"
        }
        subtitle="Ghi nhận tiền tài trợ, ủng hộ vào Quỹ đội hoặc ghi chú Quỹ giải"
      >
        <form onSubmit={handleSaveIncome} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label="Ngày thu" htmlFor="inc-date" required>
              <Input
                id="inc-date"
                name="income_date"
                type="date"
                required
                value={incDate}
                onChange={(e) => setIncDate(e.target.value)}
              />
            </FormField>
            <FormField
              label="Người ủng hộ / Nguồn thu"
              htmlFor="inc-contributor"
              required
            >
              <Input
                id="inc-contributor"
                name="contributor"
                type="text"
                required
                placeholder="VD: Anh Sơn ủng hộ nước"
                value={incContributor}
                onChange={(e) => setIncContributor(e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField
              label="Số tiền cộng vào Quỹ Sinh Hoạt (VND)"
              htmlFor="inc-amount"
            >
              <Input
                id="inc-amount"
                name="amount"
                type="text"
                inputMode="numeric"
                placeholder="Nhập 0 nếu chỉ ghi chú quỹ giải riêng"
                value={incAmount}
                onChange={(e) =>
                  setIncAmount(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="tabular-nums font-bold"
              />
            </FormField>
            <fieldset>
              <legend className="block text-sm font-semibold text-[#092244] mb-1.5">
                Phân loại
              </legend>
              <div className="flex items-center gap-3 min-h-[44px]">
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
                      className="accent-[#0d2e5b] h-4 w-4"
                    />
                    <span>{ft}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <FormField label="Ghi chú / Mục đích" htmlFor="inc-note">
            <Input
              id="inc-note"
              name="note"
              type="text"
              placeholder="Nội dung chi tiết..."
              value={incNote}
              onChange={(e) => setIncNote(e.target.value)}
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={isSaving}
              onClick={() => setIncModalOpen(false)}
            >
              Huỷ
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isSaving}
              disabled={isSaving}
            >
              Lưu Khoản Thu
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* ConfirmDialog Xoá khoản chi / khoản thu (khóa khi isSaving) */}
      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        loading={isSaving}
        onClose={() => {
          if (!isSaving) setPendingDelete(null);
        }}
        onConfirm={async () => {
          if (!pendingDelete || isSaving) return;
          const action =
            pendingDelete.kind === "expense"
              ? "delete_expense"
              : "delete_other_income";
          const id = pendingDelete.id;
          try {
            await onMutate(action, { id });
          } finally {
            setPendingDelete(null);
          }
        }}
        title={
          pendingDelete?.kind === "expense"
            ? "Xoá khoản chi tiêu?"
            : "Xoá khoản thu khác?"
        }
        description={
          pendingDelete
            ? `Bạn có chắc muốn xoá "${pendingDelete.label}"? Thao tác này sẽ cập nhật lại số dư quỹ.`
            : ""
        }
        confirmLabel="Xoá"
        danger
      />

      {/* ConfirmDialog Khôi phục dữ liệu khởi tạo */}
      <ConfirmDialog
        isOpen={pendingResetExcel}
        loading={isSaving}
        onClose={() => {
          if (!isSaving) setPendingResetExcel(false);
        }}
        onConfirm={async () => {
          if (isSaving) return;
          try {
            await onMutate("reset_to_excel", {});
          } finally {
            setPendingResetExcel(false);
          }
        }}
        title="Khôi phục dữ liệu khởi tạo?"
        description="Thao tác này sẽ khôi phục toàn bộ hệ thống về bộ dữ liệu khởi tạo mặc định (không đọc từ file Excel): Danh sách cầu thủ sẽ được nạp lại; Lịch sử trận đấu và điểm danh sẽ được nạp lại; Toàn bộ khoản thu và chi hiện tại sẽ bị thay thế; Cấu hình đội bóng và quỹ dự phòng sẽ trở về giá trị trong bộ dữ liệu khởi tạo. Cảnh báo: Không thể hoàn tác nếu không có bản sao lưu."
        confirmLabel="Khôi phục dữ liệu khởi tạo"
        danger
      />
    </div>
  );
}
