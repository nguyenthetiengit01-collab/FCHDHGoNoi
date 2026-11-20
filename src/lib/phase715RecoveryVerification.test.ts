import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as postTeamRoute } from "@/app/api/team/route";
import { SESSION_COOKIE_NAME, createSessionToken, hashPassword } from "@/lib/auth";
import {
  clearPendingBatchSubmission,
  isAmbiguousMutateFailure,
  isDefinitiveNoWriteClientFailure,
  loadPendingBatchSubmissionState,
  resolveBatchSubmissionAttempt,
  savePendingBatchSubmission,
} from "@/lib/collectionDraft";
import * as dbModule from "@/lib/db";
import { TursoDbAdapter, TursoWriteOutcomeUnknownError } from "@/lib/db";
import type { FullAppData, Player } from "@/types/app";

const tempDirs: string[] = [];

function makeTempDir(prefix = "fc-p715-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  while (tempDirs.length > 0) {
    const d = tempDirs.pop();
    if (d && fs.existsSync(d)) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {
        // ignore Windows cleanup timing
      }
    }
  }
});

describe("Phase 7.1.5 – Fail-Closed Network Recovery & Durable Local Key Persistence", () => {
  it("treats status 0, 503, DB_WRITE_OUTCOME_UNKNOWN, and retryable=true as ambiguous unknown_outcome and enforces fail-closed reload/retry", () => {
    expect(isAmbiguousMutateFailure({ ok: false, status: 0, retryable: true })).toBe(true);
    expect(
      isAmbiguousMutateFailure({
        ok: false,
        status: 503,
        code: "DB_WRITE_OUTCOME_UNKNOWN",
        retryable: false,
      })
    ).toBe(true);
    expect(isAmbiguousMutateFailure({ ok: false, status: 400 })).toBe(false);
    expect(isDefinitiveNoWriteClientFailure({ ok: false, status: 400 })).toBe(true);
    expect(isDefinitiveNoWriteClientFailure({ ok: false, status: 403 })).toBe(true);
    expect(isDefinitiveNoWriteClientFailure({ ok: false, status: 503 })).toBe(false);

    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });

    const itemsA = [
      { player_id: 2, attended: 1, paid: 1, amount: 100000, walk_in: 0, remove: false },
    ];
    const itemsB = [
      { player_id: 2, attended: 1, paid: 1, amount: 200000, walk_in: 0, remove: false },
    ];

    // Simulate in-flight submission persisted as "pending", then page reload before response
    const first = resolveBatchSubmissionAttempt({
      existingPending: null,
      matchId: 12,
      collectedBy: "Tieng",
      items: itemsA,
    });
    expect(first.blocked).toBe(false);
    if (first.blocked) throw new Error("unexpected");
    expect(savePendingBatchSubmission(12, first.submission)).toBe(true);

    // After reload while state is still "pending": changed payload MUST be blocked (fail-closed)
    const loadedAfterReload = loadPendingBatchSubmissionState(12);
    expect(loadedAfterReload.status).toBe("ok");
    if (loadedAfterReload.status !== "ok") throw new Error("unexpected");
    const changedAfterReload = resolveBatchSubmissionAttempt({
      existingPending: loadedAfterReload.submission,
      matchId: 12,
      collectedBy: "Tieng",
      items: itemsB,
    });
    expect(changedAfterReload.blocked).toBe(true);
    if (!changedAfterReload.blocked) throw new Error("expected blocked");
    expect(changedAfterReload.reason).toBe("unresolved_pending_payload_changed");

    // Same payload retry after reload reuses original key
    const retryAfterReload = resolveBatchSubmissionAttempt({
      existingPending: loadedAfterReload.submission,
      matchId: 12,
      collectedBy: "Tieng",
      items: itemsA,
    });
    expect(retryAfterReload.blocked).toBe(false);
    if (retryAfterReload.blocked) throw new Error("unexpected");
    expect(retryAfterReload.submission.idempotency_key).toBe(
      first.submission.idempotency_key
    );

    // Network disconnect (status 0) transitions persisted state to unknown_outcome
    savePendingBatchSubmission(12, {
      ...first.submission,
      state: "unknown_outcome",
    });
    const loadedUnknown = loadPendingBatchSubmissionState(12);
    expect(loadedUnknown.status).toBe("ok");
    if (loadedUnknown.status !== "ok") throw new Error("unexpected");
    expect(loadedUnknown.submission.state).toBe("unknown_outcome");

    // Definitive 400 clears pending so corrected submission gets a fresh key
    clearPendingBatchSubmission(12);
    expect(loadPendingBatchSubmissionState(12).status).toBe("none");
  });

  it("fails closed when localStorage throws quota error, is unavailable, or holds corrupted pending JSON, and checks CollectionTab discard UX", () => {
    // 1. QuotaExceededError on setItem -> returns false, does not overwrite valid key
    const backing = new Map<string, string>();
    let failWrites = false;
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => backing.get(k) ?? null,
        setItem: (k: string, v: string) => {
          if (failWrites) throw new Error("QuotaExceededError");
          backing.set(k, v);
        },
        removeItem: (k: string) => {
          backing.delete(k);
        },
      },
    });

    const sub1 = {
      match_id: 21,
      idempotency_key: "valid-key-21",
      payload_fingerprint: "fp-1",
      collected_by: "Tiếng",
      items: [
        { player_id: 2, attended: 1, paid: 1, amount: 100000, walk_in: 0, remove: false },
      ],
      state: "pending" as const,
      created_at: new Date().toISOString(),
    };
    expect(savePendingBatchSubmission(21, sub1)).toBe(true);

    failWrites = true;
    expect(
      savePendingBatchSubmission(21, { ...sub1, idempotency_key: "overwrite-key" })
    ).toBe(false);
    const stillValid = loadPendingBatchSubmissionState(21);
    expect(stillValid.status).toBe("ok");
    if (stillValid.status === "ok") {
      expect(stillValid.submission.idempotency_key).toBe("valid-key-21");
    }

    // 2. Corrupted JSON pending record -> returns status: "corrupted" (fail-closed)
    backing.set("gonoi_fee_pending_batch_21", "{broken-json");
    expect(loadPendingBatchSubmissionState(21).status).toBe("corrupted");

    // 3. localStorage unavailable -> save returns false, load returns corrupted
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("SecurityError: localStorage disabled");
      },
    });
    expect(savePendingBatchSubmission(21, sub1)).toBe(false);
    expect(loadPendingBatchSubmissionState(21).status).toBe("corrupted");

    // 4. CollectionTab & collectionDraft checks: durable check before send & fail-closed discard warning
    const collectionSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/CollectionTab.tsx"),
      "utf8"
    );
    const draftSrc = fs.readFileSync(
      path.join(process.cwd(), "src/lib/collectionDraft.ts"),
      "utf8"
    );
    expect(draftSrc).toContain("if (!persisted)");
    expect(draftSrc).toContain("isAmbiguousMutateFailure");
    expect(draftSrc).toContain("isDefinitiveNoWriteClientFailure");
    expect(collectionSrc).toContain("runBatchOperationAttempt");
    expect(collectionSrc).toContain("CẢNH BÁO ĐỐI CHIẾU");
    expect(collectionSrc).toContain("KHÔNG thể hoàn tác giao dịch đã lưu trên máy chủ");
  });
});

