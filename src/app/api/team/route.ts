import { NextRequest, NextResponse } from "next/server";
import {
  getAsyncDb,
  getFullAppData,
  seedAsyncInitialDataIfNeeded,
  ensureClubPostsReady,
  ensureSponsorsReady,
} from "@/lib/db";
import {
  getAuthSession,
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  createSessionToken,
  SESSION_COOKIE_NAME,
  requireManagerSession,
  requirePlayerSession,
  verifyCsrfOrigin,
  sanitizeDataForPublic,
  sanitizeDataForPlayer,
} from "@/lib/auth";
import { ensureWebpDataUrlServer } from "@/lib/serverWebp";
import { formatBirthYear } from "@/lib/athleteProfile";
import type { FullAppData } from "@/types/app";

export async function GET(req: NextRequest) {
  try {
    const data = await getFullAppData();
    const session = getAuthSession(req);

    let sanitizedData: FullAppData;
    if (session && session.accessRole === "manager") {
      // Ban Quản Lý: Được xem toàn bộ dữ liệu (mã PIN vẫn luôn để trống vì lý do an ninh)
      sanitizedData = {
        ...data,
        players: data.players.map((p) => ({ ...p, pin_code: "" })),
      };
    } else if (session) {
      // Cầu thủ đăng nhập: Xem số liệu chung và hồ sơ của mình, ẩn SĐT/ghi chú riêng tư của người khác
      sanitizedData = sanitizeDataForPlayer(data, session.playerId);
    } else {
      // Khách (Guest): Chỉ nhận thông tin công khai (ẩn liên hệ, ghi chú, sổ hóa đơn chi tiết)
      sanitizedData = sanitizeDataForPublic(data);
    }

    return NextResponse.json(sanitizedData, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("GET /api/team error:", error);
    return NextResponse.json(
      { error: "Không thể tải dữ liệu đội bóng" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Chống CSRF trên toàn bộ mutating actions
    if (!verifyCsrfOrigin(req)) {
      return NextResponse.json(
        { error: "Yêu cầu bị từ chối do vi phạm bảo mật CSRF / Origin." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await req.json();
    const { action, payload } = body;
    const db = getAsyncDb();
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
      "collect_match_fees_batch",
      "add_walkin_player",
      "upsert_expense",
      "delete_expense",
      "upsert_other_income",
      "delete_other_income",
      "update_settings",
      "upsert_club_post",
      "delete_club_post",
      "upsert_sponsor",
      "delete_sponsor",
      "reset_to_excel",
    ]);

    if (MANAGER_ONLY_ACTIONS.has(action)) {
      const auth = await requireManagerSession(req);
      if (!auth.authorized) {
        return NextResponse.json(
          {
            error:
              auth.error ||
              "Thao tác yêu cầu quyền Ban Quản Lý (Manager). Vui lòng đăng nhập với tài khoản Ban Quản Lý.",
          },
          { status: auth.status, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Các hành động yêu cầu cầu thủ đã đăng nhập vào hệ thống
    if (action === "update_own_profile" || action === "change_own_password") {
      const auth = await requirePlayerSession(req);
      if (!auth.authorized) {
        return NextResponse.json(
          { error: auth.error || "Vui lòng đăng nhập để cập nhật hồ sơ cá nhân" },
          { status: auth.status, headers: { "Cache-Control": "no-store" } }
        );
      }
      const targetPlayerId = Number(payload?.player_id ?? payload?.id);
      if (
        auth.player?.access_role !== "manager" &&
        targetPlayerId !== auth.player?.id
      ) {
        return NextResponse.json(
          {
            error:
              "Bảo mật: Bạn chỉ có thể cập nhật tài khoản cá nhân của chính mình",
          },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    if (action === "set_rsvp") {
      const auth = await requirePlayerSession(req);
      if (!auth.authorized) {
        return NextResponse.json(
          { error: auth.error || "Vui lòng đăng nhập để điểm danh" },
          { status: auth.status, headers: { "Cache-Control": "no-store" } }
        );
      }
      if (
        auth.player?.access_role !== "manager" &&
        Number(payload?.player_id) !== auth.player?.id
      ) {
        return NextResponse.json(
          {
            error:
              "Bảo mật: Bạn chỉ có thể thực hiện điểm danh cho tài khoản của chính mình",
          },
          { status: 403, headers: { "Cache-Control": "no-store" } }
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
          profile_image_url,
          role,
          access_role,
          pin_code,
          status,
          notes,
          hometown,
          nickname,
          playing_style,
          bio,
          gallery_urls,
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

        const webpAvatar = await ensureWebpDataUrlServer(
          avatar_url || "/uploads/avatars/member-1.jpg",
          { maxWidth: 600, maxHeight: 800, quality: 85 }
        );

        let webpProfileImage: string | undefined = undefined;
        if (profile_image_url !== undefined) {
          webpProfileImage = profile_image_url
            ? await ensureWebpDataUrlServer(profile_image_url, {
                maxWidth: 1600,
                maxHeight: 1000,
                quality: 88,
              })
            : "";
        }

        // Chuyển đổi WebP cho album ảnh cá nhân nếu có
        const rawGal = Array.isArray(gallery_urls)
          ? gallery_urls.map(String).filter(Boolean)
          : [];
        const webpGallery: string[] = [];
        for (const gUrl of rawGal) {
          const conv = await ensureWebpDataUrlServer(gUrl, {
            maxWidth: 1000,
            maxHeight: 1000,
            quality: 85,
          });
          if (conv) webpGallery.push(conv);
        }

        if (id) {
          const existing = await db.queryOne<{
            pin_code: string;
            gallery_urls_json: string;
            profile_image_url?: string;
          }>(
            "SELECT pin_code, gallery_urls_json, profile_image_url FROM players WHERE id = ?",
            [Number(id)]
          );
          const rawPin = String(pin_code || "").trim();
          let finalPin = existing?.pin_code || "1234";
          if (rawPin) {
            finalPin = rawPin.startsWith("scrypt$") ? rawPin : hashPassword(rawPin);
          }
          const finalGalleryJson =
            gallery_urls !== undefined
              ? JSON.stringify(webpGallery)
              : existing?.gallery_urls_json || "[]";
          const finalProfileImage =
            profile_image_url !== undefined
              ? (webpProfileImage || "")
              : existing?.profile_image_url || "";

          await db.run(
            `UPDATE players
            SET code_order = ?, full_name = ?, short_name = ?, jersey_number = ?,
                position = ?, phone = ?, birth_year = ?, avatar_url = ?, profile_image_url = ?, bio = ?,
                role = ?, access_role = ?, pin_code = ?, status = ?, notes = ?,
                hometown = ?, nickname = ?, playing_style = ?, gallery_urls_json = ?
            WHERE id = ?`,
            [
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
              formatBirthYear(birth_year),
              webpAvatar,
              finalProfileImage,
              typeof bio === "string" ? bio : typeof payload.bio === "string" ? payload.bio : "",
              role || "Thành viên",
              access_role === "manager" ? "manager" : "player",
              finalPin,
              status || "Đang sinh hoạt",
              notes || "",
              String(hometown || "").trim(),
              String(nickname || "").trim(),
              String(playing_style || "").trim(),
              finalGalleryJson,
              Number(id),
            ]
          );
        } else {
          const maxRow = await db.queryOne<{ maxOrder: number }>(
            "SELECT COALESCE(MAX(code_order), 0) as maxOrder FROM players"
          );
          const nextOrder = Number(code_order) || ((maxRow?.maxOrder ?? 0) + 1);
          const res = await db.run(
            `INSERT INTO players (
              code_order, full_name, short_name, jersey_number,
              position, phone, birth_year, avatar_url, profile_image_url, bio, role, access_role, pin_code, status, notes,
              hometown, nickname, playing_style, gallery_urls_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
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
              formatBirthYear(birth_year),
              webpAvatar,
              webpProfileImage || "",
              typeof bio === "string" ? bio : typeof payload.bio === "string" ? payload.bio : "",
              role || "Thành viên",
              access_role === "manager" ? "manager" : "player",
              String(pin_code || "1234").trim().startsWith("scrypt$")
                ? String(pin_code || "1234").trim()
                : hashPassword(String(pin_code || "1234").trim()),
              status || "Đang sinh hoạt",
              notes || "",
              String(hometown || "").trim(),
              String(nickname || "").trim(),
              String(playing_style || "").trim(),
              JSON.stringify(webpGallery),
            ]
          );
          const newPlayerId = Number(res.lastInsertRowid);
          const existingMatches = await db.query<{ id: number }>(
            "SELECT id FROM matches"
          );
          for (const m of existingMatches) {
            await db.run(
              `INSERT OR IGNORE INTO match_attendances (
                match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note
              )
              VALUES (?, ?, 'none', 0, 0, 0, 0, '', '')`,
              [m.id, newPlayerId]
            );
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
          profile_image_url,
          bio,
          notes,
          hometown,
          nickname,
          playing_style,
          gallery_urls,
        } = payload;

        if (!player_id) {
          return NextResponse.json(
            { error: "Thông tin cầu thủ không hợp lệ" },
            { status: 400 }
          );
        }
        const existingPlayer = await db.queryOne<{ full_name: string; short_name: string }>(
          "SELECT full_name, short_name FROM players WHERE id = ?",
          [Number(player_id)]
        );
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

        const webpAvatar = await ensureWebpDataUrlServer(
          avatar_url || "/uploads/avatars/member-1.jpg",
          { maxWidth: 600, maxHeight: 800, quality: 85 }
        );

        const hasProfileImageInPayload = profile_image_url !== undefined;
        let webpProfileImage = "";
        if (hasProfileImageInPayload && profile_image_url) {
          webpProfileImage = await ensureWebpDataUrlServer(profile_image_url, {
            maxWidth: 1600,
            maxHeight: 1000,
            quality: 88,
          });
        }

        // Chuyển đổi WebP cho album ảnh cá nhân nếu có
        const rawGal = Array.isArray(gallery_urls) ? gallery_urls.map(String).filter(Boolean) : [];
        const webpGallery: string[] = [];
        for (const gUrl of rawGal) {
          const conv = await ensureWebpDataUrlServer(gUrl, { maxWidth: 1000, maxHeight: 1000, quality: 85 });
          if (conv) webpGallery.push(conv);
        }

        const hasGalleryInPayload = Array.isArray(gallery_urls);
        const finalGalleryJson = JSON.stringify(webpGallery);

        await db.run(
          `UPDATE players
          SET full_name = ?, short_name = ?, jersey_number = ?,
              position = ?, phone = ?, birth_year = ?, avatar_url = ?,
              profile_image_url = CASE WHEN ? = 1 THEN ? ELSE profile_image_url END,
              bio = ?, notes = ?,
              hometown = ?, nickname = ?, playing_style = ?,
              gallery_urls_json = CASE WHEN ? = 1 THEN ? ELSE gallery_urls_json END
          WHERE id = ?`,
          [
            cleanName,
            derivedShort,
            jersey_number !== "" &&
              jersey_number !== null &&
              jersey_number !== undefined
              ? Number(jersey_number)
              : null,
            position || "Đa năng",
            phone || "",
            formatBirthYear(birth_year),
            webpAvatar,
            hasProfileImageInPayload ? 1 : 0,
            webpProfileImage,
            typeof bio === "string" ? bio : "",
            notes || "",
            String(hometown || "").trim(),
            String(nickname || "").trim(),
            String(playing_style || "").trim(),
            hasGalleryInPayload ? 1 : 0,
            finalGalleryJson,
            Number(player_id),
          ]
        );
        break;
      }

      // Cầu thủ tự đổi tên đăng nhập (username) và mật khẩu (PIN) của chính mình
      case "change_own_password": {
        const { player_id, current_pin, old_pin, new_pin, new_username } = payload;
        const providedOldPin = String(old_pin ?? current_pin ?? "").trim();
        const cleanNewPin = String(new_pin || "").trim();
        const cleanNewUser = String(new_username || "").trim();

        if (!providedOldPin) {
          return NextResponse.json(
            { error: "Vui lòng nhập mật khẩu hiện tại để xác thực" },
            { status: 400 }
          );
        }

        const row = await db.queryOne<{ pin_code: string; username: string }>(
          "SELECT pin_code, username FROM players WHERE id = ?",
          [Number(player_id)]
        );
        if (!row) {
          return NextResponse.json(
            { error: "Không tìm thấy hồ sơ cầu thủ" },
            { status: 404 }
          );
        }
        if (!verifyPassword(providedOldPin, row.pin_code || "1234")) {
          return NextResponse.json(
            { error: "Mật khẩu hiện tại không đúng. Vui lòng kiểm tra lại hoặc liên hệ Ban Quản Lý." },
            { status: 400 }
          );
        }

        if (cleanNewUser) {
          if (cleanNewUser.length < 3) {
            return NextResponse.json(
              { error: "Tên đăng nhập mới cần có ít nhất 3 ký tự" },
              { status: 400 }
            );
          }
          const existOther = await db.queryOne(
            "SELECT id FROM players WHERE LOWER(username) = ? AND id != ?",
            [cleanNewUser.toLowerCase(), Number(player_id)]
          );
          if (existOther) {
            return NextResponse.json(
              { error: "Tên đăng nhập này đã có người sử dụng. Vui lòng chọn tên khác." },
              { status: 400 }
            );
          }
          await db.run(
            "UPDATE players SET username = ? WHERE id = ?",
            [cleanNewUser, Number(player_id)]
          );
        }

        if (cleanNewPin) {
          const strength = validatePasswordStrength(cleanNewPin, cleanNewUser || row.username);
          if (!strength.valid) {
            return NextResponse.json(
              { error: strength.message || "Mật khẩu mới chưa đủ an toàn (tối thiểu 6 ký tự)." },
              { status: 400 }
            );
          }
          const hashedPin = hashPassword(cleanNewPin);
          await db.run(
            "UPDATE players SET pin_code = ? WHERE id = ?",
            [hashedPin, Number(player_id)]
          );
        }
        break;
      }

      // Ban quản lý reset mật khẩu giúp cầu thủ
      case "reset_player_password": {
        const { player_id, new_pin } = payload;
        const cleanPin = String(new_pin || "1234").trim() || "1234";
        const hashedPin = hashPassword(cleanPin);
        await db.run(
          "UPDATE players SET pin_code = ? WHERE id = ?",
          [hashedPin, Number(player_id)]
        );
        break;
      }

      case "delete_player": {
        const { id } = payload;
        await db.run("DELETE FROM players WHERE id = ?", [Number(id)]);
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
          await db.run(
            `UPDATE matches
            SET match_number = ?, label = ?, match_date = ?, kickoff_time = ?,
                venue = ?, opponent = ?, fee_per_player = ?, pitch_cost = ?,
                payer_name = ?, team_score = ?, opponent_score = ?, status = ?, notes = ?
            WHERE id = ?`,
            [
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
              Number(id),
            ]
          );

          if (sync_pitch_expense && pitchCostNum > 0) {
            const existingExp = await db.queryOne<{ id: number }>(
              "SELECT id FROM expenses WHERE match_id = ? AND category = 'Tiền sân'",
              [Number(id)]
            );
            if (existingExp) {
              await db.run(
                `UPDATE expenses
                SET expense_date = ?, description = ?, amount = ?, payer = ?
                WHERE id = ?`,
                [
                  match_date,
                  `Tiền sân ${label}`,
                  pitchCostNum,
                  payer_name || "Tiếng",
                  existingExp.id,
                ]
              );
            } else {
              await db.run(
                `INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
                VALUES (?, 'Tiền sân', ?, ?, ?, ?)`,
                [
                  match_date,
                  `Tiền sân ${label}`,
                  pitchCostNum,
                  payer_name || "Tiếng",
                  Number(id),
                ]
              );
            }
          }
        } else {
          const maxMatch = await db.queryOne<{ maxNum: number }>(
            "SELECT COALESCE(MAX(match_number), 0) as maxNum FROM matches"
          );
          const nextNum = Number(match_number) || ((maxMatch?.maxNum ?? 0) + 1);
          const dateStr = match_date || new Date().toISOString().slice(0, 10);
          const [, monthStr, dayStr] = dateStr.split("-");
          const computedLabel =
            String(label || "").trim() ||
            `Trận ${nextNum} - ${dayStr}/${Number(monthStr)}`;

          const res = await db.run(
            `INSERT INTO matches (
              match_number, label, match_date, kickoff_time, venue,
              opponent, fee_per_player, pitch_cost, payer_name,
              team_score, opponent_score, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
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
              notes || "",
            ]
          );

          const newMatchId = Number(res.lastInsertRowid);
          const allPlayers = await db.query<{ id: number }>(
            "SELECT id FROM players"
          );
          for (const p of allPlayers) {
            await db.run(
              `INSERT OR IGNORE INTO match_attendances (
                match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note
              )
              VALUES (?, ?, 'none', 0, 0, 0, 0, '', '')`,
              [newMatchId, p.id]
            );
          }

          if (sync_pitch_expense && pitchCostNum > 0) {
            await db.run(
              `INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
              VALUES (?, 'Tiền sân', ?, ?, ?, ?)`,
              [
                dateStr,
                `Tiền sân trận tuần ${nextNum} (${computedLabel})`,
                pitchCostNum,
                payer_name || "Tiếng",
                newMatchId,
              ]
            );
          }
        }
        break;
      }

      case "delete_match": {
        const { id } = payload;
        await db.run("DELETE FROM expenses WHERE match_id = ?", [Number(id)]);
        await db.run("DELETE FROM matches WHERE id = ?", [Number(id)]);
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
          await db.run(
            `UPDATE matches
            SET status = ?,
                team_score = ?,
                opponent_score = ?
            WHERE id = ?`,
            [
              newStatus,
              team_score !== "" && team_score !== null && team_score !== undefined
                ? Number(team_score)
                : null,
              opponent_score !== "" &&
                opponent_score !== null &&
                opponent_score !== undefined
                ? Number(opponent_score)
                : null,
              Number(match_id),
            ]
          );
        } else {
          await db.run("UPDATE matches SET status = ? WHERE id = ?", [
            newStatus,
            Number(match_id),
          ]);
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
          const mRow = await db.queryOne<{
            id: number;
            match_number: number;
            label: string;
            match_date: string;
          }>(
            "SELECT id, match_number, label, match_date FROM matches WHERE id = ?",
            [Number(match_id)]
          );

          if (mRow) {
            await db.run(
              `UPDATE matches
              SET venue = ?, pitch_cost = ?, payer_name = ?
              WHERE id = ?`,
              [cleanVenue, costNum, formattedPayer, mRow.id]
            );

            const existingExp = await db.queryOne<{ id: number }>(
              `SELECT id FROM expenses
               WHERE category = 'Tiền sân'
                 AND (match_id = ? OR description LIKE ?)`,
              [mRow.id, `%tuần ${mRow.match_number} %`]
            );

            const desc = `Tiền sân trận tuần ${mRow.match_number} - ${mRow.label.replace(/^Trận\s+\d+\s*-\s*/i, "")}`;
            if (existingExp) {
              await db.run(
                `UPDATE expenses
                SET expense_date = ?, description = ?, amount = ?, payer = ?, match_id = ?
                WHERE id = ?`,
                [
                  mRow.match_date,
                  desc,
                  costNum,
                  formattedPayer,
                  mRow.id,
                  existingExp.id,
                ]
              );
            } else if (costNum > 0) {
              await db.run(
                `INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
                VALUES (?, 'Tiền sân', ?, ?, ?, ?)`,
                [
                  mRow.match_date,
                  desc,
                  costNum,
                  formattedPayer,
                  mRow.id,
                ]
              );
            }
          }
        } else if (costNum > 0) {
          const dStr =
            String(expense_date || "").trim() ||
            new Date().toISOString().slice(0, 10);
          const [, mm, dd] = dStr.split("-");
          await db.run(
            `INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
            VALUES (?, 'Tiền sân', ?, ?, ?, NULL)`,
            [
              dStr,
              `Tiền sân ${cleanVenue} ngày ${dd}/${Number(mm)}`,
              costNum,
              formattedPayer,
            ]
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

        await db.run(
          `INSERT INTO match_attendances (
            match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note
          )
          VALUES (?, ?, ?, 0, 0, 0, 0, '', ?)
          ON CONFLICT(match_id, player_id)
          DO UPDATE SET
            rsvp_status = excluded.rsvp_status,
            note = COALESCE(NULLIF(excluded.note, ''), match_attendances.note)`,
          [
            Number(match_id),
            Number(player_id),
            validRsvp,
            String(note || ""),
          ]
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

        const matchRow = await db.queryOne<{ fee_per_player: number }>(
          "SELECT fee_per_player FROM matches WHERE id = ?",
          [Number(match_id)]
        );
        const defaultFee = matchRow?.fee_per_player ?? 100000;

        // Chuẩn hóa 3 trạng thái độc lập: Attended và Paid hoàn toàn độc lập
        const isPaid = Number(paid) === 1 ? 1 : 0;
        const isAttended = Number(attended) === 1 ? 1 : 0;
        const finalAmount =
          amount !== undefined && amount !== null && amount !== ""
            ? Number(amount)
            : (isPaid === 1 || isAttended === 1)
            ? defaultFee
            : 0;
        const isWalkIn = Number(walk_in) === 1 ? 1 : 0;

        await db.run(
          `INSERT INTO match_attendances (
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
            note = CASE WHEN excluded.note != '' THEN excluded.note ELSE match_attendances.note END`,
          [
            Number(match_id),
            Number(player_id),
            isWalkIn,
            isAttended,
            isPaid,
            finalAmount,
            String(collected_by || "Tiếng"),
            String(note || ""),
          ]
        );
        break;
      }

      // THU TIỀN HÀNG LOẠT (Lưu tạm trên máy trước khi bấm lưu 1 lần theo transaction batch)
      case "collect_match_fees_batch": {
        const { match_id, collected_by, items, idempotency_key } = payload;
        void idempotency_key;
        if (!match_id) {
          return NextResponse.json({ error: "Thiếu mã trận đấu" }, { status: 400 });
        }
        if (!Array.isArray(items) || items.length === 0) {
          break; // Không có thay đổi nào cần lưu
        }

        const matchRow = await db.queryOne<{ fee_per_player: number }>(
          "SELECT fee_per_player FROM matches WHERE id = ?",
          [Number(match_id)]
        );
        const defaultFee = matchRow?.fee_per_player ?? 100000;
        const collector = String(collected_by || "Tiếng").trim();

        const sql = `INSERT INTO match_attendances (
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
          note = CASE WHEN excluded.note != '' THEN excluded.note ELSE match_attendances.note END`;

        const statements: Array<{ sql: string; params: unknown[] }> = [];
        for (const item of items) {
          const playerId = Number(item.player_id);
          if (!playerId) continue;

          if (item.remove) {
            statements.push({
              sql: `UPDATE match_attendances
                    SET attended = 0, paid = 0, amount = 0, rsvp_status = 'absent_notice'
                    WHERE match_id = ? AND player_id = ?`,
              params: [Number(match_id), playerId],
            });
            continue;
          }

          // Chuẩn hóa 3 trạng thái độc lập: Không tự động coi Paid là Attended
          const isPaid = Number(item.paid) === 1 ? 1 : 0;
          const isAttended = Number(item.attended) === 1 ? 1 : 0;
          const finalAmount =
            item.amount !== undefined && item.amount !== null && item.amount !== ""
              ? Number(item.amount)
              : (isPaid === 1 || isAttended === 1)
              ? defaultFee
              : 0;
          const isWalkIn = Number(item.walk_in) === 1 ? 1 : 0;

          statements.push({
            sql,
            params: [
              Number(match_id),
              playerId,
              isWalkIn,
              isAttended,
              isPaid,
              finalAmount,
              collector,
              String(item.note || ""),
            ],
          });
        }

        if (statements.length > 0) {
          await db.batch(statements);
        }
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

        const matchRow = await db.queryOne<{ fee_per_player: number }>(
          "SELECT fee_per_player FROM matches WHERE id = ?",
          [Number(match_id)]
        );
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
          const maxRow = await db.queryOne<{ maxOrder: number }>(
            "SELECT COALESCE(MAX(code_order), 0) as maxOrder FROM players"
          );
          const res = await db.run(
            `INSERT INTO players (
              code_order, full_name, short_name, jersey_number,
              position, phone, role, access_role, pin_code, status, notes
            )
            VALUES (?, ?, ?, NULL, 'Đa năng', '', 'Thành viên', 'player', '1234', 'Đang sinh hoạt', 'Bổ sung trực tiếp tại sân')`,
            [
              ((maxRow?.maxOrder ?? 0) + 1),
              cleanName,
              derivedShort,
            ]
          );
          targetPlayerId = Number(res.lastInsertRowid);
        }

        if (!targetPlayerId) {
          return NextResponse.json(
            { error: "Vui lòng chọn cầu thủ hoặc nhập tên cầu thủ tham gia" },
            { status: 400 }
          );
        }

        await db.run(
          `INSERT INTO match_attendances (
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
            note = 'Tham gia không đăng ký trước'`,
          [
            Number(match_id),
            targetPlayerId,
            isPaid,
            feeAmount,
            String(collected_by || "Tiếng"),
          ]
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
          await db.run(
            `UPDATE expenses
            SET expense_date = ?, category = ?, description = ?, amount = ?, payer = ?, match_id = ?
            WHERE id = ?`,
            [
              expense_date || "2026-11-03",
              category || "Tiền sân",
              description || "",
              Number(amount) || 0,
              payer || "",
              match_id ? Number(match_id) : null,
              Number(id),
            ]
          );
        } else {
          await db.run(
            `INSERT INTO expenses (expense_date, category, description, amount, payer, match_id)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
              expense_date || new Date().toISOString().slice(0, 10),
              category || "Tiền sân",
              description || "",
              Number(amount) || 0,
              payer || "",
              match_id ? Number(match_id) : null,
            ]
          );
        }
        break;
      }

      case "delete_expense": {
        const { id } = payload;
        await db.run("DELETE FROM expenses WHERE id = ?", [Number(id)]);
        break;
      }

      case "upsert_other_income": {
        const { id, income_date, contributor, amount, fund_type, note } =
          payload;
        if (id) {
          await db.run(
            `UPDATE other_incomes
            SET income_date = ?, contributor = ?, amount = ?, fund_type = ?, note = ?
            WHERE id = ?`,
            [
              income_date || "2026-11-03",
              contributor || "",
              Number(amount) || 0,
              fund_type || "Quỹ sinh hoạt",
              note || "",
              Number(id),
            ]
          );
        } else {
          await db.run(
            `INSERT INTO other_incomes (income_date, contributor, amount, fund_type, note)
            VALUES (?, ?, ?, ?, ?)`,
            [
              income_date || new Date().toISOString().slice(0, 10),
              contributor || "",
              Number(amount) || 0,
              fund_type || "Quỹ sinh hoạt",
              note || "",
            ]
          );
        }
        break;
      }

      case "delete_other_income": {
        const { id } = payload;
        await db.run("DELETE FROM other_incomes WHERE id = ?", [Number(id)]);
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
        await db.run(
          `UPDATE team_settings
          SET team_name = ?, short_name = ?, default_match_fee = ?,
              bank_bin = ?, bank_name = ?, bank_account_no = ?, bank_account_name = ?,
              tournament_fund_reserve = ?, tournament_fund_note = ?, fanpage_url = ?
          WHERE id = 1`,
          [
            team_name || "Đội Bóng HĐH Gò Nổi",
            short_name || "FC HĐH GÒ NỔI",
            Number(default_match_fee) || 100000,
            bank_bin || "970422",
            bank_name || "MB Bank",
            bank_account_no || "",
            bank_account_name || "NGUYEN THE TIENG",
            Number(tournament_fund_reserve) || 0,
            tournament_fund_note || "",
            fanpage_url || "https://www.facebook.com/FCHDHGoNoi/",
          ]
        );
        break;
      }

      case "upsert_club_post": {
        await ensureClubPostsReady(db);
        const {
          id,
          category,
          title,
          summary,
          publishedDate,
          author,
          featuredImage,
          galleryImages,
          readingTime,
          paragraphs,
          quote,
          highlights,
          eventYear,
          event_year,
          taggedPlayerNames,
          tagged_players,
        } = payload;

        const cleanTitle = String(title || "").trim();
        if (!cleanTitle) {
          return NextResponse.json(
            { error: "Vui lòng nhập tiêu đề bài viết" },
            { status: 400 }
          );
        }

        const CATEGORY_META: Record<
          string,
          { label: string; badgeClass: string }
        > = {
          giaidau: {
            label: "Giải Đấu & Phong Trào",
            badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          },
          giaoluu: {
            label: "Giao Lưu Kết Nối",
            badgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/40",
          },
          cauthu: {
            label: "Cầu Thủ Gò Nổi",
            badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
          },
          taitro: {
            label: "Đồng Hành & Tài Trợ",
            badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/40",
          },
          anhbia: {
            label: "Ảnh Bìa & Khí Thế",
            badgeClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
          },
        };

        const catKey =
          typeof category === "string" && CATEGORY_META[category]
            ? category
            : "giaidau";
        const catMeta = CATEGORY_META[catKey];

        // Tự động chuyển đổi ảnh bìa bài viết sang chuẩn WebP trước khi lưu
        const webpFeaturedImage = await ensureWebpDataUrlServer(
          String(
            featuredImage || "/images/hinhanh-webp/anhbia/DSC06734.webp"
          ),
          { maxWidth: 1280, maxHeight: 960, quality: 84 }
        );

        // Tự động chuyển đổi toàn bộ danh sách ảnh gallery sang chuẩn WebP
        const rawGallery = Array.isArray(galleryImages)
          ? galleryImages.map(String).filter(Boolean)
          : [];
        const webpGallery: string[] = [];
        for (const gImg of rawGallery) {
          const converted = await ensureWebpDataUrlServer(gImg, {
            maxWidth: 1280,
            maxHeight: 960,
            quality: 84,
          });
          if (converted) webpGallery.push(converted);
        }

        const postId =
          String(id || "").trim() || `post-${Date.now()}`;
        const slug =
          cleanTitle
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "d")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || postId;

        const cleanParagraphs = Array.isArray(paragraphs)
          ? paragraphs.map((p) => String(p).trim()).filter(Boolean)
          : String(paragraphs || "")
              .split(/\n+/)
              .map((p) => p.trim())
              .filter(Boolean);

        const cleanHighlights = Array.isArray(highlights)
          ? highlights.map((h) => String(h).trim()).filter(Boolean)
          : String(highlights || "")
              .split(/\n+/)
              .map((h) => h.trim())
              .filter(Boolean);

        const finalYear = String(eventYear || event_year || "2026").trim() || "2026";
        const rawTagged = Array.isArray(taggedPlayerNames)
          ? taggedPlayerNames
          : Array.isArray(tagged_players)
          ? tagged_players
          : [];
        const cleanTagged = rawTagged.map(String).map((s) => s.trim()).filter(Boolean);

        await db.run(
          `INSERT INTO club_posts (
            id, category, category_label, category_badge_class,
            title, slug, summary, published_date, author,
            featured_image, gallery_images_json, reading_time,
            paragraphs_json, quote, highlights_json,
            event_year, tagged_players_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            category = excluded.category,
            category_label = excluded.category_label,
            category_badge_class = excluded.category_badge_class,
            title = excluded.title,
            slug = excluded.slug,
            summary = excluded.summary,
            published_date = excluded.published_date,
            author = excluded.author,
            featured_image = excluded.featured_image,
            gallery_images_json = excluded.gallery_images_json,
            reading_time = excluded.reading_time,
            paragraphs_json = excluded.paragraphs_json,
            quote = excluded.quote,
            highlights_json = excluded.highlights_json,
            event_year = excluded.event_year,
            tagged_players_json = excluded.tagged_players_json`,
          [
            postId,
            catKey,
            catMeta.label,
            catMeta.badgeClass,
            cleanTitle,
            slug,
            String(summary || cleanParagraphs[0] || "").trim(),
            String(publishedDate || new Date().toISOString().slice(0, 10)),
            String(author || session?.fullName || "Ban Quản Lý FC HĐH Gò Nổi"),
            webpFeaturedImage,
            JSON.stringify(webpGallery),
            String(readingTime || "3 phút đọc"),
            JSON.stringify(
              cleanParagraphs.length > 0
                ? cleanParagraphs
                : [String(summary || cleanTitle)]
            ),
            String(quote || "").trim(),
            JSON.stringify(cleanHighlights),
            finalYear,
            JSON.stringify(cleanTagged),
          ]
        );
        break;
      }

      case "delete_club_post": {
        await ensureClubPostsReady(db);
        const { id } = payload;
        if (!id) {
          return NextResponse.json(
            { error: "Thiếu mã bài viết cần xóa" },
            { status: 400 }
          );
        }
        await db.run("DELETE FROM club_posts WHERE id = ?", [String(id)]);
        break;
      }

      // QUẢN LÝ ĐƠN VỊ TÀI TRỢ & ĐỐI TÁC
      case "upsert_sponsor": {
        await ensureSponsorsReady(db);
        const {
          id,
          name,
          tier,
          logo_url,
          banner_url,
          website_url,
          description,
          start_date,
          end_date,
          display_positions,
          is_active,
          sort_order,
          note,
        } = payload;

        if (!name || !String(name).trim()) {
          return NextResponse.json(
            { error: "Tên đơn vị tài trợ không được để trống" },
            { status: 400 }
          );
        }

        let finalLogo = logo_url || "";
        let finalBanner = banner_url || "";
        if (finalLogo && finalLogo.startsWith("data:image/")) {
          finalLogo = await ensureWebpDataUrlServer(finalLogo, { maxWidth: 600 });
        }
        if (finalBanner && finalBanner.startsWith("data:image/")) {
          finalBanner = await ensureWebpDataUrlServer(finalBanner, { maxWidth: 1600 });
        }

        const positionsJson = JSON.stringify(
          Array.isArray(display_positions)
            ? display_positions
            : ["home_banner", "home_partners"]
        );
        const activeVal = is_active === false || is_active === 0 ? 0 : 1;
        const sortOrderNum = Number(sort_order) || 0;

        if (id) {
          await db.run(
            `UPDATE sponsors
             SET name = ?, tier = ?, logo_url = ?, banner_url = ?, website_url = ?,
                 description = ?, start_date = ?, end_date = ?, display_positions_json = ?,
                 is_active = ?, sort_order = ?, note = ?
             WHERE id = ?`,
            [
              String(name).trim(),
              tier || "partner",
              finalLogo,
              finalBanner,
              website_url || "",
              description || "",
              start_date || "",
              end_date || "",
              positionsJson,
              activeVal,
              sortOrderNum,
              note || "",
              Number(id),
            ]
          );
        } else {
          await db.run(
            `INSERT INTO sponsors (
              name, tier, logo_url, banner_url, website_url, description,
              start_date, end_date, display_positions_json, is_active, sort_order, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              String(name).trim(),
              tier || "partner",
              finalLogo,
              finalBanner,
              website_url || "",
              description || "",
              start_date || "",
              end_date || "",
              positionsJson,
              activeVal,
              sortOrderNum,
              note || "",
            ]
          );
        }
        break;
      }

      case "delete_sponsor": {
        await ensureSponsorsReady(db);
        const { id } = payload;
        if (!id) {
          return NextResponse.json(
            { error: "Thiếu ID đơn vị tài trợ cần xóa" },
            { status: 400 }
          );
        }
        await db.run("DELETE FROM sponsors WHERE id = ?", [Number(id)]);
        break;
      }

      case "reset_to_excel": {
        await seedAsyncInitialDataIfNeeded(db, true);
        break;
      }

      default:
        return NextResponse.json(
          { error: `Hành động không hợp lệ: ${action}` },
          { status: 400 }
        );
    }

    const updated = await getFullAppData();
    const res = NextResponse.json(updated);

    // Nếu vừa đổi mật khẩu của chính mình, cấp lại session token mới với vân tay mật khẩu mới
    if (action === "change_own_password" && session) {
      const updatedPlayer = updated.players.find((p) => p.id === session.playerId);
      if (updatedPlayer) {
        const token = createSessionToken(updatedPlayer, 24 * 7);
        res.cookies.set({
          name: SESSION_COOKIE_NAME,
          value: token,
          maxAge: 7 * 24 * 3600,
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }
    }

    return res;
  } catch (error) {
    console.error("POST /api/team error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lưu dữ liệu" },
      { status: 500 }
    );
  }
}
