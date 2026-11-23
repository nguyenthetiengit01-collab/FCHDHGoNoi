import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as postTeamRoute } from "@/app/api/team/route";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  hashPassword,
  validatePasswordStrength as authValidatePasswordStrength,
  verifyPassword,
} from "@/lib/auth";
import * as dbModule from "@/lib/db";
import { validatePasswordStrength } from "@/lib/passwordStrength";
import type { FullAppData, Player } from "@/types/app";

function createTestDb() {
  const raw = new DatabaseSync(":memory:");
  dbModule.initQaDatabaseSchema(raw);
  return { raw, db: new dbModule.LocalSqliteAdapter(raw) };
}

function spyFullAppData(raw: DatabaseSync) {
  const emptyData: FullAppData = {
    settings: {
      id: 1,
      team_name: "FC HĐH Gò Nổi",
      short_name: "FC HĐH GÒ NỔI",
      default_match_fee: 100000,
      bank_bin: "970422",
      bank_name: "MB Bank",
      bank_account_no: "",
      bank_account_name: "NGUYEN THE TIENG",
      tournament_fund_reserve: 0,
      tournament_fund_note: "",
      fanpage_url: "",
    },
    players: raw.prepare("SELECT * FROM players").all() as unknown as Player[],
    matches: [],
    attendances: [],
    otherIncomes: [],
    expenses: [],
    summary: {
      totalIncome: 0,
      totalMatchIncome: 0,
      totalOtherIncome: 0,
      totalExpense: 0,
      currentBalance: 0,
      totalMatchesCount: 0,
      totalPlayersCount: 0,
      totalUnpaidAmount: 0,
      categoryBreakdown: [],
    },
    posts: [],
    sponsors: [],
  };
  return vi.spyOn(dbModule, "getFullAppData").mockResolvedValue(emptyData);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Phase 7.1.3 P3-02 Reset PIN UI & P1-03B.1 Random Temporary PIN Enforcement", () => {
  it("removes hardcoded '1234' defaults and client-selected reset PIN inputs from PlayersTab.tsx, always using mode='random_temporary'", () => {
    const playersTabSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/PlayersTab.tsx"),
      "utf8"
    );
    const managerAppSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/TeamManagerApp.tsx"),
      "utf8"
    );

    expect(playersTabSrc).not.toContain('"1234"');
    expect(playersTabSrc).not.toContain("về 1234");
    expect(managerAppSrc).not.toContain("về mặc định (1234)");
    expect(playersTabSrc).toContain('mode: "random_temporary"');
    expect(playersTabSrc).toContain("issuedTempPin");
    expect(playersTabSrc).not.toContain('id="reset-new-pin"');
    expect(playersTabSrc).not.toContain('id="reset-confirm-pin"');
    expect(playersTabSrc).not.toContain("localStorage");
    expect(playersTabSrc).toContain('role="alert"');
    expect(playersTabSrc).toContain("if (result && !result.ok)");
    expect(playersTabSrc).toContain("setResetPinError(");
  });

  it("shares identical password strength rules between client helper and server auth module", () => {
    expect(validatePasswordStrength("1234", "player1").valid).toBe(false);
    expect(validatePasswordStrength("123456", "player1").valid).toBe(false);
    expect(validatePasswordStrength("player1", "player1").valid).toBe(false);
    expect(validatePasswordStrength("StrongPin@2026", "player1")).toEqual(
      authValidatePasswordStrength("StrongPin@2026", "player1")
    );
    expect(validatePasswordStrength("StrongPin@2026", "player1").valid).toBe(true);
  });

  it("rejects missing/invalid mode and any client-supplied new_pin on POST /api/team reset_player_password, and issues random temporaryPin once", async () => {
    const { raw, db } = createTestDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);
    spyFullAppData(raw);

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, access_role, username, pin_code, status)
         VALUES
           (1, 'Manager', 'Mgr', 'manager', 'mgr_ui', ?, 'Đang sinh hoạt'),
           (2, 'Target Player', 'Target', 'player', 'target_p', ?, 'Đang sinh hoạt')`
      ).run(hashPassword("MgrStrong@2026"), hashPassword("OldStrong@2026"));

      const mgr = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const mgrToken = createSessionToken(mgr, 24);

      const postReset = (extraPayload: Record<string, unknown>) =>
        postTeamRoute(
          new NextRequest("http://localhost:3000/api/team", {
            method: "POST",
            headers: {
              host: "localhost:3000",
              origin: "http://localhost:3000",
              cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
            },
            body: JSON.stringify({
              action: "reset_player_password",
              payload: { player_id: 2, ...extraPayload },
            }),
          })
        );

      expect((await postReset({})).status).toBe(400);
      expect((await postReset({ new_pin: "1234" })).status).toBe(400);
      expect((await postReset({ new_pin: "GoNoiNew@2026" })).status).toBe(400);
      expect((await postReset({ mode: "random_temporary", new_pin: "GoNoiNew@2026" })).status).toBe(400);

      const okRes = await postReset({ mode: "random_temporary" });
      expect(okRes.status).toBe(200);
      expect(okRes.headers.get("cache-control")).toContain("no-store");
      const okBody = (await okRes.json()) as { temporaryPin?: string };
      expect(typeof okBody.temporaryPin).toBe("string");
      expect((okBody.temporaryPin || "").length).toBeGreaterThanOrEqual(12);

      const updated = raw.prepare("SELECT pin_code, must_change_pin FROM players WHERE id = 2").get() as {
        pin_code: string;
        must_change_pin: number;
      };
      expect(updated.must_change_pin).toBe(1);
      expect(verifyPassword("OldStrong@2026", updated.pin_code)).toBe(false);
      expect(verifyPassword(okBody.temporaryPin || "", updated.pin_code)).toBe(true);
    } finally {
      raw.close();
    }
  });
});
