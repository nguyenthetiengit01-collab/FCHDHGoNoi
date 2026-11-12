import type { MatchAttendance, BatchCollectFeeItem, Player } from "@/types/app";

export interface DraftItem {
  paid: number;
  amount: number;
  attended: number;
  walk_in: number;
  removed?: boolean;
}

export type CollectionDraftState = Record<number, DraftItem>;

export interface EffectiveAttendance {
  paid: number;
  amount: number;
  attended: number;
  walk_in: number;
  isRemoved: boolean;
  isDirty: boolean;
}

/**
 * Lấy trạng thái điểm danh / thu tiền thực tế (đã gộp giữa dữ liệu gốc và phiếu nháp)
 */
export function getEffectiveAttendance(
  playerId: number,
  existingAtt: MatchAttendance | undefined,
  draftItem: DraftItem | undefined,
  defaultFee: number
): EffectiveAttendance {
  if (draftItem) {
    const isRemoved = Boolean(draftItem.removed);
    const origPaid = existingAtt?.paid ?? 0;
    const origAmt = existingAtt?.amount ?? 0;
    const origAtt = existingAtt?.attended ?? 0;
    const isDirty =
      isRemoved !== false ||
      draftItem.paid !== origPaid ||
      draftItem.amount !== origAmt ||
      draftItem.attended !== origAtt;

    return {
      paid: isRemoved ? 0 : draftItem.paid,
      amount: isRemoved ? 0 : draftItem.amount,
      attended: isRemoved ? 0 : draftItem.attended,
      walk_in: draftItem.walk_in,
      isRemoved,
      isDirty,
    };
  }

  if (existingAtt) {
    return {
      paid: existingAtt.paid,
      amount: existingAtt.amount > 0 ? existingAtt.amount : (existingAtt.paid ? defaultFee : defaultFee),
      attended: existingAtt.attended,
      walk_in: existingAtt.walk_in,
      isRemoved: false,
      isDirty: false,
    };
  }

  return {
    paid: 0,
    amount: defaultFee,
    attended: 0,
    walk_in: 0,
    isRemoved: false,
    isDirty: false,
  };
}

/**
 * Tính toán tổng số tiền đã thu, số cầu thủ đã đóng, số cầu thủ chưa đóng trên phiếu nháp
 */
export function calculateDraftTotals(
  participatingPlayers: Player[],
  attByPlayer: Map<number, MatchAttendance>,
  draft: CollectionDraftState,
  defaultFee: number
): {
  totalCollected: number;
  totalPaidCount: number;
  totalUnpaidCount: number;
  dirtyCount: number;
  netAmountDiff: number;
} {
  let totalCollected = 0;
  let totalPaidCount = 0;
  let totalUnpaidCount = 0;
  let origTotalCollected = 0;

  for (const player of participatingPlayers) {
    const orig = attByPlayer.get(player.id);
    if (orig && orig.paid === 1) {
      origTotalCollected += orig.amount;
    }

    const effective = getEffectiveAttendance(
      player.id,
      orig,
      draft[player.id],
      defaultFee
    );

    if (effective.isRemoved) {
      continue;
    }

    if (effective.paid === 1) {
      totalCollected += effective.amount;
      totalPaidCount++;
    } else {
      totalUnpaidCount++;
    }
  }

  // Đếm các dòng trong draft có thay đổi thực sự
  let dirtyCount = 0;
  for (const [pIdStr, item] of Object.entries(draft)) {
    const pId = Number(pIdStr);
    const orig = attByPlayer.get(pId);
    const eff = getEffectiveAttendance(pId, orig, item, defaultFee);
    if (eff.isDirty) {
      dirtyCount++;
    }
  }

  return {
    totalCollected,
    totalPaidCount,
    totalUnpaidCount,
    dirtyCount,
    netAmountDiff: totalCollected - origTotalCollected,
  };
}

/**
 * Trích xuất danh sách các mục thực sự thay đổi để gửi 1 request batch lên server
 */
export function buildBatchPayloadItems(
  draft: CollectionDraftState,
  attByPlayer: Map<number, MatchAttendance>,
  defaultFee: number
): BatchCollectFeeItem[] {
  const items: BatchCollectFeeItem[] = [];

  for (const [pIdStr, item] of Object.entries(draft)) {
    const pId = Number(pIdStr);
    const orig = attByPlayer.get(pId);
    const eff = getEffectiveAttendance(pId, orig, item, defaultFee);

    if (eff.isDirty) {
      items.push({
        player_id: pId,
        attended: eff.attended,
        paid: eff.paid,
        amount: eff.amount,
        walk_in: item.walk_in,
        remove: eff.isRemoved,
      });
    }
  }

  return items;
}

const STORAGE_PREFIX = "gonoi_fee_draft_match_";

export function getDraftStorageKey(matchId: number): string {
  return `${STORAGE_PREFIX}${matchId}`;
}

export function loadDraftFromStorage(matchId: number): CollectionDraftState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(matchId));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("Lỗi đọc draft thu tiền từ localStorage:", err);
    return {};
  }
}

export function saveDraftToStorage(
  matchId: number,
  draft: CollectionDraftState
): void {
  if (typeof window === "undefined") return;
  try {
    const key = getDraftStorageKey(matchId);
    if (Object.keys(draft).length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(draft));
    }
  } catch (err) {
    console.error("Lỗi lưu draft thu tiền vào localStorage:", err);
  }
}

export function clearDraftFromStorage(matchId: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getDraftStorageKey(matchId));
  } catch {
    // ignore
  }
}

