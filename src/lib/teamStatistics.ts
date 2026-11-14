import type {
  FullAppData,
  MatchAttendance,
  MatchLifecycleCategory,
  MatchRecord,
  MatchStatistics,
  Player,
  PlayerLifecycleCategory,
  PlayerStatistics,
  TeamStatistics,
} from "@/types/app";

/**
 * Phân loại trạng thái sinh hoạt của cầu thủ theo chuẩn thống nhất (mutually exclusive):
 * - "active": "Đang sinh hoạt"
 * - "paused": "Tạm nghỉ" / "Nghỉ phép" / "Tạm dừng" (kiểm tra trước stopped)
 * - "stopped": "Ngừng tham gia" / "Đã nghỉ" / "Ngưng" / "Rời đội"
 * - "unknown": Trạng thái rỗng hoặc không nhận diện (không mặc định thành active)
 */
export function classifyPlayerStatus(
  status?: string | null
): PlayerLifecycleCategory {
  const normalized = (status ?? "").trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }
  if (normalized === "đang sinh hoạt" || normalized === "active") {
    return "active";
  }
  // Kiểm tra paused trước stopped để tránh nhầm "Tạm nghỉ" thành "stopped"
  if (/tạm nghỉ|nghỉ phép|tạm dừng|paused/.test(normalized)) {
    return "paused";
  }
  if (/ngừng|ngưng|rời|nghỉ hẳn|đã nghỉ|archived|stopped/.test(normalized)) {
    return "stopped";
  }
  return "unknown";
}

/** Kiểm tra cầu thủ có đang trong trạng thái hoạt động hay không. */
export function isActivePlayer(player: Pick<Player, "status">): boolean {
  return classifyPlayerStatus(player.status) === "active";
}

/** Tính thống kê cầu thủ dùng chung cho API và mọi màn hình UI. */
export function getPlayerStatistics(
  players: readonly { status?: string | null }[]
): PlayerStatistics {
  let active = 0;
  let paused = 0;
  let stopped = 0;
  let unknown = 0;

  for (const player of players) {
    const category = classifyPlayerStatus(player.status);
    if (category === "active") active += 1;
    else if (category === "paused") paused += 1;
    else if (category === "stopped") stopped += 1;
    else unknown += 1;
  }

  return {
    total: players.length,
    active,
    paused,
    stopped,
    unknown,
  };
}

/**
 * Phân loại trạng thái trận đấu theo chuẩn thống nhất (mutually exclusive):
 * - "cancelled": "Đã hủy" / "Hủy" (kiểm tra trước completed)
 * - "inProgress": "Đang diễn ra" / "Đang đá"
 * - "upcoming": "Sắp diễn ra" / "upcoming" / "scheduled"
 * - "completed": "Đã kết thúc" / "Hoàn thành" / "completed"
 * - "unknown": Trạng thái rỗng hoặc không nhận diện (không mặc định thành completed)
 */
export function classifyMatchStatus(
  status?: string | null
): MatchLifecycleCategory {
  const normalized = (status ?? "").trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }
  if (/hủy|huỷ|cancel/.test(normalized)) {
    return "cancelled";
  }
  if (/đang diễn ra|đang đá|in[_ -]?progress|live/.test(normalized)) {
    return "inProgress";
  }
  if (/sắp diễn ra|upcoming|scheduled/.test(normalized)) {
    return "upcoming";
  }
  if (/đã kết thúc|hoàn thành|completed|finished/.test(normalized)) {
    return "completed";
  }
  return "unknown";
}

export function isUpcomingMatch(match: Pick<MatchRecord, "status">): boolean {
  return classifyMatchStatus(match.status) === "upcoming";
}

export function isCompletedMatch(match: Pick<MatchRecord, "status">): boolean {
  return classifyMatchStatus(match.status) === "completed";
}

export function isCancelledMatch(match: Pick<MatchRecord, "status">): boolean {
  return classifyMatchStatus(match.status) === "cancelled";
}

