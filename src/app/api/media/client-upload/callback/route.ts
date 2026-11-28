import { NextRequest, NextResponse } from "next/server";
import type { HandleUploadBody } from "@vercel/blob/client";
import { guardCutoverCallbackWrite } from "@/lib/cutoverFreeze";
import { handleClientUploadCompletedCallback } from "@/lib/media/clientUploadCallback";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function POST(req: NextRequest) {
  const freezeRes = guardCutoverCallbackWrite(
    "POST /api/media/client-upload/callback"
  );
  if (freezeRes) return freezeRes;

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json(
      { error: "Payload JSON không hợp lệ." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  return handleClientUploadCompletedCallback(
    req,
    body,
    "POST /api/media/client-upload/callback"
  );
}
