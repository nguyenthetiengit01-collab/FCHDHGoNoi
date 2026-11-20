import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Client } from "@libsql/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TursoDbAdapter,
  resolveDatabaseMode,
  resolveTursoRequestTimeoutMs,
} from "./db";
import { buildPublicFinancialReport } from "./publicFinancialReport";

const ORIGINAL_ENV = { ...process.env };
const tempDirsToClean: string[] = [];

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
  vi.restoreAllMocks();

  while (tempDirsToClean.length > 0) {
    const dir = tempDirsToClean.pop();
    if (dir && fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore Windows handle release timing in temp cleanup
      }
    }
  }
});

function createMockLibsqlClient(overrides: Partial<Client> = {}): Client {
  return {
    execute: vi.fn(),
    batch: vi.fn(),
    transaction: vi.fn(),
    executeMultiple: vi.fn(),
    sync: vi.fn(),
    close: vi.fn(),
    closed: false,
    protocol: "https",
    ...overrides,
  } as unknown as Client;
}

describe("Phase 7.1 – TursoDbAdapter timeout, retry & database mode", () => {
  it("times out hung Turso read/write/batch/transaction operations without leaking credentials", async () => {
    const neverResolves = () => new Promise<never>(() => {});
    const mockClient = createMockLibsqlClient({
      execute: vi.fn(neverResolves),
      batch: vi.fn(neverResolves),
      transaction: vi.fn(neverResolves),
    });

    const adapter = new TursoDbAdapter(mockClient, {
      requestTimeoutMs: 25,
      maxReadRetries: 0,
      baseRetryDelayMs: 1,
    });

    await expect(adapter.query("SELECT 1")).rejects.toThrow(
      /Turso request timed out after 25ms \(query\)/
    );
    await expect(
      adapter.run("INSERT INTO players (full_name) VALUES (?)", ["Test"])
    ).rejects.toThrow(/Turso request timed out after 25ms \(run\)/);
    await expect(
      adapter.batch([{ sql: "DELETE FROM players WHERE id = ?", params: [1] }])
    ).rejects.toThrow(/Turso request timed out after 25ms \(batch\)/);
    await expect(
      adapter.transaction(async () => "ok")
    ).rejects.toThrow(/Turso request timed out after 25ms \(transaction\.begin\)/);
  });

  it("retries transient read errors (query & queryOne) and succeeds", async () => {
    const transientErr = Object.assign(new Error("socket hang up"), {
      code: "ECONNRESET",
    });
    const busyErr = Object.assign(new Error("database is locked"), {
      code: "SQLITE_BUSY",
    });

    const executeMock = vi
      .fn()
      .mockRejectedValueOnce(transientErr)
      .mockRejectedValueOnce(busyErr)
      .mockResolvedValueOnce({
        rows: [{ id: 1, ok: 1 }],
        columns: ["id", "ok"],
        columnTypes: ["INTEGER", "INTEGER"],
        rowsAffected: 0,
        lastInsertRowid: undefined,
        toJSON: () => ({}),
      });

    const mockClient = createMockLibsqlClient({ execute: executeMock });
    const adapter = new TursoDbAdapter(mockClient, {
      requestTimeoutMs: 200,
      maxReadRetries: 2,
      baseRetryDelayMs: 5,
      maxRetryDelayMs: 20,
    });

    const row = await adapter.queryOne<{ id: number; ok: number }>(
      "SELECT 1 AS id, 1 AS ok"
    );
    expect(row).toEqual({ id: 1, ok: 1 });
    expect(executeMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry non-transient SQL errors on read", async () => {
    const syntaxErr = Object.assign(new Error("no such table: missing_tbl"), {
      code: "SQLITE_ERROR",
    });
    const executeMock = vi.fn().mockRejectedValue(syntaxErr);
    const mockClient = createMockLibsqlClient({ execute: executeMock });
    const adapter = new TursoDbAdapter(mockClient, {
      requestTimeoutMs: 200,
      maxReadRetries: 2,
      baseRetryDelayMs: 5,
    });

    await expect(adapter.query("SELECT * FROM missing_tbl")).rejects.toThrow(
      /no such table/
    );
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry non-idempotent write operations (run, batch, transaction) on ambiguous transient errors", async () => {
    const networkErr = Object.assign(new Error("network timeout"), {
      code: "ETIMEDOUT",
    });
    const executeMock = vi.fn().mockRejectedValue(networkErr);
    const batchMock = vi.fn().mockRejectedValue(networkErr);
    const txMock = vi.fn().mockRejectedValue(networkErr);

    const mockClient = createMockLibsqlClient({
      execute: executeMock,
      batch: batchMock,
      transaction: txMock,
    });
    const adapter = new TursoDbAdapter(mockClient, {
      requestTimeoutMs: 200,
      maxReadRetries: 2,
      baseRetryDelayMs: 5,
    });

    await expect(
      adapter.run("UPDATE team_settings SET default_match_fee = ?", [120000])
    ).rejects.toThrow(/network timeout/);
    expect(executeMock).toHaveBeenCalledTimes(1);

    await expect(
      adapter.batch([{ sql: "DELETE FROM expenses WHERE id = ?", params: [99] }])
    ).rejects.toThrow(/network timeout/);
    expect(batchMock).toHaveBeenCalledTimes(1);

    await expect(
      adapter.transaction(async (tx) => tx.run("SELECT 1"))
    ).rejects.toThrow(/network timeout/);
    expect(txMock).toHaveBeenCalledTimes(1);
  });

  it("executes PRAGMA foreign_keys = ON via enableForeignKeys()", async () => {
    const executeMock = vi.fn().mockResolvedValue({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
      toJSON: () => ({}),
    });
    const mockClient = createMockLibsqlClient({ execute: executeMock });
    const adapter = new TursoDbAdapter(mockClient, { requestTimeoutMs: 200 });

    await adapter.enableForeignKeys();
    await adapter.enableForeignKeys(); // idempotent

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock).toHaveBeenCalledWith("PRAGMA foreign_keys = ON;");
  });

  it("resolves TURSO_REQUEST_TIMEOUT_MS with safe fallback to 5000ms", () => {
    expect(resolveTursoRequestTimeoutMs({ NODE_ENV: "test" })).toBe(5000);
    expect(
      resolveTursoRequestTimeoutMs({
        NODE_ENV: "test",
        TURSO_REQUEST_TIMEOUT_MS: "3000",
      })
    ).toBe(3000);
    expect(
      resolveTursoRequestTimeoutMs({
        NODE_ENV: "test",
        TURSO_REQUEST_TIMEOUT_MS: "-10",
      })
    ).toBe(5000);
    expect(
      resolveTursoRequestTimeoutMs({
        NODE_ENV: "test",
        TURSO_REQUEST_TIMEOUT_MS: "invalid",
      })
    ).toBe(5000);
  });

  it("enforces Turso in production/Vercel and supports local SQLite modes in dev/test", () => {
    const repoRoot = path.resolve(process.cwd());

    expect(() =>
      resolveDatabaseMode({ NODE_ENV: "production" }, repoRoot)
    ).toThrow(/TURSO_DATABASE_URL is required/i);

    expect(
      resolveDatabaseMode(
        {
          NODE_ENV: "production",
          TURSO_DATABASE_URL: "libsql://example-prod.turso.io",
          TURSO_AUTH_TOKEN: "dummy-prod-token",
        },
        repoRoot
      )
    ).toEqual({
      adapter: "turso",
      url: "libsql://example-prod.turso.io",
      authToken: "dummy-prod-token",
    });

    expect(resolveDatabaseMode({ NODE_ENV: "test" }, repoRoot)).toEqual({
      adapter: "local-sqlite-default",
      dbPath: path.join(repoRoot, "data", "gonoifc.sqlite"),
    });

    const tempQaPath = path.join(os.tmpdir(), "phase71-qa", "test.sqlite");
    expect(
      resolveDatabaseMode(
        {
          NODE_ENV: "development",
          USE_LOCAL_SQLITE: "true",
          SQLITE_DB_PATH: tempQaPath,
        },
        repoRoot
      )
    ).toEqual({
      adapter: "local-sqlite-qa",
      dbPath: tempQaPath,
    });
  });
});

