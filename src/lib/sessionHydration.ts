import type { FullAppData, AuthSession } from "@/types/app";

/**
 * Kiểm tra cấu trúc tối thiểu hợp lệ của dữ liệu đội bóng trả về từ GET /api/team.
 */
export function isValidFullAppData(payload: unknown): payload is FullAppData {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as Partial<FullAppData>;
  return (
    Boolean(candidate.settings && typeof candidate.settings === "object") &&
    Boolean(candidate.summary && typeof candidate.summary === "object") &&
    Array.isArray(candidate.players) &&
    Array.isArray(candidate.matches) &&
    Array.isArray(candidate.attendances) &&
    Array.isArray(candidate.expenses) &&
    Array.isArray(candidate.otherIncomes)
  );
}

/**
 * Tạo bản sao dữ liệu an toàn trong lúc chuyển phiên / đăng xuất / lỗi hydration:
 * loại bỏ hoàn toàn các danh sách và ghi chú nội bộ để tránh rò rỉ dữ liệu đặc quyền.
 */
export function createTransitionSafeData(prev: FullAppData): FullAppData {
  return {
    ...prev,
    settings: {
      ...prev.settings,
      tournament_fund_note: "",
    },
    players: prev.players.map((p) => ({
      ...p,
      phone: "",
      username: "",
      pin_code: "",
      notes: "",
      access_role: "player",
    })),
    expenses: [],
    otherIncomes: [],
  };
}

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/**
 * Tải dữ liệu đội bóng theo quyền phiên hiện tại từ endpoint GET /api/team.
 * Sử dụng cookie phiên httpOnly (same-origin) và tắt cache để đảm bảo luôn mới nhất.
 */
export async function fetchAuthorizedTeamData(
  fetchImpl: FetchLike = fetch,
  signal?: AbortSignal
): Promise<FullAppData> {
  const res = await fetchImpl("/api/team", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });

  if (!res.ok) {
    let serverMsg = "";
    try {
      const errJson = (await res.json()) as { error?: string };
      if (errJson?.error) serverMsg = errJson.error;
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(
      serverMsg || `Không thể đồng bộ dữ liệu đội bóng (HTTP ${res.status})`
    );
  }

  const json: unknown = await res.json();
  if (!isValidFullAppData(json)) {
    throw new Error("Dữ liệu trả về từ máy chủ không hợp lệ.");
  }

  return json;
}

export interface HydrationStateSnapshot<TTab extends string = string> {
  session: AuthSession;
  data: FullAppData;
  activeTab: TTab;
  isHydratingSession: boolean;
  hydrationError: string | null;
}

/**
 * Điều phối chuyển phiên an toàn: hủy request cũ, cô lập dữ liệu cũ trong lúc tải,
 * và ngăn phản hồi bất đồng bộ cũ ghi đè lên phiên mới hơn.
 */
export async function executeSessionHydration<TTab extends string>(params: {
  epoch: number;
  getCurrentEpoch: () => number;
  isMounted: () => boolean;
  nextSession: AuthSession;
  nextTab: TTab;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
  onStartTransition: () => void;
  onSuccess: (hydratedData: FullAppData, nextSession: AuthSession, nextTab: TTab) => void;
  onError: (message: string, nextSession: AuthSession) => void;
}): Promise<boolean> {
  const {
    epoch,
    getCurrentEpoch,
    isMounted,
    nextSession,
    nextTab,
    fetchImpl = fetch,
    signal,
    onStartTransition,
    onSuccess,
    onError,
  } = params;

  onStartTransition();

  try {
    const freshData = await fetchAuthorizedTeamData(fetchImpl, signal);
    if (!isMounted() || epoch !== getCurrentEpoch()) {
      return false;
    }
    onSuccess(freshData, nextSession, nextTab);
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return false;
    }
    if (!isMounted() || epoch !== getCurrentEpoch()) {
      return false;
    }
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Không thể tải dữ liệu theo phiên đăng nhập. Vui lòng thử lại.";
    onError(message, nextSession);
    return false;
  }
}
