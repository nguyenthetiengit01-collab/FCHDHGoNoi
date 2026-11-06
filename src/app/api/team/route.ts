import { NextRequest, NextResponse } from "next/server";
import { getDb, getFullAppData, seedInitialDataIfNeeded } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

export async function GET() {
  try {
    const data = getFullAppData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/team error:", error);
    return NextResponse.json(
      { error: "Không thể tải dữ liệu đội bóng" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body;
    const db = getDb();
    const session = getAuthSession(req);

    // Danh sách các hành động nhạy cảm yêu cầu quyền Ban Quản Lý (Manager)
    const MANAGER_ONLY_ACTIONS = new Set([
      "upsert_player",
      "delete_player",
      "reset_player_password",
      "upsert_match",
      "delete_match",
      "set_match_status",
      "quick_pitch_expense",
      "collect_match_fee",
      "add_walkin_player",
      "upsert_expense",
      "delete_expense",
      "upsert_other_income",
      "delete_other_income",
      "update_settings",
      "reset_to_excel",
    ]);

    if (MANAGER_ONLY_ACTIONS.has(action)) {
      if (!session || session.accessRole !== "manager") {
        return NextResponse.json(
          {
            error:
              "Thao tác yêu cầu quyền Ban Quản Lý (Manager). Vui lòng đăng nhập với tài khoản Ban Quản Lý.",
          },
          { status: 403 }
        );
      }
    }

    // Các hành động yêu cầu cầu thủ đã đăng nhập vào hệ thống
    if (action === "update_own_profile" || action === "change_own_password") {
      if (!session) {
        return NextResponse.json(
          { error: "Vui lòng đăng nhập để cập nhật hồ sơ cá nhân" },
          { status: 401 }
        );
      }
      if (
        session.accessRole !== "manager" &&
        Number(payload?.id) !== session.playerId
      ) {
        return NextResponse.json(
          {
            error:
              "Bảo mật: Bạn chỉ có thể cập nhật tài khoản cá nhân của chính mình",
          },
          { status: 403 }
        );
      }
    }

    if (action === "set_rsvp") {
      if (!session) {
        return NextResponse.json(
          { error: "Vui lòng đăng nhập để điểm danh" },
          { status: 401 }
        );
      }
      if (
        session.accessRole !== "manager" &&
        Number(payload?.player_id) !== session.playerId
      ) {
        return NextResponse.json(
          {
            error:
              "Bảo mật: Bạn chỉ có thể thực hiện điểm danh cho tài khoản của chính mình",
          },
          { status: 403 }
        );
      }
    }

    switch (action) {
      case "upsert_player": {
        const {
          id,
          code_order,
          full_name,
          short_name,
          jersey_number,
          position,
          phone,
          birth_year,
          avatar_url,
          role,
          access_role,
          pin_code,
          status,
          notes,
        } = payload;

        const cleanName = String(full_name || "").trim();
        if (!cleanName) {
          return NextResponse.json(
            { error: "Vui lòng nhập họ và tên cầu thủ" },
            { status: 400 }
          );
        }
        const derivedShort =
          String(short_name || "").trim() ||
          cleanName.split(/\s+/).slice(-1)[0] ||
          cleanName;

        if (id) {
          const existing = db
            .prepare("SELECT pin_code FROM players WHERE id = ?")
            .get(Number(id)) as { pin_code: string } | undefined;
          const finalPin =
            String(pin_code || "").trim() || existing?.pin_code || "1234";

          db.prepare(`
            UPDATE players
            SET code_order = ?, full_name = ?, short_name = ?, jersey_number = ?,
                position = ?, phone = ?, birth_year = ?, avatar_url = ?, bio = ?,
                role = ?, access_role = ?, pin_code = ?, status = ?, notes = ?
            WHERE id = ?
          `).run(
            Number(code_order) || 1,
            cleanName,
            derivedShort,
            jersey_number !== "" &&
              jersey_number !== null &&
              jersey_number !== undefined
              ? Number(jersey_number)
              : null,
            position || "Đa năng",
            phone || "",
            birth_year || "",
            avatar_url || "/uploads/avatars/member-1.jpg",
            typeof payload.bio === "string" ? payload.bio : "",
            role || "Thành viên",
            access_role === "manager" ? "manager" : "player",
            finalPin,
            status || "Đang sinh hoạt",
            notes || "",
            Number(id)
          );
        } else {
          const maxRow = db
            .prepare(
              "SELECT COALESCE(MAX(code_order), 0) as maxOrder FROM players"
            )
            .get() as { maxOrder: number };
          const nextOrder = Number(code_order) || maxRow.maxOrder + 1;
          const res = db
            .prepare(`
            INSERT INTO players (
              code_order, full_name, short_name, jersey_number,
              position, phone, birth_year, avatar_url, bio, role, access_role, pin_code, status, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .run(
              nextOrder,
              cleanName,
              derivedShort,
              jersey_number !== "" &&
                jersey_number !== null &&
                jersey_number !== undefined
                ? Number(jersey_number)
                : null,
              position || "Đa năng",
              phone || "",
              birth_year || "",
              avatar_url || "/uploads/avatars/member-1.jpg",
              typeof payload.bio === "string" ? payload.bio : "",
              role || "Thành viên",
              access_role === "manager" ? "manager" : "player",
              String(pin_code || "1234").trim(),
              status || "Đang sinh hoạt",
              notes || ""
            );
          const newPlayerId = Number(res.lastInsertRowid);
          const existingMatches = db
            .prepare("SELECT id FROM matches")
            .all() as Array<{ id: number }>;
          const insAtt = db.prepare(`
            INSERT OR IGNORE INTO match_attendances (
              match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note
            )
            VALUES (?, ?, 'none', 0, 0, 0, 0, '', '')
          `);
          for (const m of existingMatches) {
            insAtt.run(m.id, newPlayerId);
          }
        }
        break;
      }

      // Cầu thủ chỉ được phép cập nhật thông tin cá nhân & ảnh đại diện của chính mình
      case "update_own_profile": {
        const {
          player_id,
          full_name,
          short_name,
          jersey_number,
          position,
          phone,
          birth_year,
          avatar_url,
          bio,
          notes,
        } = payload;

        if (!player_id) {
          return NextResponse.json(
            { error: "Thông tin cầu thủ không hợp lệ" },
            { status: 400 }
          );
        }
        const existingPlayer = db
          .prepare("SELECT full_name, short_name FROM players WHERE id = ?")
          .get(Number(player_id)) as
          | { full_name: string; short_name: string }
          | undefined;
        if (!existingPlayer) {
          return NextResponse.json(
            { error: "Không tìm thấy cầu thủ" },
            { status: 404 }
          );
        }

        const cleanName =
          String(full_name || "").trim() || existingPlayer.full_name;
        const derivedShort =
          String(short_name || "").trim() ||
          existingPlayer.short_name ||
          cleanName.split(/\s+/).slice(-1)[0] ||
          cleanName;

        db.prepare(`
          UPDATE players
          SET full_name = ?, short_name = ?, jersey_number = ?,
              position = ?, phone = ?, birth_year = ?, avatar_url = ?, bio = ?, notes = ?
          WHERE id = ?
        `).run(
          cleanName,
          derivedShort,
          jersey_number !== "" &&
            jersey_number !== null &&
            jersey_number !== undefined
            ? Number(jersey_number)
            : null,
          position || "Đa năng",
          phone || "",
          birth_year !== null && birth_year !== undefined
            ? String(birth_year)
            : "",
          avatar_url || "/uploads/avatars/member-1.jpg",
          typeof bio === "string" ? bio : "",
          notes || "",
          Number(player_id)
        );
        break;
      }

      // Cầu thủ tự đổi mật khẩu (PIN) của chính mình
      case "change_own_password": {
        const { player_id, current_pin, old_pin, new_pin } = payload;
        const providedOldPin = String(old_pin ?? current_pin ?? "").trim();
        const cleanNew = String(new_pin || "").trim();
        if (!cleanNew || cleanNew.length < 4) {
          return NextResponse.json(
            { error: "Mật khẩu mới cần có ít nhất 4 ký tự" },
            { status: 400 }
          );
        }
        const row = db
          .prepare("SELECT pin_code FROM players WHERE id = ?")
          .get(Number(player_id)) as { pin_code: string } | undefined;
        if (!row) {
          return NextResponse.json(
            { error: "Không tìm thấy hồ sơ cầu thủ" },
            { status: 404 }
          );
        }
        if ((row.pin_code || "1234") !== providedOldPin) {
          return NextResponse.json(
            { error: "Mật khẩu hiện tại không đúng" },
            { status: 400 }
          );
        }
        db.prepare("UPDATE players SET pin_code = ? WHERE id = ?").run(
          cleanNew,
          Number(player_id)
        );
        break;
      }

      // Ban quản lý reset mật khẩu giúp cầu thủ
      case "reset_player_password": {
        const { player_id, new_pin } = payload;
        const cleanPin = String(new_pin || "1234").trim() || "1234";
        db.prepare("UPDATE players SET pin_code = ? WHERE id = ?").run(
          cleanPin,
          Number(player_id)
        );
        break;
      }

      case "delete_player": {
        const { id } = payload;
        db.prepare("DELETE FROM players WHERE id = ?").run(Number(id));
        break;
      }

      case "upsert_match": {
        const {
          id,
          match_number,
          label,
          match_date,
          kickoff_time,
          venue,
          opponent,
          fee_per_player,
          pitch_cost,
          payer_name,
          team_score,
          opponent_score,
          status,
          notes,
          sync_pitch_expense,
        } = payload;

        const fee = Number(fee_per_player) || 100000;
        const pitchCostNum = Number(pitch_cost) || 0;

        if (id) {
          db.prepare(`
            UPDATE matches
            SET match_number = ?, label = ?, match_date = ?, kickoff_time = ?,
                venue = ?, opponent = ?, fee_per_player = ?, pitch_cost = ?,
                payer_name = ?, team_score = ?, opponent_score = ?, status = ?, notes = ?
            WHERE id = ?
          `).run(
            Number(match_number) || 1,
            label || `Trận ${match_number}`,
            match_date || "2026-11-03",
            kickoff_time || "19:00",
            venue || "Sân Vĩnh Lộc",
            opponent || "Giao hữu / Nội bộ",
            fee,
            pitchCostNum,
            payer_name || "Tiếng",
            team_score !== "" &&
              team_score !== null &&
              team_score !== undefined
              ? Number(team_score)
              : null,
            opponent_score !== "" &&
              opponent_score !== null &&
              opponent_score !== undefined
              ? Number(opponent_score)
              : null,
            status || "Đã kết thúc",
            notes || "",
            Number(id)
          );

          if (sync_pitch_expense && pitchCostNum > 0) {
            const existingExp = db
              .prepare(
                "SELECT id FROM expenses WHERE match_id = ? AND category = 'Tiền sân'"
              )
              .get(Number(id)) as { id: number } | undefined;
            if (existingExp) {
              db.prepare(`
                UPDATE expenses
                SET expense_date = ?, description = ?, amount = ?, payer = ?
                WHERE id = ?
              `).run(
                match_date,
                `Tiền sân ${label}`,
                pitchCostNum,
                payer_name || "Tiếng",
                existingExp.id
              );
            } else {
              db.prepare(`
                INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
                VALUES (?, 'Tiền sân', ?, ?, ?, ?)
              `).run(
                match_date,
                `Tiền sân ${label}`,
                pitchCostNum,
                payer_name || "Tiếng",
                Number(id)
              );
            }
          }
        } else {
          const maxMatch = db
            .prepare(
              "SELECT COALESCE(MAX(match_number), 0) as maxNum FROM matches"
            )
            .get() as { maxNum: number };
          const nextNum = Number(match_number) || maxMatch.maxNum + 1;
          const dateStr = match_date || new Date().toISOString().slice(0, 10);
          const [, monthStr, dayStr] = dateStr.split("-");
          const computedLabel =
            String(label || "").trim() ||
            `Trận ${nextNum} - ${dayStr}/${Number(monthStr)}`;

          const res = db
            .prepare(`
            INSERT INTO matches (
              match_number, label, match_date, kickoff_time, venue,
              opponent, fee_per_player, pitch_cost, payer_name,
              team_score, opponent_score, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .run(
              nextNum,
              computedLabel,
              dateStr,
              kickoff_time || "19:00",
              venue || "Sân Vĩnh Lộc",
              opponent || "Giao hữu / Nội bộ",
              fee,
              pitchCostNum,
              payer_name || "Tiếng",
              team_score !== "" &&
                team_score !== null &&
                team_score !== undefined
                ? Number(team_score)
                : null,
              opponent_score !== "" &&
                opponent_score !== null &&
                opponent_score !== undefined
                ? Number(opponent_score)
                : null,
              status || "Sắp diễn ra",
              notes || ""
            );

          const newMatchId = Number(res.lastInsertRowid);
          const allPlayers = db
            .prepare("SELECT id FROM players")
            .all() as Array<{ id: number }>;
          const insAtt = db.prepare(`
            INSERT OR IGNORE INTO match_attendances (
              match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note
            )
            VALUES (?, ?, 'none', 0, 0, 0, 0, '', '')
          `);
          for (const p of allPlayers) {
            insAtt.run(newMatchId, p.id);
          }

          if (sync_pitch_expense && pitchCostNum > 0) {
            db.prepare(`
              INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
              VALUES (?, 'Tiền sân', ?, ?, ?, ?)
            `).run(
              dateStr,
              `Tiền sân trận tuần ${nextNum} (${computedLabel})`,
              pitchCostNum,
              payer_name || "Tiếng",
              newMatchId
            );
          }
        }
        break;
      }

      case "delete_match": {
        const { id } = payload;
        db.prepare("DELETE FROM expenses WHERE match_id = ?").run(Number(id));
        db.prepare("DELETE FROM matches WHERE id = ?").run(Number(id));
        break;
      }

      // Chuyển nhanh trạng thái trận đấu: "Sắp diễn ra" <-> "Đã kết thúc"
      case "set_match_status": {
        const { match_id, status, team_score, opponent_score } = payload;
        if (!match_id) {
          return NextResponse.json(
            { error: "Thiếu mã trận đấu" },
            { status: 400 }
          );
        }
        const newStatus =
          status === "Sắp diễn ra" ? "Sắp diễn ra" : "Đã kết thúc";
        if (team_score !== undefined || opponent_score !== undefined) {
          db.prepare(`
            UPDATE matches
            SET status = ?,
                team_score = ?,
                opponent_score = ?
            WHERE id = ?
          `).run(
            newStatus,
            team_score !== "" && team_score !== null && team_score !== undefined
              ? Number(team_score)
              : null,
            opponent_score !== "" &&
              opponent_score !== null &&
              opponent_score !== undefined
              ? Number(opponent_score)
              : null,
            Number(match_id)
          );
        } else {
          db.prepare("UPDATE matches SET status = ? WHERE id = ?").run(
            newStatus,
            Number(match_id)
          );
        }
        break;
      }

      // Ghi nhanh Chi Tiền Sân tiện lợi cho Ban Quản Lý
      case "quick_pitch_expense": {
        const { match_id, venue, pitch_cost, payer_name, expense_date } =
          payload;
        const costNum = Number(pitch_cost) || 0;
        const cleanVenue = String(venue || "Sân Vĩnh Lộc").trim();
        const shortVenue = cleanVenue.replace(/^Sân\s+/i, "");
        const rawPayer = String(payer_name || "Tiếng").trim();
        const formattedPayer = rawPayer.includes("-")
          ? rawPayer
          : `${rawPayer} - ${shortVenue}`;

        if (match_id) {
          const mRow = db
            .prepare(
              "SELECT id, match_number, label, match_date FROM matches WHERE id = ?"
            )
            .get(Number(match_id)) as
            | {
                id: number;
                match_number: number;
                label: string;
                match_date: string;
              }
            | undefined;

          if (mRow) {
            db.prepare(`
              UPDATE matches
              SET venue = ?, pitch_cost = ?, payer_name = ?
              WHERE id = ?
            `).run(cleanVenue, costNum, formattedPayer, mRow.id);

            const existingExp = db
              .prepare(
                `SELECT id FROM expenses
                 WHERE category = 'Tiền sân'
                   AND (match_id = ? OR description LIKE ?)`
              )
              .get(
                mRow.id,
                `%tuần ${mRow.match_number} %`
              ) as { id: number } | undefined;

            const desc = `Tiền sân trận tuần ${mRow.match_number} - ${mRow.label.replace(/^Trận\s+\d+\s*-\s*/i, "")}`;
            if (existingExp) {
              db.prepare(`
                UPDATE expenses
                SET expense_date = ?, description = ?, amount = ?, payer = ?, match_id = ?
                WHERE id = ?
              `).run(
                mRow.match_date,
                desc,
                costNum,
                formattedPayer,
                mRow.id,
                existingExp.id
              );
            } else if (costNum > 0) {
              db.prepare(`
                INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
                VALUES (?, 'Tiền sân', ?, ?, ?, ?)
              `).run(
                mRow.match_date,
                desc,
                costNum,
                formattedPayer,
                mRow.id
              );
            }
          }
        } else if (costNum > 0) {
          const dStr =
            String(expense_date || "").trim() ||
            new Date().toISOString().slice(0, 10);
          const [, mm, dd] = dStr.split("-");
          db.prepare(`
            INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
            VALUES (?, 'Tiền sân', ?, ?, ?, NULL)
          `).run(
            dStr,
            `Tiền sân ${cleanVenue} ngày ${dd}/${Number(mm)}`,
            costNum,
            formattedPayer
          );
        }
        break;
      }

      // PHẦN 1: ĐIỂM DANH BÁO LỊCH TUẦN (Cầu thủ tự báo hoặc Quản lý điểm danh trước trận)
      case "set_rsvp": {
        const { match_id, player_id, rsvp_status, note } = payload;
        const validRsvp =
          rsvp_status === "registered" || rsvp_status === "absent_notice"
            ? rsvp_status
            : "none";

        db.prepare(`
          INSERT INTO match_attendances (
            match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note
          )
          VALUES (?, ?, ?, 0, 0, 0, 0, '', ?)
          ON CONFLICT(match_id, player_id)
          DO UPDATE SET
            rsvp_status = excluded.rsvp_status,
            note = COALESCE(NULLIF(excluded.note, ''), match_attendances.note)
        `).run(
          Number(match_id),
          Number(player_id),
          validRsvp,
          String(note || "")
        );
        break;
      }

      // PHẦN 2: THU TIỀN TRẬN (Dành riêng cho 2-3 người có trách nhiệm quản lý thu tiền)
      case "collect_match_fee": {
        const {
          match_id,
          player_id,
          attended,
          paid,
          amount,
          walk_in,
          collected_by,
          note,
        } = payload;

        const matchRow = db
          .prepare("SELECT fee_per_player FROM matches WHERE id = ?")
          .get(Number(match_id)) as { fee_per_player: number } | undefined;
        const defaultFee = matchRow?.fee_per_player ?? 100000;

        const isPaid = Number(paid) === 1 ? 1 : 0;
        const isAttended =
          isPaid === 1 || Number(attended) === 1 ? 1 : 0;
        const finalAmount =
          amount !== undefined && amount !== null && amount !== ""
            ? Number(amount)
            : isAttended
            ? defaultFee
            : 0;
        const isWalkIn = Number(walk_in) === 1 ? 1 : 0;

        db.prepare(`
          INSERT INTO match_attendances (
            match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note
          )
          VALUES (?, ?, 'none', ?, ?, ?, ?, ?, ?)
          ON CONFLICT(match_id, player_id)
          DO UPDATE SET
            walk_in = CASE WHEN excluded.walk_in = 1 THEN 1 ELSE match_attendances.walk_in END,
            attended = excluded.attended,
            paid = excluded.paid,
            amount = excluded.amount,
            collected_by = CASE WHEN excluded.collected_by != '' THEN excluded.collected_by ELSE match_attendances.collected_by END,
            note = CASE WHEN excluded.note != '' THEN excluded.note ELSE match_attendances.note END
        `).run(
          Number(match_id),
          Number(player_id),
          isWalkIn,
          isAttended,
          isPaid,
          finalAmount,
          String(collected_by || "Tiếng"),
          String(note || "")
        );
        break;
      }

      // Thêm cầu thủ không đăng ký trước (Walk-in: thành viên có sẵn hoặc khách/cầu thủ mới) vào danh sách tham gia & thu tiền
      case "add_walkin_player": {
        const {
          match_id,
          player_id,
          new_player_name,
          amount,
          paid,
          collected_by,
        } = payload;

        const matchRow = db
          .prepare("SELECT fee_per_player FROM matches WHERE id = ?")
          .get(Number(match_id)) as { fee_per_player: number } | undefined;
        const defaultFee = matchRow?.fee_per_player ?? 100000;
        const feeAmount =
          amount !== undefined && amount !== null && amount !== ""
            ? Number(amount)
            : defaultFee;
        const isPaid = paid === undefined ? 1 : Number(paid) === 1 ? 1 : 0;

        let targetPlayerId = Number(player_id) || 0;

        if (!targetPlayerId && String(new_player_name || "").trim()) {
          const cleanName = String(new_player_name).trim();
          const derivedShort =
            cleanName.split(/\s+/).slice(-1)[0] || cleanName;
          const maxRow = db
            .prepare(
              "SELECT COALESCE(MAX(code_order), 0) as maxOrder FROM players"
            )
            .get() as { maxOrder: number };
          const res = db
            .prepare(`
            INSERT INTO players (
              code_order, full_name, short_name, jersey_number,
              position, phone, role, access_role, pin_code, status, notes
            )
            VALUES (?, ?, ?, NULL, 'Đa năng', '', 'Thành viên', 'player', '1234', 'Đang sinh hoạt', 'Bổ sung trực tiếp tại sân')
          `)
            .run(maxRow.maxOrder + 1, cleanName, derivedShort);
          targetPlayerId = Number(res.lastInsertRowid);
        }

        if (!targetPlayerId) {
          return NextResponse.json(
            { error: "Vui lòng chọn cầu thủ hoặc nhập tên cầu thủ tham gia" },
            { status: 400 }
          );
        }

        db.prepare(`
          INSERT INTO match_attendances (
            match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note
          )
          VALUES (?, ?, 'none', 1, 1, ?, ?, ?, 'Tham gia không đăng ký trước')
          ON CONFLICT(match_id, player_id)
          DO UPDATE SET
            walk_in = 1,
            attended = 1,
            paid = excluded.paid,
            amount = excluded.amount,
            collected_by = excluded.collected_by,
            note = 'Tham gia không đăng ký trước'
        `).run(
          Number(match_id),
          targetPlayerId,
          isPaid,
          feeAmount,
          String(collected_by || "Tiếng")
        );
        break;
      }

      case "upsert_expense": {
        const {
          id,
          expense_date,
          category,
          description,
          amount,
          payer,
          match_id,
        } = payload;
        if (id) {
          db.prepare(`
            UPDATE expenses
            SET expense_date = ?, category = ?, description = ?, amount = ?, payer = ?, match_id = ?
            WHERE id = ?
          `).run(
            expense_date || "2026-11-03",
            category || "Tiền sân",
            description || "",
            Number(amount) || 0,
            payer || "",
            match_id ? Number(match_id) : null,
            Number(id)
          );
        } else {
          db.prepare(`
            INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            expense_date || new Date().toISOString().slice(0, 10),
            category || "Tiền sân",
            description || "",
            Number(amount) || 0,
            payer || "",
            match_id ? Number(match_id) : null
          );
        }
        break;
      }

      case "delete_expense": {
        const { id } = payload;
        db.prepare("DELETE FROM expenses WHERE id = ?").run(Number(id));
        break;
      }

      case "upsert_other_income": {
        const { id, income_date, contributor, amount, fund_type, note } =
          payload;
        if (id) {
          db.prepare(`
            UPDATE other_incomes
            SET income_date = ?, contributor = ?, amount = ?, fund_type = ?, note = ?
            WHERE id = ?
          `).run(
            income_date || "2026-11-03",
            contributor || "",
            Number(amount) || 0,
            fund_type || "Quỹ sinh hoạt",
            note || "",
            Number(id)
          );
        } else {
          db.prepare(`
            INSERT INTO other_incomes (income_date, contributor, amount, fund_type, note)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            income_date || new Date().toISOString().slice(0, 10),
            contributor || "",
            Number(amount) || 0,
            fund_type || "Quỹ sinh hoạt",
            note || ""
          );
        }
        break;
      }

      case "delete_other_income": {
        const { id } = payload;
        db.prepare("DELETE FROM other_incomes WHERE id = ?").run(Number(id));
        break;
      }

      case "update_settings": {
        const {
          team_name,
          short_name,
          default_match_fee,
          bank_bin,
          bank_name,
          bank_account_no,
          bank_account_name,
          tournament_fund_reserve,
          tournament_fund_note,
          fanpage_url,
        } = payload;
        db.prepare(`
          UPDATE team_settings
          SET team_name = ?, short_name = ?, default_match_fee = ?,
              bank_bin = ?, bank_name = ?, bank_account_no = ?, bank_account_name = ?,
              tournament_fund_reserve = ?, tournament_fund_note = ?, fanpage_url = ?
          WHERE id = 1
        `).run(
          team_name || "Đội Bóng HĐH Gò Nổi",
          short_name || "FC HĐH GÒ NỔI",
          Number(default_match_fee) || 100000,
          bank_bin || "970422",
          bank_name || "MB Bank",
          bank_account_no || "",
          bank_account_name || "NGUYEN THE TIENG",
          Number(tournament_fund_reserve) || 0,
          tournament_fund_note || "",
          fanpage_url || "https://www.facebook.com/FCHDHGoNoi/"
        );
        break;
      }

      case "reset_to_excel": {
        seedInitialDataIfNeeded(db, true);
        break;
      }

      default:
        return NextResponse.json(
          { error: `Hành động không hợp lệ: ${action}` },
          { status: 400 }
        );
    }

    const updated = getFullAppData();
    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/team error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lưu dữ liệu" },
      { status: 500 }
    );
  }
}
