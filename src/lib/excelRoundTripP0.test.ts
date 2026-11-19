import os from "os";
import path from "path";
import fs from "fs";

const tempDbPath = path.join(
  os.tmpdir(),
  `gonoifc-roundtrip-p0-${process.pid}-${Date.now()}.sqlite`
);
process.env.USE_LOCAL_SQLITE = "true";
process.env.SQLITE_DB_PATH = tempDbPath;

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { POST as importPost } from "@/app/api/import/route";
import { GET as exportGet } from "@/app/api/export/route";
import { getAsyncDb, getAuditLogs, getFullAppData } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import type { Player } from "@/types/app";

function buildImportRequest(
  wb: XLSX.WorkBook,
  managerToken: string,
  filename = "test.xlsx"
): NextRequest {
  const buf = new Uint8Array(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
  );
  const form = new FormData();
  form.append(
    "file",
    new File([buf], filename, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );
  return new NextRequest("http://localhost:3000/api/import", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      cookie: `${SESSION_COOKIE_NAME}=${managerToken}`,
    },
    body: form,
  });
}

function buildValidLegacyWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["", "DASHBOARD"]]),
    "1. Dashboard"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Phn"],
      ["", "DANH SÁCH THÀNH VIÊN ĐỘI BÓNG"],
      [],
      ["", "STT", "Họ và Tên", "Vị Trí", "Số Áo", "SĐT", "Ghi Chú"],
      ["", 1, "Nguyễn Thế Tiếng", "MF", 10, "0900000001", "Đội trưởng"],
      ["", 2, "Trần Văn An", "FW", 9, "0900000002", ""],
    ]),
    "2. Danh sách"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["", "THEO DÕI THU TIỀN TRẬN HẰNG TUẦN"],
      [],
      [],
      [],
      ["", "", "Ngày/Tháng:", "", "", "Trận 1 - 01/04"],
      ["", "", "Số tiền/Trận:", "", "", 100000],
      ["", "STT", "Họ và Tên", "Tên", "Tổng Đã Nộp", "Tích chọn"],
      ["", "TỔNG TIỀN THU ĐƯỢC:", "", "", 100000, 100000],
      ["", 1, "Nguyễn Thế Tiếng", "Tiếng", 100000, true],
      ["", 2, "Trần Văn An", "An", 0, false],
    ]),
    "3. Thu Trận (Tích chọn)"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [],
      ["", "CÁC KHOẢN THU NGOÀI & TÀI TRỢ"],
      [],
      ["", "STT", "Ngày", "Người Ủng Hộ / Nguồn Thu", "Số Tiền (VND)", "Ghi Chú / Mục Đích"],
      ["", "", "", "TỔNG THU KHÁC:", 500000, ""],
      ["", 1, "2026-04-01", "Mạnh Thường Quân A", 500000, "Tài trợ nước"],
    ]),
    "4. Thu Khác"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [],
      ["", "SỔ CHI TIÊU QUỸ ĐỘI BÓNG"],
      [],
      ["", "STT", "Ngày", "Hạng Mục Luỹ Kế", "Nội Dung Chi Tiết", "Số Tiền (VND)", "Người Chi / Xác Nhận"],
      ["", "", "", "", "TỔNG CHI TIÊU:", 300000, ""],
      ["", 1, "2026-04-01", "Tiền sân", "Thuê sân tuần 1", 300000, "Tiếng"],
    ]),
    "5. Chi"
  );
  return wb;
}

