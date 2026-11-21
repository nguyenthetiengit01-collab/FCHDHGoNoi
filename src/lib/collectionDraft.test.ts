import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getEffectiveAttendance,
  calculateDraftTotals,
  buildBatchPayloadItems,
  isAmbiguousMutateFailure,
  isDefinitiveNoWriteClientFailure,
  runBatchOperationAttempt,
  saveDraftToStorage,
  loadDraftFromStorage,
  loadPendingBatchSubmission,
  loadPendingBatchSubmissionState,
  deriveCollectionFooterViewState,
  type DraftItem,
} from "./collectionDraft";
import type { MatchAttendance, Player } from "@/types/app";

describe("collectionDraft helper", () => {
  const dummyPlayers: Player[] = [
    {
      id: 1,
      code_order: 1,
      full_name: "Cầu thủ 1",
      short_name: "CT1",
      jersey_number: 10,
      position: "Tiền đạo",
      phone: "",
      birth_year: "1990",
      avatar_url: "",
      role: "Thành viên",
      access_role: "player",
      pin_code: "1234",
      status: "Đang sinh hoạt",
      notes: "",
    },
    {
      id: 2,
      code_order: 2,
      full_name: "Cầu thủ 2",
      short_name: "CT2",
      jersey_number: 7,
      position: "Tiền vệ",
      phone: "",
      birth_year: "1992",
      avatar_url: "",
      role: "Thành viên",
      access_role: "player",
      pin_code: "1234",
      status: "Đang sinh hoạt",
      notes: "",
    },
    {
      id: 3,
      code_order: 3,
      full_name: "Cầu thủ 3",
      short_name: "CT3",
      jersey_number: 1,
      position: "Thủ môn",
      phone: "",
      birth_year: "1988",
      avatar_url: "",
      role: "Thành viên",
      access_role: "player",
      pin_code: "1234",
      status: "Đang sinh hoạt",
      notes: "",
    },
  ];

  const dummyAtts: MatchAttendance[] = [
    {
      id: 101,
      match_id: 1,
      player_id: 1,
      rsvp_status: "registered",
      walk_in: 0,
      attended: 1,
      paid: 1,
      amount: 100000,
      collected_by: "Tiếng",
      note: "",
    },
    {
      id: 102,
      match_id: 1,
      player_id: 2,
      rsvp_status: "registered",
      walk_in: 0,
      attended: 1,
      paid: 0,
      amount: 100000,
      collected_by: "",
      note: "",
    },
  ];

  const attByPlayer = new Map<number, MatchAttendance>([
    [1, dummyAtts[0]],
    [2, dummyAtts[1]],
  ]);

  it("lấy đúng trạng thái gốc khi chưa có nháp", () => {
    const eff1 = getEffectiveAttendance(1, dummyAtts[0], undefined, 100000);
    expect(eff1.paid).toBe(1);
    expect(eff1.amount).toBe(100000);
    expect(eff1.isDirty).toBe(false);

    const eff2 = getEffectiveAttendance(2, dummyAtts[1], undefined, 100000);
    expect(eff2.paid).toBe(0);
    expect(eff2.amount).toBe(100000);
    expect(eff2.isDirty).toBe(false);
  });

  it("ưu tiên dữ liệu nháp khi người dùng thao tác cục bộ", () => {
    // Đánh dấu cầu thủ 2 đã thu 100k
    const draft2: DraftItem = {
      paid: 1,
      amount: 100000,
      attended: 1,
      walk_in: 0,
    };
    const eff2 = getEffectiveAttendance(2, dummyAtts[1], draft2, 100000);
    expect(eff2.paid).toBe(1);
    expect(eff2.isDirty).toBe(true);

    // Huỷ thu cầu thủ 1
    const draft1: DraftItem = {
      paid: 0,
      amount: 100000,
      attended: 1,
      walk_in: 0,
    };
    const eff1 = getEffectiveAttendance(1, dummyAtts[0], draft1, 100000);
    expect(eff1.paid).toBe(0);
    expect(eff1.isDirty).toBe(true);
  });

  it("tính đúng tổng tiền và số người thu theo nháp", () => {
    // Ban đầu: CT1 đã nộp 100k, CT2 chưa nộp -> tổng 100k
    const initialTotals = calculateDraftTotals(
      dummyPlayers.slice(0, 2),
      attByPlayer,
      {},
      100000
    );
    expect(initialTotals.totalCollected).toBe(100000);
    expect(initialTotals.totalPaidCount).toBe(1);
    expect(initialTotals.totalUnpaidCount).toBe(1);
    expect(initialTotals.dirtyCount).toBe(0);

    // Nháp: đánh dấu CT2 đã nộp 100k
    const draft = {
      2: { paid: 1, amount: 100000, attended: 1, walk_in: 0 },
    };
    const totals = calculateDraftTotals(
      dummyPlayers.slice(0, 2),
      attByPlayer,
      draft,
      100000
    );
    expect(totals.totalCollected).toBe(200000);
    expect(totals.totalPaidCount).toBe(2);
    expect(totals.totalUnpaidCount).toBe(0);
    expect(totals.dirtyCount).toBe(1);
    expect(totals.netAmountDiff).toBe(100000);
  });

  it("build đúng batch payload chỉ gồm các dòng thực sự thay đổi", () => {
    const draft = {
      1: { paid: 1, amount: 100000, attended: 1, walk_in: 0 }, // Không đổi so với DB
      2: { paid: 1, amount: 120000, attended: 1, walk_in: 0 }, // Đổi paid và amount
      3: { paid: 0, amount: 0, attended: 0, walk_in: 0, removed: true }, // Bỏ khỏi trận
    };

    const batch = buildBatchPayloadItems(draft, attByPlayer, 100000);
    expect(batch.length).toBe(2); // Chỉ có 2 và 3, bỏ qua 1
    expect(batch.find((b) => b.player_id === 2)).toEqual({
      player_id: 2,
      attended: 1,
      paid: 1,
      amount: 120000,
      walk_in: 0,
      remove: false,
    });
    expect(batch.find((b) => b.player_id === 3)).toEqual({
      player_id: 3,
      attended: 0,
      paid: 0,
      amount: 0,
      walk_in: 0,
      remove: true,
    });
  });
});

