import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as postTeamRoute } from "@/app/api/team/route";
import { SESSION_COOKIE_NAME, createSessionToken, hashPassword } from "@/lib/auth";
import {
  clearPendingBatchSubmission,
  computeBatchPayloadFingerprint,
  deriveCollectionFooterViewState,
  getPendingBatchStorageKey,
  loadPendingBatchSubmissionState,
  runBatchOperationAttempt,
  savePendingBatchSubmission,
} from "@/lib/collectionDraft";
import * as dbModule from "@/lib/db";
import { TursoDbAdapter } from "@/lib/db";
import type { FullAppData, Player } from "@/types/app";

function createTestDb() {
  const raw = new DatabaseSync(":memory:");
  dbModule.initQaDatabaseSchema(raw);
  return { raw, db: new dbModule.LocalSqliteAdapter(raw) };
}

function buildFullDataFromRaw(raw: DatabaseSync): FullAppData {
  const players = raw.prepare("SELECT * FROM players").all() as unknown as Player[];
  const matches = raw.prepare("SELECT * FROM matches").all() as never[];
  const attendances = raw.prepare("SELECT * FROM match_attendances").all() as never[];
  return {
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
    players: players.map((p) => ({ ...p, pin_code: "" })),
    matches,
    attendances,
    otherIncomes: [],
    expenses: [],
    summary: {
      totalIncome: 0,
      totalMatchIncome: 0,
      totalOtherIncome: 0,
      totalExpense: 0,
      currentBalance: 0,
      totalMatchesCount: matches.length,
      totalPlayersCount: players.length,
      totalUnpaidAmount: 0,
      categoryBreakdown: [],
    },
    posts: [],
    sponsors: [],
  };
}

