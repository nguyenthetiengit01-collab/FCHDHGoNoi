import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as postTeamRoute } from "@/app/api/team/route";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  hashPassword,
} from "@/lib/auth";
import {
  clearPendingBatchSubmission,
  computeBatchPayloadFingerprint,
  generateIdempotencyUuid,
  loadPendingBatchSubmission,
  resolveBatchSubmissionAttempt,
  savePendingBatchSubmission,
} from "@/lib/collectionDraft";
import * as dbModule from "@/lib/db";
import { TursoWriteOutcomeUnknownError } from "@/lib/db";
import type { FullAppData, Player } from "@/types/app";

const tempDirs: string[] = [];

function makeTempSqlitePath(name = "synth.sqlite") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-p714-"));
  tempDirs.push(dir);
  return path.join(dir, name);
}

function createTestDb() {
  const raw = new DatabaseSync(":memory:");
  dbModule.initQaDatabaseSchema(raw);
  return { raw, db: new dbModule.LocalSqliteAdapter(raw) };
}

function spyFullAppData(raw: DatabaseSync) {
  return vi.spyOn(dbModule, "getFullAppData").mockImplementation(async () => {
    const players = raw.prepare("SELECT * FROM players").all() as unknown as Player[];
    const matches = raw.prepare("SELECT * FROM matches").all() as never[];
    const attendances = raw.prepare("SELECT * FROM match_attendances").all() as never[];
    const data: FullAppData = {
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
    return data;
  });
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
        // Ignore Windows lock release timing
      }
    }
  }
});

describe("Phase 7.1.4 – Client Idempotency Key Lifecycle", () => {
  it("generates UUIDs without Math.random, persists pending key across reloads, blocks payload changes on unknown_outcome, and clears on confirm", () => {
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

    const uuid = generateIdempotencyUuid();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    const itemsA = [
      { player_id: 2, attended: 1, paid: 1, amount: 100000, walk_in: 0, remove: false },
    ];
    const itemsB = [
      { player_id: 2, attended: 1, paid: 1, amount: 150000, walk_in: 0, remove: false },
    ];

    // 1. First send creates a key and persists pending state
    const first = resolveBatchSubmissionAttempt({
      existingPending: loadPendingBatchSubmission(10),
      matchId: 10,
      collectedBy: "Tieng",
      items: itemsA,
    });
    expect(first.blocked).toBe(false);
    if (first.blocked) throw new Error("unexpected");
    expect(first.reused).toBe(false);
    savePendingBatchSubmission(10, first.submission);

    // 2. Reload + retry with identical payload reuses identical key
    const reloaded = loadPendingBatchSubmission(10);
    expect(reloaded?.idempotency_key).toBe(first.submission.idempotency_key);
    const retry = resolveBatchSubmissionAttempt({
      existingPending: reloaded,
      matchId: 10,
      collectedBy: "Tieng",
      items: itemsA,
    });
    expect(retry.blocked).toBe(false);
    if (retry.blocked) throw new Error("unexpected");
    expect(retry.reused).toBe(true);
    expect(retry.submission.idempotency_key).toBe(first.submission.idempotency_key);

    // 3. Unknown outcome (503) preserves key & blocks changed payload
    savePendingBatchSubmission(10, {
      ...first.submission,
      state: "unknown_outcome",
    });
    const blockedAttempt = resolveBatchSubmissionAttempt({
      existingPending: loadPendingBatchSubmission(10),
      matchId: 10,
      collectedBy: "Tieng",
      items: itemsB,
    });
    expect(blockedAttempt.blocked).toBe(true);
    if (!blockedAttempt.blocked) throw new Error("expected blocked");
    expect(blockedAttempt.reason).toBe("unknown_outcome_payload_changed");
    expect(blockedAttempt.pending.idempotency_key).toBe(first.submission.idempotency_key);

    // Same payload retry during unknown_outcome still reuses original key
    const retryUnknownSame = resolveBatchSubmissionAttempt({
      existingPending: loadPendingBatchSubmission(10),
      matchId: 10,
      collectedBy: "Tieng",
      items: itemsA,
    });
    expect(retryUnknownSame.blocked).toBe(false);
    if (retryUnknownSame.blocked) throw new Error("unexpected");
    expect(retryUnknownSame.submission.idempotency_key).toBe(
      first.submission.idempotency_key
    );

    // 4. Confirmed success clears pending key -> next logical operation gets a new key
    clearPendingBatchSubmission(10);
    expect(loadPendingBatchSubmission(10)).toBeNull();
    const nextOp = resolveBatchSubmissionAttempt({
      existingPending: loadPendingBatchSubmission(10),
      matchId: 10,
      collectedBy: "Tieng",
      items: itemsB,
    });
    expect(nextOp.blocked).toBe(false);
    if (nextOp.blocked) throw new Error("unexpected");
    expect(nextOp.submission.idempotency_key).not.toBe(first.submission.idempotency_key);
    expect(
      computeBatchPayloadFingerprint(10, "Tieng", itemsA)
    ).not.toBe(computeBatchPayloadFingerprint(10, "Tieng", itemsB));
  });
});

