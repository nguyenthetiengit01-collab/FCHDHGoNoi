import fs from "node:fs";
import path from "node:path";
import { initQaDatabaseSchema } from "../../src/lib/db";
import {
  HTML_REPORT_DIR,
  SCREENSHOT_DIR,
  TEST_RESULTS_DIR,
  cleanupQaSqliteFiles,
  validateQaPaths,
} from "./qaPaths";

export interface SyntheticFixtureCounts {
  teamSettings: number;
  players: number;
  matches: number;
  clubPosts: number;
  sponsors: number;
}

export function initSyntheticQaDatabase(): SyntheticFixtureCounts {
  const { qaRoot, qaDbPath } = validateQaPaths();

  fs.mkdirSync(qaRoot, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(HTML_REPORT_DIR, { recursive: true });
  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });

  const preClean = cleanupQaSqliteFiles();
  if (preClean.locked.length > 0) {
    throw new Error(
      `Cannot initialize fresh QA SQLite database while files are locked: ${JSON.stringify(preClean.locked)}`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite = require("node:sqlite") as {
    DatabaseSync: new (filePath: string) => {
      exec: (sql: string) => void;
      prepare: (sql: string) => {
        run: (...args: unknown[]) => unknown;
        get: (...args: unknown[]) => unknown;
      };
      close: () => void;
    };
  };

  const db = new sqlite.DatabaseSync(qaDbPath);
  try {
    db.exec("PRAGMA journal_mode = DELETE;");
    db.exec("PRAGMA foreign_keys = ON;");

    initQaDatabaseSchema(db as unknown as Parameters<typeof initQaDatabaseSchema>[0]);

    db.exec("BEGIN IMMEDIATE;");
    try {
      db.prepare(
        `INSERT INTO team_settings (
          id, team_name, short_name, default_match_fee,
          bank_bin, bank_name, bank_account_no, bank_account_name,
          tournament_fund_reserve, tournament_fund_note, fanpage_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        1,
        "FC HĐH Gò Nổi QA",
        "GO NOI QA",
        100000,
        "970000",
        "QA Synthetic Bank",
        "0000000000",
        "QA SYNTHETIC ACCOUNT",
        0,
        "Synthetic QA reserve note",
        "https://example.invalid/fc-gonoi-qa"
      );

      const insertPlayer = db.prepare(
        `INSERT INTO players (
          id, code_order, full_name, short_name, jersey_number, position,
          phone, birth_year, avatar_url, profile_image_url, bio,
          role, access_role, username, pin_code, status, notes,
          hometown, nickname, playing_style, gallery_urls_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      insertPlayer.run(
        1,
        1,
        "Nguyễn Văn QA Một",
        "QA Một",
        10,
        "Tiền đạo",
        "0900000001",
        "1998",
        "/images/hinhanh-webp/giaidau/DSC06533.webp",
        "/images/hinhanh-webp/giaidau/DSC06533.webp",
        "Hồ sơ cầu thủ tổng hợp phục vụ kiểm thử tự động Phase 6.5.1.",
        "Thành viên",
        "player",
        "qaplayer1",
        "0000",
        "Đang sinh hoạt",
        "",
        "Xã Điện Quang",
        "QA Striker",
        "Synthetic QA striker",
        "[]"
      );

      insertPlayer.run(
        2,
        2,
        "Trần Văn QA Hai",
        "QA Hai",
        4,
        "Hậu vệ",
        "0900000002",
        "1997",
        "/images/hinhanh-webp/giaidau/DSC06534.webp",
        "/images/hinhanh-webp/giaidau/DSC06534.webp",
        "Hồ sơ hậu vệ tổng hợp phục vụ kiểm thử tương phản huy hiệu.",
        "Thành viên",
        "player",
        "qaplayer2",
        "0000",
        "Đang sinh hoạt",
        "",
        "Xã Điện Trung",
        "QA Defender",
        "Synthetic QA defender",
        "[]"
      );

      const insertMatch = db.prepare(
        `INSERT INTO matches (
          id, match_number, label, match_date, kickoff_time, venue, opponent,
          fee_per_player, pitch_cost, payer_name, team_score, opponent_score, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      insertMatch.run(
        1,
        1,
        "Trận QA Sắp Tới",
        "2026-12-01",
        "19:30",
        "Sân QA Tổng Hợp",
        "FC Đối Thủ QA",
        100000,
        0,
        "",
        null,
        null,
        "Sắp đá",
        "Synthetic upcoming match"
      );

      insertMatch.run(
        2,
        2,
        "Trận QA Đã Đá",
        "2026-10-15",
        "19:30",
        "Sân QA Tổng Hợp",
        "FC Giao Hữu QA",
        100000,
        0,
        "",
        3,
        1,
        "Đã đá",
        "Synthetic completed match"
      );

      db.prepare(
        `INSERT INTO club_posts (
          id, category, category_label, category_badge_class, title, slug,
          summary, published_date, author, featured_image, gallery_images_json,
          reading_time, paragraphs_json, quote, highlights_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        "post-gd-1",
        "giaidau",
        "Giải Đấu & Phong Trào",
        "bg-amber-950/60 text-amber-200 border-amber-400/50",
        "Bài viết kiểm thử QA tổng hợp",
        "bai-viet-kiem-thu-qa-tong-hop",
        "Tóm tắt nội dung tổng hợp phục vụ kiểm thử hiển thị và trợ năng.",
        "2026-10-25",
        "Ban Quản Lý QA",
        "/images/hinhanh-webp/giaidau/DSC06533.webp",
        "[]",
        "2 phút đọc",
        JSON.stringify(["Nội dung bài viết tổng hợp không chứa dữ liệu thật."]),
        "",
        "[]"
      );

      db.prepare(
        `INSERT INTO sponsors (
          id, name, tier, logo_url, banner_url, website_url, description,
          display_positions_json, is_active, sort_order, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        1,
        "Đơn Vị Đồng Hành QA",
        "title",
        "/images/hinhanh-webp/giaidau/DSC06533.webp",
        "/images/hinhanh-webp/giaidau/DSC06534.webp",
        "https://example.invalid/sponsor-qa",
        "Nhà tài trợ tổng hợp phục vụ kiểm thử banner và footer.",
        '["home_banner","home_partners"]',
        1,
        1,
        ""
      );

      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }

    const counts: SyntheticFixtureCounts = {
      teamSettings: (db.prepare("SELECT COUNT(*) as cnt FROM team_settings").get() as { cnt: number }).cnt,
      players: (db.prepare("SELECT COUNT(*) as cnt FROM players").get() as { cnt: number }).cnt,
      matches: (db.prepare("SELECT COUNT(*) as cnt FROM matches").get() as { cnt: number }).cnt,
      clubPosts: (db.prepare("SELECT COUNT(*) as cnt FROM club_posts").get() as { cnt: number }).cnt,
      sponsors: (db.prepare("SELECT COUNT(*) as cnt FROM sponsors").get() as { cnt: number }).cnt,
    };

    if (
      counts.teamSettings < 1 ||
      counts.players < 2 ||
      counts.matches < 2 ||
      counts.clubPosts < 1 ||
      counts.sponsors < 1
    ) {
      throw new Error(`Synthetic QA fixture verification failed: ${JSON.stringify(counts)}`);
    }

    const normalizedDb = path.resolve(qaDbPath);
    if (!fs.existsSync(normalizedDb)) {
      throw new Error(`Synthetic QA database missing after commit: ${normalizedDb}`);
    }

    return counts;
  } finally {
    db.close();
  }
}
