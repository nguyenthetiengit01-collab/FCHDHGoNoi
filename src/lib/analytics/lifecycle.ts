import type { AsyncDb } from "@/lib/db";

async function hasTable(db: AsyncDb, name: string): Promise<boolean> {
  const row = await db.queryOne<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
    [name]
  );
  return Boolean(row?.name);
}

async function hasColumn(db: AsyncDb, table: string, col: string): Promise<boolean> {
  const cols = await db.query<{ name: string }>(`PRAGMA table_info("${table}")`);
  return cols.some((c) => c.name === col);
}

export async function recordPlayerLifecycleEvent(params: {
  db: AsyncDb;
  playerId: number;
  eventType: "joined" | "status_changed";
  fromStatus: string | null;
  toStatus: string;
  actorId?: number | null;
  source: "manager_action" | "import";
  now?: Date;
}): Promise<void> {
  const {
    db,
    playerId,
    eventType,
    fromStatus,
    toStatus,
    actorId = null,
    source,
    now = new Date(),
  } = params;

  if (!(await hasTable(db, "player_lifecycle_events"))) {
    return;
  }

  const nowIso = now.toISOString();
  if (eventType === "joined" && (await hasColumn(db, "players", "joined_at"))) {
    await db.run(
      "UPDATE players SET joined_at = COALESCE(joined_at, ?) WHERE id = ?",
      [nowIso, playerId]
    );
  }

  await db.run(
    `INSERT INTO player_lifecycle_events
     (player_id, event_type, from_status, to_status, effective_at, actor_id, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [playerId, eventType, fromStatus, toStatus, nowIso, actorId, source, nowIso]
  );
}

export async function validateSponsorIdForIncome(
  db: AsyncDb,
  rawSponsorId: unknown
): Promise<
  | { ok: true; sponsorId: number | null; columnSupported: boolean }
  | { ok: false; error: string }
> {
  const columnSupported = await hasColumn(db, "other_incomes", "sponsor_id");
  if (rawSponsorId === undefined || rawSponsorId === null || rawSponsorId === "") {
    return { ok: true, sponsorId: null, columnSupported };
  }

  const num = Number(rawSponsorId);
  if (!Number.isInteger(num) || num <= 0) {
    return { ok: false, error: "sponsor_id không hợp lệ." };
  }

  if (await hasTable(db, "sponsors")) {
    const found = await db.queryOne<{ id: number }>(
      "SELECT id FROM sponsors WHERE id = ?",
      [num]
    );
    if (!found) {
      return { ok: false, error: "Không tìm thấy nhà tài trợ được chọn." };
    }
  }

  return { ok: true, sponsorId: num, columnSupported };
}
