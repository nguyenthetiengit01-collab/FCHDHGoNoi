import crypto from "node:crypto";
import type { AsyncDb } from "@/lib/db";
import { ANALYTICS_RAW_RETENTION_DAYS } from "./config";
import type { ProductEventInput } from "./types";
import { toVNDateKey } from "./metrics";

function getActorHashSecret(): string {
  const secret =
    process.env.ANALYTICS_ACTOR_SECRET ||
    process.env.APP_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;

  if (secret && secret.trim().length >= 16) {
    return secret.trim();
  }
  return "fc-hdh-go-noi-analytics-actor-hmac-fallback-key";
}

export function deriveActorKeyHash(
  actorRole: "guest" | "player" | "manager",
  playerId?: number | null
): string | null {
  if (actorRole === "guest" || !playerId || playerId <= 0) {
    return null;
  }
  return crypto
    .createHmac("sha256", getActorHashSecret())
    .update(`${actorRole}:${playerId}`)
    .digest("hex");
}

export async function ensureAnalyticsTablesExist(db: AsyncDb): Promise<boolean> {
  try {
    const row = await db.queryOne<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='product_analytics_events' LIMIT 1"
    );
    return Boolean(row?.name);
  } catch {
    return false;
  }
}

export async function ingestProductEvents(params: {
  db: AsyncDb;
  events: ProductEventInput[];
  actorRole: "guest" | "player" | "manager";
  playerId?: number | null;
  now?: Date;
}): Promise<{ accepted: number; deduped: number }> {
  const { db, events, actorRole, playerId, now = new Date() } = params;

  const hasTables = await ensureAnalyticsTablesExist(db);
  if (!hasTables) {
    return { accepted: 0, deduped: 0 };
  }

  const occurredAt = now.toISOString();
  const eventDate = toVNDateKey(occurredAt);
  const monthKey = eventDate.slice(0, 7);
  const actorKeyHash = deriveActorKeyHash(actorRole, playerId);

  let accepted = 0;
  let deduped = 0;

  await db.transaction(async (tx) => {
    for (const ev of events) {
      const metadataJson = ev.metadata ? JSON.stringify(ev.metadata) : null;
      const insertRes = await tx.run(
        `INSERT OR IGNORE INTO product_analytics_events
         (event_uuid, event_name, route_key, content_type, content_id, sponsor_id, actor_role, actor_key_hash, occurred_at, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ev.eventUuid,
          ev.eventName,
          ev.routeKey ?? null,
          ev.contentType ?? null,
          ev.contentId ?? null,
          ev.sponsorId ?? null,
          actorRole,
          actorKeyHash,
          occurredAt,
          metadataJson,
        ]
      );

      if (insertRes.changes === 0) {
        deduped += 1;
        continue;
      }

      accepted += 1;

      await tx.run(
        `INSERT INTO product_analytics_daily
         (event_date, event_name, actor_role, route_key, content_type, content_id, sponsor_id, event_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(event_date, event_name, actor_role, route_key, content_type, content_id, sponsor_id)
         DO UPDATE SET event_count = event_count + 1`,
        [
          eventDate,
          ev.eventName,
          actorRole,
          ev.routeKey ?? "",
          ev.contentType ?? "",
          ev.contentId ?? 0,
          ev.sponsorId ?? 0,
        ]
      );
    }

    if (actorKeyHash && accepted > 0) {
      await tx.run(
        `INSERT OR IGNORE INTO product_analytics_monthly_actors
         (month_key, actor_role, actor_key_hash)
         VALUES (?, ?, ?)`,
        [monthKey, actorRole, actorKeyHash]
      );
    }
  });

  return { accepted, deduped };
}

export async function rebuildAnalyticsRollups(db: AsyncDb): Promise<{
  dailyRows: number;
  monthlyActorRows: number;
}> {
  const hasTables = await ensureAnalyticsTablesExist(db);
  if (!hasTables) {
    return { dailyRows: 0, monthlyActorRows: 0 };
  }

  const rawRows = await db.query<{
    event_name: string;
    actor_role: string;
    route_key: string | null;
    content_type: string | null;
    content_id: number | null;
    sponsor_id: number | null;
    actor_key_hash: string | null;
    occurred_at: string;
  }>(
    `SELECT event_name, actor_role, route_key, content_type, content_id, sponsor_id, actor_key_hash, occurred_at
     FROM product_analytics_events`
  );

  const dailyBuckets = new Map<
    string,
    {
      event_date: string;
      event_name: string;
      actor_role: string;
      route_key: string;
      content_type: string;
      content_id: number;
      sponsor_id: number;
      event_count: number;
    }
  >();

  const monthlyActors = new Set<string>();

  for (const r of rawRows) {
    const eventDate = toVNDateKey(r.occurred_at);
    const routeKey = r.route_key ?? "";
    const contentType = r.content_type ?? "";
    const contentId = r.content_id ?? 0;
    const sponsorId = r.sponsor_id ?? 0;
    const key = `${eventDate}|${r.event_name}|${r.actor_role}|${routeKey}|${contentType}|${contentId}|${sponsorId}`;
    const existing = dailyBuckets.get(key);
    if (existing) {
      existing.event_count += 1;
    } else {
      dailyBuckets.set(key, {
        event_date: eventDate,
        event_name: r.event_name,
        actor_role: r.actor_role,
        route_key: routeKey,
        content_type: contentType,
        content_id: contentId,
        sponsor_id: sponsorId,
        event_count: 1,
      });
    }

    if (r.actor_key_hash && (r.actor_role === "player" || r.actor_role === "manager")) {
      const monthKey = eventDate.slice(0, 7);
      monthlyActors.add(`${monthKey}|${r.actor_role}|${r.actor_key_hash}`);
    }
  }

  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM product_analytics_daily");
    await tx.run("DELETE FROM product_analytics_monthly_actors");

    for (const row of dailyBuckets.values()) {
      await tx.run(
        `INSERT INTO product_analytics_daily
         (event_date, event_name, actor_role, route_key, content_type, content_id, sponsor_id, event_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.event_date,
          row.event_name,
          row.actor_role,
          row.route_key,
          row.content_type,
          row.content_id,
          row.sponsor_id,
          row.event_count,
        ]
      );
    }

    for (const actorEntry of monthlyActors) {
      const [monthKey, actorRole, actorKeyHash] = actorEntry.split("|");
      await tx.run(
        `INSERT OR IGNORE INTO product_analytics_monthly_actors (month_key, actor_role, actor_key_hash)
         VALUES (?, ?, ?)`,
        [monthKey, actorRole, actorKeyHash]
      );
    }
  });

  return {
    dailyRows: dailyBuckets.size,
    monthlyActorRows: monthlyActors.size,
  };
}

export async function cleanupExpiredRawEvents(params: {
  db: AsyncDb;
  retentionDays?: number;
  now?: Date;
  dryRun?: boolean;
}): Promise<{ cutoffIso: string; expiredCount: number; deletedCount: number }> {
  const {
    db,
    retentionDays = ANALYTICS_RAW_RETENTION_DAYS,
    now = new Date(),
    dryRun = false,
  } = params;

  const hasTables = await ensureAnalyticsTablesExist(db);
  const cutoffIso = new Date(now.getTime() - retentionDays * 86400000).toISOString();

  if (!hasTables) {
    return { cutoffIso, expiredCount: 0, deletedCount: 0 };
  }

  const countRow = await db.queryOne<{ cnt: number }>(
    "SELECT COUNT(*) AS cnt FROM product_analytics_events WHERE occurred_at < ?",
    [cutoffIso]
  );
  const expiredCount = Number(countRow?.cnt || 0);

  if (dryRun || expiredCount === 0) {
    return { cutoffIso, expiredCount, deletedCount: 0 };
  }

  const res = await db.run(
    "DELETE FROM product_analytics_events WHERE occurred_at < ?",
    [cutoffIso]
  );

  return {
    cutoffIso,
    expiredCount,
    deletedCount: res.changes,
  };
}