describe("Phase 7.1.5 – TursoDbAdapter Overlapping Concurrency Mock Tests", () => {
  it("handles overlapping concurrent Turso transactions for identical replay, conflicting 409, SQLITE_BUSY, and commit unknown outcome", async () => {
    const mgr: Player = {
      id: 1,
      code_order: 1,
      full_name: "Manager Turso",
      short_name: "MgrT",
      jersey_number: 1,
      position: "GK",
      phone: "0900000001",
      birth_year: "1990",
      avatar_url: "",
      role: "Quản lý",
      access_role: "manager",
      username: "mgr_turso",
      pin_code: hashPassword("MgrTurso@2026"),
      status: "Đang sinh hoạt",
      notes: "",
    };
    const mgrToken = createSessionToken(mgr, 24);

    // Shared in-memory state simulating Turso server tables + overlapping tx barriers
    const idempotencyStore = new Map<
      string,
      { payload_hash: string; status_code: number; response_json: string; expires_at: string }
    >();
    let auditInsertCount = 0;
    let simulateBusyOnSecondTx = false;
    let simulateCommitTimeout = false;

    let openTxBarrier: (() => void) | null = null;
    const waitBothTxStarted = () =>
      new Promise<void>((resolve) => {
        if (!openTxBarrier) {
          openTxBarrier = resolve;
        } else {
          const prev = openTxBarrier;
          openTxBarrier = null;
          prev();
          resolve();
        }
      });

    let txCounter = 0;
    const mockClient = {
      execute: vi.fn(async (input: string | { sql: string; args?: unknown[] }) => {
        const sql = typeof input === "string" ? input : input.sql;
        const args = typeof input === "string" ? [] : input.args ?? [];
        if (sql.includes("FROM players WHERE id = ?")) {
          const id = Number(args[0]);
          if (id === 1) return { rows: [mgr] };
          if (id === 3) return { rows: [{ id: 3 }] };
          return { rows: [] };
        }
        if (sql.includes("FROM matches WHERE id = ?")) {
          return { rows: [{ fee_per_player: 100000 }] };
        }
        if (sql.includes("SELECT payload_hash") && sql.includes("FROM idempotency_keys")) {
          const key = `${args[0]}:${args[1]}:${args[2]}`;
          const row = idempotencyStore.get(key);
          return { rows: row ? [row] : [] };
        }
        return { rows: [] };
      }),
      transaction: vi.fn(async () => {
        txCounter++;
        const myTxId = txCounter;
        const stagedKeys = new Map<
          string,
          { payload_hash: string; status_code: number; response_json: string; expires_at: string }
        >();
        let stagedAudits = 0;
        let closed = false;

        return {
          execute: async (input: string | { sql: string; args?: unknown[] }) => {
            const sql = typeof input === "string" ? input : input.sql;
            const args = typeof input === "string" ? [] : input.args ?? [];
            if (sql.includes("SELECT payload_hash") && sql.includes("FROM idempotency_keys")) {
              // Force overlapping start of tx1 & tx2 before either commits
              if (myTxId <= 2) {
                await waitBothTxStarted();
              }
              const key = `${args[0]}:${args[1]}:${args[2]}`;
              const row = idempotencyStore.get(key);
              return { rows: row ? [row] : [] };
            }
            if (sql.includes("INSERT INTO audit_logs")) {
              stagedAudits++;
            }
            if (sql.includes("INSERT INTO idempotency_keys")) {
              if (simulateBusyOnSecondTx && myTxId === 4) {
                throw new Error("SQLITE_BUSY: database is locked");
              }
              const key = `${args[0]}:${args[1]}:${args[2]}`;
              if (idempotencyStore.has(key)) {
                throw new Error("UNIQUE constraint failed: idempotency_keys");
              }
              stagedKeys.set(key, {
                payload_hash: String(args[3]),
                status_code: Number(args[4]),
                response_json: String(args[5]),
                expires_at: String(args[6]),
              });
            }
            return { rows: [], lastInsertRowid: BigInt(1), rowsAffected: 1 };
          },
          commit: async () => {
            if (simulateCommitTimeout) {
              await new Promise((r) => setTimeout(r, 80));
            }
            for (const [k, v] of stagedKeys.entries()) {
              if (idempotencyStore.has(k)) {
                throw new Error("UNIQUE constraint failed: idempotency_keys");
              }
              idempotencyStore.set(k, v);
            }
            auditInsertCount += stagedAudits;
          },
          rollback: async () => {
            stagedKeys.clear();
            stagedAudits = 0;
          },
          close: () => {
            closed = true;
            void closed;
          },
        };
      }),
    };

    const adapter = new TursoDbAdapter(mockClient as never, {
      requestTimeoutMs: 30,
    });
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
      players: [{ ...mgr, pin_code: "" }],
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
        totalPlayersCount: 1,
        totalUnpaidAmount: 0,
        categoryBreakdown: [],
      },
      posts: [],
      sponsors: [],
    } as FullAppData);

    const makeReq = (key: string, amount: number) =>
      new NextRequest("http://localhost:3000/api/team", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "idempotency-key": key,
          cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
        },
        body: JSON.stringify({
          action: "collect_match_fees_batch",
          payload: {
            match_id: 1,
            collected_by: "MgrT",
            items: [{ player_id: 3, attended: 1, paid: 1, amount }],
          },
        }),
      });

    // 1. Overlapping identical Turso transactions -> UNIQUE reconciled to 200 replay, single audit
    const [r1, r2] = await Promise.all([
      postTeamRoute(makeReq("turso-ov-1", 100000)),
      postTeamRoute(makeReq("turso-ov-1", 100000)),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(auditInsertCount).toBe(1);
    expect(
      [r1.headers.get("x-idempotent-replay"), r2.headers.get("x-idempotent-replay")].filter(
        Boolean
      ).length
    ).toBe(1);

    // 2. Conflicting payload on same key -> 409 Conflict via winner reconciliation
    const conflictRes = await postTeamRoute(makeReq("turso-ov-1", 180000));
    expect(conflictRes.status).toBe(409);

    // 3. SQLITE_BUSY / lock contention during tx -> mapped cleanly without duplicate audit
    simulateBusyOnSecondTx = true;
    const busyRes = await postTeamRoute(makeReq("turso-busy-1", 100000));
    expect([500, 503]).toContain(busyRes.status);
    expect(auditInsertCount).toBe(1);
    simulateBusyOnSecondTx = false;

    // 4. Commit timeout -> 503 DB_WRITE_OUTCOME_UNKNOWN, retryable=false
    simulateCommitTimeout = true;
    const timeoutRes = await postTeamRoute(makeReq("turso-to-1", 100000));
    expect(timeoutRes.status).toBe(503);
    const timeoutJson = await timeoutRes.json();
    expect(timeoutJson.code).toBe("DB_WRITE_OUTCOME_UNKNOWN");
    expect(timeoutJson.retryable).toBe(false);
    simulateCommitTimeout = false;

    // Explicit direct check of TursoWriteOutcomeUnknownError export
    expect(
      new TursoWriteOutcomeUnknownError({ operationType: "transaction.commit", timeoutMs: 30 })
        .name
    ).toBe("TursoWriteOutcomeUnknownError");
  });
});

