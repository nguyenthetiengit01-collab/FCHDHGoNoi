import path from "path";
import fs from "fs";
import os from "os";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { createClient, type Client, type InArgs } from "@libsql/client";
import { EXPENSE_CATEGORIES, FANPAGE_URL } from "@/types/app";
import { CLUB_ACTIVITIES_POSTS, type ClubActivityPost } from "@/data/clubActivities";
import { calculateFinancialSummary } from "./financialCalculations";
import { formatBirthYear } from "./athleteProfile";
import type {
  TeamSettings,
  Player,
  MatchRecord,
  MatchAttendance,
  OtherIncome,
  ExpenseRecord,
  RsvpStatus,
  FullAppData,
  Sponsor,
  SponsorTier,
} from "@/types/app";

export type DatabaseMode =
  | { adapter: "local-sqlite-qa"; dbPath: string }
  | { adapter: "turso"; url: string; authToken: string }
  | { adapter: "local-sqlite-default"; dbPath: string };

function normalizePathForCompare(targetPath: string): string {
  const resolved = path.resolve(targetPath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function resolveLocalSqliteQaPath(
  env: NodeJS.ProcessEnv = process.env,
  repoRoot: string = process.cwd()
): string | null {
  if (env.USE_LOCAL_SQLITE?.trim() !== "true") {
    return null;
  }

  if (env.NODE_ENV === "production") {
    throw new Error(
      "Database configuration error: USE_LOCAL_SQLITE is forbidden in production."
    );
  }

  if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test") {
    throw new Error(
      "Database configuration error: USE_LOCAL_SQLITE is only allowed when NODE_ENV is 'development' or 'test'."
    );
  }

  if (env.VERCEL) {
    throw new Error(
      "Database configuration error: USE_LOCAL_SQLITE is forbidden on Vercel."
    );
  }

  const rawQaPath = env.SQLITE_DB_PATH?.trim() || "";
  if (!rawQaPath) {
    throw new Error(
      "Database configuration error: SQLITE_DB_PATH is required when USE_LOCAL_SQLITE=true."
    );
  }

  if (!path.isAbsolute(rawQaPath)) {
    throw new Error(
      "Database configuration error: SQLITE_DB_PATH must be an absolute path."
    );
  }

  const resolvedQaPath = path.resolve(rawQaPath);
  const defaultLocalDbPath = path.resolve(repoRoot, "data", "gonoifc.sqlite");
  if (
    normalizePathForCompare(resolvedQaPath) ===
    normalizePathForCompare(defaultLocalDbPath)
  ) {
    throw new Error(
      "Database configuration error: SQLITE_DB_PATH must not point to the default local database."
    );
  }

  const relativeToRepo = path.relative(
    normalizePathForCompare(repoRoot),
    normalizePathForCompare(resolvedQaPath)
  );
  const isInsideRepo =
    relativeToRepo === "" ||
    (!relativeToRepo.startsWith("..") && !path.isAbsolute(relativeToRepo));
  if (isInsideRepo) {
    throw new Error(
      "Database configuration error: SQLITE_DB_PATH must be outside the repository directory."
    );
  }

  return resolvedQaPath;
}

export function resolveTursoConfig(
  env: NodeJS.ProcessEnv = process.env
): { url: string; authToken: string } | null {
  // Local SQLite QA Mode takes precedence over Turso env vars (and throws if misconfigured)
  if (resolveLocalSqliteQaPath(env) !== null) {
    return null;
  }

  const hasUrlKey = env.TURSO_DATABASE_URL !== undefined;
  const hasTokenKey = env.TURSO_AUTH_TOKEN !== undefined;
  const envUrl = env.TURSO_DATABASE_URL?.trim() || "";
  const envToken = env.TURSO_AUTH_TOKEN?.trim() || "";
  const isProdOrVercel =
    env.NODE_ENV === "production" || Boolean(env.VERCEL);

  const tursoRequiredOrEnabled =
    isProdOrVercel || hasUrlKey || hasTokenKey;

  // Development/test without Turso env vars: allow Local SQLite
  if (!tursoRequiredOrEnabled) {
    return null;
  }

  if (!envUrl) {
    throw new Error(
      "Database configuration error: TURSO_DATABASE_URL is required when Turso is enabled."
    );
  }

  if (!envToken) {
    throw new Error(
      "Database configuration error: TURSO_AUTH_TOKEN is required when Turso is enabled."
    );
  }

  return {
    url: envUrl,
    authToken: envToken,
  };
}

export function resolveDatabaseMode(
  env: NodeJS.ProcessEnv = process.env,
  repoRoot: string = process.cwd()
): DatabaseMode {
  const qaPath = resolveLocalSqliteQaPath(env, repoRoot);
  if (qaPath !== null) {
    return { adapter: "local-sqlite-qa", dbPath: qaPath };
  }

  const tursoConfig = resolveTursoConfig(env);
  if (tursoConfig) {
    return {
      adapter: "turso",
      url: tursoConfig.url,
      authToken: tursoConfig.authToken,
    };
  }

  const dataDir = env.VERCEL ? os.tmpdir() : path.join(repoRoot, "data");
  return {
    adapter: "local-sqlite-default",
    dbPath: path.join(dataDir, "gonoifc.sqlite"),
  };
}

export interface AsyncDbTx {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T | null>;
  run(
    sql: string,
    params?: unknown[]
  ): Promise<{ lastInsertRowid: number; changes: number }>;
  exec(sql: string): Promise<void>;
}

export interface AsyncDb extends AsyncDbTx {
  batch(
    statements: Array<{ sql: string; params?: unknown[] }>
  ): Promise<void>;
  transaction<T>(fn: (tx: AsyncDbTx) => Promise<T>): Promise<T>;
}

export class TursoDbAdapter implements AsyncDb {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const res = await this.client.execute({ sql, args: params as InArgs });
    return res.rows as unknown as T[];
  }

  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] || null;
  }

  async run(
    sql: string,
    params: unknown[] = []
  ): Promise<{ lastInsertRowid: number; changes: number }> {
    const res = await this.client.execute({ sql, args: params as InArgs });
    return {
      lastInsertRowid: Number(res.lastInsertRowid || 0),
      changes: Number(res.rowsAffected || 0),
    };
  }

  async batch(
    statements: Array<{ sql: string; params?: unknown[] }>
  ): Promise<void> {
    if (statements.length === 0) return;
    await this.client.batch(
      statements.map((s) => ({
        sql: s.sql,
        args: (s.params || []) as InArgs,
      })),
      "write"
    );
  }

  async exec(sql: string): Promise<void> {
    await this.client.executeMultiple(sql);
  }

  async transaction<T>(fn: (tx: AsyncDbTx) => Promise<T>): Promise<T> {
    const tx = await this.client.transaction("write");
    const txAdapter: AsyncDbTx = {
      query: async <R = Record<string, unknown>>(
        sql: string,
        params: unknown[] = []
      ): Promise<R[]> => {
        const res = await tx.execute({ sql, args: params as InArgs });
        return res.rows as unknown as R[];
      },
      queryOne: async <R = Record<string, unknown>>(
        sql: string,
        params: unknown[] = []
      ): Promise<R | null> => {
        const res = await tx.execute({ sql, args: params as InArgs });
        return (res.rows[0] as unknown as R) || null;
      },
      run: async (
        sql: string,
        params: unknown[] = []
      ): Promise<{ lastInsertRowid: number; changes: number }> => {
        const res = await tx.execute({ sql, args: params as InArgs });
        return {
          lastInsertRowid: Number(res.lastInsertRowid || 0),
          changes: Number(res.rowsAffected || 0),
        };
      },
      exec: async (sql: string): Promise<void> => {
        await tx.executeMultiple(sql);
      },
    };

    try {
      const result = await fn(txAdapter);
      await tx.commit();
      return result;
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // rollback fail-safe
      }
      throw err;
    } finally {
      try {
        tx.close();
      } catch {
        // close fail-safe
      }
    }
  }
}

export class LocalSqliteAdapter implements AsyncDb {
  private db: DatabaseSyncType;
  private lockQueue: Promise<void> = Promise.resolve();

