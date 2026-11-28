import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import {
  ensureAuditLogsReady,
  getAsyncDb,
  getFullAppData,
  recordAuditLog,
} from "@/lib/db";
import {
  requireManagerSession,
  verifyCsrfOrigin,
  hashPassword,
} from "@/lib/auth";
import { recordPlayerLifecycleEvent } from "@/lib/analytics/lifecycle";
import { guardCutoverWrite } from "@/lib/cutoverFreeze";
import type { Player } from "@/types/app";

const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024; // Giới hạn 5MB chống cạn kiệt bộ nhớ

class ImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportValidationError";
  }
}

function buildValidatedIsoDate(
  year: number,
  month: number,
  day: number,
  raw: unknown,
  context: string
): string {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new ImportValidationError(
      `${context}: ngày tháng không hợp lệ ("${String(raw)}").`
    );
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    throw new ImportValidationError(
      `${context}: ngày tháng không tồn tại trong lịch ("${String(raw)}").`
    );
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function excelSerialToIsoDate(val: unknown, context = "Ngày tháng"): string {
  if (
    val === null ||
    val === undefined ||
    val === "" ||
    (typeof val === "string" && val.trim() === "")
  ) {
    throw new ImportValidationError(`${context}: ngày tháng không được để trống.`);
  }
  if (typeof val === "boolean") {
    throw new ImportValidationError(
      `${context}: ngày tháng không hợp lệ ("${String(val)}").`
    );
  }
  if (typeof val === "number") {
    // Excel serial date 1 = 1900-01-01, 2958465 = 9999-12-31
    if (!Number.isFinite(val) || val < 1 || val > 2958465) {
      throw new ImportValidationError(
        `${context}: số serial ngày Excel không hợp lệ ("${String(val)}").`
      );
    }
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (Number.isNaN(d.getTime())) {
      throw new ImportValidationError(
        `${context}: số serial ngày Excel không hợp lệ ("${String(val)}").`
      );
    }
    return buildValidatedIsoDate(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
      val,
      context
    );
  }
  if (typeof val !== "string") {
    throw new ImportValidationError(
      `${context}: ngày tháng không hợp lệ ("${String(val)}").`
    );
  }

  const str = val.trim();

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (isoMatch) {
    return buildValidatedIsoDate(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
      str,
      context
    );
  }

  const dmyMatch = /^(\d{1,2})([\/-])(\d{1,2})\2(\d{2}|\d{4})$/.exec(str);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[3]);
    const rawYear = dmyMatch[4];
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    return buildValidatedIsoDate(year, month, day, str, context);
  }

  // Hỗ trợ định dạng ngắn DD/MM cho tiêu đề trận legacy (vd: "Trận 1 - 01/04")
  const dmMatch = /^(\d{1,2})\/(\d{1,2})$/.exec(str);
  if (dmMatch) {
    const day = Number(dmMatch[1]);
    const month = Number(dmMatch[2]);
    const year = new Date().getFullYear();
    return buildValidatedIsoDate(year, month, day, str, context);
  }

  throw new ImportValidationError(
    `${context}: định dạng ngày tháng không hợp lệ ("${str}").`
  );
}

function parseVndAmount(
  raw: unknown,
  context: string,
  options?: { allowEmptyZero?: boolean; defaultIfEmpty?: number }
): number {
  if (
    raw === "" ||
    raw === null ||
    raw === undefined ||
    (typeof raw === "string" && raw.trim() === "")
  ) {
    if (options?.defaultIfEmpty !== undefined) return options.defaultIfEmpty;
    if (options?.allowEmptyZero) return 0;
    throw new ImportValidationError(`${context}: số tiền không được để trống.`);
  }
  if (typeof raw === "boolean") {
    throw new ImportValidationError(`${context}: số tiền không hợp lệ.`);
  }
  const num = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
    throw new ImportValidationError(
      `${context}: số tiền VND phải là số nguyên không âm (nhận được "${String(raw)}").`
    );
  }
  return num;
}

function parseBinaryFlag(raw: unknown, context: string): 0 | 1 {
  if (
    raw === "" ||
    raw === null ||
    raw === undefined ||
    typeof raw === "boolean" ||
    (typeof raw === "string" && raw.trim() === "")
  ) {
    throw new ImportValidationError(
      `${context}: giá trị cờ phải là 0 hoặc 1 (nhận được "${String(raw)}").`
    );
  }
  const num = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (num !== 0 && num !== 1) {
    throw new ImportValidationError(
      `${context}: giá trị cờ phải là 0 hoặc 1 (nhận được "${String(raw)}").`
    );
  }
  return num;
}

function parseNullableInt(raw: unknown, context: string): number | null {
  if (raw === "" || raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") {
    throw new ImportValidationError(
      `${context}: giá trị phải là số nguyên (nhận được "${String(raw)}").`
    );
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num) || !Number.isInteger(num)) {
      throw new ImportValidationError(
        `${context}: giá trị phải là số nguyên (nhận được "${String(raw)}").`
      );
    }
    return num;
  }
  const num = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new ImportValidationError(
      `${context}: giá trị phải là số nguyên (nhận được "${String(raw)}").`
    );
  }
  return num;
}

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

