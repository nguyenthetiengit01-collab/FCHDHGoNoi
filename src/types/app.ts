import type { ClubActivityPost } from "@/data/clubActivities";

export const EXPENSE_CATEGORIES = [
  "Tiền sân",
  "Nước uống",
  "Trọng tài",
  "Áo đấu/Phụ kiện",
  "Liên hoan/Ăn uống",
  "Khác",
] as const;

export const FANPAGE_URL = "https://www.facebook.com/FCHDHGoNoi/";
export const OFFICIAL_LOGO_URL = "/images/logo.jpg";
export const OFFICIAL_COVER_URL = "/images/cover-team.jpg";
export const OFFICIAL_QR_URL = "/images/qr-nguyenthetieng.jpg";

export type UserRole = "guest" | "player" | "manager";

export interface AuthSession {
  role: UserRole;
  playerId: number | null;
  fullName: string;
  shortName: string;
  jerseyNumber: number | null;
  position: string;
  teamRole: string;
  avatarUrl?: string;
  mustChangePassword?: boolean;
}

export interface TeamSettings {
  id: number;
  team_name: string;
  short_name: string;
  default_match_fee: number;
  bank_bin: string;
  bank_name: string;
  bank_account_no: string;
  bank_account_name: string;
  tournament_fund_reserve: number;
  tournament_fund_note: string;
  fanpage_url?: string;
}

export interface Player {
  id: number;
  code_order: number;
  full_name: string;
  short_name: string;
  jersey_number: number | null;
  position: string;
  phone: string;
  birth_year: string;
  avatar_url: string;
  profile_image_url?: string;
  role: string;
  access_role: "manager" | "player";
  username?: string;
  pin_code: string;
  status: string;
  notes: string;
  bio?: string;
  hometown?: string;
  nickname?: string;
  playing_style?: string;
  gallery_urls?: string[];
}

export interface MatchRecord {
  id: number;
  match_number: number;
  label: string;
  match_date: string;
  kickoff_time: string;
  venue: string;
  opponent: string;
  fee_per_player: number;
  pitch_cost: number;
  payer_name: string;
  team_score: number | null;
  opponent_score: number | null;
  status: string;
  notes: string;
  bio?: string;
  hometown?: string;
  nickname?: string;
  playing_style?: string;
  gallery_urls?: string[];
}

export type RsvpStatus =
  | "registered"
  | "absent_notice"
  | "declined"
  | "tentative"
  | "attending"
  | "none";

export interface MatchAttendance {
  id: number;
  match_id: number;
  player_id: number;
  rsvp_status: RsvpStatus;
  walk_in: number;
  attended: number;
  paid: number;
  amount: number;
  collected_by: string;
  note: string;
}

export interface OtherIncome {
  id: number;
  income_date: string;
  contributor: string;
  amount: number;
  fund_type: string;
  note: string;
}

export interface ExpenseRecord {
  id: number;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  payer: string;
  match_id: number | null;
}

export interface CategoryBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
}

export interface FinancialSummary {
  totalMatchIncome: number;
  totalOtherIncome: number;
  totalIncome: number;
  totalExpense: number;
  currentBalance: number;
  totalUnpaidAmount: number;
  totalAttendeesCount?: number;
  totalPaidCount?: number;
  totalVoluntaryDonorsCount?: number;
  totalVoluntaryAmount?: number;
  totalMatchesCount?: number;
  totalPlayersCount?: number;
  categoryBreakdown: CategoryBreakdownItem[];
}

export type SponsorTier =
  | "title" // Tài trợ chính
  | "gold" // Nhà tài trợ Vàng
  | "silver" // Nhà tài trợ Bạc
  | "partner" // Đối tác & Đồng hành
  | "supporter"; // Đơn vị hỗ trợ

export interface Sponsor {
  id: number;
  name: string;
  tier: SponsorTier;
  logo_url: string;
  banner_url?: string;
  website_url?: string;
  description?: string;
  slogan?: string;
  start_date?: string;
  end_date?: string;
  show_banner?: number;
  display_positions?: string[];
  sort_order: number;
  is_active: boolean | number;
  note?: string; // Ghi chú hợp đồng / liên hệ (chỉ BQL thấy)
  created_at?: string;
}

export interface BatchCollectFeeItem {
  player_id: number;
  attended: number;
  paid: number;
  amount: number;
  walk_in: number;
  remove?: boolean;
}

export type PlayerLifecycleCategory = "active" | "paused" | "stopped" | "unknown";

export type MatchLifecycleCategory =
  | "upcoming"
  | "completed"
  | "cancelled"
  | "inProgress"
  | "unknown";

export interface PlayerStatistics {
  total: number;
  active: number;
  paused: number;
  stopped: number;
  unknown: number;
}

export interface MatchStatistics {
  total: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  inProgress: number;
  unknown: number;
}

export interface TeamStatistics {
  players: PlayerStatistics;
  matches: MatchStatistics;
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
}

export interface FullAppData {
  settings: TeamSettings;
  players: Player[];
  matches: MatchRecord[];
  attendances: MatchAttendance[];
  otherIncomes: OtherIncome[];
  expenses: ExpenseRecord[];
  summary: FinancialSummary;
  posts?: ClubActivityPost[];
  sponsors?: Sponsor[];
  statistics?: TeamStatistics;
}

/** Cầu thủ đã loại bỏ hoàn toàn thuộc tính pin_code trước khi trả về client */
export type SafePlayerPayload = Omit<Player, "pin_code">;

/** Hợp đồng dữ liệu trả về từ GET /api/team theo 3 cấp quyền */
export type PublicTeamPayload = Omit<FullAppData, "players"> & {
  players: SafePlayerPayload[];
};
export type PlayerTeamPayload = Omit<FullAppData, "players"> & {
  players: SafePlayerPayload[];
};
export type ManagerTeamPayload = Omit<FullAppData, "players"> & {
  players: SafePlayerPayload[];
};

/**
 * Data Transfer Object (DTO) công khai cho cầu thủ dành cho Khách (Guest)
 * Tuyệt đối KHÔNG chứa: phone, username, pin_code, notes, access_role
 */
export interface PublicPlayerDTO {
  id: number;
  code_order: number;
  full_name: string;
  short_name: string;
  jersey_number: number | null;
  position: string;
  birth_year: string;
  avatar_url: string;
  profile_image_url?: string;
  role: string;
  status: string;
  bio?: string;
  hometown?: string;
  nickname?: string;
  playing_style?: string;
  gallery_urls?: string[];
}

/**
 * Data Transfer Object (DTO) công khai của toàn bộ câu lạc bộ dành cho Khách (Guest)
 * Loại bỏ toàn bộ sổ chi tiết thu chi, chứng từ, SĐT, mã PIN và ghi chú nội bộ.
 */
export interface PublicClubData {
  settings: {
    team_name: string;
    short_name: string;
    default_match_fee: number;
    fanpage_url: string;
    bank_bin?: string;
    bank_name?: string;
    bank_account_no?: string;
    bank_account_name?: string;
  };
  players: PublicPlayerDTO[];
  matches: MatchRecord[];
  attendances: MatchAttendance[];
  summary: FinancialSummary;
  posts?: ClubActivityPost[];
  sponsors?: Sponsor[];
}

export type MutateActionFn = (
  action: string,
  payload: Record<string, unknown>
) => Promise<void>;
