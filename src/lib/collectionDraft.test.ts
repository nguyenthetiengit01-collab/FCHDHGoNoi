import { describe, it, expect } from "vitest";
import {
  getEffectiveAttendance,
  calculateDraftTotals,
  buildBatchPayloadItems,
  type DraftItem,
} from "./collectionDraft";
import type { MatchAttendance, Player } from "@/types/app";

describe("collectionDraft helper", () => {
  const dummyPlayers: Player[] = [
    {
      id: 1,
      code_order: 1,
      full_name: "Cầu thủ 1",
      short_name: "CT1",
      jersey_number: 10,
      position: "Tiền đạo",
      phone: "",
      birth_year: "1990",
      avatar_url: "",
      role: "Thành viên",
      access_role: "player",
      pin_code: "1234",
      status: "Đang sinh hoạt",
      notes: "",
    },
    {
      id: 2,
      code_order: 2,
      full_name: "Cầu thủ 2",
      short_name: "CT2",
      jersey_number: 7,
      position: "Tiền vệ",
      phone: "",
      birth_year: "1992",
      avatar_url: "",
      role: "Thành viên",
      access_role: "player",
      pin_code: "1234",
      status: "Đang sinh hoạt",
      notes: "",
    },
    {
      id: 3,
      code_order: 3,
      full_name: "Cầu thủ 3",
      short_name: "CT3",
      jersey_number: 1,
      position: "Thủ môn",
      phone: "",
      birth_year: "1988",
      avatar_url: "",
      role: "Thành viên",
      access_role: "player",
      pin_code: "1234",
      status: "Đang sinh hoạt",
      notes: "",
    },
  ];

  const dummyAtts: MatchAttendance[] = [
    {
      id: 101,
      match_id: 1,
      player_id: 1,
      rsvp_status: "registered",
      walk_in: 0,
      attended: 1,
      paid: 1,
      amount: 100000,
      collected_by: "Tiếng",
      note: "",
    },
    {
      id: 102,
      match_id: 1,
      player_id: 2,
      rsvp_status: "registered",
      walk_in: 0,
      attended: 1,
      paid: 0,
      amount: 100000,
      collected_by: "",
      note: "",
    },
  ];

  const attByPlayer = new Map<number, MatchAttendance>([
    [1, dummyAtts[0]],
    [2, dummyAtts[1]],
  ]);

  it("lấy đúng trạng thái gốc khi chưa có nháp", () => {
    const eff1 = getEffectiveAttendance(1, dummyAtts[0], undefined, 100000);
    expect(eff1.paid).toBe(1);
    expect(eff1.amount).toBe(100000);
    expect(eff1.isDirty).toBe(false);

    const eff2 = getEffectiveAttendance(2, dummyAtts[1], undefined, 100000);
    expect(eff2.paid).toBe(0);
    expect(eff2.amount).toBe(100000);
    expect(eff2.isDirty).toBe(false);
  });

  it("ưu tiên dữ liệu nháp khi người dùng thao tác cục bộ", () => {
    // Đánh dấu cầu thủ 2 đã thu 100k
    const draft2: DraftItem = {
      paid: 1,
      amount: 100000,
      attended: 1,
      walk_in: 0,
    };
    const eff2 = getEffectiveAttendance(2, dummyAtts[1], draft2, 100000);
    expect(eff2.paid).toBe(1);
    expect(eff2.isDirty).toBe(true);

    // Huỷ thu cầu thủ 1
    const draft1: DraftItem = {
      paid: 0,
      amount: 100000,
      attended: 1,
      walk_in: 0,
    };
    const eff1 = getEffectiveAttendance(1, dummyAtts[0], draft1, 100000);
    expect(eff1.paid).toBe(0);
    expect(eff1.isDirty).toBe(true);
  });

  it("tính đúng tổng tiền và số người thu theo nháp", () => {
    // Ban đầu: CT1 đã nộp 100k, CT2 chưa nộp -> tổng 100k
    const initialTotals = calculateDraftTotals(
      dummyPlayers.slice(0, 2),
      attByPlayer,
      {},
      100000
    );
    expect(initialTotals.totalCollected).toBe(100000);
    expect(initialTotals.totalPaidCount).toBe(1);
    expect(initialTotals.totalUnpaidCount).toBe(1);
    expect(initialTotals.dirtyCount).toBe(0);

    // Nháp: đánh dấu CT2 đã nộp 100k
    const draft = {
      2: { paid: 1, amount: 100000, attended: 1, walk_in: 0 },
    };
    const totals = calculateDraftTotals(
      dummyPlayers.slice(0, 2),
      attByPlayer,
      draft,
      100000
    );
    expect(totals.totalCollected).toBe(200000);
    expect(totals.totalPaidCount).toBe(2);
    expect(totals.totalUnpaidCount).toBe(0);
    expect(totals.dirtyCount).toBe(1);
    expect(totals.netAmountDiff).toBe(100000);
  });

  it("build đúng batch payload chỉ gồm các dòng thực sự thay đổi", () => {
    const draft = {
      1: { paid: 1, amount: 100000, attended: 1, walk_in: 0 }, // Không đổi so với DB
      2: { paid: 1, amount: 120000, attended: 1, walk_in: 0 }, // Đổi paid và amount
      3: { paid: 0, amount: 0, attended: 0, walk_in: 0, removed: true }, // Bỏ khỏi trận
    };

    const batch = buildBatchPayloadItems(draft, attByPlayer, 100000);
    expect(batch.length).toBe(2); // Chỉ có 2 và 3, bỏ qua 1
    expect(batch.find((b) => b.player_id === 2)).toEqual({
      player_id: 2,
      attended: 1,
      paid: 1,
      amount: 120000,
      walk_in: 0,
      remove: false,
    });
    expect(batch.find((b) => b.player_id === 3)).toEqual({
      player_id: 3,
      attended: 0,
      paid: 0,
      amount: 0,
      walk_in: 0,
      remove: true,
    });
  });
});
