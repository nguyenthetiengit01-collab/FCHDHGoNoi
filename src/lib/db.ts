import path from "path";
import fs from "fs";
import os from "os";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { EXPENSE_CATEGORIES, FANPAGE_URL } from "@/types/app";
import type {
  TeamSettings,
  Player,
  MatchRecord,
  MatchAttendance,
  OtherIncome,
  ExpenseRecord,
  RsvpStatus,
  FullAppData,
} from "@/types/app";

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

export function getDb(): DatabaseSyncType {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Trên môi trường Serverless (Vercel), thư mục gốc là chỉ-đọc nên ta sao chép DB mẫu sang /tmp để đọc/ghi
  if (IS_VERCEL && fs.existsSync(BUNDLED_DB_PATH)) {
    try {
      const bundledStat = fs.statSync(BUNDLED_DB_PATH);
      const shouldCopy =
        !fs.existsSync(DB_PATH) ||
        fs.statSync(DB_PATH).size !== bundledStat.size ||
        fs.statSync(DB_PATH).mtimeMs < bundledStat.mtimeMs;
      if (shouldCopy) {
        fs.copyFileSync(BUNDLED_DB_PATH, DB_PATH);
      }
    } catch (err) {
      console.warn("Không thể sao chép DB từ bundled data:", err);
    }
  }

  const sqlite = process.getBuiltinModule(
    "node:sqlite"
  ) as typeof import("node:sqlite");
  const db = new sqlite.DatabaseSync(DB_PATH);
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
      bio TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'Thành viên',
      access_role TEXT NOT NULL DEFAULT 'player',
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
}