/** Tính thống kê trận đấu dùng chung cho API và mọi màn hình UI. */
export function getMatchStatistics(
  matches: readonly { status?: string | null }[]
): MatchStatistics {
  let upcoming = 0;
  let completed = 0;
  let cancelled = 0;
  let inProgress = 0;
  let unknown = 0;

  for (const match of matches) {
    const category = classifyMatchStatus(match.status);
    if (category === "upcoming") upcoming += 1;
    else if (category === "completed") completed += 1;
    else if (category === "cancelled") cancelled += 1;
    else if (category === "inProgress") inProgress += 1;
    else unknown += 1;
  }

  return {
    total: matches.length,
    upcoming,
    completed,
    cancelled,
    inProgress,
    unknown,
  };
}

/** Tổng hợp thống kê cầu thủ & trận đấu cho toàn đội. */
export function getTeamStatistics(
  data: Pick<FullAppData, "players" | "matches">
): TeamStatistics {
  return {
    players: getPlayerStatistics(data.players),
    matches: getMatchStatistics(data.matches),
  };
}

export interface PlayerAttendanceStats {
  matchesPlayed: number;
  eligibleMatchesCount: number;
  attendanceRate: number | null;
}

/**
 * Tính tỷ lệ chuyên cần chuẩn hóa cho 1 cầu thủ:
 * - Mẫu số: Chỉ các trận đã hoàn thành ("completed"), loại upcoming/cancelled/inProgress/unknown.
 * - Tử số: Số trận trong tập mẫu số mà cầu thủ có attended === 1.
 * - Trả về null khi mẫu số = 0 (UI hiển thị "—").
 */
export function calculatePlayerAttendanceStats(
  playerId: number,
  matches: readonly Pick<MatchRecord, "id" | "status">[],
  attendances: readonly Pick<MatchAttendance, "match_id" | "player_id" | "attended">[]
): PlayerAttendanceStats {
  const eligibleMatches = matches.filter(isCompletedMatch);
  const eligibleMatchIds = new Set(eligibleMatches.map((m) => m.id));
  const matchesPlayed = attendances.filter(
    (a) =>
      a.player_id === playerId &&
      eligibleMatchIds.has(a.match_id) &&
      a.attended === 1
  ).length;
  const eligibleMatchesCount = eligibleMatches.length;

  return {
    matchesPlayed,
    eligibleMatchesCount,
    attendanceRate:
      eligibleMatchesCount > 0
        ? Math.round((matchesPlayed / eligibleMatchesCount) * 100)
        : null,
  };
}

/** Tính tỷ lệ chuyên cần trung bình của các cầu thủ đang hoạt động trên các trận đã hoàn thành. */
export function calculateTeamAvgAttendanceRate(
  players: readonly Pick<Player, "id" | "status">[],
  matches: readonly Pick<MatchRecord, "id" | "status">[],
  attendances: readonly Pick<MatchAttendance, "match_id" | "player_id" | "attended">[]
): number | null {
  const activePlayers = players.filter(isActivePlayer);
  const eligibleMatches = matches.filter(isCompletedMatch);
  if (activePlayers.length === 0 || eligibleMatches.length === 0) {
    return null;
  }
  const activePlayerIds = new Set(activePlayers.map((p) => p.id));
  const eligibleMatchIds = new Set(eligibleMatches.map((m) => m.id));
  const totalCompletedAttended = attendances.filter(
    (a) =>
      activePlayerIds.has(a.player_id) &&
      eligibleMatchIds.has(a.match_id) &&
      a.attended === 1
  ).length;

  return Math.round(
    (totalCompletedAttended / (activePlayers.length * eligibleMatches.length)) *
      100
  );
}

/** Định dạng tỷ lệ chuyên cần hiển thị UI ("—" khi chưa có trận đủ điều kiện). */
export function formatAttendanceRate(rate: number | null): string {
  return rate === null ? "—" : `${rate}%`;
}
