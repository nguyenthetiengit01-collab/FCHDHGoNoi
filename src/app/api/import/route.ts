import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { getAsyncDb, getFullAppData } from "@/lib/db";

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
    let buffer: Buffer;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          { error: "Không tìm thấy file Excel tải lên" },
          { status: 400 }
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
          { error: "Không tìm thấy file Quan_Ly_Thu_Chi_GONOIFC.xlsx trong thư mục dự án" },
          { status: 404 }
        );
      }
      buffer = fs.readFileSync(localPath);
    }

    const wb = XLSX.read(buffer, { type: "buffer" });
    const db = getAsyncDb();

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
        { status: 400 }
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

    await db.exec(`
      DELETE FROM match_attendances;
      DELETE FROM expenses;
      DELETE FROM other_incomes;
      DELETE FROM matches;
      DELETE FROM players;
    `);

    // 1. Đọc danh sách cầu thủ từ Sheet '2. Danh sách' (từ dòng index 4 trở đi)
    const playerIdByName = new Map<string, number>();

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
      const isManager = [
        "Nguyễn Thế Tiếng",
        "Hồ Viết Tín",
        "Dương Hiển Hoài Sơn",
      ].includes(fullName);
      const role =
        fullName === "Nguyễn Thế Tiếng"
          ? "Đội trưởng / Thủ quỹ"
          : fullName === "Hồ Viết Tín"
          ? "Đội phó / Quản lý thu"
          : fullName === "Dương Hiển Hoài Sơn"
          ? "Ban quản lý / Thủ quỹ phụ"
          : "Thành viên";

      const avatarIdx = ((stt - 1) % 14) + 1;
      const birthYear = 1986 + ((stt * 3) % 12);

      const res = await db.run(
        `INSERT INTO players (
          code_order, full_name, short_name, jersey_number,
          position, phone, birth_year, avatar_url, role, access_role, pin_code, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1234', 'Đang sinh hoạt', ?)`,
        [
          stt,
          fullName,
          shortName,
          jersey,
          pos,
          phone,
          birthYear,
          `/uploads/avatars/member-${avatarIdx}.jpg`,
          role,
          isManager ? "manager" : "player",
          notes,
        ]
      );
      playerIdByName.set(fullName, Number(res.lastInsertRowid));
    }

    // 2. Đọc các khoản Chi từ Sheet '5. Chi' (từ dòng index 5 trở đi)
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

    // 3. Đọc các cột Trận đấu từ Sheet '3. Thu Trận (Tích chọn)' (dòng index 4 & 5)
    const headerRow = thuTranRows[4] || [];
    const feeRow = thuTranRows[5] || [];
    const pitchExpenses = parsedExpenses.filter(
      (e) => e.category === "Tiền sân"
    );

    const matchIdByCol = new Map<number, { id: number; fee: number }>();

    for (let col = 5; col < headerRow.length; col++) {
      const label = String(headerRow[col] || "").trim();
      if (!label) continue;
      const matchIdx = col - 4; // 1-based
      const fee = Number(feeRow[col]) || 100000;

      // Kiểm tra xem cột này có bất kỳ cầu thủ nào đã đóng chưa
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
        // Bỏ qua các cột Trận 16..22 còn để trống trên mẫu Excel
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

    // 4. Đọc ma trận tích chọn trong Sheet '3. Thu Trận (Tích chọn)' (từ dòng index 8)
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

    // 5. Lưu các khoản Thu Khác từ Sheet '4. Thu Khác'
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

    // 6. Lưu toàn bộ khoản Chi vào bảng expenses
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
    return NextResponse.json(updated);
    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/import error:", err);
    return NextResponse.json(
      { error: "Không thể đọc file Excel. Vui lòng kiểm tra định dạng file." },
      { status: 500 }
    );
  }
}
