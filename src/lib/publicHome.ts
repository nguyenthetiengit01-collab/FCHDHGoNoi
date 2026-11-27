import { cache } from "react";
import { getAsyncDb, getFullAppData } from "@/lib/db";
import { getCurrentAuthContextFromToken, sanitizeDataForPlayer } from "@/lib/auth";
import { formatBirthYear } from "@/lib/athleteProfile";
import { getTeamStatistics } from "@/lib/teamStatistics";
import { CLUB_ACTIVITIES_POSTS, type ClubActivityPost } from "@/data/clubActivities";
import {
  FANPAGE_URL,
  type FullAppData,
  type MatchAttendance,
  type MatchRecord,
  type Player,
  type Sponsor,
  type SponsorTier,
  type TeamSettings,
} from "@/types/app";
import { isDataImageUri, isSafeMediaUrl, type MediaEntityType } from "@/lib/media/validation";

function safeParseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function toPublicMediaSrc(
  rawValue: string | null | undefined,
  ref: {
    entity: MediaEntityType;
    id: number | string;
    field: "avatar" | "profile" | "featured" | "logo" | "banner" | "gallery";
    index?: number;
  }
): string {
  if (!rawValue || typeof rawValue !== "string") return "";
  const trimmed = rawValue.trim();
  if (!trimmed) return "";

  if (isDataImageUri(trimmed)) {
    const encodedId = encodeURIComponent(String(ref.id));
    if (ref.field === "gallery" && typeof ref.index === "number" && Number.isInteger(ref.index) && ref.index >= 0) {
      return `/api/media/legacy?entity=${ref.entity}&id=${encodedId}&field=gallery&index=${ref.index}`;
    }
    return `/api/media/legacy?entity=${ref.entity}&id=${encodedId}&field=${ref.field}`;
  }
  return isSafeMediaUrl(trimmed) ? trimmed : "";
}

export function toPublicGalleryArray(
  rawJson: string | null | undefined,
  ref: { entity: "player" | "post"; id: number | string }
): string[] {
  if (!rawJson || typeof rawJson !== "string") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const result: string[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (typeof item !== "string") continue;
    const mapped = toPublicMediaSrc(item, {
      entity: ref.entity,
      id: ref.id,
      field: "gallery",
      index: i,
    });
    if (mapped) {
      result.push(mapped);
    }
  }
  return result;
}

/**
 * Returns minimal public homepage data with explicit SQL projections:
 * - Zero Base64 data:image URIs (mapped to /api/media/legacy)
 * - Zero private player fields (no pin_code, phone, notes, access_role)
 * - Zero full article paragraphs or full gallery arrays
 * - Zero financial ledger rows or internal sponsor notes
 */