describe("IDEMPOTENCY_SCHEMA_NOT_READY & unknown-write error semantics", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, String(v));
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => {
          store.clear();
        },
      },
    };
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  const sampleItems = [
    {
      player_id: 2,
      attended: 1,
      paid: 1,
      amount: 100000,
      walk_in: 0,
      remove: false,
    },
  ];

  const sampleDraft: Record<number, DraftItem> = {
    2: { paid: 1, amount: 100000, attended: 1, walk_in: 0 },
  };

  it("1-5. Treats IDEMPOTENCY_SCHEMA_NOT_READY (reconcileRequired=false) as definitive no-write, clears pending key, keeps draft & clean UI, and allows retry when ready", async () => {
    const schemaErrorResult = {
      ok: false,
      status: 503,
      code: "IDEMPOTENCY_SCHEMA_NOT_READY",
      retryable: false,
      reconcileRequired: false,
      error: "Hệ thống idempotency chưa sẵn sàng, chưa có dữ liệu nào được ghi.",
    };

    expect(isAmbiguousMutateFailure(schemaErrorResult)).toBe(false);
    expect(isDefinitiveNoWriteClientFailure(schemaErrorResult)).toBe(true);

    saveDraftToStorage(42, sampleDraft);
    const seenKeys: string[] = [];

    const firstOutcome = await runBatchOperationAttempt({
      mode: "save",
      matchId: 42,
      collectedBy: "Tieng",
      items: sampleItems,
      sendMutate: async (payload) => {
        seenKeys.push(payload.idempotency_key);
        return schemaErrorResult;
      },
    });

    // 1. Must not become unknown_outcome
    expect(firstOutcome.ok).toBe(false);
    expect(firstOutcome.pendingState.status).toBe("none");
    expect(loadPendingBatchSubmissionState(42)).toEqual({ status: "none" });
    // 2. Pending key is cleared
    expect(loadPendingBatchSubmission(42)).toBeNull();
    // 3. Original collection draft remains available
    expect(loadDraftFromStorage(42)).toEqual(sampleDraft);
    // 4. UI does not claim transaction may already have been recorded
    const footer = deriveCollectionFooterViewState({
      dirtyCount: 1,
      pendingLoadState: firstOutcome.pendingState,
      isSaving: false,
    });
    expect(footer.hasUnresolvedPending).toBe(false);
    expect(footer.showReconcileRetryButton).toBe(false);
    expect(footer.statusKind).toBe("dirty");
    expect(footer.saveButtonDisabled).toBe(false);
    expect(firstOutcome.error).not.toMatch(/chưa xác định|đã ghi|chưa đối chiếu/i);

    // 5. A new submission can proceed after schema becomes ready
    const secondOutcome = await runBatchOperationAttempt({
      mode: "save",
      matchId: 42,
      collectedBy: "Tieng",
      items: sampleItems,
      sendMutate: async (payload) => {
        seenKeys.push(payload.idempotency_key);
        return { ok: true };
      },
    });

    expect(secondOutcome.ok).toBe(true);
    expect(seenKeys).toHaveLength(2);
    expect(seenKeys[1]).not.toBe(seenKeys[0]);
    expect(loadPendingBatchSubmission(42)).toBeNull();
    expect(loadDraftFromStorage(42)).toEqual({});
  });

  it("6. Preserves original idempotency key and payload as unknown_outcome on DB_WRITE_OUTCOME_UNKNOWN", async () => {
    const unknownOutcomeResult = {
      ok: false,
      status: 503,
      code: "DB_WRITE_OUTCOME_UNKNOWN",
      retryable: false,
      reconcileRequired: true,
      error: "Không xác định được kết quả commit.",
    };

    expect(isAmbiguousMutateFailure(unknownOutcomeResult)).toBe(true);
    expect(isDefinitiveNoWriteClientFailure(unknownOutcomeResult)).toBe(false);

    saveDraftToStorage(43, sampleDraft);
    let sentKey = "";
    const outcome = await runBatchOperationAttempt({
      mode: "save",
      matchId: 43,
      collectedBy: "Tieng",
      items: sampleItems,
      sendMutate: async (payload) => {
        sentKey = payload.idempotency_key;
        return unknownOutcomeResult;
      },
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.pendingState.status).toBe("ok");
    const persisted = loadPendingBatchSubmission(43);
    expect(persisted).not.toBeNull();
    expect(persisted?.state).toBe("unknown_outcome");
    expect(persisted?.idempotency_key).toBe(sentKey);
    expect(persisted?.items).toEqual(sampleItems);

    const footer = deriveCollectionFooterViewState({
      dirtyCount: 1,
      pendingLoadState: outcome.pendingState,
      isSaving: false,
    });
    expect(footer.hasUnresolvedPending).toBe(true);
    expect(footer.showReconcileRetryButton).toBe(true);
  });

  it("7. Handles network failures conservatively as unknown_outcome", async () => {
    const networkFailureResult = {
      ok: false,
      status: 0,
      retryable: true,
      error: "Không thể kết nối máy chủ",
    };

    expect(isAmbiguousMutateFailure(networkFailureResult)).toBe(true);
    expect(isDefinitiveNoWriteClientFailure(networkFailureResult)).toBe(false);

    const outcome = await runBatchOperationAttempt({
      mode: "save",
      matchId: 44,
      collectedBy: "Tieng",
      items: sampleItems,
      sendMutate: async () => networkFailureResult,
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.pendingState.status).toBe("ok");
    expect(loadPendingBatchSubmission(44)?.state).toBe("unknown_outcome");
  });

  it("8. Treats HTTP 503 without a known no-write code as ambiguous", async () => {
    const generic503 = {
      ok: false,
      status: 503,
      error: "Service temporarily unavailable",
    };

    expect(isAmbiguousMutateFailure(generic503)).toBe(true);
    expect(isDefinitiveNoWriteClientFailure(generic503)).toBe(false);

    const outcome = await runBatchOperationAttempt({
      mode: "save",
      matchId: 45,
      collectedBy: "Tieng",
      items: sampleItems,
      sendMutate: async () => generic503,
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.pendingState.status).toBe("ok");
    expect(loadPendingBatchSubmission(45)?.state).toBe("unknown_outcome");
  });
});