function createMemoryStorage(opts?: {
  quotaError?: boolean;
  readBackMismatch?: boolean;
  unavailable?: boolean;
}) {
  const map = new Map<string, string>();
  if (opts?.unavailable) {
    return {
      map,
      windowObj: {
        get localStorage() {
          throw new Error("SecurityError: localStorage unavailable");
        },
      },
    };
  }
  return {
    map,
    windowObj: {
      localStorage: {
        getItem: (k: string) => {
          const val = map.get(k) ?? null;
          if (opts?.readBackMismatch && val !== null && k.startsWith("gonoi_fee_pending_batch_")) {
            return `${val} `;
          }
          return val;
        },
        setItem: (k: string, v: string) => {
          if (opts?.quotaError) {
            const err = new Error("QuotaExceededError");
            err.name = "QuotaExceededError";
            throw err;
          }
          map.set(k, v);
        },
        removeItem: (k: string) => {
          map.delete(k);
        },
      },
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Phase 7.1.6 – Consolidated End-to-End Batch Recovery & Storage Failure Tests", () => {
  it("persists complete 7-field operation record before network call and blocks send on storage failure, read-back mismatch, corrupted JSON, or missing items", async () => {
    const items = [
      { player_id: 2, attended: 1, paid: 1, amount: 100000, walk_in: 0, remove: false },
    ];

    // 1. QuotaExceededError -> request never sent
    const quota = createMemoryStorage({ quotaError: true });
    vi.stubGlobal("window", quota.windowObj);
    const sendSpyQuota = vi.fn();
    const quotaOutcome = await runBatchOperationAttempt({
      mode: "save",
      matchId: 5,
      collectedBy: "Tiếng",
      items,
      sendMutate: sendSpyQuota,
    });
    expect(quotaOutcome.ok).toBe(false);
    expect(sendSpyQuota).not.toHaveBeenCalled();

    // 2. localStorage unavailable -> request never sent
    const unavail = createMemoryStorage({ unavailable: true });
    vi.stubGlobal("window", unavail.windowObj);
    const sendSpyUnavail = vi.fn();
    const unavailOutcome = await runBatchOperationAttempt({
      mode: "save",
      matchId: 5,
      collectedBy: "Tiếng",
      items,
      sendMutate: sendSpyUnavail,
    });
    expect(unavailOutcome.ok).toBe(false);
    expect(sendSpyUnavail).not.toHaveBeenCalled();

    // 3. Read-back mismatch -> request never sent
    const mismatch = createMemoryStorage({ readBackMismatch: true });
    vi.stubGlobal("window", mismatch.windowObj);
    const sendSpyMismatch = vi.fn();
    const mismatchOutcome = await runBatchOperationAttempt({
      mode: "save",
      matchId: 5,
      collectedBy: "Tiếng",
      items,
      sendMutate: sendSpyMismatch,
    });
    expect(mismatchOutcome.ok).toBe(false);
    expect(sendSpyMismatch).not.toHaveBeenCalled();

    // 4. Corrupted JSON & payload missing while key exists -> explicit corrupted state, request never sent
    const normal = createMemoryStorage();
    vi.stubGlobal("window", normal.windowObj);
    normal.map.set(getPendingBatchStorageKey(5), "{bad-json");
    expect(loadPendingBatchSubmissionState(5).status).toBe("corrupted");
    const sendSpyCorrupt = vi.fn();
    expect(
      (
        await runBatchOperationAttempt({
          mode: "save",
          matchId: 5,
          collectedBy: "Tiếng",
          items,
          sendMutate: sendSpyCorrupt,
        })
      ).ok
    ).toBe(false);
    expect(sendSpyCorrupt).not.toHaveBeenCalled();

    // Payload missing (empty items or omitted) while key exists
    normal.map.set(
      getPendingBatchStorageKey(5),
      JSON.stringify({
        match_id: 5,
        idempotency_key: "key-only-5",
        payload_fingerprint: "fp-5",
        collected_by: "Tiếng",
        state: "unknown_outcome",
        created_at: new Date().toISOString(),
      })
    );
    expect(loadPendingBatchSubmissionState(5).status).toBe("corrupted");
    expect(sendSpyCorrupt).not.toHaveBeenCalled();

    // 5. Complete operation persisted BEFORE network call, never containing secrets/PINs, cannot be overwritten by new op
    normal.map.clear();
    let seenPersistedDuringSend = false;
    const networkFailOutcome = await runBatchOperationAttempt({
      mode: "save",
      matchId: 5,
      collectedBy: "Tiếng",
      items,
      sendMutate: async (payload) => {
        const stored = loadPendingBatchSubmissionState(5);
        expect(stored.status).toBe("ok");
        if (stored.status === "ok") {
          seenPersistedDuringSend = true;
          expect(stored.submission.idempotency_key).toBe(payload.idempotency_key);
          expect(stored.submission.collected_by).toBe("Tiếng");
          expect(stored.submission.items).toEqual(items);
          expect(JSON.stringify(stored.submission)).not.toContain("pin");
        }
        return { ok: false, status: 0, retryable: true, error: "Network lost" };
      },
    });
    expect(seenPersistedDuringSend).toBe(true);
    expect(networkFailOutcome.ok).toBe(false);
    expect(networkFailOutcome.pendingState.status).toBe("ok");
    if (networkFailOutcome.pendingState.status === "ok") {
      expect(networkFailOutcome.pendingState.submission.state).toBe("unknown_outcome");
    }

    // Attempt to overwrite unresolved operation with a different key is rejected
    expect(
      savePendingBatchSubmission(5, {
        match_id: 5,
        idempotency_key: "different-new-key",
        payload_fingerprint: computeBatchPayloadFingerprint(5, "Tiếng", items),
        collected_by: "Tiếng",
        items,
        state: "pending",
        created_at: new Date().toISOString(),
      })
    ).toBe(false);
  });

  it("recovers and replays via POST /api/team when server already committed (response lost) and dirtyCount === 0 after reload, and renders CollectionTab recovery UI", async () => {
    const { raw, db } = createTestDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);
    vi.spyOn(dbModule, "getFullAppData").mockImplementation(async () =>
      buildFullDataFromRaw(raw)
    );

    const storage = createMemoryStorage();
    vi.stubGlobal("window", storage.windowObj);

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, access_role, username, pin_code, status)
         VALUES
           (1, 'Manager', 'Mgr', 'manager', 'mgr_rec', ?, 'Đang sinh hoạt'),
           (2, 'Player Two', 'P2', 'player', 'p2_rec', ?, 'Đang sinh hoạt')`
      ).run(hashPassword("MgrRecStrong@2026"), hashPassword("Player2@2026"));
      raw.prepare(
        `INSERT INTO matches (id, match_number, label, match_date, fee_per_player, pitch_cost, status)
         VALUES (1, 1, 'Trận 1', '2026-06-20', 100000, 600000, 'Sắp diễn ra')`
      ).run();

      const mgr = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const mgrToken = createSessionToken(mgr, 24);
      const originalItems = [
        { player_id: 2, attended: 1, paid: 1, amount: 100000, walk_in: 0, remove: false },
      ];

      // Step 1: Client saves batch -> server commits, but simulated HTTP response is lost (status 0)
      let capturedReplayHeader: string | null = null;
      const firstOutcome = await runBatchOperationAttempt({
        mode: "save",
        matchId: 1,
        collectedBy: "Mgr",
        items: originalItems,
        sendMutate: async (payload) => {
          const serverRes = await postTeamRoute(
            new NextRequest("http://localhost:3000/api/team", {
              method: "POST",
              headers: {
                host: "localhost:3000",
                origin: "http://localhost:3000",
                "idempotency-key": payload.idempotency_key,
                cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
              },
              body: JSON.stringify({
                action: "collect_match_fees_batch",
                payload,
              }),
            })
          );
          expect(serverRes.status).toBe(200);
          // Simulate response lost before reaching browser!
          return { ok: false, status: 0, retryable: true, error: "Connection dropped" };
        },
      });
      expect(firstOutcome.ok).toBe(false);
      expect(
        raw.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'collect_match_fees_batch'").get()
      ).toEqual({ c: 1 });

      // Step 2: Reload page -> server snapshot now matches draft (dirtyCount === 0!)
      const pendingAfterReload = loadPendingBatchSubmissionState(1);
      const footerView = deriveCollectionFooterViewState({
        dirtyCount: 0,
        pendingLoadState: pendingAfterReload,
        isSaving: false,
      });
      expect(footerView.hasUnresolvedPending).toBe(true);
      expect(footerView.statusKind).toBe("unresolved");
      expect(footerView.statusText).toBe("Có giao dịch thu quỹ chưa đối chiếu");
      expect(footerView.statusText).not.toContain("Đã đồng bộ");
      expect(footerView.showReconcileRetryButton).toBe(true);
      expect(footerView.showDiscardButton).toBe(true);
      expect(footerView.discardButtonLabel).toBe("Xoá Khóa Tạm");

      // Step 3: User clicks "Đối chiếu / Thử lại" (reconcile_retry) -> sends persisted original payload & key even though dirtyCount === 0
      const replayOutcome = await runBatchOperationAttempt({
        mode: "reconcile_retry",
        matchId: 1,
        sendMutate: async (payload) => {
          const replayRes = await postTeamRoute(
            new NextRequest("http://localhost:3000/api/team", {
              method: "POST",
              headers: {
                host: "localhost:3000",
                origin: "http://localhost:3000",
                "idempotency-key": payload.idempotency_key,
                cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
              },
              body: JSON.stringify({
                action: "collect_match_fees_batch",
                payload,
              }),
            })
          );
          capturedReplayHeader = replayRes.headers.get("x-idempotent-replay");
          expect(replayRes.status).toBe(200);
          return { ok: true };
        },
      });

      expect(replayOutcome.ok).toBe(true);
      expect(capturedReplayHeader).toBe("true");
      expect(loadPendingBatchSubmissionState(1).status).toBe("none");
      // Zero duplicate financial writes & zero duplicate audit logs
      expect(
        raw.prepare("SELECT amount, paid FROM match_attendances WHERE match_id = 1 AND player_id = 2").get()
      ).toEqual({ amount: 100000, paid: 1 });
      expect(
        raw.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'collect_match_fees_batch'").get()
      ).toEqual({ c: 1 });

      clearPendingBatchSubmission(1);
    } finally {
      raw.close();
    }
  });

  it("verifies TursoDbAdapter audit rollback on mid-transaction audit failure and actor isolation", async () => {
    const mgr1: Player = {
      id: 1,
      code_order: 1,
      full_name: "Mgr One",
      short_name: "M1",
      jersey_number: 1,
      position: "GK",
      phone: "0900000001",
      birth_year: "1990",
      avatar_url: "",
      role: "Quản lý",
      access_role: "manager",
      username: "m1_iso",
      pin_code: hashPassword("Mgr1Strong@2026"),
      status: "Đang sinh hoạt",
      notes: "",
    };
    const mgr2: Player = { ...mgr1, id: 2, full_name: "Mgr Two", username: "m2_iso" };
    const t1 = createSessionToken(mgr1, 24);
    const t2 = createSessionToken(mgr2, 24);

    const committedAttendanceWrites: number[] = [];
    const committedKeys = new Set<string>();
    let failAuditOnNextTx = true;

    const mockClient = {
      execute: vi.fn(async (input: string | { sql: string; args?: unknown[] }) => {
        const sql = typeof input === "string" ? input : input.sql;
        const args = typeof input === "string" ? [] : input.args ?? [];
        if (sql.includes("FROM players WHERE id = ?")) {
          const id = Number(args[0]);
          if (id === 1) return { rows: [mgr1] };
          if (id === 2) return { rows: [mgr2] };
          if (id === 3) return { rows: [{ id: 3 }] };
          return { rows: [] };
        }
        if (sql.includes("FROM matches WHERE id = ?")) {
          return { rows: [{ fee_per_player: 100000 }] };
        }
        return { rows: [] };
      }),
      transaction: vi.fn(async () => {
        const stagedAtt: number[] = [];
        let stagedKey = "";
        let rolledBack = false;
        return {
          execute: async (input: string | { sql: string; args?: unknown[] }) => {
            const sql = typeof input === "string" ? input : input.sql;
            const args = typeof input === "string" ? [] : input.args ?? [];
            if (sql.includes("INSERT INTO match_attendances")) {
              stagedAtt.push(Number(args[1]));
            }
            if (sql.includes("INSERT INTO audit_logs") && failAuditOnNextTx) {
              throw new Error("Simulated Turso audit failure");
            }
            if (sql.includes("INSERT INTO idempotency_keys")) {
              stagedKey = `${args[0]}:${args[1]}:${args[2]}`;
            }
            return { rows: [], lastInsertRowid: BigInt(1), rowsAffected: 1 };
          },
          commit: async () => {
            committedAttendanceWrites.push(...stagedAtt);
            if (stagedKey) committedKeys.add(stagedKey);
          },
          rollback: async () => {
            rolledBack = true;
            stagedAtt.length = 0;
            stagedKey = "";
          },
          close: () => {
            void rolledBack;
          },
        };
      }),
    };

    const adapter = new TursoDbAdapter(mockClient as never, { requestTimeoutMs: 500 });
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter);
    vi.spyOn(dbModule, "getFullAppData").mockResolvedValue({
      settings: {
        id: 1,
        team_name: "FC HĐH Gò Nổi",
        short_name: "FC",
        default_match_fee: 100000,
        bank_bin: "970422",
        bank_name: "MB",
        bank_account_no: "",
        bank_account_name: "TEST",
        tournament_fund_reserve: 0,
        tournament_fund_note: "",
        fanpage_url: "",
      },
      players: [{ ...mgr1, pin_code: "" }, { ...mgr2, pin_code: "" }],
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
        totalPlayersCount: 2,
        totalUnpaidAmount: 0,
        categoryBreakdown: [],
      },
      posts: [],
      sponsors: [],
    } as FullAppData);

    const makeReq = (token: string, key: string) =>
      new NextRequest("http://localhost:3000/api/team", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "idempotency-key": key,
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({
          action: "collect_match_fees_batch",
          payload: {
            match_id: 1,
            collected_by: "Mgr",
            items: [{ player_id: 3, attended: 1, paid: 1, amount: 100000 }],
          },
        }),
      });

    // Audit failure rolls back staged attendance writes
    const failRes = await postTeamRoute(makeReq(t1, "shared-key-1"));
    expect(failRes.status).toBe(500);
    expect(committedAttendanceWrites.length).toBe(0);

    // Different actors with identical key commit independently without collision
    failAuditOnNextTx = false;
    expect((await postTeamRoute(makeReq(t1, "shared-key-1"))).status).toBe(200);
    expect((await postTeamRoute(makeReq(t2, "shared-key-1"))).status).toBe(200);
    expect(committedKeys.size).toBe(2);
  });
});
