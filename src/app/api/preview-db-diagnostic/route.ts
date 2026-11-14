import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STAGING_HOSTNAME =
  "fchdhgonoi-staging-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io";
const PRODUCTION_HOSTNAME =
  "fchdhgonoi-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io";

type DatabaseTarget = "staging" | "production" | "unknown";

function extractHostname(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const normalized = trimmed.replace(/^libsql:\/\//i, "https://");
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function classifyDatabaseTarget(rawUrl: string): DatabaseTarget {
  const hostname = extractHostname(rawUrl);
  if (!hostname) return "unknown";
  if (hostname === STAGING_HOSTNAME) return "staging";
  if (hostname === PRODUCTION_HOSTNAME) return "production";
  return "unknown";
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const dbUrl = process.env.TURSO_DATABASE_URL?.trim() || "";
  const dbToken = process.env.TURSO_AUTH_TOKEN?.trim() || "";

  return NextResponse.json(
    {
      environment: "preview",
      databaseTarget: classifyDatabaseTarget(dbUrl),
      connectionConfigured: Boolean(dbUrl && dbToken),
    },
    { status: 200 }
  );
}
