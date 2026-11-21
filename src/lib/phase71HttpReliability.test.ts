import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it, vi } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gonoi-phase71-test-"));
process.env.USE_LOCAL_SQLITE = "true";
process.env.SQLITE_DB_PATH = path.join(tmpDir, "phase71-test.sqlite");
process.env.MEDIA_STORAGE_ENABLED = "true";
process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test_token";

describe("Phase 7.1 HTTP Security Headers & Application Reliability", () => {
  afterAll(() => {
    vi.restoreAllMocks();
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore Windows SQLite file lock cleanup warnings
      }
    }
  });

  it("configures required HTTP security headers on /(.*) in next.config.ts", async () => {
    const nextConfigModule = await import("../../next.config");
    const nextConfig = nextConfigModule.default;
    expect(typeof nextConfig.headers).toBe("function");

    const rules = await nextConfig.headers!();
    const catchAllRule = rules.find((r) => r.source === "/(.*)");
    expect(catchAllRule).toBeDefined();

    const headerMap = new Map(
      catchAllRule!.headers.map((h) => [h.key.toLowerCase(), h.value])
    );

    expect(headerMap.get("x-content-type-options")).toBe("nosniff");
    expect(headerMap.get("x-frame-options")).toBe("DENY");
    expect(headerMap.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(headerMap.get("permissions-policy")).toBe(
      "camera=(), microphone=(), geolocation=()"
    );
    expect(headerMap.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains"
    );
    expect(headerMap.get("strict-transport-security")).not.toContain("preload");

    const csp =
      headerMap.get("content-security-policy") ||
      headerMap.get("content-security-policy-report-only");
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob: https:");
    expect(csp).toContain("connect-src 'self' https:");
  });

  it("sets Cache-Control: no-store on GET & POST /api/auth and POST /api/webp", async () => {
    const { GET: getAuth, POST: postAuth } = await import("../app/api/auth/route");
    const { POST: postWebp } = await import("../app/api/webp/route");

    const getAuthRes = await getAuth(new NextRequest("http://localhost:3000/api/auth"));
    expect(getAuthRes.headers.get("cache-control")).toBe(
      "no-store, no-cache, must-revalidate"
    );

    const postAuthRes = await postAuth(
      new NextRequest("http://localhost:3000/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      })
    );
    expect(postAuthRes.status).toBe(200);
    expect(postAuthRes.headers.get("cache-control")).toBe(
      "no-store, no-cache, must-revalidate"
    );

    const postWebpRes = await postWebp(
      new NextRequest("http://localhost:3000/api/webp", { method: "POST" })
    );
    expect(postWebpRes.status).toBe(401);
    expect(postWebpRes.headers.get("cache-control")).toBe(
      "no-store, no-cache, must-revalidate"
    );
  });

  it("enforces verifyCsrfOrigin (403) on POST /api/webp", async () => {
    const { POST: postWebp } = await import("../app/api/webp/route");

    const csrfMismatchReq = new NextRequest("http://localhost:3000/api/webp", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://attacker.example.com",
      },
    });

    const res = await postWebp(csrfMismatchReq);
    expect(res.status).toBe(403);
    expect(res.headers.get("cache-control")).toBe(
      "no-store, no-cache, must-revalidate"
    );
  });

  it("rejects revoked or inactive sessions via requirePlayerSession on /api/webp, /api/analytics, /api/media/upload, and /api/media/client-upload", async () => {
    const { getAsyncDb, getFullAppData } = await import("./db");
    const { createSessionToken, hashPassword, SESSION_COOKIE_NAME } = await import("./auth");
    const { POST: postWebp } = await import("../app/api/webp/route");
    const { GET: getAnalytics } = await import("../app/api/analytics/route");
    const { POST: postMediaUpload } = await import("../app/api/media/upload/route");
    const { POST: postMediaClientUpload } = await import(
      "../app/api/media/client-upload/route"
    );

    const appData = await getFullAppData();
    const player = appData.players.find((p) => p.access_role === "player");
    expect(player).toBeTruthy();

    // Issue a valid session token using DB credential material, then revoke it by changing pin_code in DB
    const db = getAsyncDb();
    const pinRow = await db.queryOne<{ pin_code: string }>(
      "SELECT pin_code FROM players WHERE id = ?",
      [player!.id]
    );
    const staleToken = createSessionToken({ ...player!, pin_code: pinRow?.pin_code || "" });
    await db.run("UPDATE players SET pin_code = ? WHERE id = ?", [
      hashPassword("NewStrongPin!99"),
      player!.id,
    ]);

    const cookieHeader = `${SESSION_COOKIE_NAME}=${staleToken}`;

    const webpRes = await postWebp(
      new NextRequest("http://localhost:3000/api/webp", {
        method: "POST",
        headers: { cookie: cookieHeader },
      })
    );
    expect(webpRes.status).toBe(401);

    const analyticsRes = await getAnalytics(
      new NextRequest("http://localhost:3000/api/analytics?section=overview", {
        method: "GET",
        headers: { cookie: cookieHeader },
      })
    );
    expect(analyticsRes.status).toBe(401);

    const uploadRes = await postMediaUpload(
      new NextRequest("http://localhost:3000/api/media/upload", {
        method: "POST",
        headers: { cookie: cookieHeader },
      })
    );
    expect(uploadRes.status).toBe(401);

    const clientUploadRes = await postMediaClientUpload(
      new NextRequest("http://localhost:3000/api/media/client-upload", {
        method: "POST",
        headers: {
          cookie: cookieHeader,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "blob.generate-client-token",
          payload: {
            pathname: "uploads/player/test.webp",
            clientPayload: null,
            multipart: false,
          },
        }),
      })
    );
    expect(clientUploadRes.status).toBe(401);

    // Also verify inactive player status is rejected
    const freshPlayerRow = await db.queryOne<typeof player>(
      "SELECT * FROM players WHERE id = ? LIMIT 1",
      [player!.id]
    );
    expect(freshPlayerRow).toBeTruthy();
    const activeToken = createSessionToken(freshPlayerRow!);
    await db.run("UPDATE players SET status = 'inactive' WHERE id = ?", [
      player!.id,
    ]);

    const inactiveRes = await getAnalytics(
      new NextRequest("http://localhost:3000/api/analytics?section=overview", {
        method: "GET",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${activeToken}` },
      })
    );
    expect(inactiveRes.status).toBe(401);
  });

  it("returns HTTP 503 on GET /api/health when !dbStatus.ok", async () => {
    const dbModule = await import("./db");
    const pingSpy = vi
      .spyOn(dbModule, "pingDatabase")
      .mockResolvedValueOnce({ ok: false, latencyMs: 15 });

    const { GET: getHealth } = await import("../app/api/health/route");
    const res = await getHealth();
    const json = await res.json();

    expect(pingSpy).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(503);
    expect(json.status).toBe("degraded");
    expect(json.db).toBe("error");
    expect(res.headers.get("cache-control")).toBe(
      "no-store, no-cache, must-revalidate"
    );
  });

  it("provides error.tsx, global-error.tsx, and not-found.tsx without leaking stack traces", () => {
    const appDir = path.resolve(process.cwd(), "src/app");
    for (const fileName of ["error.tsx", "global-error.tsx", "not-found.tsx"]) {
      const fullPath = path.join(appDir, fileName);
      expect(fs.existsSync(fullPath)).toBe(true);
      const source = fs.readFileSync(fullPath, "utf8");
      expect(source).not.toContain("error.stack");
      expect(source).not.toContain("error.message");
      expect(source).toContain("FC HĐH Gò Nổi");
    }
  });
});
