import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gonoi-fin-p1-test-"));
process.env.USE_LOCAL_SQLITE = "true";
process.env.SQLITE_DB_PATH = path.join(tmpDir, "fin-p1-test.sqlite");

describe("Phase 5.2 (P1): Financial API Validation & Transaction Atomicity", () => {
  let managerCookie = "";
  let matchId = 0;
  let otherMatchId = 0;
  let playerId = 0;

  async function callTeamPost(body: unknown) {
    const { POST } = await import("../app/api/team/route");
    const req = new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
      method: "POST",
      headers: {
        host: "fchdhgonoi.vercel.app",
        origin: "https://fchdhgonoi.vercel.app",
        cookie: managerCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return POST(req);
  }

  async function callTeamPostRawJson(rawBody: Record<string, unknown>) {
    const { POST } = await import("../app/api/team/route");
    const req = new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
      method: "POST",
      headers: {
        host: "fchdhgonoi.vercel.app",
        origin: "https://fchdhgonoi.vercel.app",
        cookie: managerCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "placeholder" }),
    });
    req.json = async () => rawBody;
    return POST(req);
  }

  beforeAll(async () => {
    const { getAsyncDb, getFullAppData } = await import("./db");
    const { createSessionToken, SESSION_COOKIE_NAME } = await import("./auth");

    const data = await getFullAppData();
    const manager = data.players.find((p) => p.access_role === "manager");
    const player = data.players.find((p) => p.access_role === "player");
    expect(manager).toBeTruthy();
    expect(player).toBeTruthy();
    expect(data.matches.length).toBeGreaterThanOrEqual(2);

    const pinRow = await getAsyncDb().queryOne<{ pin_code: string }>(
      "SELECT pin_code FROM players WHERE id = ?",
      [manager!.id]
    );
    managerCookie = `${SESSION_COOKIE_NAME}=${createSessionToken({
      ...manager!,
      pin_code: pinRow?.pin_code || "",
    })}`;
    matchId = data.matches[0].id;
    otherMatchId = data.matches[1].id;
    playerId = player!.id;
  });

  beforeEach(async () => {
    const { getAsyncDb } = await import("./db");
    const db = getAsyncDb();
    await db.exec("DROP TRIGGER IF EXISTS test_fail_expenses_insert;");
    await db.exec("DROP TRIGGER IF EXISTS test_fail_expenses_update;");
  });

  afterAll(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore Windows SQLite file lock cleanup warnings
      }
    }
  });

  const invalidAmounts: Array<{ label: string; value: unknown; raw?: boolean }> = [
    { label: "negative number", value: -100 },
    { label: "negative string", value: "-50000" },
    { label: "decimal VND number", value: 100.5 },
    { label: "decimal VND string", value: "100000.25" },
    { label: "non-numeric string", value: "abc" },
    { label: "NaN", value: Number.NaN, raw: true },
    { label: "Infinity", value: Number.POSITIVE_INFINITY, raw: true },
    { label: "string Infinity", value: "Infinity" },
  ];

  it.each(invalidAmounts)(
    "rejects invalid amount ($label) with 400 across all 5 financial actions",
    async ({ value, raw }) => {
      const send = (action: string, payload: Record<string, unknown>) =>
        raw
          ? callTeamPostRawJson({ action, payload })
          : callTeamPost({ action, payload });

      const r1 = await send("quick_pitch_expense", {
        match_id: matchId,
        venue: "Sân Vĩnh Lộc",
        pitch_cost: value,
        payer_name: "Tiếng",
      });
      expect(r1.status).toBe(400);

      const r2 = await send("collect_match_fee", {
        match_id: matchId,
        player_id: playerId,
        attended: 1,
        paid: 1,
        amount: value,
      });
      expect(r2.status).toBe(400);

      const r3 = await send("collect_match_fees_batch", {
        match_id: matchId,
        collected_by: "Tiếng",
        items: [{ player_id: playerId, attended: 1, paid: 1, amount: value }],
      });
      expect(r3.status).toBe(400);

      const r4 = await send("upsert_expense", {
        expense_date: "2026-04-01",
        category: "Nước uống",
        description: "Nước suối",
        amount: value,
        payer: "Tiếng",
      });
      expect(r4.status).toBe(400);

      const r5 = await send("upsert_other_income", {
        income_date: "2026-04-01",
        contributor: "Anh Ba",
        amount: value,
        fund_type: "Ủng hộ",
      });
      expect(r5.status).toBe(400);
    }
  );

  it("rejects empty/null/boolean amounts for quick_pitch_expense, upsert_expense, and upsert_other_income", async () => {
    for (const bad of ["", "   ", null, false, true]) {
      const r1 = await callTeamPost({
        action: "quick_pitch_expense",
        payload: { match_id: matchId, pitch_cost: bad },
      });
      expect(r1.status).toBe(400);

      const r2 = await callTeamPost({
        action: "upsert_expense",
        payload: { category: "Nước uống", amount: bad },
      });
      expect(r2.status).toBe(400);

      const r3 = await callTeamPost({
        action: "upsert_other_income",
        payload: { contributor: "Mạnh thường quân", amount: bad },
      });
      expect(r3.status).toBe(400);
    }
  });

  it("rejects contradictory attended=0 & paid=0 & amount > 0 with 400, while allowing attended=1 & paid=0 & amount=defaultFee (debt)", async () => {
    const badSingle = await callTeamPost({
      action: "collect_match_fee",
      payload: {
        match_id: matchId,
        player_id: playerId,
        attended: 0,
        paid: 0,
        amount: 100000,
      },
    });
    expect(badSingle.status).toBe(400);

    const badBatch = await callTeamPost({
      action: "collect_match_fees_batch",
      payload: {
        match_id: matchId,
        items: [
          {
            player_id: playerId,
            attended: 0,
            paid: 0,
            amount: 50000,
          },
        ],
      },
    });
    expect(badBatch.status).toBe(400);

    // Valid debt: attended=1, paid=0, amount=100000
    const validDebt = await callTeamPost({
      action: "collect_match_fee",
      payload: {
        match_id: matchId,
        player_id: playerId,
        attended: 1,
        paid: 0,
        amount: 100000,
      },
    });
    expect(validDebt.status).toBe(200);
    const debtBody = await validDebt.json();
    const record = debtBody.attendances.find(
      (a: { match_id: number; player_id: number }) =>
        a.match_id === matchId && a.player_id === playerId
    );
    expect(record).toMatchObject({ attended: 1, paid: 0, amount: 100000 });

    // Valid exempt/free: attended=1, paid=1, amount=0
    const validFreeBatch = await callTeamPost({
      action: "collect_match_fees_batch",
      payload: {
        match_id: matchId,
        items: [
          {
            player_id: playerId,
            attended: 1,
            paid: 1,
            amount: 0,
          },
        ],
      },
    });
    expect(validFreeBatch.status).toBe(200);
  });

  it("returns 404 for non-existent match_id or player_id and 400 for malformed IDs", async () => {
    const nonExistentMatch = 999999;
    const nonExistentPlayer = 999999;

    const r1 = await callTeamPost({
      action: "collect_match_fee",
      payload: {
        match_id: nonExistentMatch,
        player_id: playerId,
        attended: 1,
        paid: 1,
        amount: 100000,
      },
    });
    expect(r1.status).toBe(404);

    const r2 = await callTeamPost({
      action: "collect_match_fee",
      payload: {
        match_id: matchId,
        player_id: nonExistentPlayer,
        attended: 1,
        paid: 1,
        amount: 100000,
      },
    });
    expect(r2.status).toBe(404);

    const r3 = await callTeamPost({
      action: "collect_match_fees_batch",
      payload: {
        match_id: nonExistentMatch,
        items: [{ player_id: playerId, attended: 1, paid: 1, amount: 100000 }],
      },
    });
    expect(r3.status).toBe(404);

    const r4 = await callTeamPost({
      action: "collect_match_fees_batch",
      payload: {
        match_id: matchId,
        items: [{ player_id: nonExistentPlayer, attended: 1, paid: 1, amount: 100000 }],
      },
    });
    expect(r4.status).toBe(404);

    const r5 = await callTeamPost({
      action: "quick_pitch_expense",
      payload: {
        match_id: nonExistentMatch,
        venue: "Sân Test",
        pitch_cost: 900000,
      },
    });
    expect(r5.status).toBe(404);

    const badId = await callTeamPost({
      action: "collect_match_fee",
      payload: {
        match_id: "abc",
        player_id: playerId,
        attended: 1,
        paid: 1,
        amount: 100000,
      },
    });
    expect(badId.status).toBe(400);
  });

  it("validates and persists valid upsert_expense and upsert_other_income", async () => {
    const expRes = await callTeamPost({
      action: "upsert_expense",
      payload: {
        expense_date: "2026-04-05",
        category: "Nước uống",
        description: "Nước khoáng trận test",
        amount: 120000,
        payer: "Tiếng",
      },
    });
    expect(expRes.status).toBe(200);
    const expJson = await expRes.json();
    expect(
      expJson.expenses.some(
        (e: { description: string; amount: number }) =>
          e.description === "Nước khoáng trận test" && e.amount === 120000
      )
    ).toBe(true);

    const incRes = await callTeamPost({
      action: "upsert_other_income",
      payload: {
        income_date: "2026-04-05",
        contributor: "Anh Tư Gò Nổi",
        amount: 500000,
        fund_type: "Ủng hộ",
        note: "Tài trợ nước",
      },
    });
    expect(incRes.status).toBe(200);
    const incJson = await incRes.json();
    expect(
      incJson.otherIncomes.some(
        (o: { contributor: string; amount: number }) =>
          o.contributor === "Anh Tư Gò Nổi" && o.amount === 500000
      )
    ).toBe(true);
  });

  it("rolls back matches.pitch_cost when expenses write fails inside quick_pitch_expense transaction", async () => {
    const { getAsyncDb } = await import("./db");
    const db = getAsyncDb();

    const beforeMatch = await db.queryOne<{
      venue: string;
      pitch_cost: number;
      payer_name: string;
    }>("SELECT venue, pitch_cost, payer_name FROM matches WHERE id = ?", [
      otherMatchId,
    ]);
    expect(beforeMatch).toBeTruthy();

    await db.exec("DELETE FROM expenses WHERE match_id = " + Number(otherMatchId));
    await db.exec(`
      CREATE TRIGGER test_fail_expenses_insert
      BEFORE INSERT ON expenses
      BEGIN
        SELECT RAISE(ABORT, 'simulated expense insert failure');
      END;
    `);

    const res = await callTeamPost({
      action: "quick_pitch_expense",
      payload: {
        match_id: otherMatchId,
        venue: "Sân Rollback Test",
        pitch_cost: 1234567,
        payer_name: "RollbackPayer",
      },
    });
    expect(res.status).toBe(500);

    const afterMatch = await db.queryOne<{
      venue: string;
      pitch_cost: number;
      payer_name: string;
    }>("SELECT venue, pitch_cost, payer_name FROM matches WHERE id = ?", [
      otherMatchId,
    ]);
    expect(afterMatch).toEqual(beforeMatch);
  });

  it("updates exact match_id pitch expense on retry without duplicates or fuzzy LIKE cross-match", async () => {
    const { getAsyncDb } = await import("./db");
    const db = getAsyncDb();

    const mRow = await db.queryOne<{ id: number; match_number: number }>(
      "SELECT id, match_number FROM matches WHERE id = ?",
      [otherMatchId]
    );
    expect(mRow).toBeTruthy();

    await db.run("DELETE FROM expenses WHERE match_id = ?", [otherMatchId]);

    // Insert an unrelated Tiền sân row (match_id = NULL) whose description matches the old fuzzy LIKE pattern
    await db.run(
      `INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
       VALUES ('2026-01-01', 'Tiền sân', ?, 777000, 'OldPayer', NULL)`,
      [`Chi tiền sân tuần ${mRow!.match_number} cũ không liên kết`]
    );

    // First quick_pitch_expense call for otherMatchId -> creates exact match_id row
    const firstRes = await callTeamPost({
      action: "quick_pitch_expense",
      payload: {
        match_id: otherMatchId,
        venue: "Sân Mới A",
        pitch_cost: 950000,
        payer_name: "Tiếng",
      },
    });
    expect(firstRes.status).toBe(200);

    // Retry quick_pitch_expense for otherMatchId with updated cost -> updates same row, no duplicate
    const retryRes = await callTeamPost({
      action: "quick_pitch_expense",
      payload: {
        match_id: otherMatchId,
        venue: "Sân Mới A",
        pitch_cost: 1050000,
        payer_name: "Tiếng",
      },
    });
    expect(retryRes.status).toBe(200);

    const linkedRows = await db.query<{ id: number; amount: number }>(
      "SELECT id, amount FROM expenses WHERE match_id = ? AND category = 'Tiền sân'",
      [otherMatchId]
    );
    expect(linkedRows).toHaveLength(1);
    expect(linkedRows[0].amount).toBe(1050000);

    // Ensure the unrelated row with fuzzy description was NOT overwritten
    const unrelatedRow = await db.queryOne<{ amount: number; match_id: number | null }>(
      "SELECT amount, match_id FROM expenses WHERE payer = 'OldPayer'"
    );
    expect(unrelatedRow).toEqual({ amount: 777000, match_id: null });
  });

  it("rejects invalid attended, paid, and walk_in values with 400 instead of coercing to 0", async () => {
    const invalidFlags: unknown[] = [2, -1, 1.5, "abc", "yes", {}, []];

    for (const bad of invalidFlags) {
      const r1 = await callTeamPost({
        action: "collect_match_fee",
        payload: {
          match_id: matchId,
          player_id: playerId,
          attended: bad,
          paid: 1,
          amount: 100000,
        },
      });
      expect(r1.status).toBe(400);

      const r2 = await callTeamPost({
        action: "collect_match_fee",
        payload: {
          match_id: matchId,
          player_id: playerId,
          attended: 1,
          paid: bad,
          amount: 100000,
        },
      });
      expect(r2.status).toBe(400);

      const r3 = await callTeamPost({
        action: "collect_match_fee",
        payload: {
          match_id: matchId,
          player_id: playerId,
          attended: 1,
          paid: 1,
          walk_in: bad,
          amount: 100000,
        },
      });
      expect(r3.status).toBe(400);

      const r4 = await callTeamPost({
        action: "collect_match_fees_batch",
        payload: {
          match_id: matchId,
          items: [
            { player_id: playerId, attended: bad, paid: 1, amount: 100000 },
          ],
        },
      });
      expect(r4.status).toBe(400);

      const r5 = await callTeamPost({
        action: "collect_match_fees_batch",
        payload: {
          match_id: matchId,
          items: [
            { player_id: playerId, attended: 1, paid: bad, amount: 100000 },
          ],
        },
      });
      expect(r5.status).toBe(400);

      const r6 = await callTeamPost({
        action: "collect_match_fees_batch",
        payload: {
          match_id: matchId,
          items: [
            {
              player_id: playerId,
              attended: 1,
              paid: 1,
              walk_in: bad,
              amount: 100000,
            },
          ],
        },
      });
      expect(r6.status).toBe(400);
    }

    // Missing attended or paid (undefined/null) must also be rejected with 400
    for (const missing of [undefined, null]) {
      const m1 = await callTeamPost({
        action: "collect_match_fee",
        payload: {
          match_id: matchId,
          player_id: playerId,
          attended: missing,
          paid: 1,
          amount: 100000,
        },
      });
      expect(m1.status).toBe(400);

      const m2 = await callTeamPost({
        action: "collect_match_fees_batch",
        payload: {
          match_id: matchId,
          items: [
            { player_id: playerId, attended: 1, paid: missing, amount: 100000 },
          ],
        },
      });
      expect(m2.status).toBe(400);
    }
  });

  it("accepts boolean true/false and 0/1 for attended and paid while keeping them independent", async () => {
    // paid=true, attended=false -> paid=1, attended=0 (e.g. paid in advance, absent)
    const singleRes = await callTeamPost({
      action: "collect_match_fee",
      payload: {
        match_id: matchId,
        player_id: playerId,
        attended: false,
        paid: true,
        amount: 100000,
      },
    });
    expect(singleRes.status).toBe(200);
    const singleBody = await singleRes.json();
    const singleRec = singleBody.attendances.find(
      (a: { match_id: number; player_id: number }) =>
        a.match_id === matchId && a.player_id === playerId
    );
    expect(singleRec).toMatchObject({ attended: 0, paid: 1, amount: 100000 });

    // Batch: attended=true, paid=false -> attended=1, paid=0 (debt)
    const batchRes = await callTeamPost({
      action: "collect_match_fees_batch",
      payload: {
        match_id: matchId,
        items: [
          {
            player_id: playerId,
            attended: true,
            paid: false,
            amount: 100000,
          },
        ],
      },
    });
    expect(batchRes.status).toBe(200);
    const batchBody = await batchRes.json();
    const batchRec = batchBody.attendances.find(
      (a: { match_id: number; player_id: number }) =>
        a.match_id === matchId && a.player_id === playerId
    );
    expect(batchRec).toMatchObject({ attended: 1, paid: 0, amount: 100000 });
  });
});
