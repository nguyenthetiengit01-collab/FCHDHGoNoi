import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getLegacyMediaRoute } from "@/app/api/media/legacy/route";
import { POST as postMediaUploadRoute } from "@/app/api/media/upload/route";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import type { AsyncDb } from "@/lib/db";
import { ensureWebpDataUrlServer, MediaValidationError } from "@/lib/serverWebp";
import { getPublicHomePageData, toPublicMediaSrc } from "@/lib/publicHome";
import { migrateLegacyMedia } from "./migration";
import {
  __setMediaStorageProviderForTest,
  MediaStorageError,
  validatePublicMediaAsset,
} from "./storage";
import { isSafeMediaUrl } from "./validation";

const tempDirs: string[] = [];

async function makeTinyWebpBuffer(): Promise<Buffer> {
  return await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 80, b: 40 } },
  })
    .webp({ quality: 80 })
    .toBuffer();
}

function createTempAppDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-wb-"));
  tempDirs.push(dir);
  const sqlitePath = path.join(dir, "wb.sqlite");
  const raw = new DatabaseSync(sqlitePath);
  raw.exec(`
    CREATE TABLE team_settings (
      id INTEGER PRIMARY KEY,
      team_name TEXT, short_name TEXT, default_match_fee INTEGER,
      bank_bin TEXT, bank_name TEXT, bank_account_no TEXT, bank_account_name TEXT,
      tournament_fund_reserve INTEGER, tournament_fund_note TEXT, fanpage_url TEXT
    );
    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_order INTEGER DEFAULT 0,
      full_name TEXT NOT NULL,
      short_name TEXT,
      jersey_number INTEGER,
      position TEXT,
      birth_year INTEGER,
      phone TEXT,
      role TEXT,
      status TEXT,
      access_role TEXT DEFAULT 'player',
      pin_code TEXT,
      notes TEXT,
      hometown TEXT,
      nickname TEXT,
      playing_style TEXT,
      bio TEXT,
      avatar_url TEXT,
      profile_image_url TEXT,
      gallery_urls_json TEXT
    );
    CREATE TABLE matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_number INTEGER, label TEXT, match_date TEXT, kickoff_time TEXT, venue TEXT,
      opponent TEXT, fee_per_player INTEGER, pitch_cost INTEGER, payer_name TEXT,
      team_score INTEGER, opponent_score INTEGER, status TEXT, notes TEXT
    );
    CREATE TABLE match_attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER, player_id INTEGER, rsvp_status TEXT, attended INTEGER,
      paid INTEGER, amount INTEGER, walk_in INTEGER, collected_by TEXT, note TEXT
    );
    CREATE TABLE club_posts (
      id TEXT PRIMARY KEY,
      category TEXT, category_label TEXT, category_badge_class TEXT,
      title TEXT, slug TEXT, summary TEXT, published_date TEXT,
      event_year TEXT, author TEXT, featured_image TEXT,
      gallery_images_json TEXT, reading_time TEXT, paragraphs_json TEXT,
      quote TEXT, highlights_json TEXT, tagged_players_json TEXT
    );
    CREATE TABLE sponsors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, tier TEXT, logo_url TEXT, banner_url TEXT,
      website_url TEXT, description TEXT, start_date TEXT, end_date TEXT,
      display_positions_json TEXT, is_active INTEGER, sort_order INTEGER, note TEXT
    );
    CREATE TABLE other_incomes (id INTEGER PRIMARY KEY AUTOINCREMENT, amount INTEGER);
    CREATE TABLE expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, amount INTEGER);
  `);

  const db: AsyncDb = {
    async query<T>(sql: string, args: unknown[] = []): Promise<T[]> {
      return raw.prepare(sql).all(...(args as never[])) as T[];
    },
    async queryOne<T>(sql: string, args: unknown[] = []): Promise<T | null> {
      return (raw.prepare(sql).get(...(args as never[])) as T | undefined) ?? null;
    },
    async run(sql: string, args: unknown[] = []) {
      const res = raw.prepare(sql).run(...(args as never[]));
      return {
        changes: Number(res.changes || 0),
        lastInsertRowid: Number(res.lastInsertRowid || 0),
      };
    },
    async exec(sql: string) {
      raw.exec(sql);
    },
    async batch(statements: Array<{ sql: string; params?: unknown[] }>) {
      for (const s of statements) {
        raw.prepare(s.sql).run(...((s.params ?? []) as never[]));
      }
    },
    async transaction<T>(fn: (tx: AsyncDb) => Promise<T>): Promise<T> {
      raw.exec("BEGIN IMMEDIATE;");
      try {
        const res = await fn(db);
        raw.exec("COMMIT;");
        return res;
      } catch (err) {
        raw.exec("ROLLBACK;");
        throw err;
      }
    },
  };

  return { sqlitePath, raw, db };
}

