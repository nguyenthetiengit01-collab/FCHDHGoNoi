import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { guardCutoverCallbackWrite } from "@/lib/cutoverFreeze";
import { getAsyncDb } from "@/lib/db";
import { isMediaStorageEnabled } from "@/lib/media/validation";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

interface SignedTokenPayload {
  entity?: string;
  playerId?: number | null;
  uploadedByPlayerId?: number;
  issuedAt?: number;
  expiresAt?: number;
}

async function ensureMediaUploadRecordsTable() {
  const db = getAsyncDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS media_upload_records (
      blob_url TEXT PRIMARY KEY,
      pathname TEXT NOT NULL,
      entity TEXT NOT NULL,
      player_id INTEGER,
      uploaded_by_player_id INTEGER,
      content_type TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

/**
 * Shared idempotent handler for Vercel Blob `blob.upload-completed` callbacks.
 * Used by both `/api/media/client-upload/callback` and legacy `/api/media/client-upload`
 * during Stage 1 Drain. Blocked in Stage 2 when `P103_CUTOVER_FREEZE_CALLBACKS=true`.
 */
export async function handleClientUploadCompletedCallback(
  req: NextRequest,
  body: HandleUploadBody,
  routeLabel: string
): Promise<NextResponse> {
  const freezeRes = guardCutoverCallbackWrite(routeLabel);
  if (freezeRes) return freezeRes;

  if (body?.type !== "blob.upload-completed") {
    return NextResponse.json(
      {
        error: "Endpoint callback không được phép cấp upload token mới.",
        code: "CALLBACK_TOKEN_GENERATION_FORBIDDEN",
      },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  if (!isMediaStorageEnabled()) {
    return NextResponse.json(
      { error: "Kho lưu trữ media (MEDIA_STORAGE_ENABLED) chưa được bật." },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json(
      {
        error: "Thiếu cấu hình BLOB_READ_WRITE_TOKEN cho Object Storage.",
        code: "BLOB_STORAGE_NOT_CONFIGURED",
      },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        throw new Error("Token generation is forbidden on callback handler.");
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        let parsed: SignedTokenPayload = {};
        if (tokenPayload) {
          try {
            parsed = JSON.parse(tokenPayload) as SignedTokenPayload;
          } catch {
            throw new Error("Invalid signed tokenPayload.");
          }
        }

        if (
          typeof parsed.expiresAt === "number" &&
          Number.isFinite(parsed.expiresAt) &&
          Date.now() > parsed.expiresAt
        ) {
          throw new Error("Upload token has expired.");
        }

        await ensureMediaUploadRecordsTable();
        const db = getAsyncDb();
        const nowIso = new Date().toISOString();
        const entity =
          parsed.entity === "player" ||
          parsed.entity === "post" ||
          parsed.entity === "sponsor"
            ? parsed.entity
            : "unknown";

        await db.run(
          `INSERT INTO media_upload_records (
            blob_url, pathname, entity, player_id, uploaded_by_player_id,
            content_type, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)
          ON CONFLICT(blob_url) DO NOTHING`,
          [
            blob.url,
            blob.pathname,
            entity,
            typeof parsed.playerId === "number" ? parsed.playerId : null,
            typeof parsed.uploadedByPlayerId === "number"
              ? parsed.uploadedByPlayerId
              : null,
            blob.contentType || "",
            nowIso,
            nowIso,
          ]
        );
      },
    });

    return NextResponse.json(jsonResponse, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Callback xử lý upload thất bại.";
    const lower = message.toLowerCase();
    const status =
      lower.includes("signature") || lower.includes("forbidden") ? 401 : 400;
    return NextResponse.json(
      { error: message },
      { status, headers: NO_STORE_HEADERS }
    );
  }
}
