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
  collected_by: string;
  items: BatchCollectFeeItem[];
  state: PendingBatchSubmissionState;
  created_at: string;
}

const PENDING_BATCH_PREFIX = "gonoi_fee_pending_batch_";

export function getPendingBatchStorageKey(matchId: number): string {
  return `${PENDING_BATCH_PREFIX}${matchId}`;
}

export function normalizeBatchPayloadItems(
  items: BatchCollectFeeItem[]
): BatchCollectFeeItem[] {
  return [...items]
    .map((item) => ({
      player_id: Number(item.player_id),
      attended: Number(item.attended) ? 1 : 0,
      paid: Number(item.paid) ? 1 : 0,
      amount: Number(item.amount) || 0,
      walk_in: Number(item.walk_in) ? 1 : 0,
      remove: Boolean(item.remove),
    }))
    .sort((a, b) => a.player_id - b.player_id);
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
  const normalizedItems = normalizeBatchPayloadItems(items);

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

function isValidBatchItemList(raw: unknown): raw is BatchCollectFeeItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  return raw.every(
    (it) =>
      it &&
      typeof it === "object" &&
      Number.isInteger(Number((it as BatchCollectFeeItem).player_id)) &&
      Number((it as BatchCollectFeeItem).player_id) > 0 &&
      Number.isFinite(Number((it as BatchCollectFeeItem).amount ?? 0))
  );
}

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
      !parsed.payload_fingerprint ||
      typeof parsed.collected_by !== "string" ||
      !isValidBatchItemList(parsed.items)
    ) {
      return { status: "corrupted" };
    }
    const normalizedItems = normalizeBatchPayloadItems(parsed.items);
    const expectedFingerprint = computeBatchPayloadFingerprint(
      Number(matchId),
      parsed.collected_by,
      normalizedItems
    );
    if (parsed.payload_fingerprint !== expectedFingerprint) {
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
        collected_by: parsed.collected_by,
        items: normalizedItems,
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
    const existingState = loadPendingBatchSubmissionState(matchId);
    if (
      existingState.status === "ok" &&
      existingState.submission.state !== "confirmed" &&
      existingState.submission.idempotency_key !== submission.idempotency_key
    ) {
      // Never overwrite an unresolved operation with a different idempotency key
      return false;
    }

    const normalizedItems = normalizeBatchPayloadItems(submission.items);
    const cleanSubmission: PendingBatchSubmission = {
      match_id: Number(matchId),
      idempotency_key: submission.idempotency_key,
      payload_fingerprint: computeBatchPayloadFingerprint(
        Number(matchId),
        submission.collected_by,
        normalizedItems
      ),
      collected_by: String(submission.collected_by || "").trim(),
      items: normalizedItems,
      state: submission.state,
      created_at: submission.created_at,
    };

    const key = getPendingBatchStorageKey(matchId);
    const serialized = JSON.stringify(cleanSubmission);
    window.localStorage.setItem(key, serialized);
    const readBackRaw = window.localStorage.getItem(key);
    if (readBackRaw !== serialized) {
      return false;
    }
    const verified = loadPendingBatchSubmissionState(matchId);
    return (
      verified.status === "ok" &&
      verified.submission.idempotency_key === cleanSubmission.idempotency_key &&
      verified.submission.payload_fingerprint === cleanSubmission.payload_fingerprint &&
      verified.submission.items.length === cleanSubmission.items.length
    );
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
  reconcileRequired?: boolean;
}): boolean {
  if (result.ok) return false;
  if (result.code === "DB_WRITE_OUTCOME_UNKNOWN") return true;
  if (
    result.code === "IDEMPOTENCY_SCHEMA_NOT_READY" &&
    result.reconcileRequired === false
  ) {
    return false;
  }
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
  reconcileRequired?: boolean;
}): boolean {
  if (result.ok || isAmbiguousMutateFailure(result)) return false;
  if (
    result.code === "IDEMPOTENCY_SCHEMA_NOT_READY" &&
    result.reconcileRequired === false
  ) {
    return true;
  }
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

  const normalizedItems = normalizeBatchPayloadItems(items);
  const cleanCollector = String(collectedBy || "").trim();
  const fingerprint = computeBatchPayloadFingerprint(
    matchId,
    cleanCollector,
    normalizedItems
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
      collected_by: cleanCollector,
      items: normalizedItems,
      state: "pending",
      created_at: now.toISOString(),
    },
  };
}

export interface BatchOperationOutcome {
  ok: boolean;
  error?: string;
  cleared?: boolean;
  pendingState: PendingBatchLoadResult;
}

