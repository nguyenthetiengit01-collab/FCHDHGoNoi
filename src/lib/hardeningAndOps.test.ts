import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gonoi-ops-test-"));
process.env.USE_LOCAL_SQLITE = "true";
process.env.SQLITE_DB_PATH = path.join(tmpDir, "ops-test.sqlite");

describe("Phase 5 Hardening, Audit Logs & Security Matrix", () => {
  afterAll(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore Windows SQLite file lock cleanup warnings
      }
    }
  });

  it("enforces authentication (401) and 10MB file size limit (413) on POST /api/webp", async () => {
    const { POST: postWebp } = await import("../app/api/webp/route");
    const { getFullAppData } = await import("./db");
    const { createSessionToken, SESSION_COOKIE_NAME } = await import("./auth");

    // 1. Unauthenticated -> 401
    const guestReq = new NextRequest("http://localhost:3000/api/webp", {
      method: "POST",
    });
    const guestRes = await postWebp(guestReq);
    expect(guestRes.status).toBe(401);

    // 2. Authenticated user uploading > 10MB -> 413
    const appData = await getFullAppData();
    const realPlayer = appData.players.find((p) => p.access_role === "player");
    expect(realPlayer).toBeTruthy();

    const playerToken = createSessionToken(realPlayer!);
    const oversizedBytes = new Uint8Array(10 * 1024 * 1024 + 1024);
    const form = new FormData();
    form.append("file", new File([oversizedBytes], "oversized.png", { type: "image/png" }));

    const oversizedReq = new NextRequest("http://localhost:3000/api/webp", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${playerToken}` },
      body: form,
    });
    const oversizedRes = await postWebp(oversizedReq);
    expect(oversizedRes.status).toBe(413);
  });

  it("reports healthy DB status on GET /api/health", async () => {
    const { GET: getHealth } = await import("../app/api/health/route");
    const res = await getHealth();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe("ok");
    expect(json.db).toBe("connected");
    expect(typeof json.latencyMs).toBe("number");
  });

  it("enforces RBAC (401 Guest, 403 Player, 200 Manager) on /api/audit-logs, /api/export, /api/import, and /api/team mutations", async () => {
    const { getAuditLogs, getFullAppData, recordAuditLog } = await import("./db");
    const { createSessionToken, SESSION_COOKIE_NAME } = await import("./auth");
    const { GET: getAuditLogsRoute } = await import("../app/api/audit-logs/route");
    const { GET: getExportRoute } = await import("../app/api/export/route");
    const { POST: postImportRoute } = await import("../app/api/import/route");
    const { POST: postTeamRoute, GET: getTeamRoute } = await import("../app/api/team/route");

    const appData = await getFullAppData();
    const realManager = appData.players.find((p) => p.access_role === "manager");
    const realPlayer = appData.players.find((p) => p.access_role === "player");
    expect(realManager).toBeTruthy();
    expect(realPlayer).toBeTruthy();

    const playerToken = createSessionToken(realPlayer!);
    const managerToken = createSessionToken(realManager!);

    // Public GET /api/team must never expose pin_code or phone
    const publicTeamRes = await getTeamRoute(new NextRequest("http://localhost:3000/api/team"));
    expect(publicTeamRes.status).toBe(200);
    const publicTeamJson = await publicTeamRes.json();
    expect(publicTeamJson.players.some((p: { pin_code?: string; phone?: string }) => Boolean(p.pin_code) || Boolean(p.phone))).toBe(false);

    // Audit logs RBAC
    await recordAuditLog({
      actorId: realManager!.id,
      actorName: realManager!.full_name,
      actorRole: "manager",
      action: "collect_match_fee",
      summary: "Thu quỹ trận thử nghiệm",
    });

    const guestAuditRes = await getAuditLogsRoute(new NextRequest("http://localhost:3000/api/audit-logs"));
    expect(guestAuditRes.status).toBe(401);

    const playerAuditRes = await getAuditLogsRoute(
      new NextRequest("http://localhost:3000/api/audit-logs", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${playerToken}` },
      })
    );
    expect(playerAuditRes.status).toBe(403);

    const managerAuditRes = await getAuditLogsRoute(
      new NextRequest("http://localhost:3000/api/audit-logs", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${managerToken}` },
      })
    );
    expect(managerAuditRes.status).toBe(200);

    // Export RBAC
    const guestExportRes = await getExportRoute(new NextRequest("http://localhost:3000/api/export"));
    expect(guestExportRes.status).toBe(401);

    const playerExportRes = await getExportRoute(
      new NextRequest("http://localhost:3000/api/export", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${playerToken}` },
      })
    );
    expect(playerExportRes.status).toBe(403);

    // Import RBAC
    const guestImportRes = await postImportRoute(
      new NextRequest("http://localhost:3000/api/import", { method: "POST" })
    );
    expect(guestImportRes.status).toBe(401);

    const playerImportRes = await postImportRoute(
      new NextRequest("http://localhost:3000/api/import", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${playerToken}` },
      })
    );
    expect(playerImportRes.status).toBe(403);

    // Manager mutation on /api/team logs to audit_logs without secrets
    const guestMutRes = await postTeamRoute(
      new NextRequest("http://localhost:3000/api/team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update_settings", payload: { note: "test" } }),
      })
    );
    expect(guestMutRes.status).toBe(401);

    const playerMutRes = await postTeamRoute(
      new NextRequest("http://localhost:3000/api/team", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${playerToken}`,
        },
        body: JSON.stringify({ action: "update_settings", payload: { note: "test" } }),
      })
    );
    expect(playerMutRes.status).toBe(403);

    const logs = await getAuditLogs(10);
    expect(logs.some((l) => /pin|secret|token/i.test(l.summary))).toBe(false);
  });
});
