import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gonoi-backup-sec-"));

describe("Final Backup Security Hardening – Encryption & Workflow Validation", () => {
  afterAll(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore Windows SQLite file lock cleanup warnings
      }
    }
  });

  it("encrypts v3 backup with public key only, rejects tampering/wrong key, decrypts, and restores cleanly", () => {
    const srcDbPath = path.join(tmpDir, "sensitive-src.sqlite");
    const plainBackupPath = path.join(tmpDir, "plain-v3.json");
    const encBackupPath = path.join(tmpDir, "plain-v3.json.enc");
    const decryptedBackupPath = path.join(tmpDir, "decrypted-v3.json");
    const restoredDbPath = path.join(tmpDir, "restored.sqlite");

    const db = new DatabaseSync(srcDbPath);
    try {
      db.exec(`
        CREATE TABLE players (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          full_name TEXT NOT NULL,
          phone TEXT NOT NULL,
          pin_code TEXT NOT NULL
        );
      `);
      db.prepare("INSERT INTO players (full_name, phone, pin_code) VALUES (?, ?, ?)").run(
        "Nguyen Van A",
        "0909123456",
        "scrypt$salt$hashsecret999"
      );
    } finally {
      db.close();
    }

    // 1. Keygen
    const keygenRes = spawnSync(process.execPath, ["scripts/backup-crypto.mjs", "keygen"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(keygenRes.status).toBe(0);
    const { publicKey, privateKey } = JSON.parse(keygenRes.stdout) as {
      publicKey: string;
      privateKey: string;
    };
    expect(publicKey.startsWith("gonoi-pub-v1:")).toBe(true);
    expect(privateKey.startsWith("gonoi-priv-v1:")).toBe(true);

    // 2. Backup v3
    const bRes = spawnSync(
      process.execPath,
      ["scripts/db-backup.mjs", "--sqlite", srcDbPath, "--out", plainBackupPath],
      { cwd: process.cwd(), encoding: "utf8" }
    );
    expect(bRes.status).toBe(0);

    // 3. Failure case: missing public key
    const missingKeyEnc = spawnSync(
      process.execPath,
      ["scripts/backup-crypto.mjs", "encrypt", "--in", plainBackupPath, "--out", encBackupPath],
      {
        cwd: process.cwd(),
        env: { ...process.env, BACKUP_ENCRYPTION_PUBLIC_KEY: "" },
        encoding: "utf8",
      }
    );
    expect(missingKeyEnc.status).toBe(1);

    // 4. Encrypt with public key ONLY
    const encRes = spawnSync(
      process.execPath,
      ["scripts/backup-crypto.mjs", "encrypt", "--in", plainBackupPath, "--out", encBackupPath],
      {
        cwd: process.cwd(),
        env: { ...process.env, BACKUP_ENCRYPTION_PUBLIC_KEY: publicKey },
        encoding: "utf8",
      }
    );
    expect(encRes.status).toBe(0);

    const encRaw = fs.readFileSync(encBackupPath, "utf8");
    expect(encRaw).not.toContain("0909123456");
    expect(encRaw).not.toContain("scrypt$salt$hashsecret999");
    expect(encRaw).not.toContain("Nguyen Van A");

    const encJson = JSON.parse(encRaw) as {
      keyId: string;
      ciphertext: string;
      tag: string;
    };
    expect(encJson.keyId).toMatch(/^k1-[0-9a-f]{16}$/);

    // 5. Reject wrong private key (with keyId mismatch)
    const wrongKeygen = JSON.parse(
      spawnSync(process.execPath, ["scripts/backup-crypto.mjs", "keygen"], {
        cwd: process.cwd(),
        encoding: "utf8",
      }).stdout
    ) as { privateKey: string };

    const wrongDec = spawnSync(
      process.execPath,
      ["scripts/backup-crypto.mjs", "decrypt", "--in", encBackupPath, "--out", decryptedBackupPath],
      {
        cwd: process.cwd(),
        env: { ...process.env, BACKUP_DECRYPTION_PRIVATE_KEY: wrongKeygen.privateKey },
        encoding: "utf8",
      }
    );
    expect(wrongDec.status).toBe(1);
    expect(wrongDec.stderr).toContain("keyId mismatch");
    expect(fs.existsSync(decryptedBackupPath)).toBe(false);

    // 5b. Reject 1-byte ciphertext tampering & 1-byte GCM tag tampering
    const tamperedCipherPath = path.join(tmpDir, "tampered-cipher.enc");
    const tamperedTagPath = path.join(tmpDir, "tampered-tag.enc");
    const tamperedOutPath = path.join(tmpDir, "should-not-exist.json");

    const cipherBuf = Buffer.from(encJson.ciphertext, "base64");
    cipherBuf[0] ^= 0xff;
    fs.writeFileSync(
      tamperedCipherPath,
      JSON.stringify({ ...encJson, ciphertext: cipherBuf.toString("base64") }),
      "utf8"
    );
    const cipherTamperRes = spawnSync(
      process.execPath,
      ["scripts/backup-crypto.mjs", "decrypt", "--in", tamperedCipherPath, "--out", tamperedOutPath],
      {
        cwd: process.cwd(),
        env: { ...process.env, BACKUP_DECRYPTION_PRIVATE_KEY: privateKey },
        encoding: "utf8",
      }
    );
    expect(cipherTamperRes.status).not.toBe(0);
    expect(fs.existsSync(tamperedOutPath)).toBe(false);

    const tagBuf = Buffer.from(encJson.tag, "base64");
    tagBuf[0] ^= 0xff;
    fs.writeFileSync(
      tamperedTagPath,
      JSON.stringify({ ...encJson, tag: tagBuf.toString("base64") }),
      "utf8"
    );
    const tagTamperRes = spawnSync(
      process.execPath,
      ["scripts/backup-crypto.mjs", "decrypt", "--in", tamperedTagPath, "--out", tamperedOutPath],
      {
        cwd: process.cwd(),
        env: { ...process.env, BACKUP_DECRYPTION_PRIVATE_KEY: privateKey },
        encoding: "utf8",
      }
    );
    expect(tagTamperRes.status).not.toBe(0);
    expect(fs.existsSync(tamperedOutPath)).toBe(false);

    // 6. Decrypt via --private-key-file & restore
    const privKeyFile = path.join(tmpDir, "priv.key");
    fs.writeFileSync(privKeyFile, privateKey, { mode: 0o600 });
    const decRes = spawnSync(
      process.execPath,
      [
        "scripts/backup-crypto.mjs",
        "decrypt",
        "--in",
        encBackupPath,
        "--out",
        decryptedBackupPath,
        "--private-key-file",
        privKeyFile,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );
    expect(decRes.status).toBe(0);

    const restoreRes = spawnSync(
      process.execPath,
      ["scripts/db-restore.mjs", "--in", decryptedBackupPath, "--target", restoredDbPath, "--confirm"],
      { cwd: process.cwd(), encoding: "utf8" }
    );
    expect(restoreRes.status).toBe(0);

    const dstDb = new DatabaseSync(restoredDbPath);
    try {
      const row = dstDb.prepare("SELECT full_name, phone, pin_code FROM players").get() as {
        full_name: string;
        phone: string;
        pin_code: string;
      };
      expect(row).toEqual({
        full_name: "Nguyen Van A",
        phone: "0909123456",
        pin_code: "scrypt$salt$hashsecret999",
      });
    } finally {
      dstDb.close();
    }
  });

  it("validates .github/workflows/turso-backup.yml hardening, SHA pinning, and no plaintext upload", () => {
    const workflowPath = path.resolve(".github/workflows/turso-backup.yml");
    expect(fs.existsSync(workflowPath)).toBe(true);
    const yml = fs.readFileSync(workflowPath, "utf8");

    expect(yml).toContain('cron: "0 20 * * 0"');
    expect(yml).toContain("workflow_dispatch:");
    expect(yml).toContain("if: github.ref == 'refs/heads/main'");
    expect(yml).toContain("contents: read");
    expect(yml).toContain("cancel-in-progress: false");
    expect(yml).toContain("timeout-minutes: 15");
    expect(yml).not.toContain("continue-on-error");

    // All uses: must be pinned to a 40-char commit SHA
    const usesMatches = Array.from(yml.matchAll(/uses:\s*([^\s#]+)/g)).map((m) => m[1]);
    expect(usesMatches.length).toBeGreaterThanOrEqual(3);
    for (const ref of usesMatches) {
      expect(ref).toMatch(/^[^@]+@[0-9a-f]{40}$/);
    }

    // Secrets & encryption checks
    expect(yml).toContain("secrets.TURSO_PROD_DATABASE_URL");
    expect(yml).toContain("secrets.TURSO_PROD_AUTH_TOKEN_RO");
    expect(yml).toContain("secrets.TURSO_BACKUP_PUBLIC_KEY");
    expect(yml).not.toContain("BACKUP_DECRYPTION_PRIVATE_KEY");
    expect(yml).toContain("rm -f /tmp/gonoi-prod-backup.json");
    expect(yml).toContain("path: /tmp/gonoi-prod-backup.json.enc");
    expect(yml).toContain("retention-days: 30");
    expect(yml).toContain("if-no-files-found: error");
    expect(yml).toContain("if: always()");

    // No step echoes secret values
    expect(yml).not.toMatch(/echo\s+.*(TURSO_AUTH_TOKEN|TURSO_DATABASE_URL|BACKUP_ENCRYPTION_PUBLIC_KEY)/);
  });

  it("captures a consistent point-in-time snapshot inside client.transaction('read') during concurrent writes", async () => {
    const snapDbPath = path.join(tmpDir, "snapshot-concurrent.sqlite");
    const setupDb = new DatabaseSync(snapDbPath);
    try {
      setupDb.exec(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE parent_a (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL);
        CREATE TABLE child_b (id INTEGER PRIMARY KEY AUTOINCREMENT, parent_id INTEGER NOT NULL REFERENCES parent_a(id));
        INSERT INTO parent_a (id, label) VALUES (1, 'initial-parent');
        INSERT INTO child_b (id, parent_id) VALUES (10, 1);
      `);
    } finally {
      setupDb.close();
    }

    const { backupFromTurso } = await import("../../scripts/db-backup.mjs");
    const fileUrl = `file:${snapDbPath.replace(/\\/g, "/")}`;

    const writerDb = new DatabaseSync(snapDbPath);
    let wroteConcurrently = false;
    try {
      const result = (await backupFromTurso(fileUrl, undefined, {
        onBeforeTableRead: async (tableName: string) => {
          if (tableName === "child_b" && !wroteConcurrently) {
            wroteConcurrently = true;
            // Concurrent write committed after read transaction already started and read parent_a
            writerDb.exec("INSERT INTO parent_a (id, label) VALUES (2, 'concurrent-parent');");
            writerDb.exec("INSERT INTO child_b (id, parent_id) VALUES (20, 2);");
          }
        },
      })) as unknown as {
        rowCounts: Record<string, number>;
        sequences: Array<{ name: string; seq: number }>;
      };

      expect(wroteConcurrently).toBe(true);
      expect(result.rowCounts.parent_a).toBe(1);
      expect(result.rowCounts.child_b).toBe(1);
      expect(result.sequences).toEqual([
        { name: "child_b", seq: 10 },
        { name: "parent_a", seq: 1 },
      ]);
    } finally {
      writerDb.close();
    }
  });
});