afterEach(() => {
  delete process.env.MEDIA_STORAGE_ENABLED;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.USE_LOCAL_SQLITE;
  delete process.env.SQLITE_DB_PATH;
  __setMediaStorageProviderForTest(null);
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore Windows handle race
    }
  }
});

describe("Workstream B — Public Homepage DTO & Legacy Compatibility", () => {
  it("strips PII, base64 data URIs, full article bodies, galleries, ledger rows, and sponsor notes from homepage DTO", async () => {
    const webpBuf = await makeTinyWebpBuffer();
    const dataUri = `data:image/webp;base64,${webpBuf.toString("base64")}`;
    const { sqlitePath, raw } = createTempAppDb();

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, jersey_number, position, birth_year, phone, role, status, access_role, pin_code, notes, avatar_url, profile_image_url, gallery_urls_json)
         VALUES (1, 'Nguyen Van A', 'Van A', 10, 'MF', 1995, '0909123456', 'Thành viên', 'Đang sinh hoạt', 'manager', 'scrypt$salt$hash', 'private note', ?, ?, ?)`
      ).run(dataUri, "https://blob.example/p1.webp", JSON.stringify([dataUri, "https://blob.example/g1.webp"]));

      raw.prepare(
        `INSERT INTO club_posts (id, category, category_label, category_badge_class, title, slug, summary, published_date, event_year, author, featured_image, gallery_images_json, reading_time, paragraphs_json, highlights_json, tagged_players_json)
         VALUES ('post-1', 'giai-dau', 'Giải đấu', 'bg-gold', 'Title 1', 'post-1', 'Short summary', '2026-11-10', '2026', 'BQL', ?, ?, '3 phút', ?, '[]', '[]')`
      ).run(dataUri, JSON.stringify([dataUri]), JSON.stringify(["Very long paragraph 1", "Paragraph 2"]));

      raw.prepare(
        `INSERT INTO sponsors (name, tier, logo_url, banner_url, website_url, description, display_positions_json, is_active, sort_order, note)
         VALUES ('Sponsor 1', 'title', ?, 'https://blob.example/banner.webp', 'https://example.com', 'Tag', '[]', 1, 1, 'internal secret note')`
      ).run(dataUri);

      raw.prepare("INSERT INTO other_incomes (amount) VALUES (500000)").run();
      raw.prepare("INSERT INTO expenses (amount) VALUES (300000)").run();
      raw.close();

      process.env.USE_LOCAL_SQLITE = "true";
      process.env.SQLITE_DB_PATH = sqlitePath;

      const home = await getPublicHomePageData();
      const serialized = JSON.stringify(home);

      expect(serialized).not.toContain("data:image/");
      expect(serialized).not.toContain("0909123456");
      expect(serialized).not.toContain("scrypt$salt$hash");
      expect(serialized).not.toContain("private note");
      expect(serialized).not.toContain("Very long paragraph 1");
      expect(serialized).not.toContain("internal secret note");

      expect(home.players[0].avatar_url).toBe("/api/media/legacy?entity=player&id=1&field=avatar");
      expect(home.players[0].profile_image_url).toBe("https://blob.example/p1.webp");
      expect(home.players[0].gallery_urls).toEqual([]);
      expect(home.posts?.[0].featuredImage).toBe("/api/media/legacy?entity=post&id=1&field=featured");
      expect(home.posts?.[0].paragraphs).toEqual([]);
      expect(home.posts?.[0].galleryImages).toEqual([]);
      expect(home.sponsors?.[0].logo_url).toBe("/api/media/legacy?entity=sponsor&id=1&field=logo");
      expect(home.sponsors?.[0].note).toBe("");
      expect(home.otherIncomes).toEqual([]);
      expect(home.expenses).toEqual([]);

      // Legacy media endpoint serves the exact WebP bytes cleanly
      const legacyRes = await getLegacyMediaRoute(
        new NextRequest("http://localhost/api/media/legacy?entity=player&id=1&field=avatar")
      );
      expect(legacyRes.status).toBe(200);
      expect(legacyRes.headers.get("content-type")).toBe("image/webp");
      expect(Buffer.from(await legacyRes.arrayBuffer()).equals(webpBuf)).toBe(true);
    } finally {
      try {
        raw.close();
      } catch {
        // Ignore
      }
    }
  });

  it("validates safe media URLs and rejects unsafe schemes", () => {
    expect(isSafeMediaUrl("https://public.blob.vercel-storage.com/a.webp")).toBe(true);
    expect(isSafeMediaUrl("/images/logo.jpg")).toBe(true);
    expect(isSafeMediaUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMediaUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(toPublicMediaSrc("javascript:alert(1)", { entity: "player", id: 1, field: "avatar" })).toBe("");
  });
});

describe("Workstream B — Media Storage Upload, Auth & Feature Flag", () => {
  it("enforces auth, RBAC, ownership, MIME/magic-bytes, and fail-closed storage config", async () => {
    const webpBuf = await makeTinyWebpBuffer();

    const makeUploadReq = (file: File, entity: string, cookie?: string, playerId?: string) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity", entity);
      if (playerId) fd.append("playerId", playerId);
      const headers: Record<string, string> = { Host: "localhost", Origin: "http://localhost" };
      if (cookie) headers.Cookie = `${SESSION_COOKIE_NAME}=${cookie}`;
      return new NextRequest("http://localhost/api/media/upload", {
        method: "POST",
        headers,
        body: fd,
      });
    };

    const playerCookie = createSessionToken({
      id: 2,
      code_order: 2,
      full_name: "Player 2",
      short_name: "P2",
      jersey_number: 2,
      position: "DF",
      phone: "",
      birth_year: "1995",
      avatar_url: "",
      role: "Thành viên",
      access_role: "player",
      pin_code: "hash",
      status: "Đang sinh hoạt",
      notes: "",
    });
    const managerCookie = createSessionToken({
      id: 1,
      code_order: 1,
      full_name: "Manager 1",
      short_name: "M1",
      jersey_number: 1,
      position: "GK",
      phone: "",
      birth_year: "1990",
      avatar_url: "",
      role: "Ban Quản Lý",
      access_role: "manager",
      pin_code: "hash",
      status: "Đang sinh hoạt",
      notes: "",
    });

    const validFile = new File([new Uint8Array(webpBuf)], "test.webp", { type: "image/webp" });

    // Guest -> 401
    expect((await postMediaUploadRoute(makeUploadReq(validFile, "player"))).status).toBe(401);

    // Feature flag off -> 503
    expect((await postMediaUploadRoute(makeUploadReq(validFile, "player", playerCookie, "2"))).status).toBe(503);

    process.env.MEDIA_STORAGE_ENABLED = "true";

    // Player uploading post -> 403
    expect((await postMediaUploadRoute(makeUploadReq(validFile, "post", playerCookie))).status).toBe(403);

    // Player uploading for another player -> 403
    expect((await postMediaUploadRoute(makeUploadReq(validFile, "player", playerCookie, "99"))).status).toBe(403);

    // Fake image bytes -> 400
    const badFile = new File([Buffer.from("not-an-image-at-all")], "evil.webp", { type: "image/webp" });
    expect((await postMediaUploadRoute(makeUploadReq(badFile, "post", managerCookie))).status).toBe(400);

    // Missing BLOB_READ_WRITE_TOKEN -> 503 (no Base64 fallback)
    const missingTokenRes = await postMediaUploadRoute(makeUploadReq(validFile, "post", managerCookie));
    expect(missingTokenRes.status).toBe(503);

    // Private visibility & unsafe pathname rejected by storage adapter
    expect(() =>
      validatePublicMediaAsset({
        pathname: "public-media/uploads/player/abc.webp",
        buffer: webpBuf,
        contentType: "image/webp",
        visibility: "private",
        entity: "player",
      })
    ).toThrow(MediaStorageError);

    // Valid mocked Blob upload -> 200 HTTPS URL
    __setMediaStorageProviderForTest({
      name: "mock-blob",
      async uploadPublicAsset(asset) {
        return {
          url: `https://mock.blob.vercel-storage.com/${asset.pathname}`,
          pathname: asset.pathname,
          contentType: asset.contentType,
          sizeBytes: asset.buffer.length,
        };
      },
    });
    const okRes = await postMediaUploadRoute(makeUploadReq(validFile, "post", managerCookie));
    expect(okRes.status).toBe(200);
    const okJson = (await okRes.json()) as { url: string; pathname: string };
    expect(okJson.url).toMatch(/^https:\/\/mock\.blob\.vercel-storage\.com\/public-media\/uploads\/post\//);

    // ensureWebpDataUrlServer rejects new Base64 when MEDIA_STORAGE_ENABLED=true
    await expect(
      ensureWebpDataUrlServer(`data:image/webp;base64,${webpBuf.toString("base64")}`)
    ).rejects.toThrow(MediaValidationError);
  });
});

