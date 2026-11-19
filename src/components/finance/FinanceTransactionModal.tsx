"use client";

import React from "react";
import {
  EXPENSE_CATEGORIES,
  type ExpenseRecord,
  type MutateActionFn,
  type OtherIncome,
  type Sponsor,
} from "@/types/app";
import { ModalDialog } from "../ModalDialog";
import { Button, ConfirmDialog, FormField, Input, Select } from "../ui";

export interface FinanceTransactionModalProps {
  isSaving: boolean;
  sponsors: Sponsor[];
  expModalOpen: boolean;
  setExpModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingExpense: ExpenseRecord | null;
  expDate: string;
  setExpDate: React.Dispatch<React.SetStateAction<string>>;
  expCategory: string;
  setExpCategory: React.Dispatch<React.SetStateAction<string>>;
  expDesc: string;
  setExpDesc: React.Dispatch<React.SetStateAction<string>>;
  expAmount: string;
  setExpAmount: React.Dispatch<React.SetStateAction<string>>;
  expPayer: string;
  setExpPayer: React.Dispatch<React.SetStateAction<string>>;
  handleSaveExpense: (e: React.FormEvent) => Promise<void>;
  incModalOpen: boolean;
  setIncModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingIncome: OtherIncome | null;
  incDate: string;
  setIncDate: React.Dispatch<React.SetStateAction<string>>;
  incContributor: string;
  setIncContributor: React.Dispatch<React.SetStateAction<string>>;
  incAmount: string;
  setIncAmount: React.Dispatch<React.SetStateAction<string>>;
  incFundType: string;
  setIncFundType: React.Dispatch<React.SetStateAction<string>>;
  incSponsorId: string;
  setIncSponsorId: React.Dispatch<React.SetStateAction<string>>;
  incNote: string;
  setIncNote: React.Dispatch<React.SetStateAction<string>>;
  handleSaveIncome: (e: React.FormEvent) => Promise<void>;
  pendingDelete: { kind: "expense" | "income"; id: number; label: string } | null;
  setPendingDelete: React.Dispatch<
    React.SetStateAction<{ kind: "expense" | "income"; id: number; label: string } | null>
  >;
  pendingResetExcel: boolean;
  setPendingResetExcel: React.Dispatch<React.SetStateAction<boolean>>;
  onMutate: MutateActionFn;
}

export function FinanceTransactionModal({
  isSaving,
  sponsors,
  expModalOpen,
  setExpModalOpen,
  editingExpense,
  expDate,
  setExpDate,
  expCategory,
  setExpCategory,
  expDesc,
  setExpDesc,
  expAmount,
  setExpAmount,
  expPayer,
  setExpPayer,
  handleSaveExpense,
  incModalOpen,
  setIncModalOpen,
  editingIncome,
  incDate,
  setIncDate,
  incContributor,
  setIncContributor,
  incAmount,
  setIncAmount,
  incFundType,
  setIncFundType,
  incSponsorId,
  setIncSponsorId,
  incNote,
  setIncNote,
  handleSaveIncome,
  pendingDelete,
  setPendingDelete,
  pendingResetExcel,
  setPendingResetExcel,
  onMutate,
}: FinanceTransactionModalProps) {
  return (
    <>
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
              <legend className="block text-sm font-semibold text-ink-primary mb-1.5">
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
                      className="accent-navy-600 h-4 w-4"
                    />
                    <span>{ft}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {sponsors.length > 0 && (
            <FormField label="Liên kết Nhà tài trợ (tùy chọn)" htmlFor="inc-sponsor">
              <Select
                id="inc-sponsor"
                name="sponsor_id"
                value={incSponsorId}
                onChange={(e) => setIncSponsorId(e.target.value)}
              >
                <option value="">— Chưa phân bổ —</option>
                {sponsors.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name} ({s.tier})
                  </option>
                ))}
              </Select>
            </FormField>
          )}

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
    </>
  );
}
