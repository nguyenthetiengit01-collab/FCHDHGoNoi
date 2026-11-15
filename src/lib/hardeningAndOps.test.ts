import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gonoi-ops-test-"));
process.env.USE_LOCAL_SQLITE = "true";
process.env.SQLITE_DB_PATH = path.join(tmpDir, "ops-test.sqlite");

describe("Phase 5 Hardening, Audit Logs & Ops", () => {
  afterAll(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore Windows SQLite file lock cleanup warnings
      }
    }
  });

  it("blocks unauthenticated POST /api/webp requests with 401", async () => {
    const { POST: postWebp } = await import("../app/api/webp/route");
    const req = new NextRequest("http://localhost:3000/api/webp", {
      method: "POST",
    });
    const res = await postWebp(req);
    expect(res.status).toBe(401);
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

  it("records and retrieves audit logs and enforces manager-only access on GET /api/audit-logs", async () => {
    const { getAuditLogs, getFullAppData, recordAuditLog } = await import("./db");
    const { createSessionToken, SESSION_COOKIE_NAME } = await import("./auth");
    const { GET: getAuditLogsRoute } = await import("../app/api/audit-logs/route");

    const appData = await getFullAppData();
    const realManager = appData.players.find((p) => p.access_role === "manager");
    const realPlayer = appData.players.find((p) => p.access_role === "player");
    expect(realManager).toBeTruthy();
    expect(realPlayer).toBeTruthy();

    await recordAuditLog({
      actorId: realManager!.id,
      actorName: realManager!.full_name,
      actorRole: "manager",
      action: "collect_match_fee",
      summary: "Thu quỹ trận thử nghiệm",
    });

    const logs = await getAuditLogs(10);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0]?.action).toBe("collect_match_fee");

    // 1. Guest -> 401
    const guestReq = new NextRequest("http://localhost:3000/api/audit-logs");
    const guestRes = await getAuditLogsRoute(guestReq);
    expect(guestRes.status).toBe(401);

    // 2. Player -> 403
    const playerToken = createSessionToken(realPlayer!);
    const playerReq = new NextRequest("http://localhost:3000/api/audit-logs", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${playerToken}` },
    });
    const playerRes = await getAuditLogsRoute(playerReq);
    expect(playerRes.status).toBe(403);

    // 3. Manager -> 200
    const managerToken = createSessionToken(realManager!);
    const managerReq = new NextRequest("http://localhost:3000/api/audit-logs", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${managerToken}` },
    });
    const managerRes = await getAuditLogsRoute(managerReq);
    expect(managerRes.status).toBe(200);
    const body = await managerRes.json();
    expect(Array.isArray(body.logs)).toBe(true);
    expect(body.logs.length).toBeGreaterThanOrEqual(1);
  });
});
