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
  fanpage_url: string;
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
  role: string;
  access_role: "manager" | "player";
  pin_code: string;
  status: string;
  notes: string;
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
}

export type RsvpStatus = "registered" | "absent_notice" | "none";

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
  categoryBreakdown: CategoryBreakdownItem[];
}

export interface FullAppData {
  settings: TeamSettings;
  players: Player[];
  matches: MatchRecord[];
  attendances: MatchAttendance[];
  otherIncomes: OtherIncome[];
  expenses: ExpenseRecord[];
  summary: FinancialSummary;
}

export type MutateActionFn = (
  action: string,
  payload: Record<string, unknown>
) => Promise<void>;