  constructor(db: DatabaseSyncType) {
    this.db = db;
  }

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.lockQueue.then(fn, fn);
    this.lockQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async rawQuery<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    type QueryFn = (...args: unknown[]) => unknown[];
    return (this.db.prepare(sql).all as QueryFn)(...params) as T[];
  }

  private async rawQueryOne<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T | null> {
    type QueryOneFn = (...args: unknown[]) => unknown;
    return ((this.db.prepare(sql).get as QueryOneFn)(...params) as T) || null;
  }

  private async rawRun(
    sql: string,
    params: unknown[] = []
  ): Promise<{ lastInsertRowid: number; changes: number }> {
    type RunFn = (...args: unknown[]) => {
      lastInsertRowid?: number | bigint;
      changes?: number;
    };
    const res = (this.db.prepare(sql).run as RunFn)(...params);
    return {
      lastInsertRowid: Number(res?.lastInsertRowid || 0),
      changes: Number(res?.changes || 0),
    };
  }

  private async rawExec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    return this.withLock(() => this.rawQuery<T>(sql, params));
  }

  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T | null> {
    return this.withLock(() => this.rawQueryOne<T>(sql, params));
  }

  async run(
    sql: string,
    params: unknown[] = []
  ): Promise<{ lastInsertRowid: number; changes: number }> {
    return this.withLock(() => this.rawRun(sql, params));
  }

  async batch(
    statements: Array<{ sql: string; params?: unknown[] }>
  ): Promise<void> {
    if (statements.length === 0) return;
    return this.withLock(async () => {
      type RunFn = (...args: unknown[]) => void;
      this.db.exec("BEGIN TRANSACTION;");
      try {
        for (const s of statements) {
          const stmt = this.db.prepare(s.sql);
          (stmt.run as RunFn)(...(s.params || []));
        }
        this.db.exec("COMMIT;");
      } catch (err) {
        try {
          this.db.exec("ROLLBACK;");
        } catch {
          // rollback fail safe, preserve original error
        }
        throw err;
      }
    });
  }

  async exec(sql: string): Promise<void> {
    return this.withLock(() => this.rawExec(sql));
  }

  async transaction<T>(fn: (tx: AsyncDbTx) => Promise<T>): Promise<T> {
    return this.withLock(async () => {
      this.db.exec("BEGIN TRANSACTION;");
      const txAdapter: AsyncDbTx = {
        query: this.rawQuery.bind(this),
        queryOne: this.rawQueryOne.bind(this),
        run: this.rawRun.bind(this),
        exec: this.rawExec.bind(this),
      };
      try {
        const result = await fn(txAdapter);
        this.db.exec("COMMIT;");
        return result;
      } catch (err) {
        try {
          this.db.exec("ROLLBACK;");
        } catch {
          // rollback fail-safe, preserve original error
        }
        throw err;
      }
    });
  }
}

let asyncDbInstance: AsyncDb | null = null;
let tursoClientInstance: Client | null = null;

export function getAsyncDb(): AsyncDb {
  if (asyncDbInstance) return asyncDbInstance;

  const mode = resolveDatabaseMode(process.env);
  if (mode.adapter === "local-sqlite-qa") {
    console.info("Database adapter selected: Local SQLite QA");
    const local = getDb(mode.dbPath);
    asyncDbInstance = new LocalSqliteAdapter(local);
    return asyncDbInstance;
  }

  if (mode.adapter === "turso") {
    if (!tursoClientInstance) {
      tursoClientInstance = createClient({
        url: mode.url,
        authToken: mode.authToken,
      });
    }
    asyncDbInstance = new TursoDbAdapter(tursoClientInstance);
    return asyncDbInstance;
  }

  const local = getDb(mode.dbPath);
  asyncDbInstance = new LocalSqliteAdapter(local);
  return asyncDbInstance;
}

const BUNDLED_DATA_DIR = path.join(process.cwd(), "data");
const BUNDLED_DB_PATH = path.join(BUNDLED_DATA_DIR, "gonoifc.sqlite");
const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL ? os.tmpdir() : BUNDLED_DATA_DIR;
const DB_PATH = path.join(DATA_DIR, "gonoifc.sqlite");

let dbInstance: DatabaseSyncType | null = null;

export {
  EXPENSE_CATEGORIES,
  type TeamSettings,
  type Player,
  type MatchRecord,
  type MatchAttendance,
  type OtherIncome,
  type ExpenseRecord,
};