describe("Phase 5.2 P0: Import Transaction Atomicity & Excel Round-Trip Integrity", () => {
  let manager: Player;
  let managerToken: string;

  beforeAll(async () => {
    await getFullAppData();
    const db = getAsyncDb();
    const players = await db.query<Player>("SELECT * FROM players ORDER BY id ASC");
    const foundManager = players.find((p) => p.access_role === "manager");
    if (!foundManager) {
      throw new Error("Expected a manager in seeded test DB");
    }
    manager = foundManager;
    managerToken = createSessionToken(manager, 1);
  });

  afterAll(() => {
    for (const suffix of ["", "-wal", "-shm"]) {
      const target = `${tempDbPath}${suffix}`;
      if (fs.existsSync(target)) {
        try {
          fs.unlinkSync(target);
        } catch {
          // ignore Windows file lock cleanup
        }
      }
    }
  });

  it("rolls back completely on mid-transaction DB failure (old players/matches/expenses/audit_logs remain intact)", async () => {
    const before = await getFullAppData();
    const beforeAuditCount = (await getAuditLogs(200)).length;

    const db = getAsyncDb();
    const origTransaction = db.transaction.bind(db);
    const txSpy = vi.spyOn(db, "transaction").mockImplementation(async (fn) => {
      return origTransaction(async (tx) => {
        const wrappedTx: typeof tx = {
          query: tx.query,
          queryOne: tx.queryOne,
          exec: tx.exec,
          run: async (sql, params) => {
            if (sql.includes("INSERT INTO expenses")) {
              throw new Error("Simulated mid-transaction DB failure on expenses");
            }
            return tx.run(sql, params);
          },
        };
        return fn(wrappedTx);
      });
    });

    try {
      const wb = buildValidLegacyWorkbook();
      const res = await importPost(buildImportRequest(wb, managerToken));
      expect(res.status).toBe(500);
    } finally {
      txSpy.mockRestore();
    }

    const after = await getFullAppData();
    const afterAuditCount = (await getAuditLogs(200)).length;

    expect(after.players.map((p) => p.full_name)).toEqual(
      before.players.map((p) => p.full_name)
    );
    expect(after.matches.length).toBe(before.matches.length);
    expect(after.expenses.length).toBe(before.expenses.length);
    expect(afterAuditCount).toBe(beforeAuditCount);
  });

  it("rejects negative, NaN, Infinity, decimal VND amounts and duplicate player names with 400 without mutating DB", async () => {
    const before = await getFullAppData();

    // 1. Negative amount on sheet 5
    const negWb = buildValidLegacyWorkbook();
    negWb.Sheets["5. Chi"] = XLSX.utils.aoa_to_sheet([
      [],
      ["", "SỔ CHI TIÊU QUỸ ĐỘI BÓNG"],
      [],
      ["", "STT", "Ngày", "Hạng Mục Luỹ Kế", "Nội Dung Chi Tiết", "Số Tiền (VND)", "Người Chi / Xác Nhận"],
      ["", "", "", "", "TỔNG CHI TIÊU:", 0, ""],
      ["", 1, "2026-04-01", "Tiền sân", "Chi âm", -50000, "Tiếng"],
    ]);
    expect((await importPost(buildImportRequest(negWb, managerToken))).status).toBe(400);

    // 2. NaN / non-numeric amount on sheet 4
    const nanWb = buildValidLegacyWorkbook();
    nanWb.Sheets["4. Thu Khác"] = XLSX.utils.aoa_to_sheet([
      [],
      ["", "CÁC KHOẢN THU NGOÀI & TÀI TRỢ"],
      [],
      ["", "STT", "Ngày", "Người Ủng Hộ / Nguồn Thu", "Số Tiền (VND)", "Ghi Chú / Mục Đích"],
      ["", "", "", "TỔNG THU KHÁC:", 0, ""],
      ["", 1, "2026-04-01", "MTQ", "NaN", "Lỗi số"],
    ]);
    expect((await importPost(buildImportRequest(nanWb, managerToken))).status).toBe(400);

    // 3. Infinity amount on sheet 5
    const infWb = buildValidLegacyWorkbook();
    infWb.Sheets["5. Chi"] = XLSX.utils.aoa_to_sheet([
      [],
      ["", "SỔ CHI TIÊU QUỸ ĐỘI BÓNG"],
      [],
      ["", "STT", "Ngày", "Hạng Mục Luỹ Kế", "Nội Dung Chi Tiết", "Số Tiền (VND)", "Người Chi / Xác Nhận"],
      ["", "", "", "", "TỔNG CHI TIÊU:", 0, ""],
      ["", 1, "2026-04-01", "Nước uống", "Mua nước", "Infinity", "Tiếng"],
    ]);
    expect((await importPost(buildImportRequest(infWb, managerToken))).status).toBe(400);

    // 4. Decimal VND amount on sheet 4
    const decWb = buildValidLegacyWorkbook();
    decWb.Sheets["4. Thu Khác"] = XLSX.utils.aoa_to_sheet([
      [],
      ["", "CÁC KHOẢN THU NGOÀI & TÀI TRỢ"],
      [],
      ["", "STT", "Ngày", "Người Ủng Hộ / Nguồn Thu", "Số Tiền (VND)", "Ghi Chú / Mục Đích"],
      ["", "", "", "TỔNG THU KHÁC:", 0, ""],
      ["", 1, "2026-04-01", "MTQ", 100000.5, "Số lẻ"],
    ]);
    expect((await importPost(buildImportRequest(decWb, managerToken))).status).toBe(400);

    // 5. Duplicate player name (case-insensitive)
    const dupWb = buildValidLegacyWorkbook();
    dupWb.Sheets["2. Danh sách"] = XLSX.utils.aoa_to_sheet([
      ["Phn"],
      ["", "DANH SÁCH THÀNH VIÊN ĐỘI BÓNG"],
      [],
      ["", "STT", "Họ và Tên", "Vị Trí", "Số Áo", "SĐT", "Ghi Chú"],
      ["", 1, "Nguyễn Thế Tiếng", "MF", 10, "0900000001", ""],
      ["", 2, "  nguyễn thế tiếng ", "FW", 9, "0900000002", ""],
    ]);
    expect((await importPost(buildImportRequest(dupWb, managerToken))).status).toBe(400);

    const after = await getFullAppData();
    expect(after.players.length).toBe(before.players.length);
    expect(after.matches.length).toBe(before.matches.length);
    expect(after.expenses.length).toBe(before.expenses.length);
    expect(after.otherIncomes.length).toBe(before.otherIncomes.length);
  });

  it("round-trips Export -> Import preserving attended/paid/custom amount/expense.match_id/fund_type", async () => {
    const db = getAsyncDb();
    const initial = await getFullAppData();
    const p1 = initial.players[0];
    const p2 = initial.players[1];
    const p3 = initial.players[2];
    expect(p1 && p2 && p3).toBeTruthy();

    // Seed specific edge cases directly in test DB
    const mRes = await db.run(
      `INSERT INTO matches (match_number, label, match_date, kickoff_time, venue, opponent, fee_per_player, pitch_cost, payer_name, status, notes)
       VALUES (99, 'Trận RoundTrip 99', '2026-05-10', '19:30', 'Sân Gò Nổi', 'FC Bạn', 120000, 600000, 'Tiếng', 'Đã kết thúc', 'Test roundtrip')`
    );
    const matchId = Number(mRes.lastInsertRowid);

    // Case A: attended=1, paid=0 (nợ 120k)
    await db.run(
      `INSERT INTO match_attendances (match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note)
       VALUES (?, ?, 'registered', 0, 1, 0, 120000, '', 'Chưa đóng')`,
      [matchId, p1.id]
    );
    // Case B: attended=0, paid=1 (vắng nhưng đóng góp tự nguyện)
    await db.run(
      `INSERT INTO match_attendances (match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note)
       VALUES (?, ?, 'absent_notice', 0, 0, 1, 120000, 'Tiếng', 'Ủng hộ')`,
      [matchId, p2.id]
    );
    // Case C: custom amount != fee_per_player (150k instead of 120k)
    await db.run(
      `INSERT INTO match_attendances (match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note)
       VALUES (?, ?, 'registered', 1, 1, 1, 150000, 'Tín', 'Đóng dư')`,
      [matchId, p3.id]
    );

    // Expense linked to matchId
    await db.run(
      `INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
       VALUES ('2026-05-10', 'Nước uống', 'Nước trận 99', 95000, 'Tiếng', ?)`,
      [matchId]
    );

    // Other income with fund_type = "Chuyển quỹ nội bộ"
    await db.run(
      `INSERT INTO other_incomes (income_date, contributor, amount, fund_type, note)
       VALUES ('2026-05-10', 'Quỹ giải đội bóng', 250000, 'Chuyển quỹ nội bộ', 'Điều chuyển nội bộ')`
    );

    const beforeExport = await getFullAppData();

    // 1. Export
    const exportReq = new NextRequest("http://localhost:3000/api/export", {
      method: "GET",
      headers: {
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${managerToken}`,
      },
    });
    const exportRes = await exportGet(exportReq);
    expect(exportRes.status).toBe(200);
    const exportedBytes = new Uint8Array(await exportRes.arrayBuffer());
    const exportedWb = XLSX.read(exportedBytes, { type: "array" });
    expect(exportedWb.SheetNames).toContain("6. Dữ liệu Chi tiết (App)");

    // 2. Import exported workbook back
    const importRes = await importPost(
      buildImportRequest(exportedWb, managerToken, "exported.xlsx")
    );
    expect(importRes.status).toBe(200);
    const afterImport = await importRes.json();

    // Verify match 99 preserved
    const reimportedMatch = afterImport.matches.find(
      (m: { label: string }) => m.label === "Trận RoundTrip 99"
    );
    expect(reimportedMatch).toBeDefined();
    expect(reimportedMatch.fee_per_player).toBe(120000);

    // Verify attendances preserved
    const p1New = afterImport.players.find(
      (p: { full_name: string }) => p.full_name === p1.full_name
    );
    const p2New = afterImport.players.find(
      (p: { full_name: string }) => p.full_name === p2.full_name
    );
    const p3New = afterImport.players.find(
      (p: { full_name: string }) => p.full_name === p3.full_name
    );

    const att1 = afterImport.attendances.find(
      (a: { match_id: number; player_id: number }) =>
        a.match_id === reimportedMatch.id && a.player_id === p1New.id
    );
    expect(att1).toMatchObject({ attended: 1, paid: 0, amount: 120000 });

    const att2 = afterImport.attendances.find(
      (a: { match_id: number; player_id: number }) =>
        a.match_id === reimportedMatch.id && a.player_id === p2New.id
    );
    expect(att2).toMatchObject({ attended: 0, paid: 1, amount: 120000 });

    const att3 = afterImport.attendances.find(
      (a: { match_id: number; player_id: number }) =>
        a.match_id === reimportedMatch.id && a.player_id === p3New.id
    );
    expect(att3).toMatchObject({ attended: 1, paid: 1, amount: 150000, walk_in: 1 });

    // Verify expense.match_id preserved and remapped to new match id
    const reimportedExp = afterImport.expenses.find(
      (e: { description: string }) => e.description === "Nước trận 99"
    );
    expect(reimportedExp).toBeDefined();
    expect(reimportedExp.match_id).toBe(reimportedMatch.id);

    // Verify other_income with fund_type = "Chuyển quỹ nội bộ" preserved
    const reimportedTransfer = afterImport.otherIncomes.find(
      (o: { note: string }) => o.note === "Điều chuyển nội bộ"
    );
    expect(reimportedTransfer).toBeDefined();
    expect(reimportedTransfer.fund_type).toBe("Chuyển quỹ nội bộ");
    expect(reimportedTransfer.amount).toBe(250000);

    // Verify financial summary matches before export
    expect(afterImport.summary.totalMatchIncome).toBe(
      beforeExport.summary.totalMatchIncome
    );
    expect(afterImport.summary.totalOtherIncome).toBe(
      beforeExport.summary.totalOtherIncome
    );
    expect(afterImport.summary.totalExpense).toBe(
      beforeExport.summary.totalExpense
    );
    expect(afterImport.summary.totalUnpaidAmount).toBe(
      beforeExport.summary.totalUnpaidAmount
    );
  });

  it("imports legacy 5-sheet workbook cleanly for backward compatibility", async () => {
    const db = getAsyncDb();
    const currentPlayers = await db.query<Player>("SELECT * FROM players ORDER BY id ASC");
    const currentManager = currentPlayers.find((p) => p.access_role === "manager");
    if (!currentManager) throw new Error("Expected manager in DB");
    const freshToken = createSessionToken(currentManager, 1);

    const legacyWb = buildValidLegacyWorkbook();
    const res = await importPost(
      buildImportRequest(legacyWb, freshToken, "legacy-5-sheets.xlsx")
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.players).toHaveLength(2);
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0].label).toBe("Trận 1 - 01/04");
    expect(data.otherIncomes).toHaveLength(1);
    expect(data.otherIncomes[0].fund_type).toBe("Quỹ sinh hoạt");
    expect(data.expenses).toHaveLength(1);
    expect(data.expenses[0].match_id).toBeNull();
  });
});
