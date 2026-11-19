"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Download,
  RotateCcw,
  Settings,
  PieChart,
  Receipt,
  HandCoins,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type {
  FullAppData,
  MutateActionFn,
  ExpenseRecord,
  OtherIncome,
} from "@/types/app";
import { formatVND, VIET_BANKS } from "@/lib/format";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  FormField,
  Input,
  Select,
  StatCard,
} from "./ui";
import { ExpenseLedgerSection } from "./finance/ExpenseLedgerSection";
import { OtherIncomeSection } from "./finance/OtherIncomeSection";
import { FinanceTransactionModal } from "./finance/FinanceTransactionModal";
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
  const [incSponsorId, setIncSponsorId] = useState("");
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
    setIncSponsorId("");
    setIncNote("");
    setIncModalOpen(true);
  }

  function openEditIncome(inc: OtherIncome) {
    setEditingIncome(inc);
    setIncDate(inc.income_date);
    setIncContributor(inc.contributor);
    setIncAmount(String(inc.amount));
    setIncFundType(inc.fund_type);
    const sid = (inc as OtherIncome & { sponsor_id?: number | null }).sponsor_id;
    setIncSponsorId(sid ? String(sid) : "");
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
      sponsor_id: incSponsorId ? Number(incSponsorId) : null,
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
              <PieChart className="h-4 w-4 text-navy-600" />
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
                  className="w-full min-h-11 md:min-h-0 text-left group cursor-pointer rounded-lg p-1.5 -mx-1.5 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-ink-primary group-hover:text-navy-500">
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
                          ? "bg-navy-600"
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
                <span className="font-semibold text-ink-primary">
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
                <span className="font-semibold text-ink-primary">
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
              <div className="rounded-lg bg-navy-800/[0.04] border border-navy-600/15 px-3 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-navy-600 flex items-center gap-1">
                  <Trophy className="h-3 w-3 text-gold-600" />
                  Quỹ giải tách riêng
                </span>
                <span className="text-sm font-extrabold text-ink-primary tabular-nums">
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
            className={`inline-flex items-center gap-2 min-h-11 md:min-h-10 px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              subView === "expenses"
                ? "bg-navy-600 text-gold-300"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>Sổ Chi Tiêu ({expenses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView("incomes")}
            className={`inline-flex items-center gap-2 min-h-11 md:min-h-10 px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              subView === "incomes"
                ? "bg-navy-600 text-gold-300"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <HandCoins className="h-4 w-4" />
            <span>Thu Khác & Quỹ Giải ({otherIncomes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView("settings")}
            className={`inline-flex items-center gap-2 min-h-11 md:min-h-10 px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              subView === "settings"
                ? "bg-navy-600 text-gold-300"
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
            className="inline-flex items-center gap-1.5 min-h-11 md:min-h-10 rounded-lg border border-navy-600/25 bg-slate-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-navy-600 hover:bg-slate-100 transition"
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
              className="min-h-11 md:min-h-10"
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
              className="min-h-11 md:min-h-10"
            >
              Ghi Khoản Thu Khác
            </Button>
          )}
        </div>
      </Card>

      {/* SUBVIEW 1: SỔ CHI TIÊU QUỸ ĐỘI BÓNG (Sheet '5. Chi') */}
      {subView === "expenses" && (
        <ExpenseLedgerSection
          matches={matches}

          expenses={expenses}
          filteredExpenses={filteredExpenses}
          hasActiveFilters={hasActiveFilters}
          quickMatchId={quickMatchId}
          setQuickMatchId={setQuickMatchId}
          quickVenue={quickVenue}
          setQuickVenue={setQuickVenue}
          quickCost={quickCost}
          setQuickCost={setQuickCost}
          quickPayer={quickPayer}
          setQuickPayer={setQuickPayer}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          isSaving={isSaving}
          onMutate={onMutate}
          clearAllFilters={clearAllFilters}
          openEditExpense={openEditExpense}
          onRequestDeleteExpense={(exp) =>
            setPendingDelete({
              kind: "expense",
              id: exp.id,
              label: `${exp.description} (${formatVND(exp.amount)})`,
            })
          }
        />
      )}

      {subView === "incomes" && (
        <OtherIncomeSection
          filteredIncomes={filteredIncomes}
          settings={settings}
          summary={summary}
          otherIncomes={otherIncomes}
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          hasActiveFilters={hasActiveFilters}
          clearAllFilters={clearAllFilters}
          incomeSearch={incomeSearch}
          setIncomeSearch={setIncomeSearch}
          openEditIncome={openEditIncome}
          onRequestDeleteIncome={(inc) =>
            setPendingDelete({
              kind: "income",
              id: inc.id,
              label: `${inc.contributor} (${formatVND(inc.amount)})`,
            })
          }
        />
      )}

      {subView === "settings" && (
        <Card className="max-w-2xl space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-ink-primary">
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
                className="min-h-11 md:min-h-10 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              >
                Khôi phục dữ liệu khởi tạo
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={isSaving}
                disabled={isSaving}
                className="min-h-11 md:min-h-10"
              >
                Lưu Cấu Hình Đội Bóng
              </Button>
            </div>
          </form>
        </Card>
      )}

      <FinanceTransactionModal
        isSaving={isSaving}
        sponsors={data.sponsors || []}
        expModalOpen={expModalOpen}
        setExpModalOpen={setExpModalOpen}
        editingExpense={editingExpense}
        expDate={expDate}
        setExpDate={setExpDate}
        expCategory={expCategory}
        setExpCategory={setExpCategory}
        expDesc={expDesc}
        setExpDesc={setExpDesc}
        expAmount={expAmount}
        setExpAmount={setExpAmount}
        expPayer={expPayer}
        setExpPayer={setExpPayer}
        handleSaveExpense={handleSaveExpense}
        incModalOpen={incModalOpen}
        setIncModalOpen={setIncModalOpen}
        editingIncome={editingIncome}
        incDate={incDate}
        setIncDate={setIncDate}
        incContributor={incContributor}
        setIncContributor={setIncContributor}
        incAmount={incAmount}
        setIncAmount={setIncAmount}
        incFundType={incFundType}
        setIncFundType={setIncFundType}
        incSponsorId={incSponsorId}
        setIncSponsorId={setIncSponsorId}
        incNote={incNote}
        setIncNote={setIncNote}
        handleSaveIncome={handleSaveIncome}
        pendingDelete={pendingDelete}
        setPendingDelete={setPendingDelete}
        pendingResetExcel={pendingResetExcel}
        setPendingResetExcel={setPendingResetExcel}
        onMutate={onMutate}
      />
    </div>
  );
}
