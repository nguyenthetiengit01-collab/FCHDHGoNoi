import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { getAsyncDb, getFullAppData } from "@/lib/db";
import {
  requireManagerSession,
  verifyCsrfOrigin,
  hashPassword,
} from "@/lib/auth";
import type { Player } from "@/types/app";

const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024; // Giới hạn 5MB chống cạn kiệt bộ nhớ

function excelSerialToIsoDate(val: unknown): string {
  if (!val) return new Date().toISOString().slice(0, 10);
  if (typeof val === "number") {
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split("/");
  if (parts.length === 2) {
    const dd = parts[0].trim().padStart(2, "0");
    const mm = parts[1].trim().padStart(2, "0");
    return `2026-${mm}-${dd}`;
  }
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  try {
    // 1. Kiểm tra CSRF / Origin
    if (!verifyCsrfOrigin(req)) {
      return NextResponse.json(
        { error: "Yêu cầu bị từ chối do vi phạm bảo mật CSRF / Origin." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 2. Xác thực bắt buộc quyền Ban Quản Lý (Manager)
    const auth = await requireManagerSession(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || "Thao tác yêu cầu quyền Ban Quản Lý (Manager)." },
        { status: auth.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    let buffer: Buffer;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          { error: "Không tìm thấy file Excel tải lên" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      if (file.size > MAX_IMPORT_SIZE_BYTES) {
        return NextResponse.json(
          {
            error:
              "Kích thước file vượt quá giới hạn cho phép (tối đa 5MB).",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      const localPath = path.join(
        process.cwd(),
        "Quan_Ly_Thu_Chi_GONOIFC.xlsx"
      );
      if (!fs.existsSync(localPath)) {
        return NextResponse.json(
          {
            error:
              "Không tìm thấy file Quan_Ly_Thu_Chi_GONOIFC.xlsx trong thư mục dự án",
          },
          { status: 404, headers: { "Cache-Control": "no-store" } }
        );
      }
      buffer = fs.readFileSync(localPath);
    }

    // 3. Đọc và Kiểm tra cấu trúc Workbook trong bộ nhớ TRƯỚC KHI thực hiện bất kỳ thao tác ghi DB nào
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(buffer, { type: "buffer" });
    } catch {
      return NextResponse.json(
        { error: "Định dạng file không hợp lệ hoặc file Excel bị hỏng." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const wsDanhSach = wb.Sheets["2. Danh sách"];
    const wsThuTran = wb.Sheets["3. Thu Trận (Tích chọn)"];
    const wsThuKhac = wb.Sheets["4. Thu Khác"];
    const wsChi = wb.Sheets["5. Chi"];

    if (!wsDanhSach || !wsThuTran || !wsChi) {
      return NextResponse.json(
        {
          error:
            "File Excel cần có đủ các sheet: '2. Danh sách', '3. Thu Trận (Tích chọn)', '5. Chi'",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const sheetToGrid = (ws: XLSX.WorkSheet): unknown[][] => {
      const ref = ws["!ref"] || "A1:Z100";
      const decoded = XLSX.utils.decode_range(ref);
      decoded.s = { r: 0, c: 0 };
      return XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        defval: "",
        range: decoded,
      });
    };

    const danhSachRows = sheetToGrid(wsDanhSach);
    const thuTranRows = sheetToGrid(wsThuTran);
    const thuKhacRows = wsThuKhac ? sheetToGrid(wsThuKhac) : [];
    const chiRows = sheetToGrid(wsChi);

    // Validate danh sách tối thiểu có tiêu đề và ít nhất 1 dòng cầu thủ
    if (danhSachRows.length < 5) {
      return NextResponse.json(
        {
          error:
            "Sheet '2. Danh sách' không có đủ dữ liệu thành viên hợp lệ.",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const db = getAsyncDb();

    // 4. Đọc dữ liệu cầu thủ hiện tại trong DB để bảo toàn mã PIN (hash) và hồ sơ đã tùy chỉnh
    const existingPlayers = await db.query<Player>(
      "SELECT * FROM players ORDER BY id ASC"
    );
    const existingPlayerMap = new Map<string, Player>();
    for (const p of existingPlayers) {
      existingPlayerMap.set(p.full_name.trim().toLowerCase(), p);
    }

    // Parse trước toàn bộ dữ liệu vào bộ nhớ để đảm bảo tính toàn vẹn 100% trước khi ghi DB
    interface ParsedPlayerData {
      stt: number;
      fullName: string;
      shortName: string;
      jersey: number | null;
      pos: string;
      phone: string;
      birthYear: number;
      avatarUrl: string;
      profileImageUrl: string;
      bio: string;
      role: string;
      accessRole: string;
      pinCode: string;
      status: string;
      notes: string;
      hometown: string;
      nickname: string;
      playingStyle: string;
      galleryUrlsJson: string;
    }

    const playersToInsert: ParsedPlayerData[] = [];

    for (let r = 4; r < danhSachRows.length; r++) {
      const row = danhSachRows[r];
      if (!row) continue;
      const stt = Number(row[1]) || r - 3;
      const fullName = String(row[2] || "").trim();
      if (!fullName) continue;
      const pos = String(row[3] || "").trim() || "Đa năng";
      const jersey =
        row[4] !== "" && row[4] !== null && row[4] !== undefined
          ? Number(row[4])
          : null;
      const phone = String(row[5] || "").trim();
      const notes = String(row[6] || "").trim();
      const shortName = fullName.split(/\s+/).slice(-1)[0] || fullName;

      // Bảo toàn thông tin từ DB nếu cầu thủ đã tồn tại
      const existing = existingPlayerMap.get(fullName.toLowerCase());
      const isManager = [
        "Nguyễn Thế Tiếng",
        "Hồ Viết Tín",
        "Dương Hiển Hoài Sơn",
      ].includes(fullName);

      const defaultRole =
        fullName === "Nguyễn Thế Tiếng"
          ? "Đội trưởng / Thủ quỹ"
          : fullName === "Hồ Viết Tín"
          ? "Đội phó / Quản lý thu"
          : fullName === "Dương Hiển Hoài Sơn"
          ? "Ban quản lý / Thủ quỹ phụ"
          : "Thành viên";

      const avatarIdx = ((stt - 1) % 14) + 1;
      const birthYear = 1986 + ((stt * 3) % 12);

      playersToInsert.push({
        stt,
        fullName,
        shortName: existing?.short_name || shortName,
        jersey: jersey !== null ? jersey : existing?.jersey_number ?? null,
        pos: existing?.position || pos,
        phone: existing?.phone || phone,
        birthYear: existing ? Number(existing.birth_year) || birthYear : birthYear,
        avatarUrl: existing?.avatar_url || `/uploads/avatars/member-${avatarIdx}.jpg`,
        profileImageUrl: existing?.profile_image_url || "",
        bio: existing?.bio || "",
        role: existing?.role || defaultRole,
        accessRole: existing?.access_role || (isManager ? "manager" : "player"),
        // BẢO MẬT: Giữ nguyên hash PIN hiện tại; nếu mới thì băm scrypt mặc định "1234"
        pinCode: existing?.pin_code || hashPassword("1234"),
        status: existing?.status || "Đang sinh hoạt",
        notes: existing?.notes || notes,
        hometown: existing?.hometown || "",
        nickname: existing?.nickname || "",
        playingStyle: existing?.playing_style || "",
        galleryUrlsJson: (existing as unknown as { gallery_urls_json?: string })?.gallery_urls_json || "[]",
      });
    }

    // 5. Đọc các khoản Chi từ Sheet '5. Chi'
    const parsedExpenses: Array<{
      date: string;
      category: string;
      description: string;
      amount: number;
      payer: string;
    }> = [];

    for (let r = 5; r < chiRows.length; r++) {
      const row = chiRows[r];
      if (!row) continue;
      const desc = String(row[4] || "").trim();
      const amt = Number(row[5]) || 0;
      if (!desc && amt === 0) continue;
      parsedExpenses.push({
        date: excelSerialToIsoDate(row[2]),
        category: String(row[3] || "Tiền sân").trim(),
        description: desc,
        amount: amt,
        payer: String(row[6] || "").trim(),
      });
    }

    // 6. Thực thi ghi dữ liệu an toàn theo lô (Batch Execution)
    // Sau khi đã parse và validate toàn bộ thành công
    await db.exec(`
      DELETE FROM match_attendances;
      DELETE FROM expenses;
      DELETE FROM other_incomes;
      DELETE FROM matches;
      DELETE FROM players;
    `);

    const playerIdByName = new Map<string, number>();

    for (const p of playersToInsert) {
      const res = await db.run(
        `INSERT INTO players (
          code_order, full_name, short_name, jersey_number,
          position, phone, birth_year, avatar_url, profile_image_url, bio,
          role, access_role, pin_code, status, notes,
          hometown, nickname, playing_style, gallery_urls_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.stt,
          p.fullName,
          p.shortName,
          p.jersey,
          p.pos,
          p.phone,
          p.birthYear,
          p.avatarUrl,
          p.profileImageUrl,
          p.bio,
          p.role,
          p.accessRole,
          p.pinCode,
          p.status,
          p.notes,
          p.hometown,
          p.nickname,
          p.playingStyle,
          p.galleryUrlsJson,
        ]
      );
      playerIdByName.set(p.fullName, Number(res.lastInsertRowid));
    }

    // 7. Đọc và tạo các Trận đấu từ Sheet '3. Thu Trận (Tích chọn)'
    const headerRow = thuTranRows[4] || [];
    const feeRow = thuTranRows[5] || [];
    const pitchExpenses = parsedExpenses.filter(
      (e) => e.category === "Tiền sân"
    );

    const matchIdByCol = new Map<number, { id: number; fee: number }>();

    for (let col = 5; col < headerRow.length; col++) {
      const label = String(headerRow[col] || "").trim();
      if (!label) continue;
      const matchIdx = col - 4;
      const fee = Number(feeRow[col]) || 100000;

      let hasAnyPaid = false;
      for (let r = 8; r < thuTranRows.length; r++) {
        const cellVal = thuTranRows[r]?.[col];
        if (
          cellVal === true ||
          cellVal === 1 ||
          String(cellVal).toLowerCase() === "true" ||
          String(cellVal).toLowerCase() === "x"
        ) {
          hasAnyPaid = true;
          break;
        }
      }

      const matchedPitchExp = pitchExpenses[matchIdx - 1];
      if (!hasAnyPaid && !matchedPitchExp && matchIdx > 15) {
        continue;
      }

      const matchDate = matchedPitchExp
        ? matchedPitchExp.date
        : excelSerialToIsoDate(label.split("-")[1] || "");
      const payer = matchedPitchExp?.payer || "Tiếng";
      const venue = payer.includes("-")
        ? `Sân ${payer.split("-")[1].trim()}`
        : "Sân Vĩnh Lộc";
      const pitchCost = matchedPitchExp?.amount || 0;

      const res = await db.run(
        `INSERT INTO matches (
          match_number, label, match_date, kickoff_time, venue,
          opponent, fee_per_player, pitch_cost, payer_name, status, notes
        ) VALUES (?, ?, ?, '19:00', ?, 'Sinh hoạt / Giao hữu tuần', ?, ?, ?, ?, '')`,
        [
          matchIdx,
          label,
          matchDate,
          venue,
          fee,
          pitchCost,
          payer,
          hasAnyPaid ? "Đã kết thúc" : "Sắp diễn ra",
        ]
      );
      matchIdByCol.set(col, { id: Number(res.lastInsertRowid), fee });
    }

    // 8. Đọc ma trận điểm danh / thu tiền từ Sheet '3. Thu Trận (Tích chọn)'
    for (let r = 8; r < thuTranRows.length; r++) {
      const row = thuTranRows[r];
      if (!row) continue;
      const fullName = String(row[2] || "").trim();
      if (!fullName) continue;
      const playerId = playerIdByName.get(fullName);
      if (!playerId) continue;

      const shortNameInSheet = String(row[3] || "").trim();
      if (shortNameInSheet) {
        await db.run("UPDATE players SET short_name = ? WHERE id = ?", [
          shortNameInSheet,
          playerId,
        ]);
      }

      for (const [col, mInfo] of matchIdByCol.entries()) {
        const val = row[col];
        const isPaid =
          val === true ||
          val === 1 ||
          String(val).toLowerCase() === "true" ||
          String(val).toLowerCase() === "x";
        await db.run(
          `INSERT OR REPLACE INTO match_attendances (
            match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note
          ) VALUES (?, ?, ?, 0, ?, ?, ?, 'Tiếng', '')`,
          [
            mInfo.id,
            playerId,
            isPaid ? "registered" : "none",
            isPaid ? 1 : 0,
            isPaid ? 1 : 0,
            isPaid ? mInfo.fee : 0,
          ]
        );
      }
    }

    // 9. Lưu các khoản Thu Khác từ Sheet '4. Thu Khác'
    for (let r = 5; r < thuKhacRows.length; r++) {
      const row = thuKhacRows[r];
      if (!row) continue;
      const contributor = String(row[3] || "").trim();
      const amount = Number(row[4]) || 0;
      const note = String(row[5] || "").trim();
      if (!contributor && amount === 0 && !note) continue;
      await db.run(
        `INSERT INTO other_incomes (income_date, contributor, amount, fund_type, note)
         VALUES (?, ?, ?, ?, ?)`,
        [
          excelSerialToIsoDate(row[2]),
          contributor || "Quỹ giải đội bóng",
          amount,
          amount > 0 ? "Quỹ sinh hoạt" : "Ghi chú Quỹ giải",
          note,
        ]
      );
    }

    // 10. Lưu toàn bộ khoản Chi vào bảng expenses
    for (const exp of parsedExpenses) {
      await db.run(
        `INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
         VALUES (?, ?, ?, ?, ?, NULL)`,
        [
          exp.date,
          exp.category,
          exp.description,
          exp.amount,
          exp.payer,
        ]
      );
    }

    const updated = await getFullAppData();
    return NextResponse.json(updated, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    console.error("POST /api/import error:", err);
    return NextResponse.json(
      { error: "Không thể import file Excel. Vui lòng kiểm tra định dạng file." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