interface ParsedMatchData {
  exportedId: number | null;
  matchNumber: number;
  label: string;
  matchDate: string;
  kickoffTime: string;
  venue: string;
  opponent: string;
  feePerPlayer: number;
  pitchCost: number;
  payerName: string;
  teamScore: number | null;
  opponentScore: number | null;
  status: string;
  notes: string;
}

interface ParsedAttendanceData {
  matchIndex: number; // index into parsedMatches
  playerNameRaw: string;
  playerNameNormalized: string;
  rsvpStatus: string;
  walkIn: number;
  attended: number;
  paid: number;
  amount: number;
  collectedBy: string;
  note: string;
}

interface ParsedOtherIncomeData {
  date: string;
  contributor: string;
  amount: number;
  fundType: string;
  note: string;
}

interface ParsedExpenseData {
  date: string;
  category: string;
  description: string;
  amount: number;
  payer: string;
  exportedMatchId: number | null;
}

function sheetToGrid(ws: XLSX.WorkSheet): unknown[][] {
  const ref = ws["!ref"] || "A1:Z100";
  const decoded = XLSX.utils.decode_range(ref);
  decoded.s = { r: 0, c: 0 };
  return XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
    range: decoded,
  });
}

const REQUIRED_MATCH_DETAIL_COLUMNS = [
  "id",
  "match_number",
  "label",
  "match_date",
  "kickoff_time",
  "venue",
  "opponent",
  "fee_per_player",
  "pitch_cost",
  "payer_name",
  "team_score",
  "opponent_score",
  "status",
  "notes",
] as const;

const REQUIRED_ATTENDANCE_DETAIL_COLUMNS = [
  "match_id",
  "player_name",
  "rsvp_status",
  "walk_in",
  "attended",
  "paid",
  "amount",
  "collected_by",
  "note",
] as const;

