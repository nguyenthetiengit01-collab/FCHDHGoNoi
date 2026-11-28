import { NextResponse } from "next/server";

export const CUTOVER_FREEZE_RETRY_AFTER_SECONDS = 300;
export const CLIENT_UPLOAD_TOKEN_TTL_MS = 60 * 1000;
export const CUTOVER_FREEZE_ERROR_CODE = "CUTOVER_WRITE_FROZEN";
export const CUTOVER_FREEZE_ERROR_MESSAGE =
  "Hệ thống đang tạm khóa ghi dữ liệu để bảo trì nâng cấp bảo mật (P1-03 Cutover). Vui lòng thử lại sau ít phút.";

/**
 * Kiểm tra cờ khóa ghi dữ liệu (write freeze) phục vụ bảo trì / cutover P1-03
 * (Giai đoạn 1: chặn toàn bộ mutating API & cấp token upload mới).
 */
export function isCutoverWriteFrozen(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.P103_CUTOVER_FREEZE_WRITES?.trim() === "true";
}

/**
 * Kiểm tra cờ khóa callback upload (Giai đoạn 2: sau khi drain hết upload in-flight,
 * khóa luôn route /api/media/client-upload/callback trước khi chụp final backup).
 */
export function isCutoverCallbackFrozen(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.P103_CUTOVER_FREEZE_CALLBACKS?.trim() === "true";
}

/**
 * Tạo phản hồi HTTP 503 chuẩn khi hệ thống đang tạm khóa ghi dữ liệu.
 */
export function createCutoverFreezeResponse(
  actionLabel?: string
): NextResponse {
  void actionLabel;
  return NextResponse.json(
    {
      error: CUTOVER_FREEZE_ERROR_MESSAGE,
      code: CUTOVER_FREEZE_ERROR_CODE,
      retryAfterSeconds: CUTOVER_FREEZE_RETRY_AFTER_SECONDS,
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(CUTOVER_FREEZE_RETRY_AFTER_SECONDS),
      },
    }
  );
}

/**
 * Guard đầu route cho các API có thao tác ghi DB hoặc side-effect media/blob.
 * Trả về NextResponse 503 nếu đang freeze, ngược lại trả về null.
 */
export function guardCutoverWrite(
  actionLabel?: string,
  env: Record<string, string | undefined> = process.env
): NextResponse | null {
  if (!isCutoverWriteFrozen(env)) {
    return null;
  }
  return createCutoverFreezeResponse(actionLabel);
}

/**
 * Guard riêng cho route callback Vercel Blob (/api/media/client-upload/callback).
 * Không bị chặn bởi P103_CUTOVER_FREEZE_WRITES trong Giai đoạn 1 (Drain),
 * chỉ bị chặn khi P103_CUTOVER_FREEZE_CALLBACKS=true ở Giai đoạn 2.
 */
export function guardCutoverCallbackWrite(
  actionLabel?: string,
  env: Record<string, string | undefined> = process.env
): NextResponse | null {
  if (!isCutoverCallbackFrozen(env)) {
    return null;
  }
  return createCutoverFreezeResponse(actionLabel);
}