describe("Phase 7.1.4 – Server Required Idempotency Key & Concurrency", () => {
  it("enforces required Idempotency-Key, validation, expiry, actor isolation, concurrency safety, and unknown-outcome handling", async () => {
    const { raw, db } = createTestDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);
    spyFullAppData(raw);

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, access_role, username, pin_code, status)
         VALUES
           (1, 'Manager 1', 'M1', 'manager', 'm1', ?, 'Đang sinh hoạt'),
           (2, 'Manager 2', 'M2', 'manager', 'm2', ?, 'Đang sinh hoạt'),
           (3, 'Player 3', 'P3', 'player', 'p3', ?, 'Đang sinh hoạt')`
      ).run(
        hashPassword("Mgr1Strong@2026"),
        hashPassword("Mgr2Strong@2026"),
        hashPassword("Player3@2026")
      );
      raw.prepare(
        `INSERT INTO matches (id, match_number, label, match_date, fee_per_player, pitch_cost)
         VALUES (1, 1, 'Trận 1', '2026-06-15', 100000, 600000)`
      ).run();

      const m1 = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const m2 = raw.prepare("SELECT * FROM players WHERE id = 2").get() as unknown as Player;
      const t1 = createSessionToken(m1, 24);
      const t2 = createSessionToken(m2, 24);

      const makeReq = (
        token: string,
        opts: { headerKey?: string; bodyKey?: unknown; amount?: number }
      ) => {
        const headers: Record<string, string> = {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        };
        if (opts.headerKey !== undefined) {
          headers["idempotency-key"] = opts.headerKey;
        }
        return new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "collect_match_fees_batch",
            payload: {
              match_id: 1,
              collected_by: "M1",
              ...(opts.bodyKey !== undefined ? { idempotency_key: opts.bodyKey } : {}),
              items: [
                {
                  player_id: 3,
                  attended: 1,
                  paid: 1,
                  amount: opts.amount ?? 100000,
                },
              ],
            },
          }),
        });
      };

      // 1. Missing key -> 400 and zero financial writes
      const missingRes = await postTeamRoute(makeReq(t1, {}));
      expect(missingRes.status).toBe(400);
      expect(
        raw.prepare("SELECT COUNT(*) AS c FROM match_attendances").get()
      ).toEqual({ c: 0 });

      // 2. Invalid key (control char in body / > 128 chars / header-body mismatch) -> 400
      expect((await postTeamRoute(makeReq(t1, { bodyKey: "bad\nkey" }))).status).toBe(400);
      expect((await postTeamRoute(makeReq(t1, { headerKey: "x".repeat(129) }))).status).toBe(400);
      expect(
        (await postTeamRoute(makeReq(t1, { headerKey: "k-a", bodyKey: "k-b" }))).status
      ).toBe(400);

      // 3. Concurrent identical requests -> no double write, no duplicate audit log
      const [c1, c2] = await Promise.all([
        postTeamRoute(makeReq(t1, { headerKey: "conc-same-1", amount: 100000 })),
        postTeamRoute(makeReq(t1, { headerKey: "conc-same-1", amount: 100000 })),
      ]);
      expect(c1.status).toBe(200);
      expect(c2.status).toBe(200);
      expect(
        raw.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'collect_match_fees_batch'").get()
      ).toEqual({ c: 1 });

      // 4. Concurrent conflicting payloads -> deterministic 200 + 409
      const [cf1, cf2] = await Promise.all([
        postTeamRoute(makeReq(t1, { headerKey: "conc-diff-1", amount: 100000 })),
        postTeamRoute(makeReq(t1, { headerKey: "conc-diff-1", amount: 150000 })),
      ]);
      expect([cf1.status, cf2.status].sort()).toEqual([200, 409]);

      // 5. Expired key is replaced cleanly
      raw.prepare(
        `INSERT INTO idempotency_keys (idempotency_key, actor_id, action, payload_hash, status_code, response_json, expires_at)
         VALUES ('expired-k1', 1, 'collect_match_fees_batch', 'old-hash', 200, '{}', '2020-01-01T00:00:00.000Z')`
      ).run();
      const expiredRes = await postTeamRoute(
        makeReq(t1, { headerKey: "expired-k1", amount: 120000 })
      );
      expect(expiredRes.status).toBe(200);
      expect(expiredRes.headers.get("x-idempotent-replay")).toBeNull();

      // 6. Actor isolation
      const actor2Res = await postTeamRoute(
        makeReq(t2, { headerKey: "conc-same-1", amount: 130000 })
      );
      expect(actor2Res.status).toBe(200);
      expect(actor2Res.headers.get("x-idempotent-replay")).toBeNull();

      // 7. Commit timeout maps to 503 DB_WRITE_OUTCOME_UNKNOWN with retryable=false
      vi.spyOn(db, "transaction").mockRejectedValueOnce(
        new TursoWriteOutcomeUnknownError({
          operationType: "transaction.commit",
          timeoutMs: 5000,
        })
      );
      const timeoutRes = await postTeamRoute(
        makeReq(t1, { headerKey: "timeout-k1", amount: 100000 })
      );
      expect(timeoutRes.status).toBe(503);
      const timeoutJson = await timeoutRes.json();
      expect(timeoutJson.code).toBe("DB_WRITE_OUTCOME_UNKNOWN");
      expect(timeoutJson.retryable).toBe(false);

      // 8. Read-only ensureIdempotencyKeysReady: fails closed with zero DDL on missing schema,
      // and deduplicates metadata check after migration
      const raw2 = new DatabaseSync(":memory:");
      const db2 = new dbModule.LocalSqliteAdapter(raw2);
      const runSpy = vi.spyOn(db2, "run");
      await expect(dbModule.ensureIdempotencyKeysReady(db2)).rejects.toThrow(
        /Idempotency schema is not ready/i
      );
      expect(runSpy).toHaveBeenCalledTimes(0);

      // Verify POST /api/team collect_match_fees_batch fails closed (503) without running DDL
      dbModule.initQaDatabaseSchema(raw2);
      raw2.exec("DROP TABLE IF EXISTS idempotency_keys;");
      raw2.exec("INSERT INTO matches (id, match_number, label, match_date, fee_per_player) VALUES (1, 1, 'Trận 1', '2026-11-21', 100000);");
      raw2
        .prepare("INSERT INTO players (id, code_order, full_name, short_name, access_role, username, pin_code, status) VALUES (1, 1, 'Mgr', 'M1', 'manager', 'mgr1', ?, 'Đang sinh hoạt'), (3, 3, 'Player 3', 'P3', 'player', 'p3', ?, 'Đang sinh hoạt')")
        .run(hashPassword("MgrStrong@2026"), hashPassword("Player3@2026"));
      vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(
        db2 as unknown as ReturnType<typeof dbModule.getAsyncDb>
      );
      const mgr2Row = raw2.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const mgr2Token = createSessionToken(mgr2Row, 24);
      const missingSchemaRes = await postTeamRoute(makeReq(mgr2Token, { headerKey: "missing-schema-k1", amount: 100000 }));
      expect(missingSchemaRes.status).toBe(503);
      expect((await missingSchemaRes.json()).code).toBe("IDEMPOTENCY_SCHEMA_NOT_READY");
      const idempotencyDdlCalls = runSpy.mock.calls.filter(([sql]) =>
        /\b(CREATE\s+TABLE|CREATE\s+INDEX|ALTER\s+TABLE|DROP\s+TABLE)\b[\s\S]*\b(idempotency_keys|idx_idempotency_expires_at)\b/i.test(
          String(sql)
        )
      );
      expect(idempotencyDdlCalls).toHaveLength(0);

      // After migration, 10 concurrent calls deduplicate to 1 read-only query and 0 DDL runs
      raw2.exec(`
        CREATE TABLE idempotency_keys (idempotency_key TEXT NOT NULL, actor_id INTEGER NOT NULL, action TEXT NOT NULL, payload_hash TEXT NOT NULL, status_code INTEGER NOT NULL, response_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT NOT NULL, PRIMARY KEY (idempotency_key, actor_id, action));
        CREATE INDEX idx_idempotency_expires_at ON idempotency_keys(expires_at);
      `);
      runSpy.mockClear();
      const querySpy = vi.spyOn(db2, "query");
      await Promise.all(
        Array.from({ length: 10 }, () => dbModule.ensureIdempotencyKeysReady(db2))
      );
      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(runSpy).toHaveBeenCalledTimes(0);
      raw2.close();
    } finally {
      raw.close();
    }
  });
});

describe("Phase 7.1.4 – Migration Staging Preflight, Dry-Run Zero-Write & Local Safety", () => {
  it("enforces Staging allowlist, rejects Production/wrong creds, keeps dry-run 100% zero-write, and protects local SQLite paths", async () => {
    const mod = await import("../../scripts/migrations/phase7-idempotency-v1.mjs");

    // 1. Staging preflight checks
    await expect(
      mod.runStagingMigration({
        env: {
          TURSO_DATABASE_URL: "libsql://fchdhgonoi-nguyenthetiengit01.turso.io",
          TURSO_AUTH_TOKEN: "prod-secret",
        } as unknown as NodeJS.ProcessEnv,
        dryRun: true,
      })
    ).rejects.toThrow(/missing TURSO_STAGING_DATABASE_URL/i);

    await expect(
      mod.runStagingMigration({
        env: {
          TURSO_STAGING_DATABASE_URL: "libsql://fchdhgonoi-nguyenthetiengit01.turso.io",
          TURSO_STAGING_AUTH_TOKEN: "tok",
        } as unknown as NodeJS.ProcessEnv,
        dryRun: true,
      })
    ).rejects.toThrow(/appears to be Production/i);

    await expect(
      mod.runStagingMigration({
        env: {
          TURSO_STAGING_DATABASE_URL: "libsql://fchdhgonoi-staging-restore.turso.io",
          TURSO_STAGING_AUTH_TOKEN: "tok",
        } as unknown as NodeJS.ProcessEnv,
        dryRun: true,
      })
    ).rejects.toThrow(/not in the exact allowlist/i);

    let capturedUrl = "";
    let capturedToken = "";
    const mockClient = {
      execute: vi.fn(async () => ({ rows: [] })),
      close: vi.fn(),
    };
    const stagingRes = await mod.runStagingMigration({
      env: {
        TURSO_DATABASE_URL: "libsql://fchdhgonoi-nguyenthetiengit01.turso.io",
        TURSO_STAGING_DATABASE_URL: "libsql://fchdhgonoi-staging.turso.io",
        TURSO_STAGING_AUTH_TOKEN: "staging-tok",
      } as unknown as NodeJS.ProcessEnv,
      dryRun: true,
      clientFactory: (cfg: { url: string; authToken?: string }) => {
        capturedUrl = cfg.url;
        capturedToken = cfg.authToken ?? "";
        return mockClient as never;
      },
    });
    expect(capturedUrl).toBe("libsql://fchdhgonoi-staging.turso.io");
    expect(capturedToken).toBe("staging-tok");
    expect(stagingRes.target.dbName).toBe("fchdhgonoi-staging");
    expect(stagingRes.dryRun).toBe(true);
    // Dry-run only executed SELECT sqlite_master (zero CREATE/INSERT)
    expect(mockClient.execute).toHaveBeenCalledTimes(1);

    // 2. Dry-run zero-write on empty & partial SQLite DBs + apply/re-apply + failed rollback
    const synthPath = makeTempSqlitePath("synth-mig.sqlite");
    const db = new DatabaseSync(synthPath);
    try {
      const execCalls: string[] = [];
      const execFn = async (sql: string, params: unknown[] = []) => {
        execCalls.push(sql);
        db.prepare(sql).run(...(params as never[]));
      };
      const queryFn = async (sql: string, params: unknown[] = []) =>
        db.prepare(sql).all(...(params as never[]));
      const getSchemaSnapshot = () =>
        db
          .prepare(
            "SELECT type, name, sql FROM sqlite_master ORDER BY type, name"
          )
          .all();

      const emptyBefore = getSchemaSnapshot();
      const dryEmpty = await mod.runPhase7IdempotencyMigration({
        execute: execFn,
        query: queryFn,
        dryRun: true,
      });
      expect(execCalls.length).toBe(0);
      expect(dryEmpty.actions).toEqual([
        "CREATE TABLE schema_migrations",
        "CREATE TABLE idempotency_keys",
        "CREATE INDEX idx_idempotency_expires_at",
        "RECORD MIGRATION phase7-idempotency-v1",
      ]);
      expect(getSchemaSnapshot()).toEqual(emptyBefore);

      // Partial DB (schema_migrations exists, idempotency_keys absent) -> dry-run still zero-write
      db.exec(
        "CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL, summary TEXT)"
      );
      const partialBefore = getSchemaSnapshot();
      const dryPartial = await mod.runPhase7IdempotencyMigration({
        execute: execFn,
        query: queryFn,
        dryRun: true,
      });
      expect(execCalls.length).toBe(0);
      expect(dryPartial.actions).toEqual([
        "CREATE TABLE idempotency_keys",
        "CREATE INDEX idx_idempotency_expires_at",
        "RECORD MIGRATION phase7-idempotency-v1",
      ]);
      expect(getSchemaSnapshot()).toEqual(partialBefore);

      // Apply & re-apply
      const applied = await mod.runPhase7IdempotencyMigration({
        execute: execFn,
        query: queryFn,
        dryRun: false,
      });
      expect(applied.applied).toBe(true);
      const reapplied = await mod.runPhase7IdempotencyMigration({
        execute: execFn,
        query: queryFn,
        dryRun: false,
      });
      expect(reapplied.actions).toEqual([]);
      expect(
        db
          .prepare("SELECT COUNT(*) AS c FROM schema_migrations WHERE version = ?")
          .get(mod.MIGRATION_VERSION)
      ).toEqual({ c: 1 });
    } finally {
      db.close();
    }

    // 3. Local SQLite safety guard
    expect(() =>
      mod.validateLocalSqlitePath(path.join(process.cwd(), "data/gonoifc.sqlite"))
    ).toThrow(/inside the repository/i);
    expect(() =>
      mod.validateLocalSqlitePath(makeTempSqlitePath("gonoifc.sqlite"))
    ).toThrow(/protected or production-like/i);
    expect(() =>
      mod.validateLocalSqlitePath(makeTempSqlitePath("prod-copy.sqlite"))
    ).toThrow(/protected or production-like/i);

    const validPath = makeTempSqlitePath("isolated-valid.sqlite");
    fs.writeFileSync(validPath, "");
    expect(mod.validateLocalSqlitePath(validPath)).toBe(path.resolve(validPath));
  });
});
