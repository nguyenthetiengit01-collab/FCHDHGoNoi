import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parseNonNegativeIntVnd } from "./financeValidation";
import { sanitizeExcelTextCell } from "./excelSanitize";

// Mock Upstash packages when not installed in local test node_modules
vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {},
}));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class MockRatelimit {
    static slidingWindow() {
      return {};
    }
    async limit() {
      return { success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 };
    }
  },
}));

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gonoi-p71-fin-excel-"));
process.env.USE_LOCAL_SQLITE = "true";
process.env.SQLITE_DB_PATH = path.join(tmpDir, "p71-test.sqlite");

describe("Phase 7.1 (P1-05): parseNonNegativeIntVnd & POST /api/team VND validation", () => {
  let managerCookie = "";
  let matchId = 0;
  let playerId = 0;

  async function callTeamPost(action: string, payload: Record<string, unknown>) {
    const { POST } = await import("../app/api/team/route");
    const req = new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
      method: "POST",
      headers: {
        host: "fchdhgonoi.vercel.app",
        origin: "https://fchdhgonoi.vercel.app",
        cookie: managerCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action, payload }),
    });
    return POST(req);
  }

  async function callTeamPostRaw(action: string, rawPayload: Record<string, unknown>) {
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
    req.json = async () => ({ action, payload: rawPayload });
    return POST(req);
  }

  beforeAll(async () => {
    const { getAsyncDb, getFullAppData } = await import("./db");
    const { createSessionToken, SESSION_COOKIE_NAME } = await import("./auth");

    const data = await getFullAppData();
    const db = getAsyncDb();
    const manager = await db.queryOne<import("@/types/app").Player>(
      "SELECT * FROM players WHERE access_role = 'manager' ORDER BY id ASC LIMIT 1"
    );
    const player = await db.queryOne<import("@/types/app").Player>(
      "SELECT * FROM players WHERE access_role = 'player' ORDER BY id ASC LIMIT 1"
    );
    expect(manager).toBeTruthy();
    expect(player).toBeTruthy();
    expect(data.matches.length).toBeGreaterThanOrEqual(1);

    managerCookie = `${SESSION_COOKIE_NAME}=${createSessionToken(manager!)}`;
    matchId = data.matches[0].id;
    playerId = player!.id;
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

  it("parseNonNegativeIntVnd accepts positive integers and explicit 0, rejects invalid inputs", () => {
    expect(parseNonNegativeIntVnd(100000)).toEqual({ ok: true, value: 100000 });
    expect(parseNonNegativeIntVnd("150000")).toEqual({ ok: true, value: 150000 });
    expect(parseNonNegativeIntVnd(0)).toEqual({ ok: true, value: 0 });
    expect(parseNonNegativeIntVnd("0")).toEqual({ ok: true, value: 0 });

    expect(parseNonNegativeIntVnd(-1).ok).toBe(false);
    expect(parseNonNegativeIntVnd("-50000").ok).toBe(false);
    expect(parseNonNegativeIntVnd("-0").ok).toBe(false);
    expect(parseNonNegativeIntVnd(100.5).ok).toBe(false);
    expect(parseNonNegativeIntVnd("100.5").ok).toBe(false);
    expect(parseNonNegativeIntVnd(Number.NaN).ok).toBe(false);
    expect(parseNonNegativeIntVnd(Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(parseNonNegativeIntVnd(Number.NEGATIVE_INFINITY).ok).toBe(false);
    expect(parseNonNegativeIntVnd(Number.MAX_SAFE_INTEGER + 1).ok).toBe(false);
    expect(parseNonNegativeIntVnd("abc").ok).toBe(false);
    expect(parseNonNegativeIntVnd("").ok).toBe(false);
    expect(parseNonNegativeIntVnd(null).ok).toBe(false);
    expect(parseNonNegativeIntVnd(undefined).ok).toBe(false);
  });

  it("upsert_match preserves explicit 0 for fee_per_player and pitch_cost, and rejects invalid VND with 400", async () => {
    const zeroRes = await callTeamPost("upsert_match", {
      match_number: 99,
      label: "Trận Miễn Phí",
      match_date: "2026-11-20",
      fee_per_player: 0,
      pitch_cost: 0,
    });
    expect(zeroRes.status).toBe(200);

    const { getAsyncDb } = await import("./db");
    const db = getAsyncDb();
    const created = await db.queryOne<{
      id: number;
      fee_per_player: number;
      pitch_cost: number;
    }>("SELECT id, fee_per_player, pitch_cost FROM matches WHERE label = ?", [
      "Trận Miễn Phí",
    ]);
    expect(created).toBeTruthy();
    expect(created!.fee_per_player).toBe(0);
    expect(created!.pitch_cost).toBe(0);

    // Missing fee_per_player defaults to 100000, missing pitch_cost defaults to 0
    const defaultRes = await callTeamPost("upsert_match", {
      match_number: 100,
      label: "Trận Mặc Định",
      match_date: "2026-11-21",
    });
    expect(defaultRes.status).toBe(200);
    const defaulted = await db.queryOne<{
      fee_per_player: number;
      pitch_cost: number;
    }>("SELECT fee_per_player, pitch_cost FROM matches WHERE label = ?", [
      "Trận Mặc Định",
    ]);
    expect(defaulted!.fee_per_player).toBe(100000);
    expect(defaulted!.pitch_cost).toBe(0);

    // Invalid inputs return 400
    for (const badVal of [-100, 50.5, "abc"]) {
      const badFee = await callTeamPost("upsert_match", {
        label: "Bad Fee",
        fee_per_player: badVal,
      });
      expect(badFee.status).toBe(400);

      const badPitch = await callTeamPost("upsert_match", {
        label: "Bad Pitch",
        pitch_cost: badVal,
      });
      expect(badPitch.status).toBe(400);
    }

    const nanRes = await callTeamPostRaw("upsert_match", {
      label: "NaN Fee",
      fee_per_player: Number.NaN,
    });
    expect(nanRes.status).toBe(400);

    const infRes = await callTeamPostRaw("upsert_match", {
      label: "Inf Pitch",
      pitch_cost: Number.POSITIVE_INFINITY,
    });
    expect(infRes.status).toBe(400);
  });

  it("add_walkin_player validates match_id, paid, and amount while preserving explicit 0", async () => {
    const zeroAmountRes = await callTeamPost("add_walkin_player", {
      match_id: matchId,
      player_id: playerId,
      amount: 0,
      paid: 1,
    });
    expect(zeroAmountRes.status).toBe(200);

    const { getAsyncDb } = await import("./db");
    const db = getAsyncDb();
    const att = await db.queryOne<{ amount: number; paid: number }>(
      "SELECT amount, paid FROM match_attendances WHERE match_id = ? AND player_id = ?",
      [matchId, playerId]
    );
    expect(att).toEqual({ amount: 0, paid: 1 });

    // Invalid match_id -> 400; non-existent match_id -> 404
    expect(
      (
        await callTeamPost("add_walkin_player", {
          match_id: "abc",
          player_id: playerId,
        })
      ).status
    ).toBe(400);

    expect(
      (
        await callTeamPost("add_walkin_player", {
          match_id: 999999,
          player_id: playerId,
        })
      ).status
    ).toBe(404);

    // Invalid paid flag -> 400
    expect(
      (
        await callTeamPost("add_walkin_player", {
          match_id: matchId,
          player_id: playerId,
          paid: 2,
        })
      ).status
    ).toBe(400);

    // Invalid amount -> 400
    expect(
      (
        await callTeamPost("add_walkin_player", {
          match_id: matchId,
          player_id: playerId,
          amount: -5000,
        })
      ).status
    ).toBe(400);

    expect(
      (
        await callTeamPost("add_walkin_player", {
          match_id: matchId,
          player_id: playerId,
          amount: 12.34,
        })
      ).status
    ).toBe(400);
  });

  it("update_settings preserves explicit 0 for default_match_fee and tournament_fund_reserve, and rejects invalid VND with 400", async () => {
    const zeroSettingsRes = await callTeamPost("update_settings", {
      default_match_fee: 0,
      tournament_fund_reserve: 0,
    });
    expect(zeroSettingsRes.status).toBe(200);

    const { getAsyncDb } = await import("./db");
    const db = getAsyncDb();
    const settings = await db.queryOne<{
      default_match_fee: number;
      tournament_fund_reserve: number;
    }>("SELECT default_match_fee, tournament_fund_reserve FROM team_settings WHERE id = 1");
    expect(settings).toEqual({
      default_match_fee: 0,
      tournament_fund_reserve: 0,
    });

    expect(
      (
        await callTeamPost("update_settings", {
          default_match_fee: -100,
        })
      ).status
    ).toBe(400);

    expect(
      (
        await callTeamPost("update_settings", {
          tournament_fund_reserve: 100.5,
        })
      ).status
    ).toBe(400);

    expect(
      (
        await callTeamPostRaw("update_settings", {
          default_match_fee: Number.NaN,
        })
      ).status
    ).toBe(400);
  });
});

describe("Phase 7.1 (P1-06): Excel Formula Injection Protection", () => {
  it("sanitizeExcelTextCell neutralizes formula triggers while preserving Vietnamese text and dates", () => {
    expect(sanitizeExcelTextCell("=CMD()")).toBe("'=CMD()");
    expect(sanitizeExcelTextCell("+1+1")).toBe("'+1+1");
    expect(sanitizeExcelTextCell("-1+1")).toBe("'-1+1");
    expect(sanitizeExcelTextCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(sanitizeExcelTextCell("\t=1")).toBe("'\t=1");
    expect(sanitizeExcelTextCell("\r=1")).toBe("'\r=1");

    expect(sanitizeExcelTextCell("Nguyễn Thế Tiếng")).toBe("Nguyễn Thế Tiếng");
    expect(sanitizeExcelTextCell("Xã Gò Nổi • TP. Đà Nẵng")).toBe(
      "Xã Gò Nổi • TP. Đà Nẵng"
    );
    expect(sanitizeExcelTextCell("2026-11-20")).toBe("2026-11-20");
    expect(sanitizeExcelTextCell("0901234567")).toBe("0901234567");
    expect(sanitizeExcelTextCell(null)).toBe("");
    expect(sanitizeExcelTextCell(undefined)).toBe("");
  });

  it("GET /api/export neutralizes formula payloads in text columns while keeping numeric cells and formulas intact", async () => {
    const { getAsyncDb, getFullAppData } = await import("./db");
    const { createSessionToken, SESSION_COOKIE_NAME } = await import("./auth");
    const { GET: exportGet } = await import("../app/api/export/route");

    await getFullAppData();
    const db = getAsyncDb();
    const manager = (await db.queryOne<import("@/types/app").Player>(
      "SELECT * FROM players WHERE access_role = 'manager' ORDER BY id ASC LIMIT 1"
    ))!;

    // Insert synthetic player, other income, and expense with formula payloads
    const playerRes = await db.run(
      `INSERT INTO players (code_order, full_name, short_name, position, phone, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [999, "=CMD()", "@SUM(A1)", "MF", "+1+1", "-1+1"]
    );
    const synPlayerId = Number(playerRes.lastInsertRowid);

    await db.run(
      `INSERT INTO other_incomes (income_date, contributor, amount, fund_type, note)
       VALUES (?, ?, ?, ?, ?)`,
      ["2026-11-20", "\t=1", 250000, "Ủng hộ", "\r=1"]
    );

    await db.run(
      `INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      ["2026-11-20", "Khác", "=HYPERLINK(\"http://evil\")", 120000, "@Payer"]
    );

    const token = createSessionToken(manager);
    const req = new NextRequest("http://localhost:3000/api/export", {
      method: "GET",
      headers: {
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await exportGet(req);
    expect(res.status).toBe(200);

    const bytes = new Uint8Array(await res.arrayBuffer());
    const wb = XLSX.read(bytes, { type: "array" });

    // Check 2. Danh sách
    const wsPlayers = wb.Sheets["2. Danh sách"];
    const playerRows = XLSX.utils.sheet_to_json<unknown[]>(wsPlayers, {
      header: 1,
      defval: "",
    });
    const synRow = playerRows.find((r) => r[2] === "'=CMD()");
    expect(synRow).toBeTruthy();
    expect(synRow![5]).toBe("'+1+1");
    expect(synRow![6]).toBe("'-1+1");

    // Check 3. Thu Trận preserves intentional formula cells
    const wsThuTran = wb.Sheets["3. Thu Trận (Tích chọn)"];
    expect(wsThuTran["E8"]?.f).toContain("SUM(E9:");
    expect(wsThuTran["E8"]?.t).toBe("n");

    // Check 4. Thu Khác
    const wsThuKhac = wb.Sheets["4. Thu Khác"];
    const thuKhacRows = XLSX.utils.sheet_to_json<unknown[]>(wsThuKhac, {
      header: 1,
      defval: "",
    });
    const synIncomeRow = thuKhacRows.find((r) => r[3] === "'\t=1");
    expect(synIncomeRow).toBeTruthy();
    expect(synIncomeRow![4]).toBe(250000);
    expect(synIncomeRow![5]).toBe("'\r=1");

    // Check 5. Chi
    const wsChi = wb.Sheets["5. Chi"];
    const chiRows = XLSX.utils.sheet_to_json<unknown[]>(wsChi, {
      header: 1,
      defval: "",
    });
    const synExpRow = chiRows.find((r) => r[4] === "'=HYPERLINK(\"http://evil\")");
    expect(synExpRow).toBeTruthy();
    expect(synExpRow![5]).toBe(120000);
    expect(synExpRow![6]).toBe("'@Payer");

    // Cleanup synthetic rows
    await db.run("DELETE FROM players WHERE id = ?", [synPlayerId]);
  });
});
