export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Validate and parse a non-negative integer VND amount.
 * Rejects missing values, negative numbers (including "-0"), fractional numbers,
 * NaN, Infinity, non-safe integers, and malformed strings, while preserving explicit 0.
 */
export function parseNonNegativeIntVnd(
  raw: unknown,
  fieldName = "Số tiền"
): ValidationResult<number> {
  if (raw === undefined || raw === null) {
    return { ok: false, error: `${fieldName} không được để trống.` };
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { ok: false, error: `${fieldName} không được để trống.` };
    }
    if (trimmed.startsWith("-")) {
      return {
        ok: false,
        error: `${fieldName} phải là số nguyên VNĐ không âm (≥ 0).`,
      };
    }
    const num = Number(trimmed);
    if (!Number.isSafeInteger(num) || num < 0) {
      return {
        ok: false,
        error: `${fieldName} phải là số nguyên VNĐ không âm (≥ 0).`,
      };
    }
    return { ok: true, value: num === 0 ? 0 : num };
  }
  if (typeof raw === "number") {
    if (!Number.isSafeInteger(raw) || raw < 0) {
      return {
        ok: false,
        error: `${fieldName} phải là số nguyên VNĐ không âm (≥ 0).`,
      };
    }
    return { ok: true, value: raw === 0 ? 0 : raw };
  }
  return {
    ok: false,
    error: `${fieldName} phải là số nguyên VNĐ hợp lệ.`,
  };
}
