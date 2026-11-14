import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { POST as importPost } from "@/app/api/import/route";
import { GET as exportGet } from "@/app/api/export/route";
import { getAsyncDb, getFullAppData } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import type { Player } from "@/types/app";

async function getTestActors(): Promise<{ manager: Player; player: Player }> {
  await getFullAppData();
  const db = getAsyncDb();
  const players = await db.query<Player>("SELECT * FROM players ORDER BY id ASC");
  const manager = players.find((p) => p.access_role === "manager");
  const player = players.find((p) => p.access_role !== "manager");
  if (!manager || !player) {
    throw new Error("Expected at least one manager and one player in local test DB");
  }
  return { manager, player };
}

describe("Dependency Hardening – SheetJS XLSX 0.20.3 & Excel Security", () => {
  it("loads SheetJS xlsx 0.20.3 and round-trips synthetic workbook safely", () => {
    expect(XLSX.version).toBe("0.20.3");

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["STT", "Họ và Tên", "Số tiền"],
      [1, "Cầu thủ Tổng hợp A", 100000],
      [2, "Cầu thủ Tổng hợp B", 0],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "2. Danh sách");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const parsed = XLSX.read(buf, { type: "buffer" });
    expect(parsed.SheetNames).toContain("2. Danh sách");

    const rows = XLSX.utils.sheet_to_json<unknown[]>(parsed.Sheets["2. Danh sách"], {
      header: 1,
      defval: "",
    });
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual([1, "Cầu thủ Tổng hợp A", 100000]);
  });

  it("enforces RBAC on POST /api/import and GET /api/export (Guest=401, Player=403, Manager export=200)", async () => {
    const { manager, player } = await getTestActors();

    const guestReq = new NextRequest("http://localhost:3000/api/import", {
      method: "POST",
      headers: { host: "localhost:3000", origin: "http://localhost:3000" },
    });
    expect((await importPost(guestReq)).status).toBe(401);

    const playerToken = createSessionToken(player, 1);
    const playerImportReq = new NextRequest("http://localhost:3000/api/import", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${playerToken}`,
      },
    });
    expect((await importPost(playerImportReq)).status).toBe(403);

    const playerExportReq = new NextRequest("http://localhost:3000/api/export", {
      method: "GET",
      headers: {
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${playerToken}`,
      },
    });
    expect((await exportGet(playerExportReq)).status).toBe(403);

    const managerToken = createSessionToken(manager, 1);
    const managerExportReq = new NextRequest("http://localhost:3000/api/export", {
      method: "GET",
      headers: {
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${managerToken}`,
      },
    });
    const exportRes = await exportGet(managerExportReq);
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get("content-type")).toContain("spreadsheetml.sheet");
    const exportBytes = new Uint8Array(await exportRes.arrayBuffer());
    const exportedWb = XLSX.read(exportBytes, { type: "array" });
    expect(exportedWb.SheetNames).toContain("1. Dashboard");
    expect(exportedWb.SheetNames).toContain("2. Danh sách");
  });

  it("rejects cross-origin CSRF, unsupported extension, oversized file, and invalid sheets for Manager without DB mutation", async () => {
    const { manager } = await getTestActors();
    const managerToken = createSessionToken(manager, 1);

    const csrfReq = new NextRequest("http://localhost:3000/api/import", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil.example",
        cookie: `${SESSION_COOKIE_NAME}=${managerToken}`,
      },
    });
    expect((await importPost(csrfReq)).status).toBe(403);

    const badExtForm = new FormData();
    badExtForm.append("file", new File([new Uint8Array(Buffer.from("not-excel"))], "payload.txt", { type: "text/plain" }));
    const badExtReq = new NextRequest("http://localhost:3000/api/import", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${managerToken}`,
      },
      body: badExtForm,
    });
    expect((await importPost(badExtReq)).status).toBe(400);

    const bigBuf = new Uint8Array(5 * 1024 * 1024 + 10);
    const bigForm = new FormData();
    bigForm.append("file", new File([bigBuf], "too-big.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const bigReq = new NextRequest("http://localhost:3000/api/import", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${managerToken}`,
      },
      body: bigForm,
    });
    expect((await importPost(bigReq)).status).toBe(400);

    const corruptWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(corruptWb, XLSX.utils.aoa_to_sheet([["OnlyOneSheet"]]), "WrongSheet");
    const validZipWrongSheets = new Uint8Array(XLSX.write(corruptWb, { type: "buffer", bookType: "xlsx" }) as Buffer);
    const wrongSheetForm = new FormData();
    wrongSheetForm.append("file", new File([validZipWrongSheets], "wrong-sheets.xlsx"));
    const wrongSheetReq = new NextRequest("http://localhost:3000/api/import", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${managerToken}`,
      },
      body: wrongSheetForm,
    });
    expect((await importPost(wrongSheetReq)).status).toBe(400);
  });
});
