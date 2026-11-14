import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/preview-db-diagnostic/route";

describe("GET /api/preview-db-diagnostic", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 when VERCEL_ENV is not preview", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns staging when TURSO_DATABASE_URL matches staging hostname in preview", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv(
      "TURSO_DATABASE_URL",
      "libsql://fchdhgonoi-staging-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io"
    );
    vi.stubEnv("TURSO_AUTH_TOKEN", "dummy-token");

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      environment: "preview",
      databaseTarget: "staging",
      connectionConfigured: true,
    });
  });

  it("returns production when TURSO_DATABASE_URL matches production hostname in preview", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv(
      "TURSO_DATABASE_URL",
      "libsql://fchdhgonoi-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io"
    );
    vi.stubEnv("TURSO_AUTH_TOKEN", "dummy-token");

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      environment: "preview",
      databaseTarget: "production",
      connectionConfigured: true,
    });
  });

  it("returns unknown and connectionConfigured false when env vars are missing", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("TURSO_DATABASE_URL", "");
    vi.stubEnv("TURSO_AUTH_TOKEN", "");

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      environment: "preview",
      databaseTarget: "unknown",
      connectionConfigured: false,
    });
  });
});