describe("Phase 7.1 – getFullAppData & getPublicFinancialReportData projection compatibility", () => {
  it("returns projected FullAppData without leaking pin_code and supports public financial report", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gonoifc-p71-"));
    tempDirsToClean.push(tempDir);
    const tempDbPath = path.join(tempDir, "synthetic.sqlite");

    vi.stubEnv("NODE_ENV", "test");
    process.env.USE_LOCAL_SQLITE = "true";
    process.env.SQLITE_DB_PATH = tempDbPath;
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;

    vi.resetModules();
    const dbMod = await import("./db");

    const fullData = await dbMod.getFullAppData();
    expect(fullData.settings.id).toBe(1);
    expect(fullData.settings.team_name).toBeTruthy();
    expect(Array.isArray(fullData.players)).toBe(true);
    expect(fullData.players.length).toBeGreaterThan(0);

    for (const p of fullData.players) {
      expect(p.pin_code).toBe("");
      expect(Array.isArray(p.gallery_urls)).toBe(true);
      expect("gallery_urls_json" in p).toBe(false);
    }

    expect(Array.isArray(fullData.matches)).toBe(true);
    expect(Array.isArray(fullData.attendances)).toBe(true);
    expect(Array.isArray(fullData.otherIncomes)).toBe(true);
    expect(Array.isArray(fullData.expenses)).toBe(true);
    expect(Array.isArray(fullData.posts)).toBe(true);
    expect(Array.isArray(fullData.sponsors)).toBe(true);
    expect(typeof fullData.summary.currentBalance).toBe("number");

    const publicReportSource = await dbMod.getPublicFinancialReportData();
    const reportFromProjected = buildPublicFinancialReport(publicReportSource, {
      year: "all",
      month: "all",
      now: new Date("2026-06-01T00:00:00Z"),
    });
    const reportFromFull = buildPublicFinancialReport(fullData, {
      year: "all",
      month: "all",
      now: new Date("2026-06-01T00:00:00Z"),
    });

    expect(reportFromProjected.summary).toEqual(reportFromFull.summary);
    expect(reportFromProjected.teamName).toBe(reportFromFull.teamName);
    expect(reportFromProjected.tournamentReserve).toBe(
      reportFromFull.tournamentReserve
    );
    expect(reportFromProjected.monthlyTrend).toEqual(reportFromFull.monthlyTrend);

    try {
      dbMod.getDb().close();
    } catch {
      // ignore if already closed
    }
  });
});