export async function runBatchOperationAttempt(params: {
  mode: "save" | "reconcile_retry";
  matchId: number;
  collectedBy?: string;
  items?: BatchCollectFeeItem[];
  sendMutate: (payload: {
    match_id: number;
    collected_by: string;
    items: BatchCollectFeeItem[];
    idempotency_key: string;
  }) => Promise<{
    ok: boolean;
    error?: string;
    status?: number;
    code?: string;
    retryable?: boolean;
    reconcileRequired?: boolean;
  } | void>;
}): Promise<BatchOperationOutcome> {
  const { mode, matchId, sendMutate } = params;
  const loaded = loadPendingBatchSubmissionState(matchId);

  if (loaded.status === "corrupted") {
    return {
      ok: false,
      error:
        "Dữ liệu khóa an toàn của lần gửi trước trong trình duyệt bị hỏng hoặc thiếu thông tin. Để tránh ghi trùng giao dịch, vui lòng kiểm tra bảng thu quỹ thực tế trước rồi bấm Huỷ Thay Đổi / Xoá Khóa Tạm nếu cần gửi lại.",
      pendingState: loaded,
    };
  }

  let activeSubmission: PendingBatchSubmission;
  if (mode === "reconcile_retry") {
    if (loaded.status !== "ok") {
      return {
        ok: false,
        error: "Không tìm thấy thao tác thu quỹ chưa đối chiếu để thử lại.",
        pendingState: loaded,
      };
    }
    // Always replay exact persisted original payload & key, never rebuild from server data
    activeSubmission = loaded.submission;
  } else {
    const rawItems = params.items ?? [];
    const rawCollector = String(params.collectedBy ?? "").trim();
    const resolution = resolveBatchSubmissionAttempt({
      existingPending: loaded.status === "ok" ? loaded.submission : null,
      matchId,
      collectedBy: rawCollector,
      items: rawItems,
    });
    if (resolution.blocked) {
      return {
        ok: false,
        error:
          "Đang có thao tác thu quỹ trước chưa đối chiếu xong kết quả trên máy chủ. Hãy dùng nút 'Đối chiếu / Thử lại' với dữ liệu gốc hoặc kiểm tra bảng thu quỹ trước khi thay đổi.",
        pendingState: loaded,
      };
    }
    activeSubmission = resolution.submission;
  }

  const persisted = savePendingBatchSubmission(matchId, activeSubmission);
  if (!persisted) {
    return {
      ok: false,
      error:
        "Không thể lưu đầy đủ bản ghi thao tác vào bộ nhớ trình duyệt (localStorage đầy, bị chặn hoặc đọc lại không khớp). Hệ thống đã dừng gửi để tránh rủi ro ghi trùng.",
      pendingState: loadPendingBatchSubmissionState(matchId),
    };
  }

  try {
    const result = await sendMutate({
      match_id: activeSubmission.match_id,
      collected_by: activeSubmission.collected_by,
      items: activeSubmission.items,
      idempotency_key: activeSubmission.idempotency_key,
    });

    if (result && !result.ok) {
      if (isAmbiguousMutateFailure(result) || result.status === 409) {
        savePendingBatchSubmission(matchId, {
          ...activeSubmission,
          state: "unknown_outcome",
        });
        return {
          ok: false,
          error:
            result.error ||
            "Mất kết nối hoặc chưa xác định được kết quả ghi cơ sở dữ liệu. Bản ghi thao tác gốc và khóa idempotency được giữ nguyên để đối chiếu/thử lại an toàn.",
          pendingState: loadPendingBatchSubmissionState(matchId),
        };
      }

      if (isDefinitiveNoWriteClientFailure(result)) {
        clearPendingBatchSubmission(matchId);
      }

      return {
        ok: false,
        error:
          result.error ||
          "Không thể lưu phiếu thu lên máy chủ. Dữ liệu nháp vẫn được giữ an toàn trên máy để bạn kiểm tra lại.",
        pendingState: loadPendingBatchSubmissionState(matchId),
      };
    }

    clearPendingBatchSubmission(matchId);
    clearDraftFromStorage(matchId);
    return {
      ok: true,
      cleared: true,
      pendingState: { status: "none" },
    };
  } catch {
    savePendingBatchSubmission(matchId, {
      ...activeSubmission,
      state: "unknown_outcome",
    });
    return {
      ok: false,
      error:
        "Mất kết nối máy chủ khi lưu phiếu thu. Bản ghi thao tác gốc và khóa idempotency được giữ nguyên để đối chiếu/thử lại an toàn.",
      pendingState: loadPendingBatchSubmissionState(matchId),
    };
  }
}

export interface CollectionFooterViewState {
  hasUnresolvedPending: boolean;
  statusKind: "unresolved" | "dirty" | "synced";
  statusText: string;
  showDiscardButton: boolean;
  discardButtonLabel: string;
  showReconcileRetryButton: boolean;
  saveButtonDisabled: boolean;
}

export function deriveCollectionFooterViewState(params: {
  dirtyCount: number;
  pendingLoadState: PendingBatchLoadResult;
  isSaving: boolean;
  confirmedNotice?: string | null;
}): CollectionFooterViewState {
  const { dirtyCount, pendingLoadState, isSaving, confirmedNotice } = params;
  const hasUnresolvedPending =
    pendingLoadState.status === "corrupted" ||
    (pendingLoadState.status === "ok" &&
      pendingLoadState.submission.state !== "confirmed");

  if (hasUnresolvedPending) {
    return {
      hasUnresolvedPending: true,
      statusKind: "unresolved",
      statusText:
        pendingLoadState.status === "corrupted"
          ? "Khóa thao tác bị hỏng — cần đối chiếu"
          : "Có giao dịch thu quỹ chưa đối chiếu",
      showDiscardButton: true,
      discardButtonLabel: "Xoá Khóa Tạm",
      showReconcileRetryButton: pendingLoadState.status === "ok",
      saveButtonDisabled: true,
    };
  }

  if (dirtyCount > 0) {
    return {
      hasUnresolvedPending: false,
      statusKind: "dirty",
      statusText: `${dirtyCount} thay đổi chưa lưu`,
      showDiscardButton: true,
      discardButtonLabel: "Huỷ Thay Đổi",
      showReconcileRetryButton: false,
      saveButtonDisabled: isSaving,
    };
  }

  return {
    hasUnresolvedPending: false,
    statusKind: "synced",
    statusText: confirmedNotice || "Đã đồng bộ với máy chủ",
    showDiscardButton: false,
    discardButtonLabel: "Huỷ Thay Đổi",
    showReconcileRetryButton: false,
    saveButtonDisabled: true,
  };
}

