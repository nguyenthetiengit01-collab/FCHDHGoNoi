import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gonoi-v3-drill-"));

describe("Backup/Restore v3 – Full Schema Completeness & Backward Compatibility", () => {
  afterAll(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore Windows file lock cleanup warnings
      }
    }
  });

  it("backs up and restores full v3 schema, typed values (incl. BLOB), views, indexes, triggers, and FKs", () => {
    const fixtureDbPath = path.join(tmpDir, "fixture.sqlite");
    const backupJsonPath = path.join(tmpDir, "fixture-v3.json");
    const restoredDbPath = path.join(tmpDir, "restored.sqlite");

    const blobBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x42]);

    const srcDb = new DatabaseSync(fixtureDbPath);
    try {
      srcDb.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE departments (
          id INTEGER PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL
        );
        CREATE TABLE entries (
          id INTEGER PRIMARY KEY,
          dept_id INTEGER NOT NULL REFERENCES departments(id),
          tag TEXT,
          status TEXT NOT NULL CHECK(status IN ('active', 'archived')),
          amount INTEGER NOT NULL CHECK(amount >= 0),
          ratio REAL,
          notes TEXT,
          payload BLOB
        );
        CREATE TABLE trigger_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER NOT NULL,
          note TEXT NOT NULL
        );

        CREATE INDEX idx_entries_dept_status ON entries(dept_id, status);
        CREATE UNIQUE INDEX idx_entries_active_tag ON entries(tag) WHERE status = 'active';

        CREATE VIEW v_dept_summary AS
          SELECT d.code, COUNT(v.id) AS active_count, COALESCE(SUM(v.amount), 0) AS total_amount
          FROM departments d
          LEFT JOIN v_active_entries v ON v.dept_id = d.id
          GROUP BY d.id;

        CREATE VIEW v_active_entries AS
          SELECT id, dept_id, tag, amount, ratio
          FROM entries
          WHERE status = 'active';

        CREATE TRIGGER trg_entries_after_insert
        AFTER INSERT ON entries
        BEGIN
          INSERT INTO trigger_log(entry_id, note) VALUES (NEW.id, 'inserted:' || NEW.status);
        END;
      `);

      srcDb.prepare("INSERT INTO departments (id, code, name) VALUES (?, ?, ?)").run(1, "ENG", "Engineering");
      srcDb
        .prepare(
          "INSERT INTO entries (id, dept_id, tag, status, amount, ratio, notes, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(10, 1, "alpha", "active", 250, 12.75, null, blobBytes);
      srcDb
        .prepare(
          "INSERT INTO entries (id, dept_id, tag, status, amount, ratio, notes, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(11, 1, "alpha", "archived", 50, 0.5, "archived note", null);
    } finally {
      srcDb.close();
    }

    // 1. Run Backup v3
    const backupRes = spawnSync(
      process.execPath,
      ["scripts/db-backup.mjs", "--sqlite", fixtureDbPath, "--out", backupJsonPath],
      { cwd: process.cwd(), encoding: "utf8" }
    );
    expect(backupRes.status).toBe(0);

    const backupPayload = JSON.parse(fs.readFileSync(backupJsonPath, "utf8"));
    expect(backupPayload.version).toBe(3);
    expect(backupPayload.createdAt).toBeTruthy();
    expect(backupPayload.objects.tables.map((t: { name: string }) => t.name).sort()).toEqual([
      "departments",
      "entries",
      "trigger_log",
    ]);
    expect(backupPayload.objects.indexes.map((i: { name: string }) => i.name).sort()).toEqual([
      "idx_entries_active_tag",
      "idx_entries_dept_status",
    ]);
    expect(backupPayload.objects.views.map((v: { name: string }) => v.name).sort()).toEqual([
      "v_active_entries",
      "v_dept_summary",
    ]);
    expect(backupPayload.objects.triggers.map((t: { name: string }) => t.name)).toEqual([
      "trg_entries_after_insert",
    ]);
    expect(backupPayload.rowCounts).toEqual({
      departments: 1,
      entries: 2,
      trigger_log: 2,
    });

    // 2. Run Restore v3
    const restoreRes = spawnSync(
      process.execPath,
      ["scripts/db-restore.mjs", "--in", backupJsonPath, "--target", restoredDbPath, "--confirm"],
      { cwd: process.cwd(), encoding: "utf8" }
    );
    expect(restoreRes.status).toBe(0);
    const restoreOut = JSON.parse(restoreRes.stdout);
    expect(restoreOut.status).toBe("ok");
    expect(restoreOut.version).toBe(3);

    // 3-9. Verify schema, row counts, typed values, partial unique index, trigger, views, FKs
    const dstDb = new DatabaseSync(restoredDbPath);
    try {
      const masterObjects = dstDb
        .prepare(
          "SELECT name, type FROM sqlite_master WHERE type IN ('table','index','view','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type, name"
        )
        .all() as Array<{ name: string; type: string }>;
      expect(masterObjects).toEqual([
        { name: "idx_entries_active_tag", type: "index" },
        { name: "idx_entries_dept_status", type: "index" },
        { name: "departments", type: "table" },
        { name: "entries", type: "table" },
        { name: "trigger_log", type: "table" },
        { name: "trg_entries_after_insert", type: "trigger" },
        { name: "v_active_entries", type: "view" },
        { name: "v_dept_summary", type: "view" },
      ]);

      // Typed data + BLOB integrity
      const row10 = dstDb.prepare("SELECT * FROM entries WHERE id = 10").get() as Record<string, unknown>;
      expect(row10.amount).toBe(250);
      expect(row10.ratio).toBeCloseTo(12.75);
      expect(row10.notes).toBeNull();
      expect(Buffer.from(row10.payload as Uint8Array)).toEqual(Buffer.from(blobBytes));

      // Trigger did NOT duplicate historical rows during restore
      const logCountBefore = dstDb.prepare("SELECT COUNT(*) AS c FROM trigger_log").get() as { c: number };
      expect(logCountBefore.c).toBe(2);

      // View results (including dependent v_dept_summary)
      const summary = dstDb.prepare("SELECT * FROM v_dept_summary").get() as {
        code: string;
        active_count: number;
        total_amount: number;
      };
      expect(summary).toEqual({ code: "ENG", active_count: 1, total_amount: 250 });

      // Partial unique index behavior
      expect(() =>
        dstDb
          .prepare("INSERT INTO entries (id, dept_id, tag, status, amount) VALUES (?, ?, ?, ?, ?)")
          .run(12, 1, "alpha", "active", 10)
      ).toThrow(/UNIQUE/i);

      // Archived duplicate tag is allowed by partial unique index AND fires trigger
      dstDb
        .prepare("INSERT INTO entries (id, dept_id, tag, status, amount) VALUES (?, ?, ?, ?, ?)")
        .run(13, 1, "alpha", "archived", 15);
      const logCountAfter = dstDb.prepare("SELECT COUNT(*) AS c FROM trigger_log").get() as { c: number };
      expect(logCountAfter.c).toBe(3);

      // Foreign key constraint enforcement
      dstDb.exec("PRAGMA foreign_keys = ON;");
      expect(() =>
        dstDb
          .prepare("INSERT INTO entries (id, dept_id, tag, status, amount) VALUES (?, ?, ?, ?, ?)")
          .run(14, 999, "beta", "active", 10)
      ).toThrow(/FOREIGN KEY/i);

      // Check constraint enforcement
      expect(() =>
        dstDb
          .prepare("INSERT INTO entries (id, dept_id, tag, status, amount) VALUES (?, ?, ?, ?, ?)")
          .run(15, 1, "beta", "active", -5)
      ).toThrow(/CHECK/i);
    } finally {
      dstDb.close();
    }
  });

  it("supports backward-compatible v2 restore and rejects invalid/unsupported backup files", () => {
    const v2JsonPath = path.join(tmpDir, "backup-v2.json");
    const v2TargetPath = path.join(tmpDir, "restored-v2.sqlite");
    const invalidJsonPath = path.join(tmpDir, "backup-invalid.json");

    fs.writeFileSync(
      v2JsonPath,
      JSON.stringify({
        version: 2,
        createdAt: new Date().toISOString(),
        schema: {
          items: "CREATE TABLE items (id INTEGER PRIMARY KEY, label TEXT NOT NULL)",
        },
        rowCounts: { items: 1 },
        tables: {
          items: [{ id: 1, label: "legacy-v2-row" }],
        },
      }),
      "utf8"
    );

    const v2Res = spawnSync(
      process.execPath,
      ["scripts/db-restore.mjs", "--in", v2JsonPath, "--target", v2TargetPath, "--confirm"],
      { cwd: process.cwd(), encoding: "utf8" }
    );
    expect(v2Res.status).toBe(0);
    const v2Out = JSON.parse(v2Res.stdout);
    expect(v2Out.version).toBe(2);
    expect(v2Out.restoredCounts).toEqual({ items: 1 });

    // Unsupported version must be rejected cleanly
    fs.writeFileSync(
      invalidJsonPath,
      JSON.stringify({ version: 99, tables: {} }),
      "utf8"
    );
    const invalidRes = spawnSync(
      process.execPath,
      ["scripts/db-restore.mjs", "--in", invalidJsonPath, "--target", v2TargetPath, "--confirm"],
      { cwd: process.cwd(), encoding: "utf8" }
    );
    expect(invalidRes.status).toBe(1);
    expect(invalidRes.stderr).toContain("Unsupported backup format version");
  });

  it("preserves AUTOINCREMENT sqlite_sequence after highest ID deletion (100 deleted -> next insert is 101)", () => {
    const autoSrcPath = path.join(tmpDir, "auto-src.sqlite");
    const autoBackupPath = path.join(tmpDir, "auto-v3.json");
    const autoDstPath = path.join(tmpDir, "auto-dst.sqlite");

    const src = new DatabaseSync(autoSrcPath);
    try {
      src.exec(`
        CREATE TABLE auto_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          label TEXT NOT NULL
        );
      `);
      const insertStmt = src.prepare("INSERT INTO auto_items (label) VALUES (?)");
      for (let i = 1; i <= 100; i++) {
        insertStmt.run(`item-${i}`);
      }
      src.exec("DELETE FROM auto_items WHERE id = 100;");
    } finally {
      src.close();
    }

    const bRes = spawnSync(
      process.execPath,
      ["scripts/db-backup.mjs", "--sqlite", autoSrcPath, "--out", autoBackupPath],
      { cwd: process.cwd(), encoding: "utf8" }
    );
    expect(bRes.status).toBe(0);

    const backupObj = JSON.parse(fs.readFileSync(autoBackupPath, "utf8"));
    expect(backupObj.sequences).toEqual([{ name: "auto_items", seq: 100 }]);
    expect(backupObj.rowCounts.auto_items).toBe(99);

    const rRes = spawnSync(
      process.execPath,
      ["scripts/db-restore.mjs", "--in", autoBackupPath, "--target", autoDstPath, "--confirm"],
      { cwd: process.cwd(), encoding: "utf8" }
    );
    expect(rRes.status).toBe(0);

    const dst = new DatabaseSync(autoDstPath);
    try {
      const inserted = dst.prepare("INSERT INTO auto_items (label) VALUES (?)").run("new-after-restore");
      expect(Number(inserted.lastInsertRowid)).toBe(101);
    } finally {
      dst.close();
    }
  });

  it("detects foreign key violations via PRAGMA foreign_key_check and fails restore without reporting PASS", () => {
    const fkInvalidBackupPath = path.join(tmpDir, "fk-invalid-v3.json");
    const fkTargetPath = path.join(tmpDir, "fk-invalid.sqlite");

    fs.writeFileSync(
      fkInvalidBackupPath,
      JSON.stringify({
        version: 3,
        createdAt: new Date().toISOString(),
        objects: {
          tables: [
            { name: "parents", tbl_name: "parents", sql: "CREATE TABLE parents (id INTEGER PRIMARY KEY)" },
            {
              name: "children",
              tbl_name: "children",
              sql: "CREATE TABLE children (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES parents(id))",
            },
          ],
          indexes: [],
          triggers: [],
          views: [],
        },
        schema: {
          parents: "CREATE TABLE parents (id INTEGER PRIMARY KEY)",
          children:
            "CREATE TABLE children (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES parents(id))",
        },
        sequences: [],
        rowCounts: { parents: 1, children: 1 },
        tables: {
          parents: [{ id: 1 }],
          children: [{ id: 10, parent_id: 999 }],
        },
      }),
      "utf8"
    );

    const res = spawnSync(
      process.execPath,
      ["scripts/db-restore.mjs", "--in", fkInvalidBackupPath, "--target", fkTargetPath, "--confirm"],
      { cwd: process.cwd(), encoding: "utf8" }
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("Foreign key integrity check failed");
    expect(res.stdout).not.toContain('"status": "ok"');
  });
});