describe("F7.1-14 – Deterministic TursoDbAdapter Foreign-Key Initialization", () => {
  it("runs initialization once across 20 concurrent first queries and blocks queries/writes/transactions until ready", async () => {
    const events: string[] = [];
    let pragmaCount = 0;
    let releasePragma!: () => void;
    const pragmaGate = new Promise<void>((resolve) => {
      releasePragma = resolve;
    });

    const mockClient = {
      execute: vi.fn(async (stmt: unknown) => {
        const sql =
          typeof stmt === "string"
            ? stmt
            : (stmt as { sql: string }).sql;
        if (sql.includes("PRAGMA foreign_keys")) {
          pragmaCount += 1;
          events.push("pragma:start");
          await pragmaGate;
          events.push("pragma:done");
          return { rows: [], rowsAffected: 0, lastInsertRowid: 0n };
        }
        events.push(`op:${sql}`);
        return { rows: [{ ok: 1 }], rowsAffected: 1, lastInsertRowid: 1n };
      }),
      batch: vi.fn(async () => {
        events.push("op:batch");
        return [];
      }),
      executeMultiple: vi.fn(async () => {
        events.push("op:exec");
      }),
      transaction: vi.fn(async () => ({
        execute: vi.fn(async () => {
          events.push("op:tx.execute");
          return { rows: [], rowsAffected: 1, lastInsertRowid: 1n };
        }),
        executeMultiple: vi.fn(async () => undefined),
        commit: vi.fn(async () => undefined),
        rollback: vi.fn(async () => undefined),
        close: vi.fn(),
      })),
    };

    const adapter = new TursoDbAdapter(
      mockClient as unknown as import("@libsql/client").Client,
      { requestTimeoutMs: 1000, maxReadRetries: 0 }
    );

    const concurrentOps = [
      ...Array.from({ length: 20 }, (_, i) =>
        adapter.query(`SELECT ${i}`)
      ),
      adapter.run("INSERT INTO t VALUES (1)"),
      adapter.batch([{ sql: "INSERT INTO t VALUES (2)" }]),
      adapter.transaction(async (tx) => {
        await tx.run("INSERT INTO t VALUES (3)");
      }),
    ];

    // Give microtasks a chance to start; no query/write/tx should run before pragma finishes
    await Promise.resolve();
    await Promise.resolve();
    expect(pragmaCount).toBe(1);
    expect(events).toEqual(["pragma:start"]);

    releasePragma();
    await Promise.all(concurrentOps);

    expect(pragmaCount).toBe(1);
    expect(events[0]).toBe("pragma:start");
    expect(events[1]).toBe("pragma:done");
    expect(events.length).toBe(25);
  });

  it("rejects all waiting callers on initialization failure and retries cleanly on next call", async () => {
    let failInit = true;
    const mockClient = {
      execute: vi.fn(async (stmt: unknown) => {
        const sql =
          typeof stmt === "string"
            ? stmt
            : (stmt as { sql: string }).sql;
        if (sql.includes("PRAGMA foreign_keys")) {
          if (failInit) {
            throw new Error("FK_INIT_FAILED");
          }
          return { rows: [], rowsAffected: 0, lastInsertRowid: 0n };
        }
        return { rows: [{ ok: 1 }], rowsAffected: 0, lastInsertRowid: 0n };
      }),
    };

    const adapter = new TursoDbAdapter(
      mockClient as unknown as import("@libsql/client").Client,
      { requestTimeoutMs: 500, maxReadRetries: 0 }
    );

    const results = await Promise.allSettled([
      adapter.query("SELECT 1"),
      adapter.run("INSERT INTO t VALUES (1)"),
    ]);

    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("rejected");

    // Not silently marked ready: next call retries initialization and succeeds when healthy
    failInit = false;
    const rows = await adapter.query<{ ok: number }>("SELECT 1");
    expect(rows).toEqual([{ ok: 1 }]);
  });
});