export async function getPublicHomePageData(): Promise<FullAppData> {
  const db = getAsyncDb();

  const [
    settingsRow,
    rawPlayers,
    rawMatches,
    rawAttendances,
    rawPosts,
    rawSponsors,
  ] = await Promise.all([
    db
      .queryOne<TeamSettings>(
        `SELECT id, team_name, short_name, default_match_fee, bank_bin, bank_name,
                bank_account_no, bank_account_name, tournament_fund_reserve,
                tournament_fund_note, fanpage_url
         FROM team_settings WHERE id = 1`
      )
      .catch(() => null),
    db.query<{
      id: number;
      code_order: number;
      full_name: string;
      short_name: string;
      jersey_number: number | null;
      position: string;
      birth_year: number | string | null;
      role: string;
      status: string;
      hometown: string | null;
      nickname: string | null;
      playing_style: string | null;
      bio: string | null;
      avatar_url: string | null;
      profile_image_url: string | null;
    }>(
      `SELECT id, code_order, full_name, short_name, jersey_number, position,
              birth_year, role, status, hometown, nickname, playing_style, bio,
              avatar_url, profile_image_url
       FROM players
       ORDER BY code_order ASC, id ASC`
    ),
    db.query<MatchRecord>(
      `SELECT id, match_number, label, match_date, kickoff_time, venue, opponent,
              fee_per_player, pitch_cost, payer_name, team_score, opponent_score,
              status, notes
       FROM matches
       ORDER BY match_number ASC, match_date ASC`
    ),
    db.query<{
      id: number;
      match_id: number;
      player_id: number;
      rsvp_status: string;
      attended: number;
    }>(
      `SELECT id, match_id, player_id, rsvp_status, attended
       FROM match_attendances`
    ),
    db
      .query<{
        id: string;
        category: string;
        category_label: string;
        category_badge_class: string;
        title: string;
        slug: string;
        summary: string;
        published_date: string;
        event_year: string;
        author: string;
        featured_image: string;
        reading_time: string;
        tagged_players_json: string;
      }>(
        `SELECT id, category, category_label, category_badge_class, title,
                slug, summary, published_date, event_year, author, featured_image,
                reading_time, tagged_players_json
         FROM club_posts
         ORDER BY published_date DESC, rowid DESC
         LIMIT 12`
      )
      .catch(() => null),
    db
      .query<{
        id: number;
        name: string;
        tier: string;
        logo_url: string;
        banner_url: string | null;
        website_url: string | null;
        description: string | null;
        start_date: string | null;
        end_date: string | null;
        display_positions_json: string | null;
        is_active: number;
        sort_order: number;
      }>(
        `SELECT id, name, tier, logo_url, banner_url, website_url, description,
                start_date, end_date, display_positions_json, is_active, sort_order
         FROM sponsors
         ORDER BY sort_order ASC, id ASC`
      )
      .catch(() => null),
  ]);

  const settings: TeamSettings = settingsRow || {
    id: 1,
    team_name: "Đội Bóng HĐH Gò Nổi",
    short_name: "FC HĐH GÒ NỔI",
    default_match_fee: 100000,
    bank_bin: "970422",
    bank_name: "MB Bank",
    bank_account_no: "",
    bank_account_name: "NGUYEN THE TIENG",
    tournament_fund_reserve: 2301700,
    tournament_fund_note: "",
    fanpage_url: FANPAGE_URL,
  };

  const players: Player[] = rawPlayers.map((p) => ({
    id: Number(p.id),
    code_order: Number(p.code_order || 0),
    full_name: p.full_name || "",
    short_name: p.short_name || "",
    jersey_number: p.jersey_number ?? null,
    position: p.position || "",
    birth_year: formatBirthYear(p.birth_year),
    phone: "",
    role: p.role || "Thành viên",
    status: p.status || "Đang sinh hoạt",
    access_role: "player",
    pin_code: "",
    notes: "",
    hometown: p.hometown || "",
    nickname: p.nickname || "",
    playing_style: p.playing_style || "",
    bio: p.bio || "",
    avatar_url: toPublicMediaSrc(p.avatar_url, {
      entity: "player",
      id: Number(p.id),
      field: "avatar",
    }),
    profile_image_url: toPublicMediaSrc(p.profile_image_url, {
      entity: "player",
      id: Number(p.id),
      field: "profile",
    }),
    gallery_urls: [],
  }));

  const attendances: MatchAttendance[] = rawAttendances.map((a) => ({
    id: Number(a.id),
    match_id: Number(a.match_id),
    player_id: Number(a.player_id),
    rsvp_status: (a.rsvp_status || "unconfirmed") as MatchAttendance["rsvp_status"],
    attended: Number(a.attended || 0),
    paid: 0,
    amount: 0,
    walk_in: 0,
    collected_by: "",
    note: "",
  }));

  const posts: ClubActivityPost[] =
    rawPosts && rawPosts.length > 0
      ? rawPosts.map((r) => ({
          id: r.id,
          category: r.category as ClubActivityPost["category"],
          categoryLabel: r.category_label,
          categoryBadgeClass: r.category_badge_class,
          title: r.title,
          slug: r.slug,
          summary: r.summary,
          publishedDate: r.published_date,
          eventYear: r.event_year || "2026",
          author: r.author,
          featuredImage: toPublicMediaSrc(r.featured_image, {
            entity: "post",
            id: r.id,
            field: "featured",
          }),
          galleryImages: [],
          readingTime: r.reading_time || "3 phút đọc",
          paragraphs: [],
          highlights: [],
          taggedPlayerNames: safeParseStringArray(r.tagged_players_json),
        }))
      : CLUB_ACTIVITIES_POSTS.slice(0, 12).map((p) => ({
          ...p,
          galleryImages: [],
          paragraphs: [],
          highlights: [],
        }));

  const sponsors: Sponsor[] = (rawSponsors || []).map((s) => ({
    id: Number(s.id),
    name: s.name,
    tier: (s.tier || "partner") as SponsorTier,
    logo_url: toPublicMediaSrc(s.logo_url, {
      entity: "sponsor",
      id: Number(s.id),
      field: "logo",
    }),
    banner_url: toPublicMediaSrc(s.banner_url, {
      entity: "sponsor",
      id: Number(s.id),
      field: "banner",
    }),
    website_url: s.website_url || "",
    description: s.description || "",
    start_date: s.start_date || "",
    end_date: s.end_date || "",
    display_positions: safeParseStringArray(s.display_positions_json),
    is_active: Boolean(s.is_active),
    sort_order: Number(s.sort_order ?? 0),
    note: "",
  }));

  const baseData: FullAppData = {
    settings,
    players,
    matches: rawMatches,
    attendances,
    otherIncomes: [],
    expenses: [],
    summary: {
      totalMatchIncome: 0,
      totalOtherIncome: 0,
      totalIncome: 0,
      totalExpense: 0,
      currentBalance: 0,
      totalUnpaidAmount: 0,
      categoryBreakdown: [],
    },
    posts,
    sponsors,
  };

  return {
    ...baseData,
    statistics: getTeamStatistics(baseData),
  };
}