function parseDetailSheet(wsDetail: XLSX.WorkSheet): {
  matches: ParsedMatchData[];
  attendances: ParsedAttendanceData[];
} {
  const rows = sheetToGrid(wsDetail);
  const matchesHeaderIdx = rows.findIndex(
    (r) => String(r?.[0] || "").trim() === "[MATCHES]"
  );
  const attHeaderIdx = rows.findIndex(
    (r) => String(r?.[0] || "").trim() === "[ATTENDANCES]"
  );

  if (matchesHeaderIdx === -1 || attHeaderIdx === -1) {
    throw new ImportValidationError(
      "Sheet '6. Dữ liệu Chi tiết (App)' có cấu trúc không hợp lệ: thiếu mục [MATCHES] hoặc [ATTENDANCES]."
    );
  }
  if (attHeaderIdx <= matchesHeaderIdx + 1 || attHeaderIdx + 1 >= rows.length) {
    throw new ImportValidationError(
      "Sheet '6. Dữ liệu Chi tiết (App)' có cấu trúc không hợp lệ: thiếu dòng tiêu đề cột."
    );
  }

  const matchesColRow = rows[matchesHeaderIdx + 1] || [];
  const mCol = (name: string) =>
    matchesColRow.findIndex((c) => String(c).trim() === name);

  for (const requiredCol of REQUIRED_MATCH_DETAIL_COLUMNS) {
    if (mCol(requiredCol) === -1) {
      throw new ImportValidationError(
        `Sheet '6. Dữ liệu Chi tiết (App)' thiếu cột '${requiredCol}' trong mục [MATCHES].`
      );
    }
  }

  const mIdIdx = mCol("id");
  const mNumIdx = mCol("match_number");
  const mLabelIdx = mCol("label");
  const mDateIdx = mCol("match_date");
  const mTimeIdx = mCol("kickoff_time");
  const mVenueIdx = mCol("venue");
  const mOppIdx = mCol("opponent");
  const mFeeIdx = mCol("fee_per_player");
  const mPitchIdx = mCol("pitch_cost");
  const mPayerIdx = mCol("payer_name");
  const mTeamScoreIdx = mCol("team_score");
  const mOppScoreIdx = mCol("opponent_score");
  const mStatusIdx = mCol("status");
  const mNotesIdx = mCol("notes");

  const parsedMatches: ParsedMatchData[] = [];
  const matchIdxByExportedId = new Map<number, number>();

  for (let r = matchesHeaderIdx + 2; r < attHeaderIdx; r++) {
    const row = rows[r];
    if (
      !row ||
      row.every(
        (c) =>
          c === "" ||
          c === null ||
          c === undefined ||
          (typeof c === "string" && c.trim() === "")
      )
    ) {
      continue;
    }
    const exportedId = parseNullableInt(
      row[mIdIdx],
      `Sheet '6. Dữ liệu Chi tiết (App)' trận dòng ${r + 1}`
    );
    if (exportedId === null || exportedId <= 0) {
      throw new ImportValidationError(
        `Sheet '6. Dữ liệu Chi tiết (App)' trận dòng ${r + 1}: id trận phải là số nguyên dương.`
      );
    }
    if (matchIdxByExportedId.has(exportedId)) {
      throw new ImportValidationError(
        `Sheet '6. Dữ liệu Chi tiết (App)' trận dòng ${r + 1}: trùng lặp id trận (${exportedId}).`
      );
    }

    const rawMatchNumber = parseNullableInt(
      row[mNumIdx],
      `Sheet '6. Dữ liệu Chi tiết (App)' match_number dòng ${r + 1}`
    );
    if (rawMatchNumber !== null && rawMatchNumber <= 0) {
      throw new ImportValidationError(
        `Sheet '6. Dữ liệu Chi tiết (App)' trận dòng ${r + 1}: match_number phải là số nguyên dương.`
      );
    }
    const matchNumber = rawMatchNumber ?? parsedMatches.length + 1;

    const feePerPlayer = parseVndAmount(
      row[mFeeIdx],
      `Sheet '6. Dữ liệu Chi tiết (App)' fee_per_player dòng ${r + 1}`,
      { defaultIfEmpty: 100000 }
    );
    const pitchCost = parseVndAmount(
      row[mPitchIdx],
      `Sheet '6. Dữ liệu Chi tiết (App)' pitch_cost dòng ${r + 1}`,
      { allowEmptyZero: true }
    );

    const idx = parsedMatches.length;
    matchIdxByExportedId.set(exportedId, idx);

    parsedMatches.push({
      exportedId,
      matchNumber,
      label: String(row[mLabelIdx] || `Trận ${matchNumber}`).trim(),
      matchDate: excelSerialToIsoDate(
        row[mDateIdx],
        `Sheet '6. Dữ liệu Chi tiết (App)' match_date dòng ${r + 1}`
      ),
      kickoffTime: String(row[mTimeIdx] || "19:00").trim(),
      venue: String(row[mVenueIdx] || "Sân Vĩnh Lộc").trim(),
      opponent: String(row[mOppIdx] || "Sinh hoạt / Giao hữu tuần").trim(),
      feePerPlayer,
      pitchCost,
      payerName: String(row[mPayerIdx] || "Tiếng").trim(),
      teamScore: parseNullableInt(
        row[mTeamScoreIdx],
        `Sheet '6. Dữ liệu Chi tiết (App)' team_score dòng ${r + 1}`
      ),
      opponentScore: parseNullableInt(
        row[mOppScoreIdx],
        `Sheet '6. Dữ liệu Chi tiết (App)' opponent_score dòng ${r + 1}`
      ),
      status: String(row[mStatusIdx] || "Đã kết thúc").trim(),
      notes: String(row[mNotesIdx] || "").trim(),
    });
  }

  const attColRow = rows[attHeaderIdx + 1] || [];
  const aCol = (name: string) =>
    attColRow.findIndex((c) => String(c).trim() === name);

  for (const requiredCol of REQUIRED_ATTENDANCE_DETAIL_COLUMNS) {
    if (aCol(requiredCol) === -1) {
      throw new ImportValidationError(
        `Sheet '6. Dữ liệu Chi tiết (App)' thiếu cột '${requiredCol}' trong mục [ATTENDANCES].`
      );
    }
  }

  const aMatchIdIdx = aCol("match_id");
  const aPlayerNameIdx = aCol("player_name");
  const aRsvpIdx = aCol("rsvp_status");
  const aWalkInIdx = aCol("walk_in");
  const aAttendedIdx = aCol("attended");
  const aPaidIdx = aCol("paid");
  const aAmountIdx = aCol("amount");
  const aCollectedByIdx = aCol("collected_by");
  const aNoteIdx = aCol("note");

  const parsedAttendances: ParsedAttendanceData[] = [];
  const seenAttendanceKeys = new Set<string>();

  for (let r = attHeaderIdx + 2; r < rows.length; r++) {
    const row = rows[r];
    if (
      !row ||
      row.every(
        (c) =>
          c === "" ||
          c === null ||
          c === undefined ||
          (typeof c === "string" && c.trim() === "")
      )
    ) {
      continue;
    }
    const rawMatchId = parseNullableInt(
      row[aMatchIdIdx],
      `Sheet '6. Dữ liệu Chi tiết (App)' attendance match_id dòng ${r + 1}`
    );
    if (rawMatchId === null || rawMatchId <= 0) {
      throw new ImportValidationError(
        `Sheet '6. Dữ liệu Chi tiết (App)' attendance dòng ${r + 1}: thiếu hoặc sai match_id (phải là số nguyên dương).`
      );
    }
    const matchIndex = matchIdxByExportedId.get(rawMatchId);
    if (matchIndex === undefined) {
      throw new ImportValidationError(
        `Sheet '6. Dữ liệu Chi tiết (App)' attendance dòng ${r + 1}: match_id (${rawMatchId}) không tồn tại trong [MATCHES].`
      );
    }

    const playerName = String(row[aPlayerNameIdx] || "").trim();
    if (!playerName) {
      throw new ImportValidationError(
        `Sheet '6. Dữ liệu Chi tiết (App)' attendance dòng ${r + 1}: thiếu tên cầu thủ (player_name).`
      );
    }

    const attKey = `${matchIndex}:${playerName.toLowerCase()}`;
    if (seenAttendanceKeys.has(attKey)) {
      throw new ImportValidationError(
        `Sheet '6. Dữ liệu Chi tiết (App)' attendance dòng ${r + 1}: trùng lặp điểm danh cho cầu thủ "${playerName}" ở match_id (${rawMatchId}).`
      );
    }
    seenAttendanceKeys.add(attKey);

    const attended = parseBinaryFlag(
      row[aAttendedIdx],
      `Sheet '6. Dữ liệu Chi tiết (App)' attended dòng ${r + 1}`
    );
    const paid = parseBinaryFlag(
      row[aPaidIdx],
      `Sheet '6. Dữ liệu Chi tiết (App)' paid dòng ${r + 1}`
    );
    const rawWalkIn = row[aWalkInIdx];
    const walkIn =
      rawWalkIn === "" ||
      rawWalkIn === null ||
      rawWalkIn === undefined ||
      (typeof rawWalkIn === "string" && rawWalkIn.trim() === "")
        ? 0
        : parseBinaryFlag(
            rawWalkIn,
            `Sheet '6. Dữ liệu Chi tiết (App)' walk_in dòng ${r + 1}`
          );
    const amount = parseVndAmount(
      row[aAmountIdx],
      `Sheet '6. Dữ liệu Chi tiết (App)' amount dòng ${r + 1}`,
      { allowEmptyZero: true }
    );

    parsedAttendances.push({
      matchIndex,
      playerNameRaw: playerName,
      playerNameNormalized: playerName.toLowerCase(),
      rsvpStatus: String(row[aRsvpIdx] || "none").trim() || "none",
      walkIn,
      attended,
      paid,
      amount,
      collectedBy: String(row[aCollectedByIdx] || "").trim(),
      note: String(row[aNoteIdx] || "").trim(),
    });
  }

  return { matches: parsedMatches, attendances: parsedAttendances };
}