export function seedInitialDataIfNeeded(db: DatabaseSyncType, forceReset = false) {
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
  } else {
    const countRow = db.prepare("SELECT COUNT(*) as cnt FROM players").get() as {
      cnt: number;
    };
    if (countRow && countRow.cnt > 0) {
      return;
    }
  }

  db.exec("BEGIN TRANSACTION;");
  try {
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

    const initialPlayers: Array<{
      code_order: number;
      full_name: string;
      short_name: string;
      jersey_number: number;
      position: string;
      role: string;
      access_role: "manager" | "player";
      birth_year: string;
      bio: string;
    }> = [
      { code_order: 1, full_name: "Lê Anh Trung", short_name: "Trung", jersey_number: 17, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1989", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 2, full_name: "Nguyễn Thế Tiếng", short_name: "Tiếng", jersey_number: 12, position: "Đa năng", role: "Đội trưởng / Thủ quỹ", access_role: "manager", birth_year: "1992", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 3, full_name: "Hồ Viết Tín", short_name: "Tín", jersey_number: 26, position: "Đa năng", role: "Đội phó / Quản lý thu", access_role: "manager", birth_year: "1995", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 4, full_name: "Nguyễn Văn Dũng", short_name: "Dũng", jersey_number: 21, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1986", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 5, full_name: "Nguyễn Văn Thịnh", short_name: "Thịnh", jersey_number: 22, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1989", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 6, full_name: "Lại Văn Toàn", short_name: "Toàn", jersey_number: 5, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1992", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 7, full_name: "Ngô Công Phát", short_name: "Phát", jersey_number: 4, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1995", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 8, full_name: "Nguyễn Đăng Xuân", short_name: "Xuân", jersey_number: 45, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1986", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 9, full_name: "Vũ Hùng Khương", short_name: "Vương Lâm", jersey_number: 18, position: "Đa năng", role: "Ban quản lý / Thủ quỹ phụ", access_role: "manager", birth_year: "1994", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 10, full_name: "Nguyễn Thanh Vĩnh", short_name: "Vĩnh", jersey_number: 9, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1991", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 11, full_name: "Nguyễn Tấn Thiện", short_name: "Thiện", jersey_number: 14, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1997", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 12, full_name: "Trần Xuân Minh", short_name: "Minh", jersey_number: 3, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1980", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 13, full_name: "Nguyễn Văn Hải", short_name: "Hải", jersey_number: 6, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1989", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 14, full_name: "Ngô Vũ", short_name: "Vũ", jersey_number: 19, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1992", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 15, full_name: "Nguyễn Tấn Tuấn", short_name: "Tuấn", jersey_number: 8, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1995", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 16, full_name: "Nguyễn Văn Thành", short_name: "Thành", jersey_number: 92, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1986", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 17, full_name: "Dương Hiển Hoài Sơn", short_name: "Hoài Sơn", jersey_number: 24, position: "Đa năng", role: "Ban quản lý / Thủ quỹ phụ", access_role: "manager", birth_year: "1986", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 18, full_name: "Nguyễn Tấn Nghĩa", short_name: "Nghĩa", jersey_number: 25, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1992", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 19, full_name: "Nguyễn Bồng", short_name: "Bồng", jersey_number: 11, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1995", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 20, full_name: "Nguyễn Phi Vương", short_name: "Vương", jersey_number: 13, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1986", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 21, full_name: "Đỗ Thiều Duy Vương", short_name: "D. Vương", jersey_number: 15, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1989", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 22, full_name: "Phan Phước Trường", short_name: "Trường", jersey_number: 7, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1992", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
      { code_order: 23, full_name: "Võ Quang Quốc", short_name: "Quốc", jersey_number: 99, position: "Đa năng", role: "Thành viên", access_role: "player", birth_year: "1983", bio: "Thành viên nhiệt huyết của FC HĐH Gò Nổi. Luôn cháy hết mình trên sân cỏ với tinh thần cống hiến, fair-play và gắn kết tình anh em đồng hương bền chặt." },
    ];

    const insertPlayer = db.prepare(`
      INSERT INTO players (code_order, full_name, short_name, jersey_number, position, phone, birth_year, avatar_url, bio, role, access_role, pin_code, status, notes)
      VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, '1234', 'Đang sinh hoạt', '')
    `);

    const playerIdByName = new Map<string, number>();
    for (let idx = 0; idx < initialPlayers.length; idx++) {
      const p = initialPlayers[idx];
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

    const initialMatches = [
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

    const insertMatch = db.prepare(`
      INSERT INTO matches (
        match_number, label, match_date, kickoff_time, venue,
        opponent, fee_per_player, pitch_cost, payer_name, status, notes
      ) VALUES (?, ?, ?, '19:00', ?, 'Sinh hoạt / Giao hữu tuần', 100000, ?, ?, 'Đã kết thúc', '')
    `);

    const matchIds: number[] = [];
    for (const m of initialMatches) {
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

    const attendanceMatrix: Record<string, number[]> = {
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

    const insertAttendance = db.prepare(`
      INSERT INTO match_attendances (match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note)
      VALUES (?, ?, ?, 0, ?, ?, ?, 'Tiếng', '')
    `);

    for (const [fullName, flags] of Object.entries(attendanceMatrix)) {
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

    for (let i = 0; i < initialMatches.length; i++) {
      const m = initialMatches[i];
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

export function getFullAppData(): FullAppData {
  const db = getDb();

  const settings = db
    .prepare("SELECT * FROM team_settings WHERE id = 1")
    .get() as unknown as TeamSettings;

  const players = db
    .prepare("SELECT * FROM players ORDER BY code_order ASC, id ASC")
    .all() as unknown as Player[];

  const matches = db
    .prepare("SELECT * FROM matches ORDER BY match_number ASC, match_date ASC")
    .all() as unknown as MatchRecord[];

  const attendances = db
    .prepare("SELECT * FROM match_attendances")
    .all() as unknown as MatchAttendance[];

  const otherIncomes = db
    .prepare("SELECT * FROM other_incomes ORDER BY income_date DESC, id DESC")
    .all() as unknown as OtherIncome[];

  const expenses = db
    .prepare("SELECT * FROM expenses ORDER BY expense_date ASC, id ASC")
    .all() as unknown as ExpenseRecord[];

  const totalMatchIncome = attendances.reduce(
    (sum, a) => sum + (a.paid ? a.amount : 0),
    0
  );
  const totalUnpaidAmount = attendances.reduce(
    (sum, a) => sum + (a.attended && !a.paid ? a.amount : 0),
    0
  );
  const totalOtherIncome = otherIncomes.reduce((sum, o) => sum + o.amount, 0);
  const totalIncome = totalMatchIncome + totalOtherIncome;
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const currentBalance = totalIncome - totalExpense;

  const categoryBreakdown = EXPENSE_CATEGORIES.map((category) => {
    const amount = expenses
      .filter((e) => e.category === category)
      .reduce((s, e) => s + e.amount, 0);
    return {
      category,
      amount,
      percentage:
        totalExpense > 0
          ? Math.round((amount / totalExpense) * 1000) / 10
          : 0,
    };
  });

  return JSON.parse(
    JSON.stringify({
      settings,
      players,
      matches,
      attendances,
      otherIncomes,
      expenses,
      summary: {
        totalMatchIncome,
        totalOtherIncome,
        totalIncome,
        totalExpense,
        currentBalance,
        totalUnpaidAmount,
        categoryBreakdown,
      },
    })
  );
}