/**
 * Request-deduped scoped query for /cau-thu/[id] (shared between generateMetadata and page render).
 */
export const getPublicPlayerProfileByIdOrJersey = cache(
  async (
    idOrJersey: string
  ): Promise<{
    player: Player | null;
    matches: MatchRecord[];
    attendances: MatchAttendance[];
  }> => {
    const db = getAsyncDb();
    const numeric = Number(idOrJersey);
    const row = Number.isInteger(numeric)
      ? await db.queryOne<{
          id: number;
          code_order: number;
          full_name: string;
          short_name: string;
          jersey_number: number | null;
          position: string;
          birth_year: number | string | null;
          role: string;
          status: string;
          hometown: string | null;
          nickname: string | null;
          playing_style: string | null;
          bio: string | null;
          avatar_url: string | null;
          profile_image_url: string | null;
          gallery_urls_json: string | null;
        }>(
          `SELECT id, code_order, full_name, short_name, jersey_number, position,
                  birth_year, role, status, hometown, nickname, playing_style, bio,
                  avatar_url, profile_image_url, gallery_urls_json
           FROM players
           WHERE id = ? OR jersey_number = ?
           ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
           LIMIT 1`,
          [numeric, numeric, numeric]
        )
      : null;

    if (!row) {
      return { player: null, matches: [], attendances: [] };
    }

    const playerId = Number(row.id);
    const [matches, attendances] = await Promise.all([
      db.query<MatchRecord>(
        `SELECT id, match_number, label, match_date, kickoff_time, venue, opponent,
                fee_per_player, pitch_cost, payer_name, team_score, opponent_score,
                status, notes
         FROM matches
         ORDER BY match_number ASC, match_date ASC`
      ),
      db.query<{
        id: number;
        match_id: number;
        player_id: number;
        rsvp_status: string;
        attended: number;
      }>(
        `SELECT id, match_id, player_id, rsvp_status, attended
         FROM match_attendances
         WHERE player_id = ?`,
        [playerId]
      ),
    ]);

    const player: Player = {
      id: playerId,
      code_order: Number(row.code_order || 0),
      full_name: row.full_name || "",
      short_name: row.short_name || "",
      jersey_number: row.jersey_number ?? null,
      position: row.position || "",
      birth_year: formatBirthYear(row.birth_year),
      phone: "",
      role: row.role || "Thành viên",
      status: row.status || "Đang sinh hoạt",
      access_role: "player",
      pin_code: "",
      notes: "",
      hometown: row.hometown || "",
      nickname: row.nickname || "",
      playing_style: row.playing_style || "",
      bio: row.bio || "",
      avatar_url: toPublicMediaSrc(row.avatar_url, {
        entity: "player",
        id: playerId,
        field: "avatar",
      }),
      profile_image_url: toPublicMediaSrc(row.profile_image_url, {
        entity: "player",
        id: playerId,
        field: "profile",
      }),
      gallery_urls: toPublicGalleryArray(row.gallery_urls_json, {
        entity: "player",
        id: playerId,
      }),
    };

    return {
      player,
      matches,
      attendances: attendances.map((a) => ({
        id: Number(a.id),
        match_id: Number(a.match_id),
        player_id: Number(a.player_id),
        rsvp_status: (a.rsvp_status || "unconfirmed") as MatchAttendance["rsvp_status"],
        attended: Number(a.attended || 0),
        paid: 0,
        amount: 0,
        walk_in: 0,
        collected_by: "",
        note: "",
      })),
    };
  }
);

/**
 * DB-first SSR initial data resolver for HomePage.
 * Fail-closed: returns public homepage data whenever session is missing, invalid,
 * belongs to an inactive, default-PIN, or must_change_pin=1 account, or DB verification fails (503).
 */
export async function resolveHomePageInitialData(
  sessionCookie?: string | null
): Promise<FullAppData> {
  if (!sessionCookie) {
    return getPublicHomePageData();
  }

  let authCtx;
  try {
    authCtx = await getCurrentAuthContextFromToken(sessionCookie);
  } catch {
    return getPublicHomePageData();
  }

  if (!authCtx.authorized || !authCtx.player || authCtx.mustChangePin) {
    return getPublicHomePageData();
  }

  const data = await getFullAppData();
  if (authCtx.player.access_role === "manager") {
    return {
      ...data,
      players: data.players.map((p) => ({ ...p, pin_code: "" })),
    };
  }
  return sanitizeDataForPlayer(data, authCtx.player.id);
}