export function getDb(customDbPath?: string): DatabaseSyncType {
  if (dbInstance) return dbInstance;

  const qaPath = customDbPath ? null : resolveLocalSqliteQaPath(process.env);
  const resolvedPath = customDbPath ?? qaPath ?? DB_PATH;
  const targetDir = path.dirname(resolvedPath);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Trên môi trường Serverless (Vercel), thư mục gốc là chỉ-đọc nên ta sao chép DB mẫu sang /tmp để đọc/ghi
  // LƯU Ý QUAN TRỌNG: Chỉ copy một lần khi DB chưa tồn tại ở /tmp. Tuyệt đối không kiểm tra kích thước file
  // vì khi người dùng cập nhật dữ liệu (ghi thêm trận, điểm danh, thu tiền), kích thước file sẽ thay đổi!
  if (
    IS_VERCEL &&
    resolvedPath === DB_PATH &&
    !fs.existsSync(DB_PATH) &&
    fs.existsSync(BUNDLED_DB_PATH)
  ) {
    try {
      fs.copyFileSync(BUNDLED_DB_PATH, DB_PATH);
    } catch (err) {
      console.warn("Không thể sao chép DB từ bundled data:", err);
    }
  }

  const sqlite = process.getBuiltinModule(
    "node:sqlite"
  ) as typeof import("node:sqlite");
  const db = new sqlite.DatabaseSync(resolvedPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  initSchema(db);
  runMigrations(db);
  seedInitialDataIfNeeded(db);

  dbInstance = db;
  return db;
}

function initSchema(db: DatabaseSyncType) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      team_name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      default_match_fee INTEGER NOT NULL DEFAULT 100000,
      bank_bin TEXT NOT NULL DEFAULT '970422',
      bank_name TEXT NOT NULL DEFAULT 'MB Bank',
      bank_account_no TEXT NOT NULL DEFAULT '',
      bank_account_name TEXT NOT NULL DEFAULT 'NGUYEN THE TIENG',
      tournament_fund_reserve INTEGER NOT NULL DEFAULT 2301700,
      tournament_fund_note TEXT NOT NULL DEFAULT 'Quỹ giải trước: 2,876,700đ - Trừ 2 áo TM, 1 balo còn: 2,301,700đ',
      fanpage_url TEXT NOT NULL DEFAULT '${FANPAGE_URL}'
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_order INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      jersey_number INTEGER,
      position TEXT NOT NULL DEFAULT 'Đa năng',
      phone TEXT NOT NULL DEFAULT '',
      birth_year TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      profile_image_url TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'Thành viên',
      access_role TEXT NOT NULL DEFAULT 'player',
      username TEXT NOT NULL DEFAULT '',
      pin_code TEXT NOT NULL DEFAULT '1234',
      status TEXT NOT NULL DEFAULT 'Đang sinh hoạt',
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_number INTEGER NOT NULL,
      label TEXT NOT NULL,
      match_date TEXT NOT NULL,
      kickoff_time TEXT NOT NULL DEFAULT '19:00',
      venue TEXT NOT NULL DEFAULT 'Sân Vĩnh Lộc',
      opponent TEXT NOT NULL DEFAULT 'Giao hữu / Nội bộ',
      fee_per_player INTEGER NOT NULL DEFAULT 100000,
      pitch_cost INTEGER NOT NULL DEFAULT 0,
      payer_name TEXT NOT NULL DEFAULT 'Tiếng',
      team_score INTEGER,
      opponent_score INTEGER,
      status TEXT NOT NULL DEFAULT 'Đã kết thúc',
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS match_attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      rsvp_status TEXT NOT NULL DEFAULT 'none',
      walk_in INTEGER NOT NULL DEFAULT 0,
      attended INTEGER NOT NULL DEFAULT 0,
      paid INTEGER NOT NULL DEFAULT 0,
      amount INTEGER NOT NULL DEFAULT 0,
      collected_by TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      UNIQUE(match_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS other_incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      income_date TEXT NOT NULL,
      contributor TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      fund_type TEXT NOT NULL DEFAULT 'Quỹ sinh hoạt',
      note TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      payer TEXT NOT NULL DEFAULT '',
      match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS club_posts (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL DEFAULT 'giaidau',
      category_label TEXT NOT NULL DEFAULT 'Giải Đấu & Phong Trào',
      category_badge_class TEXT NOT NULL DEFAULT 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      published_date TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'Ban Quản Lý FC HĐH Gò Nổi',
      featured_image TEXT NOT NULL,
      gallery_images_json TEXT NOT NULL DEFAULT '[]',
      reading_time TEXT NOT NULL DEFAULT '3 phút đọc',
      paragraphs_json TEXT NOT NULL DEFAULT '[]',
      quote TEXT DEFAULT '',
      highlights_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS sponsors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'partner',
      logo_url TEXT NOT NULL DEFAULT '',
      banner_url TEXT NOT NULL DEFAULT '',
      website_url TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL DEFAULT '',
      end_date TEXT NOT NULL DEFAULT '',
      display_positions_json TEXT NOT NULL DEFAULT '["home_banner","home_partners"]',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function hasColumn(db: DatabaseSyncType, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function runMigrations(db: DatabaseSyncType) {
  if (!hasColumn(db, "team_settings", "fanpage_url")) {
    db.exec(
      `ALTER TABLE team_settings ADD COLUMN fanpage_url TEXT NOT NULL DEFAULT '${FANPAGE_URL}';`
    );
  }
  if (!hasColumn(db, "players", "access_role")) {
    db.exec(
      `ALTER TABLE players ADD COLUMN access_role TEXT NOT NULL DEFAULT 'player';`
    );
    db.exec(`
      UPDATE players
      SET access_role = 'manager',
          role = CASE
            WHEN full_name = 'Nguyễn Thế Tiếng' THEN 'Đội trưởng / Thủ quỹ'
            WHEN full_name = 'Hồ Viết Tín' THEN 'Đội phó / Quản lý thu'
            WHEN full_name = 'Dương Hiển Hoài Sơn' THEN 'Ban quản lý / Thủ quỹ phụ'
            ELSE role
          END
      WHERE full_name IN ('Nguyễn Thế Tiếng', 'Hồ Viết Tín', 'Dương Hiển Hoài Sơn');
    `);
  }
  if (!hasColumn(db, "players", "pin_code")) {
    db.exec(
      `ALTER TABLE players ADD COLUMN pin_code TEXT NOT NULL DEFAULT '1234';`
    );
  }
  if (!hasColumn(db, "players", "birth_year")) {
    db.exec(
      `ALTER TABLE players ADD COLUMN birth_year TEXT NOT NULL DEFAULT '';`
    );
  }
  db.exec(`
    UPDATE players
    SET birth_year = CAST(1986 + ((code_order * 3) % 12) AS TEXT)
    WHERE birth_year IS NULL OR birth_year = '';
  `);
  if (!hasColumn(db, "players", "avatar_url")) {
    db.exec(
      `ALTER TABLE players ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';`
    );
    const allPlayers = db
      .prepare("SELECT id FROM players ORDER BY code_order ASC, id ASC")
      .all() as Array<{ id: number }>;
    const updAvatar = db.prepare(
      "UPDATE players SET avatar_url = ? WHERE id = ? AND (avatar_url IS NULL OR avatar_url = '')"
    );
    allPlayers.forEach((p, idx) => {
      const picIdx = (idx % 14) + 1;
      updAvatar.run(`/uploads/avatars/member-${picIdx}.jpg`, p.id);
    });
  }
  if (!hasColumn(db, "players", "profile_image_url")) {
    db.exec(
      `ALTER TABLE players ADD COLUMN profile_image_url TEXT NOT NULL DEFAULT '';`
    );
  }
  if (!hasColumn(db, "players", "bio")) {
    db.exec(
      `ALTER TABLE players ADD COLUMN bio TEXT NOT NULL DEFAULT '';`
    );
    db.exec(`
      UPDATE players
      SET bio = 'Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt.'
      WHERE bio IS NULL OR bio = '';
    `);
  }
  if (!hasColumn(db, "match_attendances", "rsvp_status")) {
    db.exec(
      `ALTER TABLE match_attendances ADD COLUMN rsvp_status TEXT NOT NULL DEFAULT 'none';`
    );
    db.exec(`
      UPDATE match_attendances
      SET rsvp_status = CASE WHEN attended = 1 OR paid = 1 THEN 'registered' ELSE 'none' END;
    `);
  }
  if (!hasColumn(db, "match_attendances", "walk_in")) {
    db.exec(
      `ALTER TABLE match_attendances ADD COLUMN walk_in INTEGER NOT NULL DEFAULT 0;`
    );
  }
  if (!hasColumn(db, "match_attendances", "collected_by")) {
    db.exec(
      `ALTER TABLE match_attendances ADD COLUMN collected_by TEXT NOT NULL DEFAULT 'Tiếng';`
    );
  }
  if (!hasColumn(db, "players", "username")) {
    db.exec(
      `ALTER TABLE players ADD COLUMN username TEXT NOT NULL DEFAULT '';`
    );
    const allPlayers = db
      .prepare("SELECT id, short_name, full_name, jersey_number FROM players")
      .all() as Array<{
      id: number;
      short_name: string;
      full_name: string;
      jersey_number: number | null;
    }>;
    const updUser = db.prepare(
      "UPDATE players SET username = ? WHERE id = ? AND (username = '' OR username IS NULL)"
    );
    allPlayers.forEach((p) => {
      const defaultUser = (p.short_name || p.full_name || `player${p.id}`)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      updUser.run(defaultUser, p.id);
    });
  }
}

const INITIAL_PLAYERS: Array<{
  code_order: number;
  full_name: string;
  short_name: string;
  jersey_number: number;
  position: string;
  role: string;
  access_role: "manager" | "player";
  birth_year: string;
  hometown: string;
  nickname: string;
  playing_style: string;
  bio: string;
}> = [
  {
    code_order: 1,
    full_name: "Lê Anh Trung",
    short_name: "Trung",
    jersey_number: 17,
    position: "Tiền vệ biên",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1989",
    hometown: "Xã Điện Trung",
    nickname: "Trung Cơn Lốc",
    playing_style: "Tốc độ xé gió, bứt phá biên & dứt điểm quyết đoán",
    bio: "Chiến binh tốc độ của FC HĐH Gò Nổi. Mỗi lần xỏ giày ra sân là một lần cháy hết mình bên hành lang cánh, cống hiến những pha dốc bóng thần tốc và những bàn thắng giàu cảm xúc cho màu cờ sắc áo quê hương.",
  },
  {
    code_order: 2,
    full_name: "Nguyễn Thế Tiếng",
    short_name: "Tiếng",
    jersey_number: 12,
    position: "Trung vệ / Tiền vệ",
    role: "Đội trưởng / Thủ quỹ",
    access_role: "manager",
    birth_year: "1992",
    hometown: "Xã Điện Quang",
    nickname: "Tiếng Thuyền Trưởng",
    playing_style: "Thủ lĩnh chỉ huy, bao quát tuyến giữa & lăn xả phòng ngự",
    bio: "Đội trưởng kiêm Thủ quỹ tận tụy của FC HĐH Gò Nổi. Người kết nối anh em đồng hương ba xã tại Sài Gòn, luôn giữ ngọn lửa đoàn kết, nhiệt huyết và minh bạch trong mọi hoạt động của câu lạc bộ.",
  },
  {
    code_order: 3,
    full_name: "Hồ Viết Tín",
    short_name: "Tín",
    jersey_number: 26,
    position: "Trung vệ thòng",
    role: "Đội phó / Quản lý thu",
    access_role: "manager",
    birth_year: "1995",
    hometown: "Xã Điện Trung",
    nickname: "Tín Hòn Đá Tảng",
    playing_style: "Bức tường thép trung tâm, phán đoán sắc sảo & điềm tĩnh",
    bio: "Đội phó bản lĩnh và đáng tin cậy. Là chốt chặn thép nơi hậu tuyến, thi đấu điềm đạm, phán đoán tình huống thông minh và luôn là chỗ dựa tinh thần vững chắc cho toàn thể đồng đội.",
  },
  {
    code_order: 4,
    full_name: "Nguyễn Văn Dũng",
    short_name: "Dũng",
    jersey_number: 21,
    position: "Hậu vệ cánh",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1986",
    hometown: "Xã Điện Phong",
    nickname: "Dũng Thép",
    playing_style: "Lăn xả kiên cường, sức mạnh tranh chấp & bền bỉ",
    bio: "Chiến binh kỳ cựu mang tinh thần quả cảm của người con Gò Nổi. Không ngại va chạm, bền bỉ qua từng trận cầu và luôn truyền năng lượng tích cực cho thế hệ trẻ của đội bóng.",
  },
  {
    code_order: 5,
    full_name: "Nguyễn Văn Thịnh",
    short_name: "Thịnh",
    jersey_number: 22,
    position: "Tiền vệ trung tâm",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1989",
    hometown: "Xã Điện Quang",
    nickname: "Thịnh Nghệ Sĩ",
    playing_style: "Kỹ thuật điêu luyện, thoát pressing & chuyền bóng tinh tế",
    bio: "Tiền vệ hào hoa với lối đá thông minh, xử lý bóng mềm mại và những đường chuyền 'dọn cỗ' sắc bén. Luôn cống hiến những pha xử lý bóng mãn nhãn và tinh thần fair-play mẫu mực.",
  },
  {
    code_order: 6,
    full_name: "Lại Văn Toàn",
    short_name: "Toàn",
    jersey_number: 5,
    position: "Hậu vệ dập",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1992",
    hometown: "Xã Điện Phong",
    nickname: "Toàn Lá Chắn",
    playing_style: "Đeo bám quyết liệt, cản phá lăn xả & kỷ luật chiến thuật",
    bio: "Lá chắn kiên cường nơi phòng tuyến FC HĐH Gò Nổi. Thi đấu kỷ luật, lăn xả trong từng pha tranh chấp và luôn sẵn sàng bọc lót kịp thời cho đồng đội ở những điểm nóng.",
  },
  {
    code_order: 7,
    full_name: "Ngô Công Phát",
    short_name: "Phát",
    jersey_number: 4,
    position: "Hậu vệ cánh",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1995",
    hometown: "Xã Điện Trung",
    nickname: "Phát Motor",
    playing_style: "Thể lực sung mãn, lên công về thủ không biết mệt",
    bio: "Cỗ máy cơ động bên hành lang, sở hữu nguồn thể lực dồi dào và lối chơi nhiệt huyết. Luôn có mặt kịp thời ở cả mặt trận phòng ngự lẫn hỗ trợ tấn công.",
  },
  {
    code_order: 8,
    full_name: "Nguyễn Đăng Xuân",
    short_name: "Xuân",
    jersey_number: 45,
    position: "Tiền vệ trụ",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1986",
    hometown: "Xã Điện Quang",
    nickname: "Xuân Chiến Binh",
    playing_style: "Điềm tĩnh, bao quát tốt & dứt điểm uy lực",
    bio: "Dạn dày kinh nghiệm trận mạc, thi đấu với cái đầu lạnh và trái tim nóng. Khả năng đọc trận đấu nhạy bén và tung ra những cú sút xa bất ngờ làm nổ tung cầu trường.",
  },
  {
    code_order: 9,
    full_name: "Vũ Hùng Khương",
    short_name: "Vương Lâm",
    jersey_number: 18,
    position: "Đa năng",
    role: "Ban quản lý / Thủ quỹ phụ",
    access_role: "manager",
    birth_year: "1994",
    hometown: "Xã Điện Trung",
    nickname: "Vương Lâm Đa Năng",
    playing_style: "Nhãn quan rộng, đa năng mọi vị trí & nhiệt huyết hậu cần",
    bio: "Thành viên Ban Quản Lý gương mẫu, vừa là hạt nhân lối chơi trên sân vừa chu toàn công việc hậu cần cho đội. Lối đá thông minh, nhạy bén và luôn hết mình vì tập thể.",
  },
  {
    code_order: 10,
    full_name: "Nguyễn Thanh Vĩnh",
    short_name: "Vĩnh",
    jersey_number: 9,
    position: "Tiền đạo cắm",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1991",
    hometown: "Xã Điện Phong",
    nickname: "Vĩnh Sát Thủ",
    playing_style: "Chớp thời cơ trong vòng cấm, chọn vị trí & dứt điểm một chạm",
    bio: "Tiền đạo mũi nhọn với bản năng săn bàn nhạy bén. Luôn có mặt đúng lúc, đúng chỗ trong vòng cấm đối phương để chuyển hóa cơ hội thành những bàn thắng quý như vàng.",
  },
  {
    code_order: 11,
    full_name: "Nguyễn Tấn Thiện",
    short_name: "Thiện",
    jersey_number: 14,
    position: "Tiền vệ công",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1997",
    hometown: "Xã Điện Quang",
    nickname: "Thiện Mũi Tên",
    playing_style: "Lắt léo, quấy phá hàng thủ đối phương & bùng nổ",
    bio: "Ngòi nổ tạo đột biến với những pha đi bóng lắt léo và tự tin. Sức trẻ, lòng nhiệt tình và tinh thần cống hiến không ngừng nghỉ giúp Thiện luôn tạo nên sự khác biệt trên sân.",
  },
  {
    code_order: 12,
    full_name: "Trần Xuân Minh",
    short_name: "Minh",
    jersey_number: 3,
    position: "Hậu vệ",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1980",
    hometown: "Xã Điện Quang",
    nickname: "Anh Minh Đại Ca",
    playing_style: "Kinh nghiệm lão luyện, đọc tình huống & truyền lửa điềm tĩnh",
    bio: "Cánh chim đầu đàn của FC HĐH Gò Nổi. Với kinh nghiệm trận mạc dày dặn và phong thái đĩnh đạc, anh luôn là chỗ dựa tinh thần quý báu dìu dắt các em trẻ thi đấu tự tin.",
  },
  {
    code_order: 13,
    full_name: "Nguyễn Văn Hải",
    short_name: "Hải",
    jersey_number: 6,
    position: "Tiền vệ trung tâm",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1989",
    hometown: "Xã Điện Trung",
    nickname: "Hải Con Thoi",
    playing_style: "Cần mẫn, tranh chấp dẻo dai & phân phối bóng",
    bio: "Tiền vệ cần mẫn ở khu vực trung tuyến. Không hoa mỹ nhưng vô cùng hiệu quả, luôn di chuyển không bóng khôn ngoan để giải tỏa áp lực cho hàng phòng ngự.",
  },
  {
    code_order: 14,
    full_name: "Ngô Vũ",
    short_name: "Vũ",
    jersey_number: 19,
    position: "Tiền đạo lùi",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1992",
    hometown: "Xã Điện Phong",
    nickname: "Vũ Quái Kiệt",
    playing_style: "Thông minh, tinh quái & xử lý bóng biến hóa",
    bio: "Cầu thủ đa năng với lối chơi tinh quái và tư duy nhạy bén. Khả năng thích ứng nhanh với mọi thế trận giúp Vũ luôn là quân bài chiến lược quan trọng của đội.",
  },
  {
    code_order: 15,
    full_name: "Nguyễn Tấn Tuấn",
    short_name: "Tuấn",
    jersey_number: 8,
    position: "Tiền vệ công",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1995",
    hometown: "Xã Điện Quang",
    nickname: "Tuấn Đại Bác",
    playing_style: "Phối hợp ban bật nhịp nhàng & sút xa hiểm hóc",
    bio: "Kỹ thuật cơ bản toàn diện, nhãn quan chiến thuật sắc sảo. Sở hữu những cú nã đại bác tầm xa đầy uy lực, sẵn sàng làm rung lưới đối phương từ ngoài vòng cấm.",
  },
  {
    code_order: 16,
    full_name: "Nguyễn Văn Thành",
    short_name: "Thành",
    jersey_number: 92,
    position: "Trung vệ",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1986",
    hometown: "Xã Điện Trung",
    nickname: "Thành Không Gian",
    playing_style: "Không chiến dũng mãnh, thể hình lý tưởng & cản phá chắc tay",
    bio: "Chiến binh thép nơi hàng thủ với thể hình vượt trội. Khả năng không chiến xuất sắc và những pha can thiệp dũng mãnh mang lại sự an tâm tuyệt đối cho khung thành đội nhà.",
  },
  {
    code_order: 17,
    full_name: "Dương Hiển Hoài Sơn",
    short_name: "Hoài Sơn",
    jersey_number: 24,
    position: "Đa năng",
    role: "Ban quản lý / Thủ quỹ phụ",
    access_role: "manager",
    birth_year: "1986",
    hometown: "Xã Điện Quang",
    nickname: "Sơn Nhiệt Huyết",
    playing_style: "Máu lửa, gắn kết toàn đội & chu đáo hậu cần",
    bio: "Thành viên Ban Quản Lý nhiệt thành và trách nhiệm. Trên sân thi đấu lăn xả, ngoài sân lo toan từng buổi tập và đồng hành sát sao cùng anh em trong mọi chuyến du đấu.",
  },
  {
    code_order: 18,
    full_name: "Nguyễn Tấn Nghĩa",
    short_name: "Nghĩa",
    jersey_number: 25,
    position: "Tiền vệ cánh",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1992",
    hometown: "Xã Điện Phong",
    nickname: "Nghĩa Năng Lượng",
    playing_style: "Tràn đầy năng lượng, xông xáo & dốc bóng biên",
    bio: "Chiến binh tràn đầy năng lượng tích cực. Luôn ra sân với nụ cười sảng khoái và tinh thần chiến đấu quả cảm, sẵn sàng cống hiến trọn vẹn sức mình vì màu cờ sắc áo.",
  },
  {
    code_order: 19,
    full_name: "Nguyễn Bồng",
    short_name: "Bồng",
    jersey_number: 11,
    position: "Tiền đạo cánh",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1995",
    hometown: "Xã Điện Trung",
    nickname: "Bồng Kèo Trái",
    playing_style: "Kèo trái ma thuật, tạt bóng chuẩn xác & kiến tạo",
    bio: "Sở hữu chiếc chân trái khéo léo và những đường cong hiểm hóc. Những pha kiến tạo từ cánh của Bồng luôn mở ra cơ hội ăn bàn mười mươi cho các đồng đội tuyến trên.",
  },
  {
    code_order: 20,
    full_name: "Nguyễn Phi Vương",
    short_name: "Vương",
    jersey_number: 13,
    position: "Hậu vệ",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1986",
    hometown: "Xã Điện Quang",
    nickname: "Vương Kỷ Luật",
    playing_style: "Kỷ luật thép, đọc trận đấu & phòng ngự chủ động",
    bio: "Mẫu cầu thủ đề cao tính kỷ luật và tinh thần tập thể. Thi đấu bình tĩnh, tuân thủ nghiêm ngặt đấu pháp và luôn đặt lợi ích của đội bóng lên trên hết.",
  },
  {
    code_order: 21,
    full_name: "Đỗ Thiều Duy Vương",
    short_name: "D. Vương",
    jersey_number: 15,
    position: "Tiền vệ trung tâm",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1989",
    hometown: "Xã Điện Phong",
    nickname: "Vương Nhịp Điệu",
    playing_style: "Cầm trịch tuyến giữa, điều tiết nhịp độ & phát động tấn công",
    bio: "Nhạc trưởng tài hoa ở giữa sân, sở hữu khả năng điều phối nhịp độ trận đấu tuyệt vời. Những đường chuyền đảo cánh của Duy Vương luôn mang lại sự đột biến cao.",
  },
  {
    code_order: 22,
    full_name: "Phan Phước Trường",
    short_name: "Trường",
    jersey_number: 7,
    position: "Tiền đạo cánh",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1992",
    hometown: "Xã Điện Quang",
    nickname: "Trường CR7",
    playing_style: "Bùng nổ cảm hứng, kỹ thuật qua người & tốc độ",
    bio: "Số 7 mang phong cách thi đấu đậm chất kỹ thuật và tốc độ. Luôn ra sân với khát khao chiến thắng mãnh liệt, tạo nên những khoảnh khắc bùng nổ làm nức lòng người hâm mộ.",
  },
  {
    code_order: 23,
    full_name: "Võ Quang Quốc",
    short_name: "Quốc",
    jersey_number: 99,
    position: "Đa năng",
    role: "Thành viên",
    access_role: "player",
    birth_year: "1983",
    hometown: "Xã Điện Trung",
    nickname: "Quốc Vui Vẻ",
    playing_style: "Nhiệt tình cống hiến, tinh thần bất khuất & gắn kết",
    bio: "Chiến binh mang số áo đặc biệt 99 với tinh thần thể thao bất diệt. Nụ cười rạng rỡ và sự gắn kết của anh luôn tiếp thêm niềm vui và sự tự tin cho toàn thể anh em.",
  },
];

const INITIAL_MATCHES = [
  { match_number: 1, label: "Trận 1 - 18/6", match_date: "2026-06-18", venue: "Sân Vĩnh Lộc", pitch_cost: 410000, payer_name: "Tiếng", desc: "Tiền sân trận mở màn tuần 1 - 18/6" },
  { match_number: 2, label: "Trận 2 - 25/6", match_date: "2026-06-25", venue: "Sân Vĩnh Lộc", pitch_cost: 930000, payer_name: "Tín", desc: "Tiền sân trận tuần 2 - 25/6" },
  { match_number: 3, label: "Trận 3 - 02/7", match_date: "2026-07-02", venue: "Sân Vĩnh Lộc", pitch_cost: 1365000, payer_name: "Tiếng", desc: "Tiền sân trận tuần 3 - 02/7" },
  { match_number: 4, label: "Trận 4 - 08/7", match_date: "2026-07-08", venue: "Sân Vĩnh Lộc", pitch_cost: 1020000, payer_name: "Tiếng", desc: "Tiền sân trận tuần 4 - 08/7" },
  { match_number: 5, label: "Trận 5 - 15/7", match_date: "2026-07-15", venue: "Sân Vĩnh Lộc", pitch_cost: 840000, payer_name: "Tiếng", desc: "Tiền sân trận tuần 5 - 15/7" },
  { match_number: 6, label: "Trận 6 - 22/7", match_date: "2026-07-22", venue: "Sân Vĩnh Lộc", pitch_cost: 1270000, payer_name: "Tiếng", desc: "Tiền sân trận tuần 6 - 22/7" },
  { match_number: 7, label: "Trận 7 - 05/8", match_date: "2026-08-05", venue: "Sân Vĩnh Lộc", pitch_cost: 1330000, payer_name: "Tiếng", desc: "Tiền sân trận tuần 7 - 05/8" },
  { match_number: 8, label: "Trận 8 - 12/8", match_date: "2026-08-12", venue: "Sân Vĩnh Lộc", pitch_cost: 710000, payer_name: "Tiếng - Vĩnh Lộc", desc: "Tiền sân trận tuần 8 - 12/8" },
  { match_number: 9, label: "Trận 9 - 26/8", match_date: "2026-08-26", venue: "Sân Vũ Khánh", pitch_cost: 1080000, payer_name: "Tiếng - Vũ Khánh", desc: "Tiền sân trận tuần 9 - 17/8" },
  { match_number: 10, label: "Trận 10 - 09/9", match_date: "2026-09-09", venue: "Sân Gò Mây", pitch_cost: 1008000, payer_name: "Tiếng - Gò Mây", desc: "Tiền sân trận tuần 10 - 09/9" },
  { match_number: 11, label: "Trận 11 - 23/9", match_date: "2026-09-23", venue: "Sân DEMI", pitch_cost: 780000, payer_name: "Tiếng- DEMI", desc: "Tiền sân trận tuần 11 - 23/9" },
  { match_number: 12, label: "Trận 12 - 30/9", match_date: "2026-09-30", venue: "Sân Vũ Khánh", pitch_cost: 800000, payer_name: "Tiếng - Vũ Khánh", desc: "Tiền sân trận tuần 12 - 30/9" },
  { match_number: 13, label: "Trận 13 - 14/10", match_date: "2026-10-14", venue: "Sân Vĩnh Lộc", pitch_cost: 890000, payer_name: "Tiếng - Vĩnh Lộc", desc: "Tiền sân trận tuần 13 - 14/10" },
  { match_number: 14, label: "Trận 14 - 21/10", match_date: "2026-10-21", venue: "Sân Vĩnh Lộc", pitch_cost: 860000, payer_name: "Tiếng - Vĩnh Lộc", desc: "Tiền sân trận tuần 14 - 21/10" },
  { match_number: 15, label: "Trận 15 - 28/10", match_date: "2026-10-28", venue: "Sân Vũ Khánh", pitch_cost: 1227000, payer_name: "Tiếng - Vũ Khánh", desc: "Tiền sân trận tuần 15 - 28/10" },
];

const ATTENDANCE_MATRIX: Record<string, number[]> = {
  "Nguyễn Phi Vương":    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  "Phan Phước Trường":   [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  "Nguyễn Văn Hải":      [1,1,1,1,1,1,1,1,1,0,0,0,1,1,1],
  "Dương Hiển Hoài Sơn": [1,1,0,1,1,0,1,1,1,1,1,0,1,1,0],
  "Ngô Công Phát":       [1,0,1,1,0,1,1,0,1,1,1,0,1,1,0],
  "Hồ Viết Tín":         [0,1,0,1,1,1,1,1,1,0,1,1,1,0,1],
  "Đỗ Thiều Duy Vương":  [1,1,0,0,1,1,1,0,1,1,1,0,0,1,0],
  "Vũ Hùng Khương":      [1,0,0,1,0,1,1,1,1,1,1,0,0,1,0],
  "Nguyễn Tấn Nghĩa":    [1,0,1,0,1,0,1,1,1,1,0,1,1,0,1],
  "Nguyễn Văn Thành":    [0,0,0,1,0,1,1,1,1,1,1,0,0,1,1],
  "Nguyễn Thế Tiếng":    [1,0,1,1,1,0,1,0,1,0,1,1,0,0,1],
  "Ngô Vũ":              [1,1,1,1,0,1,0,1,0,1,0,0,0,1,0],
  "Nguyễn Đăng Xuân":    [0,1,1,0,1,1,0,0,0,1,0,0,0,1,0],
  "Nguyễn Bồng":         [0,1,1,1,0,0,0,0,1,1,0,0,0,0,0],
  "Nguyễn Tấn Thiện":    [1,0,0,0,0,1,1,1,0,0,1,0,0,0,0],
  "Lê Anh Trung":        [0,0,0,1,0,1,0,1,0,0,0,0,1,0,1],
  "Trần Xuân Minh":      [0,1,0,0,0,1,0,0,0,0,0,0,0,1,1],
  "Lại Văn Toàn":        [0,0,0,0,0,0,1,0,0,0,0,0,1,1,1],
  "Võ Quang Quốc":       [0,0,0,0,0,0,0,0,1,0,1,0,0,0,0],
  "Nguyễn Thanh Vĩnh":   [0,1,0,0,0,0,0,1,0,0,0,0,0,0,0],
  "Nguyễn Văn Thịnh":    [0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
  "Nguyễn Văn Dũng":     [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  "Nguyễn Tấn Tuấn":     [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
};

export async function seedAsyncInitialDataIfNeeded(
  db: AsyncDb,
  forceReset = false
) {
  await db.transaction(async (tx) => {
    if (forceReset) {
      await tx.exec(`
        DELETE FROM match_attendances;
        DELETE FROM expenses;
        DELETE FROM other_incomes;
        DELETE FROM matches;
        DELETE FROM players;
        DELETE FROM team_settings;
      `);
    } else {
      const countRow = await tx.queryOne<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM players"
      );
      if (countRow && countRow.cnt > 0) {
        return;
      }
    }

    await tx.run(
      `INSERT INTO team_settings (
        id, team_name, short_name, default_match_fee,
        bank_bin, bank_name, bank_account_no, bank_account_name,
        tournament_fund_reserve, tournament_fund_note, fanpage_url
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "Đội Bóng HĐH Gò Nổi",
        "FC HĐH GÒ NỔI",
        100000,
        "970422",
        "MB Bank",
        "0905123456",
        "NGUYEN THE TIENG",
        2301700,
        "Còn giải trước: 2,876,700đ | Trừ 2 áo TM, 1 balo (575,000đ) còn: 2,301,700đ",
        FANPAGE_URL,
      ]
    );

    const playerIdByName = new Map<string, number>();
    for (let idx = 0; idx < INITIAL_PLAYERS.length; idx++) {
      const p = INITIAL_PLAYERS[idx];
      const picIdx = (idx % 14) + 1;
      const res = await tx.run(
        `INSERT INTO players (code_order, full_name, short_name, jersey_number, position, phone, birth_year, avatar_url, bio, role, access_role, pin_code, status, notes)
         VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, '1234', 'Đang sinh hoạt', '')`,
        [
          p.code_order,
          p.full_name,
          p.short_name,
          p.jersey_number,
          p.position,
          p.birth_year,
          `/uploads/avatars/member-${picIdx}.jpg`,
          p.bio,
          p.role,
          p.access_role,
        ]
      );
      playerIdByName.set(p.full_name, Number(res.lastInsertRowid));
    }

    const matchIds: number[] = [];
    for (const m of INITIAL_MATCHES) {
      const res = await tx.run(
        `INSERT INTO matches (
          match_number, label, match_date, kickoff_time, venue,
          opponent, fee_per_player, pitch_cost, payer_name, status, notes
        ) VALUES (?, ?, ?, '19:00', ?, 'Sinh hoạt / Giao hữu tuần', 100000, ?, ?, 'Đã kết thúc', '')`,
        [
          m.match_number,
          m.label,
          m.match_date,
          m.venue,
          m.pitch_cost,
          m.payer_name,
        ]
      );
      matchIds.push(Number(res.lastInsertRowid));
    }

    for (const [fullName, flags] of Object.entries(ATTENDANCE_MATRIX)) {
      const playerId = playerIdByName.get(fullName);
      if (!playerId) continue;
      for (let i = 0; i < matchIds.length; i++) {
        const isPaid = flags[i] === 1 ? 1 : 0;
        const rsvp: RsvpStatus = isPaid ? "registered" : "none";
        await tx.run(
          `INSERT INTO match_attendances (match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note)
           VALUES (?, ?, ?, 0, ?, ?, ?, 'Tiếng', '')`,
          [
            matchIds[i],
            playerId,
            rsvp,
            isPaid,
            isPaid,
            isPaid ? 100000 : 0,
          ]
        );
      }
    }

    await tx.run(
      `INSERT INTO other_incomes (income_date, contributor, amount, fund_type, note)
       VALUES (?, ?, ?, ?, ?)`,
      [
        "2026-06-15",
        "Nguyễn Thế Tiếng",
        0,
        "Ghi chú Quỹ giải",
        "Còn giải trước: 2,876,700đ",
      ]
    );
    await tx.run(
      `INSERT INTO other_incomes (income_date, contributor, amount, fund_type, note)
       VALUES (?, ?, ?, ?, ?)`,
      [
        "2026-10-16",
        "Quỹ giải đội bóng",
        0,
        "Ghi chú Quỹ giải",
        "Trừ 2 áo TM, 1 balo còn: 2,301,700đ",
      ]
    );

    for (let i = 0; i < INITIAL_MATCHES.length; i++) {
      const m = INITIAL_MATCHES[i];
      await tx.run(
        `INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          m.match_date,
          "Tiền sân",
          m.desc,
          m.pitch_cost,
          m.payer_name,
          matchIds[i],
        ]
      );
      if (m.match_number === 11) {
        await tx.run(
          `INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            "2026-09-23",
            "Áo đấu/Phụ kiện",
            "giặt đồ",
            110000,
            "anh Sơn 1 lần + Vương lâm 3 lần; 160k - 50k dư trận trước",
            matchIds[i],
          ]
        );
      }
    }
  });
}

export function seedInitialDataIfNeeded(db: DatabaseSyncType, forceReset = false) {
  if (!forceReset) {
    const countRow = db.prepare("SELECT COUNT(*) as cnt FROM players").get() as {
      cnt: number;
    };
    if (countRow && countRow.cnt > 0) {
      return;
    }
  }

  db.exec("BEGIN TRANSACTION;");
  try {
    if (forceReset) {
      db.exec(`
        DELETE FROM match_attendances;
        DELETE FROM expenses;
        DELETE FROM other_incomes;
        DELETE FROM matches;
        DELETE FROM players;
        DELETE FROM team_settings;
        DELETE FROM sqlite_sequence;
      `);
    }
    db.prepare(`
      INSERT INTO team_settings (
        id, team_name, short_name, default_match_fee,
        bank_bin, bank_name, bank_account_no, bank_account_name,
        tournament_fund_reserve, tournament_fund_note, fanpage_url
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "Đội Bóng HĐH Gò Nổi",
      "FC HĐH GÒ NỔI",
      100000,
      "970422",
      "MB Bank",
      "0905123456",
      "NGUYEN THE TIENG",
      2301700,
      "Còn giải trước: 2,876,700đ | Trừ 2 áo TM, 1 balo (575,000đ) còn: 2,301,700đ",
      FANPAGE_URL
    );

    const insertPlayer = db.prepare(`
      INSERT INTO players (code_order, full_name, short_name, jersey_number, position, phone, birth_year, avatar_url, bio, role, access_role, pin_code, status, notes)
      VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, '1234', 'Đang sinh hoạt', '')
    `);

    const playerIdByName = new Map<string, number>();
    for (let idx = 0; idx < INITIAL_PLAYERS.length; idx++) {
      const p = INITIAL_PLAYERS[idx];
      const picIdx = (idx % 14) + 1;
      const res = insertPlayer.run(
        p.code_order,
        p.full_name,
        p.short_name,
        p.jersey_number,
        p.position,
        p.birth_year,
        `/uploads/avatars/member-${picIdx}.jpg`,
        p.bio,
        p.role,
        p.access_role
      );
      playerIdByName.set(p.full_name, Number(res.lastInsertRowid));
    }

    const insertMatch = db.prepare(`
      INSERT INTO matches (
        match_number, label, match_date, kickoff_time, venue,
        opponent, fee_per_player, pitch_cost, payer_name, status, notes
      ) VALUES (?, ?, ?, '19:00', ?, 'Sinh hoạt / Giao hữu tuần', 100000, ?, ?, 'Đã kết thúc', '')
    `);

    const matchIds: number[] = [];
    for (const m of INITIAL_MATCHES) {
      const res = insertMatch.run(
        m.match_number,
        m.label,
        m.match_date,
        m.venue,
        m.pitch_cost,
        m.payer_name
      );
      matchIds.push(Number(res.lastInsertRowid));
    }

    const insertAttendance = db.prepare(`
      INSERT INTO match_attendances (match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note)
      VALUES (?, ?, ?, 0, ?, ?, ?, 'Tiếng', '')
    `);

    for (const [fullName, flags] of Object.entries(ATTENDANCE_MATRIX)) {
      const playerId = playerIdByName.get(fullName);
      if (!playerId) continue;
      for (let i = 0; i < matchIds.length; i++) {
        const isPaid = flags[i] === 1 ? 1 : 0;
        const rsvp: RsvpStatus = isPaid ? "registered" : "none";
        insertAttendance.run(
          matchIds[i],
          playerId,
          rsvp,
          isPaid,
          isPaid,
          isPaid ? 100000 : 0
        );
      }
    }

    const insertOtherIncome = db.prepare(`
      INSERT INTO other_incomes (income_date, contributor, amount, fund_type, note)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertOtherIncome.run(
      "2026-06-15",
      "Nguyễn Thế Tiếng",
      0,
      "Ghi chú Quỹ giải",
      "Còn giải trước: 2,876,700đ"
    );
    insertOtherIncome.run(
      "2026-10-16",
      "Quỹ giải đội bóng",
      0,
      "Ghi chú Quỹ giải",
      "Trừ 2 áo TM, 1 balo còn: 2,301,700đ"
    );

    const insertExpense = db.prepare(`
      INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < INITIAL_MATCHES.length; i++) {
      const m = INITIAL_MATCHES[i];
      insertExpense.run(
        m.match_date,
        "Tiền sân",
        m.desc,
        m.pitch_cost,
        m.payer_name,
        matchIds[i]
      );
      if (m.match_number === 11) {
        insertExpense.run(
          "2026-09-23",
          "Áo đấu/Phụ kiện",
          "giặt đồ",
          110000,
          "anh Sơn 1 lần + Vương lâm 3 lần; 160k - 50k dư trận trước",
          matchIds[i]
        );
      }
    }

    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

let clubPostsInitialized = false;

export async function ensureClubPostsReady(db: AsyncDb): Promise<void> {
  if (clubPostsInitialized) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS club_posts (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL DEFAULT 'giaidau',
        category_label TEXT NOT NULL DEFAULT 'Giải Đấu & Phong Trào',
        category_badge_class TEXT NOT NULL DEFAULT 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        published_date TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT 'Ban Quản Lý FC HĐH Gò Nổi',
        featured_image TEXT NOT NULL,
        gallery_images_json TEXT NOT NULL DEFAULT '[]',
        reading_time TEXT NOT NULL DEFAULT '3 phút đọc',
        paragraphs_json TEXT NOT NULL DEFAULT '[]',
        quote TEXT DEFAULT '',
        highlights_json TEXT NOT NULL DEFAULT '[]',
        event_year TEXT NOT NULL DEFAULT '2026',
        tagged_players_json TEXT NOT NULL DEFAULT '[]'
      );
    `);

    // Thêm các cột mới nếu bảng club_posts đã tồn tại từ trước
    try {
      await db.exec("ALTER TABLE club_posts ADD COLUMN event_year TEXT NOT NULL DEFAULT '2026';");
    } catch {
      // đã tồn tại
    }
    try {
      await db.exec("ALTER TABLE club_posts ADD COLUMN tagged_players_json TEXT NOT NULL DEFAULT '[]';");
    } catch {
      // đã tồn tại
    }

    // Đảm bảo các cột quê quán, biệt danh, phong cách, album ảnh tồn tại trong bảng players
    try {
      await db.exec("ALTER TABLE players ADD COLUMN hometown TEXT NOT NULL DEFAULT '';");
    } catch {
      // đã tồn tại
    }
    try {
      await db.exec("ALTER TABLE players ADD COLUMN nickname TEXT NOT NULL DEFAULT '';");
    } catch {
      // đã tồn tại
    }
    try {
      await db.exec("ALTER TABLE players ADD COLUMN playing_style TEXT NOT NULL DEFAULT '';");
    } catch {
      // đã tồn tại
    }
    try {
      await db.exec("ALTER TABLE players ADD COLUMN profile_image_url TEXT NOT NULL DEFAULT '';");
    } catch {
      // đã tồn tại
    }
    try {
      await db.exec("ALTER TABLE players ADD COLUMN gallery_urls_json TEXT NOT NULL DEFAULT '[]';");
    } catch {
      // đã tồn tại
    }

    // Chuẩn hoá năm sinh trong database: loại bỏ triệt để hậu tố .0
    try {
      await db.exec("UPDATE players SET birth_year = REPLACE(birth_year, '.0', '') WHERE birth_year LIKE '%.0';");
    } catch {
      // bỏ qua nếu lỗi
    }

    // Nâng cấp & cá nhân hóa thông tin chi tiết của 23 cầu thủ nếu đang là mẫu mặc định
    for (const initP of INITIAL_PLAYERS) {
      await db.run(
        `UPDATE players
         SET hometown = CASE WHEN hometown = '' OR hometown IS NULL THEN ? ELSE hometown END,
             nickname = CASE WHEN nickname = '' OR nickname IS NULL THEN ? ELSE nickname END,
             playing_style = CASE WHEN playing_style = '' OR playing_style IS NULL THEN ? ELSE playing_style END,
             bio = CASE
                     WHEN bio IS NULL OR bio = '' OR bio LIKE 'Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình%'
                     THEN ?
                     ELSE bio
                   END
         WHERE full_name = ?`,
        [initP.hometown, initP.nickname, initP.playing_style, initP.bio, initP.full_name]
      );
    }

    // Luôn chèn các bài viết chuẩn mới nhất nếu chưa có trong DB
    for (const post of CLUB_ACTIVITIES_POSTS) {
      await db.run(
        `INSERT OR IGNORE INTO club_posts (
          id, category, category_label, category_badge_class,
          title, slug, summary, published_date, author,
          featured_image, gallery_images_json, reading_time,
          paragraphs_json, quote, highlights_json,
          event_year, tagged_players_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          post.id,
          post.category,
          post.categoryLabel,
          post.categoryBadgeClass,
          post.title,
          post.slug,
          post.summary,
          post.publishedDate,
          post.author,
          post.featuredImage,
          JSON.stringify(post.galleryImages || []),
          post.readingTime,
          JSON.stringify(post.paragraphs || []),
          post.quote || "",
          JSON.stringify(post.highlights || []),
          post.eventYear || "2026",
          JSON.stringify(post.taggedPlayerNames || []),
        ]
      );
    }
    clubPostsInitialized = true;
  } catch (err) {
    console.error("ensureClubPostsReady error:", err);
  }
}

let sponsorsInitialized = false;

export async function ensureSponsorsReady(db: AsyncDb): Promise<void> {
  if (sponsorsInitialized) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sponsors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tier TEXT NOT NULL DEFAULT 'partner',
        logo_url TEXT NOT NULL DEFAULT '',
        banner_url TEXT NOT NULL DEFAULT '',
        website_url TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        start_date TEXT NOT NULL DEFAULT '',
        end_date TEXT NOT NULL DEFAULT '',
        display_positions_json TEXT NOT NULL DEFAULT '["home_banner","home_partners"]',
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const countRow = await db.queryOne<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM sponsors"
    );
    if (!countRow || Number(countRow.cnt) === 0) {
      await db.run(
        `INSERT INTO sponsors (name, tier, logo_url, banner_url, website_url, description, start_date, end_date, display_positions_json, is_active, sort_order, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
        [
          "Ban Liên Lạc Hội Đồng Hương Gò Nổi",
          "title",
          "/uploads/avatars/member-1.jpg",
          "/uploads/avatars/member-1.jpg",
          FANPAGE_URL,
          "Đơn vị bảo trợ tinh thần và đồng hành xuyên suốt cùng các hoạt động phong trào con em Gò Nổi xa quê.",
          "2026-01-01",
          "2026-12-31",
          JSON.stringify(["home_banner", "home_partners", "match_roster"]),
          "Bảo trợ phong trào và giải đấu thường niên",
        ]
      );
    }
    sponsorsInitialized = true;
  } catch (err) {
    console.error("ensureSponsorsReady error:", err);
  }
}

interface RawClubPostRow {
  id: string;
  category: ClubActivityPost["category"];
  category_label: string;
  category_badge_class: string;
  title: string;
  slug: string;
  summary: string;
  published_date: string;
  author: string;
  featured_image: string;
  gallery_images_json: string;
  reading_time: string;
  paragraphs_json: string;
  quote: string;
  highlights_json: string;
  event_year?: string;
  tagged_players_json?: string;
}

interface RawPlayerRow extends Player {
  gallery_urls_json?: string;
}

function safeJsonParseArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

interface RawSponsorRow {
  id: number;
  name: string;
  tier: SponsorTier;
  logo_url: string;
  banner_url: string;
  website_url: string;
  description: string;
  start_date: string;
  end_date: string;
  display_positions_json: string;
  is_active: number;
  sort_order: number;
  note?: string;
  created_at?: string;
}

export async function getFullAppData(): Promise<FullAppData> {
  const db = getAsyncDb();
  await ensureClubPostsReady(db);
  await ensureSponsorsReady(db);

  const settings = (await db.queryOne<TeamSettings>(
    "SELECT * FROM team_settings WHERE id = 1"
  )) || {
    id: 1,
    team_name: "Đội Bóng HĐH Gò Nổi",
    short_name: "FC HĐH GÒ NỔI",
    default_match_fee: 100000,
    bank_bin: "970422",
    bank_name: "MB Bank",
    bank_account_no: "",
    bank_account_name: "NGUYEN THE TIENG",
    tournament_fund_reserve: 2301700,
    tournament_fund_note: "",
    fanpage_url: FANPAGE_URL,
  };

  const rawPlayers = await db.query<RawPlayerRow>(
    "SELECT * FROM players ORDER BY code_order ASC, id ASC"
  );

  // Bảo mật: Xóa mã PIN cá nhân trong dữ liệu trả về cho client/khách truy cập, chuẩn hóa năm sinh số nguyên
  const players = rawPlayers.map((p) => ({
    ...p,
    birth_year: formatBirthYear(p.birth_year),
    pin_code: "",
    profile_image_url: p.profile_image_url || "",
    gallery_urls: safeJsonParseArray(p.gallery_urls_json || "[]"),
  }));

  const matches = await db.query<MatchRecord>(
    "SELECT * FROM matches ORDER BY match_number ASC, match_date ASC"
  );

  const attendances = await db.query<MatchAttendance>(
    "SELECT * FROM match_attendances"
  );

  const otherIncomes = await db.query<OtherIncome>(
    "SELECT * FROM other_incomes ORDER BY income_date DESC, id DESC"
  );

  const expenses = await db.query<ExpenseRecord>(
    "SELECT * FROM expenses ORDER BY expense_date ASC, id ASC"
  );

  let posts: ClubActivityPost[] = CLUB_ACTIVITIES_POSTS;
  try {
    const rawPosts = await db.query<RawClubPostRow>(
      "SELECT * FROM club_posts ORDER BY published_date DESC, rowid DESC"
    );
    if (rawPosts.length > 0) {
      posts = rawPosts.map((r) => ({
        id: r.id,
        category: r.category,
        categoryLabel: r.category_label,
        categoryBadgeClass: r.category_badge_class,
        title: r.title,
        slug: r.slug,
        summary: r.summary,
        publishedDate: r.published_date,
        eventYear: r.event_year || "2026",
        author: r.author,
        featuredImage: r.featured_image,
        galleryImages: safeJsonParseArray(r.gallery_images_json),
        readingTime: r.reading_time || "3 phút đọc",
        paragraphs: safeJsonParseArray(r.paragraphs_json),
        quote: r.quote || undefined,
        highlights: safeJsonParseArray(r.highlights_json),
        taggedPlayerNames: safeJsonParseArray(r.tagged_players_json || "[]"),
      }));
    }
  } catch {
    posts = CLUB_ACTIVITIES_POSTS;
  }

  let sponsors: Sponsor[] = [];
  try {
    const rawSponsors = await db.query<RawSponsorRow>(
      "SELECT * FROM sponsors ORDER BY sort_order ASC, id ASC"
    );
    sponsors = rawSponsors.map((r) => ({
      id: Number(r.id),
      name: r.name,
      tier: (r.tier || "partner") as SponsorTier,
      logo_url: r.logo_url || "",
      banner_url: r.banner_url || "",
      website_url: r.website_url || "",
      description: r.description || "",
      start_date: r.start_date || "",
      end_date: r.end_date || "",
      display_positions: safeJsonParseArray(r.display_positions_json),
      is_active: Boolean(r.is_active),
      sort_order: Number(r.sort_order || 0),
      note: r.note || "",
      created_at: r.created_at || "",
    }));
  } catch (err) {
    console.error("Failed to query sponsors:", err);
    sponsors = [];
  }

  const summary = calculateFinancialSummary({
    attendances,
    otherIncomes,
    expenses,
  });

  return JSON.parse(
    JSON.stringify({
      settings,
      players,
      matches,
      attendances,
      otherIncomes,
      expenses,
      summary,
      posts,
      sponsors,
    })
  );
}