export async function POST(req: NextRequest) {
  const freezeRes = guardCutoverWrite("POST /api/import");
  if (freezeRes) return freezeRes;

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
      const ext = path.extname(file.name || "").toLowerCase();
      if (![".xlsx", ".xls", ".xlsm"].includes(ext)) {
        return NextResponse.json(
          { error: "Chỉ hỗ trợ định dạng file Excel (.xlsx, .xls, .xlsm)." },
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
    const wsDetail = wb.Sheets["6. Dữ liệu Chi tiết (App)"];

    if (!wsDanhSach || !wsThuTran || !wsChi) {
      return NextResponse.json(
        {
          error:
            "File Excel cần có đủ các sheet: '2. Danh sách', '3. Thu Trận (Tích chọn)', '5. Chi'",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const danhSachRows = sheetToGrid(wsDanhSach);
    const thuTranRows = sheetToGrid(wsThuTran);
    const thuKhacRows = wsThuKhac ? sheetToGrid(wsThuKhac) : [];
    const chiRows = sheetToGrid(wsChi);

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

    // 4. Đọc dữ liệu cầu thủ hiện tại trong DB (read-only) để bảo toàn mã PIN (hash) và hồ sơ đã tùy chỉnh
    const existingPlayers = await db.query<Player>(
      "SELECT * FROM players ORDER BY id ASC"
    );
    const existingPlayerMap = new Map<string, Player>();
    for (const p of existingPlayers) {
      existingPlayerMap.set(p.full_name.trim().toLowerCase(), p);
    }

    // 5. Parse & Validate Sheet '2. Danh sách' trong bộ nhớ
    let pHeaderIdx = 3;
    let colStt = 1;
    let colFullName = 2;
    let colPos = 3;
    let colJersey = 4;
    let colPhone = 5;
    let colNotes = 6;

    for (let r = 0; r < Math.min(10, danhSachRows.length); r++) {
      const row = danhSachRows[r] || [];
      const nameIdx = row.findIndex((c) =>
        String(c).trim().toLowerCase().includes("họ và tên")
      );
      if (nameIdx !== -1) {
        pHeaderIdx = r;
        colFullName = nameIdx;
        const sttIdx = row.findIndex(
          (c) => String(c).trim().toLowerCase() === "stt"
        );
        colStt = sttIdx !== -1 ? sttIdx : colFullName - 1;
        const posIdx = row.findIndex((c) =>
          String(c).trim().toLowerCase().includes("vị trí")
        );
        if (posIdx !== -1) colPos = posIdx;
        const jerseyIdx = row.findIndex((c) =>
          String(c).trim().toLowerCase().includes("số áo")
        );
        if (jerseyIdx !== -1) colJersey = jerseyIdx;
        const phoneIdx = row.findIndex(
          (c) =>
            String(c).trim().toLowerCase().includes("sđt") ||
            String(c).trim().toLowerCase().includes("điện thoại")
        );
        if (phoneIdx !== -1) colPhone = phoneIdx;
        const notesIdx = row.findIndex((c) =>
          String(c).trim().toLowerCase().includes("ghi chú")
        );
        if (notesIdx !== -1) colNotes = notesIdx;
        break;
      }
    }

    const playersToInsert: ParsedPlayerData[] = [];
    const seenPlayerNames = new Set<string>();

    for (let r = pHeaderIdx + 1; r < danhSachRows.length; r++) {
      const row = danhSachRows[r];
      if (!row) continue;
      const stt = Number(row[colStt]) || r - pHeaderIdx;
      const fullName = String(row[colFullName] || "").trim();
      if (!fullName) continue;

      const normalizedName = fullName.toLowerCase();
      if (seenPlayerNames.has(normalizedName)) {
        throw new ImportValidationError(
          `Trùng tên cầu thủ trong sheet '2. Danh sách': "${fullName}".`
        );
      }
      seenPlayerNames.add(normalizedName);

      const pos = String(row[colPos] || "").trim() || "Đa năng";
      const jersey =
        row[colJersey] !== "" &&
        row[colJersey] !== null &&
        row[colJersey] !== undefined
          ? Number(row[colJersey])
          : null;
      const phone = String(row[colPhone] || "").trim();
      const notes = String(row[colNotes] || "").trim();
      const shortName = fullName.split(/\s+/).slice(-1)[0] || fullName;

      const existing = existingPlayerMap.get(normalizedName);
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
        jersey: jersey !== null && Number.isFinite(jersey) ? jersey : existing?.jersey_number ?? null,
        pos: existing?.position || pos,
        phone: existing?.phone || phone,
        birthYear: existing ? Number(existing.birth_year) || birthYear : birthYear,
        avatarUrl: existing?.avatar_url || `/uploads/avatars/member-${avatarIdx}.jpg`,
        profileImageUrl: existing?.profile_image_url || "",
        bio: existing?.bio || "",
        role: existing?.role || defaultRole,
        accessRole: existing?.access_role || (isManager ? "manager" : "player"),
        pinCode: existing?.pin_code || hashPassword(crypto.randomBytes(24).toString("base64url")),
        status: existing?.status || "Đang sinh hoạt",
        notes: existing?.notes || notes,
        hometown: existing?.hometown || "",
        nickname: existing?.nickname || "",
        playingStyle: existing?.playing_style || "",
        galleryUrlsJson:
          (existing as unknown as { gallery_urls_json?: string })
            ?.gallery_urls_json || "[]",
      });
    }

    if (playersToInsert.length === 0) {
      throw new ImportValidationError(
        "Sheet '2. Danh sách' không có cầu thủ hợp lệ nào."
      );
    }

    // 6. Parse & Validate Sheet '5. Chi' trong bộ nhớ
    let chiHeaderIdx = 3;
    let colChiDate = 2;
    let colChiCat = 3;
    let colChiDesc = 4;
    let colChiAmt = 5;
    let colChiPayer = 6;
    let colChiMatchId = -1;

    for (let r = 0; r < Math.min(10, chiRows.length); r++) {
      const row = chiRows[r] || [];
      const descIdx = row.findIndex((c) =>
        String(c).trim().toLowerCase().includes("nội dung chi tiết")
      );
      if (descIdx !== -1) {
        chiHeaderIdx = r;
        colChiDesc = descIdx;
        const dateIdx = row.findIndex((c) =>
          String(c).trim().toLowerCase() === "ngày"
        );
        if (dateIdx !== -1) colChiDate = dateIdx;
        const catIdx = row.findIndex((c) =>
          String(c).trim().toLowerCase().includes("hạng mục")
        );
        if (catIdx !== -1) colChiCat = catIdx;
        const amtIdx = row.findIndex((c) =>
          String(c).trim().toLowerCase().includes("số tiền")
        );
        if (amtIdx !== -1) colChiAmt = amtIdx;
        const payerIdx = row.findIndex((c) =>
          String(c).trim().toLowerCase().includes("người chi")
        );
        if (payerIdx !== -1) colChiPayer = payerIdx;
        const matchIdIdx = row.findIndex((c) =>
          String(c).trim().toLowerCase().includes("mã trận")
        );
        if (matchIdIdx !== -1) colChiMatchId = matchIdIdx;
        break;
      }
    }

    const parsedExpenses: ParsedExpenseData[] = [];

    for (let r = chiHeaderIdx + 1; r < chiRows.length; r++) {
      const row = chiRows[r];
      if (!row) continue;
      if (String(row[colChiDesc] || "").toLowerCase().includes("tổng chi")) continue;
      if (String(row[colChiCat] || "").toLowerCase().includes("tổng chi")) continue;

      const desc = String(row[colChiDesc] || "").trim();
      const cat = String(row[colChiCat] || "").trim();
      const payer = String(row[colChiPayer] || "").trim();
      const rawAmt = row[colChiAmt];
      const hasRawAmt =
        rawAmt !== "" && rawAmt !== null && rawAmt !== undefined;

      if (!desc && !cat && !payer && !hasRawAmt) continue;

      const amt = parseVndAmount(rawAmt, `Sheet '5. Chi' dòng ${r + 1}`, {
        allowEmptyZero: true,
      });
      if (!desc && amt === 0) continue;

      let exportedMatchId: number | null = null;
      if (colChiMatchId !== -1) {
        const rawMatchId = row[colChiMatchId];
        if (
          rawMatchId !== "" &&
          rawMatchId !== null &&
          rawMatchId !== undefined
        ) {
          const parsedMatchId = parseNullableInt(
            rawMatchId,
            `Sheet '5. Chi' Mã Trận dòng ${r + 1}`
          );
          if (parsedMatchId !== null && parsedMatchId <= 0) {
            throw new ImportValidationError(
              `Sheet '5. Chi' dòng ${r + 1}: Mã trận phải là số nguyên dương.`
            );
          }
          exportedMatchId = parsedMatchId;
        }
      }

      parsedExpenses.push({
        date: excelSerialToIsoDate(
          row[colChiDate],
          `Sheet '5. Chi' ngày dòng ${r + 1}`
        ),
        category: cat || "Tiền sân",
        description: desc,
        amount: amt,
        payer,
        exportedMatchId,
      });
    }

    // 7. Parse & Validate Sheet '4. Thu Khác' trong bộ nhớ
    let thuKhacHeaderIdx = 3;
    let colTkDate = 2;
    let colTkContributor = 3;
    let colTkAmt = 4;
    let colTkNote = 5;
    let colTkFundType = -1;

    for (let r = 0; r < Math.min(10, thuKhacRows.length); r++) {
      const row = thuKhacRows[r] || [];
      const contIdx = row.findIndex((c) =>
        String(c).trim().toLowerCase().includes("người ủng hộ")
      );
      if (contIdx !== -1) {
        thuKhacHeaderIdx = r;
        colTkContributor = contIdx;
        const dateIdx = row.findIndex((c) =>
          String(c).trim().toLowerCase() === "ngày"
        );
        if (dateIdx !== -1) colTkDate = dateIdx;
        const amtIdx = row.findIndex((c) =>
          String(c).trim().toLowerCase().includes("số tiền")
        );
        if (amtIdx !== -1) colTkAmt = amtIdx;
        const noteIdx = row.findIndex((c) =>
          String(c).trim().toLowerCase().includes("ghi chú")
        );
        if (noteIdx !== -1) colTkNote = noteIdx;
        const fundIdx = row.findIndex((c) =>
          String(c).trim().toLowerCase().includes("loại quỹ")
        );
        if (fundIdx !== -1) colTkFundType = fundIdx;
        break;
      }
    }

    const parsedOtherIncomes: ParsedOtherIncomeData[] = [];

    for (let r = thuKhacHeaderIdx + 1; r < thuKhacRows.length; r++) {
      const row = thuKhacRows[r];
      if (!row) continue;
      if (
        String(row[colTkContributor] || "")
          .toLowerCase()
          .includes("tổng thu khác")
      ) {
        continue;
      }

      const contributor = String(row[colTkContributor] || "").trim();
      const note = String(row[colTkNote] || "").trim();
      const rawAmt = row[colTkAmt];
      const hasRawAmt =
        rawAmt !== "" && rawAmt !== null && rawAmt !== undefined;

      if (!contributor && !note && !hasRawAmt) continue;

      const amount = parseVndAmount(rawAmt, `Sheet '4. Thu Khác' dòng ${r + 1}`, {
        allowEmptyZero: true,
      });

      // NGUYÊN TẮC TÀI CHÍNH CHUẨN: Chỉ ghi nhận các khoản thu THỰC TẾ với amount > 0
      if (amount <= 0) continue;

      const fundType =
        colTkFundType !== -1
          ? String(row[colTkFundType] || "").trim() || "Quỹ sinh hoạt"
          : "Quỹ sinh hoạt";

      parsedOtherIncomes.push({
        date: excelSerialToIsoDate(
          row[colTkDate],
          `Sheet '4. Thu Khác' ngày dòng ${r + 1}`
        ),
        contributor: contributor || "Quỹ giải đội bóng",
        amount,
        fundType,
        note,
      });
    }

    // 8. Parse & Validate Sheet '3. Thu Trận (Tích chọn)' và (nếu có) '6. Dữ liệu Chi tiết (App)'
    let dateRowIdx = 4;
    let feeRowIdx = 5;
    let thuTranHeaderIdx = 6;

    for (let r = 0; r < Math.min(10, thuTranRows.length); r++) {
      const str = (thuTranRows[r] || [])
        .map((c) => String(c).toLowerCase())
        .join(" ");
      if (str.includes("ngày/tháng") || str.includes("trận 1")) dateRowIdx = r;
      if (str.includes("số tiền/trận")) feeRowIdx = r;
      if (str.includes("tổng đã nộp") || str.includes("tích chọn"))
        thuTranHeaderIdx = r;
    }

    const headerRow = thuTranRows[dateRowIdx] || [];
    const feeRow = thuTranRows[feeRowIdx] || [];

    interface DetectedMatchCol {
      col: number;
      label: string;
      fee: number;
      matchIdx: number;
    }
    const detectedMatchCols: DetectedMatchCol[] = [];
    let currentMatchCounter = 1;

    for (let col = 0; col < headerRow.length; col++) {
      const rawLabel = String(headerRow[col] || "").trim();
      if (
        /trận\s+\d+/i.test(rawLabel) ||
        rawLabel.toLowerCase().startsWith("trận")
      ) {
        const fee = parseVndAmount(
          feeRow[col],
          `Sheet '3. Thu Trận (Tích chọn)' mức phí cột ${col + 1}`,
          { defaultIfEmpty: 100000 }
        );
        detectedMatchCols.push({
          col,
          label: rawLabel,
          fee,
          matchIdx: currentMatchCounter++,
        });
      }
    }

    let thuTranPlayerRowStart = thuTranHeaderIdx + 2;
    let colThuTranName = 2;
    let colThuTranShort = 3;

    for (let r = 0; r < Math.min(15, thuTranRows.length); r++) {
      const row = thuTranRows[r] || [];
      const nameIdx = row.findIndex(
        (c) => String(c).trim().toLowerCase() === "họ và tên"
      );
      if (nameIdx !== -1) {
        colThuTranName = nameIdx;
        const shortIdx = row.findIndex(
          (c) => String(c).trim().toLowerCase() === "tên"
        );
        if (shortIdx !== -1) colThuTranShort = shortIdx;
        thuTranPlayerRowStart = r + 2;
        break;
      }
    }

    // Cập nhật short_name từ Sheet 3 vào playersToInsert trong bộ nhớ
    const shortNameByLowerName = new Map<string, string>();
    for (let r = thuTranPlayerRowStart; r < thuTranRows.length; r++) {
      const row = thuTranRows[r];
      if (!row) continue;
      const fullName = String(row[colThuTranName] || "").trim();
      if (!fullName) continue;
      const shortNameInSheet = String(row[colThuTranShort] || "").trim();
      if (shortNameInSheet) {
        shortNameByLowerName.set(fullName.toLowerCase(), shortNameInSheet);
      }
    }
    for (const p of playersToInsert) {
      const overrideShort = shortNameByLowerName.get(p.fullName.toLowerCase());
      if (overrideShort) {
        p.shortName = overrideShort;
      }
    }

    let parsedMatches: ParsedMatchData[] = [];
    let parsedAttendances: ParsedAttendanceData[] = [];

    if (wsDetail) {
      const detailParsed = parseDetailSheet(wsDetail);
      for (const att of detailParsed.attendances) {
        if (!seenPlayerNames.has(att.playerNameNormalized)) {
          throw new ImportValidationError(
            `Sheet '6. Dữ liệu Chi tiết (App)': Không tìm thấy cầu thủ "${att.playerNameRaw}" trong sheet '2. Danh sách'.`
          );
        }
      }
      parsedMatches = detailParsed.matches;
      parsedAttendances = detailParsed.attendances;
    } else {
      // Tương thích ngược với workbook 5 sheet cũ
      const pitchExpenses = parsedExpenses.filter(
        (e) => e.category === "Tiền sân"
      );
      const colToMatchIndex = new Map<number, number>();

      for (const mCol of detectedMatchCols) {
        const col = mCol.col;
        const label = mCol.label;
        const matchIdx = mCol.matchIdx;
        const fee = mCol.fee;

        let hasAnyPaid = false;
        for (let r = thuTranPlayerRowStart; r < thuTranRows.length; r++) {
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
        if (
          !hasAnyPaid &&
          !matchedPitchExp &&
          !label.includes("-") &&
          matchIdx > 15
        ) {
          continue;
        }

        const matchDate = matchedPitchExp
          ? matchedPitchExp.date
          : excelSerialToIsoDate(
              label.split("-")[1] || "",
              `Sheet '3. Thu Trận (Tích chọn)' ngày trận "${label}"`
            );
        const payer = matchedPitchExp?.payer || "Tiếng";
        const venue = payer.includes("-")
          ? `Sân ${payer.split("-")[1].trim()}`
          : "Sân Vĩnh Lộc";
        const pitchCost = matchedPitchExp?.amount || 0;

        colToMatchIndex.set(col, parsedMatches.length);
        parsedMatches.push({
          exportedId: null,
          matchNumber: matchIdx,
          label,
          matchDate,
          kickoffTime: "19:00",
          venue,
          opponent: "Sinh hoạt / Giao hữu tuần",
          feePerPlayer: fee,
          pitchCost,
          payerName: payer,
          teamScore: null,
          opponentScore: null,
          status: hasAnyPaid ? "Đã kết thúc" : "Sắp diễn ra",
          notes: "",
        });
      }

      for (let r = thuTranPlayerRowStart; r < thuTranRows.length; r++) {
        const row = thuTranRows[r];
        if (!row) continue;
        const fullName = String(row[colThuTranName] || "").trim();
        if (!fullName) continue;
        const normalizedName = fullName.toLowerCase();
        if (!seenPlayerNames.has(normalizedName)) continue;

        for (const [col, matchIndex] of colToMatchIndex.entries()) {
          const val = row[col];
          const isPaid =
            val === true ||
            val === 1 ||
            String(val).toLowerCase() === "true" ||
            String(val).toLowerCase() === "x";
          const fee = parsedMatches[matchIndex].feePerPlayer;
          parsedAttendances.push({
            matchIndex,
            playerNameRaw: fullName,
            playerNameNormalized: normalizedName,
            rsvpStatus: isPaid ? "registered" : "none",
            walkIn: 0,
            attended: isPaid ? 1 : 0,
            paid: isPaid ? 1 : 0,
            amount: isPaid ? fee : 0,
            collectedBy: "Tiếng",
            note: "",
          });
        }
      }
    }

    // Kiểm tra tham chiếu match_id của expenses TRƯỚC khi mở transaction
    const validExportedMatchIds = new Set<number>();
    for (const m of parsedMatches) {
      if (m.exportedId !== null) {
        validExportedMatchIds.add(m.exportedId);
      }
    }
    for (const exp of parsedExpenses) {
      if (
        exp.exportedMatchId !== null &&
        !validExportedMatchIds.has(exp.exportedMatchId)
      ) {
        throw new ImportValidationError(
          `Sheet '5. Chi': Mã trận (${exp.exportedMatchId}) không tồn tại trong danh sách trận đấu.`
        );
      }
    }

    const prevStatusByName = new Map(
      existingPlayers.map((ep) => [ep.full_name.trim().toLowerCase(), ep.status])
    );

    // Đảm bảo bảng audit_logs đã sẵn sàng TRƯỚC khi mở transaction (tránh DDL/lock lồng nhau)
    await ensureAuditLogsReady();

    // 9. Thực thi toàn bộ DELETE + INSERT + Lifecycle + Audit trong MỘT DB Transaction nguyên tử
    await db.transaction(async (tx) => {
      await tx.exec(`
        DELETE FROM match_attendances;
        DELETE FROM expenses;
        DELETE FROM other_incomes;
        DELETE FROM matches;
        DELETE FROM players;
      `);

      const playerIdByName = new Map<string, number>();

      for (const p of playersToInsert) {
        const res = await tx.run(
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

        const insertedPlayerId = Number(res.lastInsertRowid);
        const normalizedName = p.fullName.trim().toLowerCase();
        playerIdByName.set(normalizedName, insertedPlayerId);

        const prevStatus = prevStatusByName.get(normalizedName);
        if (prevStatus && prevStatus !== p.status) {
          await recordPlayerLifecycleEvent({
            db: tx,
            playerId: insertedPlayerId,
            eventType: "status_changed",
            fromStatus: prevStatus,
            toStatus: p.status,
            actorId: auth.session?.playerId ?? null,
            source: "import",
          });
        } else if (!prevStatus) {
          await recordPlayerLifecycleEvent({
            db: tx,
            playerId: insertedPlayerId,
            eventType: "joined",
            fromStatus: null,
            toStatus: p.status,
            actorId: auth.session?.playerId ?? null,
            source: "import",
          });
        }
      }

      const insertedMatchIds: number[] = [];
      const exportedMatchIdToNewId = new Map<number, number>();

      for (const m of parsedMatches) {
        const res = await tx.run(
          `INSERT INTO matches (
            match_number, label, match_date, kickoff_time, venue,
            opponent, fee_per_player, pitch_cost, payer_name,
            team_score, opponent_score, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            m.matchNumber,
            m.label,
            m.matchDate,
            m.kickoffTime,
            m.venue,
            m.opponent,
            m.feePerPlayer,
            m.pitchCost,
            m.payerName,
            m.teamScore,
            m.opponentScore,
            m.status,
            m.notes,
          ]
        );
        const newMatchId = Number(res.lastInsertRowid);
        insertedMatchIds.push(newMatchId);
        if (m.exportedId !== null) {
          exportedMatchIdToNewId.set(m.exportedId, newMatchId);
        }
      }

      for (const att of parsedAttendances) {
        const matchId = insertedMatchIds[att.matchIndex];
        const playerId = playerIdByName.get(att.playerNameNormalized);
        if (!matchId) {
          throw new ImportValidationError(
            `Không tìm thấy match_id tương ứng cho dữ liệu điểm danh (matchIndex=${att.matchIndex}).`
          );
        }
        if (!playerId) {
          throw new ImportValidationError(
            `Không tìm thấy cầu thủ "${att.playerNameRaw}" khi lưu dữ liệu điểm danh.`
          );
        }

        await tx.run(
          `INSERT OR REPLACE INTO match_attendances (
            match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            matchId,
            playerId,
            att.rsvpStatus,
            att.walkIn,
            att.attended,
            att.paid,
            att.amount,
            att.collectedBy,
            att.note,
          ]
        );
      }

      for (const inc of parsedOtherIncomes) {
        await tx.run(
          `INSERT INTO other_incomes (income_date, contributor, amount, fund_type, note)
           VALUES (?, ?, ?, ?, ?)`,
          [inc.date, inc.contributor, inc.amount, inc.fundType, inc.note]
        );
      }

      for (const exp of parsedExpenses) {
        let resolvedMatchId: number | null = null;
        if (exp.exportedMatchId !== null) {
          const mapped = exportedMatchIdToNewId.get(exp.exportedMatchId);
          if (mapped === undefined) {
            throw new ImportValidationError(
              `Sheet '5. Chi': Mã trận (${exp.exportedMatchId}) không tồn tại trong danh sách trận đấu.`
            );
          }
          resolvedMatchId = mapped;
        }
        await tx.run(
          `INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            exp.date,
            exp.category,
            exp.description,
            exp.amount,
            exp.payer,
            resolvedMatchId,
          ]
        );
      }

      if (auth.session) {
        await recordAuditLog({
          actorId: auth.session.playerId,
          actorName: auth.session.fullName,
          actorRole: auth.session.accessRole,
          action: "import_excel",
          summary: `Import Excel: ${playersToInsert.length} cầu thủ, ${parsedMatches.length} trận, ${parsedExpenses.length} khoản chi`,
          tx,
        });
      }
    });

    const updated = await getFullAppData();

    return NextResponse.json(updated, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    if (err instanceof ImportValidationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("POST /api/import error:", err);
    return NextResponse.json(
      { error: "Không thể import file Excel. Vui lòng kiểm tra định dạng file." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
