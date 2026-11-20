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

export type PendingBatchSubmissionState =
  | "pending"
  | "unknown_outcome"
  | "confirmed";

export interface PendingBatchSubmission {
  match_id: number;
  idempotency_key: string;
  payload_fingerprint: string;
  state: PendingBatchSubmissionState;
  created_at: string;
}

const PENDING_BATCH_PREFIX = "gonoi_fee_pending_batch_";

export function getPendingBatchStorageKey(matchId: number): string {
  return `${PENDING_BATCH_PREFIX}${matchId}`;
}

export function generateIdempotencyUuid(): string {
  const webCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  if (webCrypto && typeof webCrypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error("Trình duyệt không hỗ trợ Web Crypto API để tạo khóa idempotency an toàn.");
}

export function computeBatchPayloadFingerprint(
  matchId: number,
  collectedBy: string,
  items: BatchCollectFeeItem[]
): string {
  const normalizedItems = [...items]
    .map((item) => ({
      player_id: Number(item.player_id),
      attended: Number(item.attended) ? 1 : 0,
      paid: Number(item.paid) ? 1 : 0,
      amount: Number(item.amount) || 0,
      walk_in: Number(item.walk_in) ? 1 : 0,
      remove: Boolean(item.remove),
    }))
    .sort((a, b) => a.player_id - b.player_id);

  const canonical = JSON.stringify({
    match_id: Number(matchId),
    collected_by: String(collectedBy || "").trim(),
    items: normalizedItems,
  });

  // Deterministic 64-bit FNV-1a (two independent 32-bit lanes) + length tag
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0x9e3779b9;
  for (let i = 0; i < canonical.length; i++) {
    const c = canonical.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  return `v1:${canonical.length}:${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

export type PendingBatchLoadResult =
  | { status: "none" }
  | { status: "ok"; submission: PendingBatchSubmission }
  | { status: "corrupted" };

export function loadPendingBatchSubmissionState(
  matchId: number
): PendingBatchLoadResult {
  if (typeof window === "undefined") return { status: "none" };
  try {
    if (!window.localStorage) return { status: "corrupted" };
    const raw = window.localStorage.getItem(getPendingBatchStorageKey(matchId));
    if (!raw) return { status: "none" };
    const parsed = JSON.parse(raw) as Partial<PendingBatchSubmission>;
    if (
      !parsed ||
      Number(parsed.match_id) !== Number(matchId) ||
      typeof parsed.idempotency_key !== "string" ||
      !parsed.idempotency_key ||
      typeof parsed.payload_fingerprint !== "string" ||
      !parsed.payload_fingerprint
    ) {
      return { status: "corrupted" };
    }
    const state: PendingBatchSubmissionState =
      parsed.state === "unknown_outcome" || parsed.state === "confirmed"
        ? parsed.state
        : "pending";
    return {
      status: "ok",
      submission: {
        match_id: Number(matchId),
        idempotency_key: parsed.idempotency_key,
        payload_fingerprint: parsed.payload_fingerprint,
        state,
        created_at:
          typeof parsed.created_at === "string"
            ? parsed.created_at
            : new Date().toISOString(),
      },
    };
  } catch {
    return { status: "corrupted" };
  }
}

export function loadPendingBatchSubmission(
  matchId: number
): PendingBatchSubmission | null {
  const res = loadPendingBatchSubmissionState(matchId);
  return res.status === "ok" ? res.submission : null;
}

export function savePendingBatchSubmission(
  matchId: number,
  submission: PendingBatchSubmission
): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (!window.localStorage) return false;
    const key = getPendingBatchStorageKey(matchId);
    const serialized = JSON.stringify(submission);
    window.localStorage.setItem(key, serialized);
    return window.localStorage.getItem(key) === serialized;
  } catch {
    return false;
  }
}

export function clearPendingBatchSubmission(matchId: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getPendingBatchStorageKey(matchId));
  } catch {
    // ignore
  }
}

export function isAmbiguousMutateFailure(result: {
  ok?: boolean;
  status?: number;
  code?: string;
  retryable?: boolean;
}): boolean {
  if (result.ok) return false;
  if (result.code === "DB_WRITE_OUTCOME_UNKNOWN") return true;
  if (result.status === 0 || result.status === 503) return true;
  if (typeof result.status === "number" && result.status >= 500) return true;
  if (result.retryable === true) return true;
  if (result.status === 408) return true;
  return result.status === undefined;
}

export function isDefinitiveNoWriteClientFailure(result: {
  ok?: boolean;
  status?: number;
  code?: string;
  retryable?: boolean;
}): boolean {
  if (result.ok || isAmbiguousMutateFailure(result)) return false;
  return (
    result.status === 400 ||
    result.status === 401 ||
    result.status === 403 ||
    result.status === 404 ||
    result.status === 422
  );
}

export type BatchAttemptResolution =
  | {
      blocked: true;
      reason: "unknown_outcome_payload_changed" | "unresolved_pending_payload_changed";
      pending: PendingBatchSubmission;
    }
  | {
      blocked: false;
      reused: boolean;
      submission: PendingBatchSubmission;
    };

export function resolveBatchSubmissionAttempt(params: {
  existingPending: PendingBatchSubmission | null;
  matchId: number;
  collectedBy: string;
  items: BatchCollectFeeItem[];
  generateKey?: () => string;
  now?: Date;
}): BatchAttemptResolution {
  const {
    existingPending,
    matchId,
    collectedBy,
    items,
    generateKey = generateIdempotencyUuid,
    now = new Date(),
  } = params;

  const fingerprint = computeBatchPayloadFingerprint(
    matchId,
    collectedBy,
    items
  );

  if (existingPending && existingPending.match_id === Number(matchId)) {
    if (existingPending.payload_fingerprint === fingerprint) {
      return {
        blocked: false,
        reused: true,
        submission: existingPending,
      };
    }

    if (
      existingPending.state === "unknown_outcome" ||
      existingPending.state === "pending"
    ) {
      return {
        blocked: true,
        reason:
          existingPending.state === "unknown_outcome"
            ? "unknown_outcome_payload_changed"
            : "unresolved_pending_payload_changed",
        pending: existingPending,
      };
    }
  }

  return {
    blocked: false,
    reused: false,
    submission: {
      match_id: Number(matchId),
      idempotency_key: generateKey(),
      payload_fingerprint: fingerprint,
      state: "pending",
      created_at: now.toISOString(),
    },
  };
}