describe("Workstream B — Idempotent Legacy Media Migration", () => {
  it("supports dry-run, CAS concurrent protection, orphan tracking, gallery ordering, and idempotent reruns", async () => {
    const webpBuf = await makeTinyWebpBuffer();
    const dataUri = `data:image/webp;base64,${webpBuf.toString("base64")}`;
    const { raw, db } = createTempAppDb();

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, avatar_url, profile_image_url, gallery_urls_json)
         VALUES (1, 'P1', ?, 'https://already.example/p.webp', ?)`
      ).run(dataUri, JSON.stringify(["/images/static.webp", dataUri]));

      raw.prepare(
        `INSERT INTO club_posts (id, title, featured_image, gallery_images_json)
         VALUES ('post-bad', 'Bad', 'data:image/webp;base64,not_valid_bytes!!', '[]')`
      ).run();

      raw.prepare(
        `INSERT INTO sponsors (name, logo_url, banner_url)
         VALUES ('Sp1', '', '/images/sponsor.webp')`
      ).run();

      // 1. Dry-run performs zero DB writes
      const dryReport = await migrateLegacyMedia({ db, dryRun: true });
      expect(dryReport.dryRun).toBe(true);
      expect(dryReport.migratedFields).toBe(2);
      expect(dryReport.failedFields).toBe(1);
      const stillBase64 = await db.queryOne<{ avatar_url: string }>("SELECT avatar_url FROM players WHERE id = 1");
      expect(stillBase64?.avatar_url).toBe(dataUri);

      // 2. Real migration against mocked Blob store
      const mockProvider = {
        name: "mock-blob",
        async uploadPublicAsset(asset: { pathname: string; buffer: Buffer; contentType: string }) {
          return {
            url: `https://mock.blob.vercel-storage.com/${asset.pathname}`,
            pathname: asset.pathname,
            contentType: asset.contentType,
            sizeBytes: asset.buffer.length,
          };
        },
      };

      const run1 = await migrateLegacyMedia({ db, provider: mockProvider, dryRun: false });
      expect(run1.migratedFields).toBe(2);
      expect(run1.failedFields).toBe(1);
      expect(run1.orphanObjects).toEqual([]);

      const p1After = await db.queryOne<{ avatar_url: string; profile_image_url: string; gallery_urls_json: string }>(
        "SELECT avatar_url, profile_image_url, gallery_urls_json FROM players WHERE id = 1"
      );
      expect(p1After?.avatar_url).toMatch(/^https:\/\/mock\.blob\.vercel-storage\.com\/public-media\/migrated\/player\//);
      expect(p1After?.profile_image_url).toBe("https://already.example/p.webp");
      const galleryAfter = JSON.parse(p1After?.gallery_urls_json || "[]") as string[];
      expect(galleryAfter[0]).toBe("/images/static.webp");
      expect(galleryAfter[1]).toMatch(/^https:\/\/mock\.blob\.vercel-storage\.com\//);

      // 3. Idempotent rerun skips already migrated URLs
      const run2 = await migrateLegacyMedia({ db, provider: mockProvider, dryRun: false });
      expect(run2.migratedFields).toBe(0);

      // 4. CAS conflict / DB failure records orphan object without silent overwrite
      raw.prepare("INSERT INTO sponsors (name, logo_url, banner_url) VALUES ('Sp2', ?, '')").run(dataUri);
      const casFailDb: AsyncDb = {
        ...db,
        async run(sql, args) {
          if (sql.includes("UPDATE sponsors")) {
            return { changes: 0, lastInsertRowid: 0 };
          }
          return db.run(sql, args);
        },
      };
      const casReport = await migrateLegacyMedia({ db: casFailDb, provider: mockProvider, dryRun: false });
      expect(casReport.orphanObjects.length).toBe(1);
      expect(casReport.entries.some((e) => e.status === "db_cas_conflict_or_failed")).toBe(true);
    } finally {
      raw.close();
    }
  });
});