describe("Phase 7.1.5 – Local SQLite Symlink Path Safety", () => {
  it("accepts isolated temp DBs and rejects direct repo paths, repo-pointing symlinks, and protected-DB symlinks", async () => {
    const mod = await import("../../scripts/migrations/phase7-idempotency-v1.mjs");

    // 1. Valid external synthetic DB path accepted
    const externalDir = makeTempDir("fc-p715-ext-");
    const validDb = path.join(externalDir, "synthetic-ok.sqlite");
    fs.writeFileSync(validDb, "");
    expect(mod.validateLocalSqlitePath(validDb)).toBe(fs.realpathSync(validDb));

    // 2. Direct path inside repo rejected
    expect(() =>
      mod.validateLocalSqlitePath(path.join(process.cwd(), "package.json"))
    ).toThrow(/inside the repository/i);

    // 3. Production-like basename rejected
    const prodLike = path.join(externalDir, "prod-copy.sqlite");
    fs.writeFileSync(prodLike, "");
    expect(() => mod.validateLocalSqlitePath(prodLike)).toThrow(/protected/i);

    const gonoifcCopy = path.join(externalDir, "gonoifc.sqlite");
    fs.writeFileSync(gonoifcCopy, "");
    expect(() => mod.validateLocalSqlitePath(gonoifcCopy)).toThrow(/protected/i);

    // 4. Directory junction / symlink in os.tmpdir pointing inside repo -> rejected
    const junctionDir = path.join(externalDir, "repo-alias");
    fs.symlinkSync(path.join(process.cwd(), "docs"), junctionDir, "junction");
    expect(() =>
      mod.validateLocalSqlitePath(path.join(junctionDir, "phase-7", "risk-register.md"))
    ).toThrow(/inside the repository/i);

    // 5. File symlink (when permitted by OS) pointing to protected DB name -> rejected
    const symToProtected = path.join(externalDir, "innocent-alias.sqlite");
    try {
      fs.symlinkSync(gonoifcCopy, symToProtected, "file");
      expect(() => mod.validateLocalSqlitePath(symToProtected)).toThrow(/protected/i);
    } catch (err) {
      // On Windows without Developer Mode, file symlinks may throw EPERM; junction test above still proves realpathSync
      expect((err as NodeJS.ErrnoException).code).toBe("EPERM");
    }
  });
});
