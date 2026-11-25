import { expect, test } from "@playwright/test";
import { hashPassword } from "../../src/lib/auth";
import {
  computeBatchPayloadFingerprint,
  getPendingBatchStorageKey,
} from "../../src/lib/collectionDraft";
import type { Player } from "../../src/types/app";
import { QA_DB_PATH } from "./qaPaths";

function openQaDb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite = require("node:sqlite") as {
    DatabaseSync: new (filePath: string) => {
      prepare: (sql: string) => {
        run: (...args: unknown[]) => unknown;
        get: (...args: unknown[]) => unknown;
      };
      close: () => void;
    };
  };
  return new sqlite.DatabaseSync(QA_DB_PATH);
}

const QA_MANAGER_ID = 99;
const QA_MANAGER_PLAYER: Player = {
  id: QA_MANAGER_ID,
  code_order: 99,
  full_name: "QA Recovery Manager",
  short_name: "QA Mgr",
  jersey_number: 99,
  position: "GK",
  phone: "0900000099",
  birth_year: "1990",
  avatar_url: "/images/logo.jpg",
  role: "Quản lý",
  access_role: "manager",
  username: "qamgr99",
  pin_code: hashPassword("QaMgrStrong@2026"),
  status: "Đang sinh hoạt",
  notes: "",
};

test.describe("CollectionTab – Live Browser Pending Operation Recovery", () => {
  test.beforeAll(() => {
    const db = openQaDb();
    try {
      db.prepare(
        `INSERT OR REPLACE INTO players (
          id, code_order, full_name, short_name, jersey_number, position,
          phone, birth_year, avatar_url, profile_image_url, bio,
          role, access_role, username, pin_code, status, notes,
          hometown, nickname, playing_style, gallery_urls_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, '', 'Xã Điện Quang', '', '', '[]')`
      ).run(
        QA_MANAGER_PLAYER.id,
        QA_MANAGER_PLAYER.code_order,
        QA_MANAGER_PLAYER.full_name,
        QA_MANAGER_PLAYER.short_name,
        QA_MANAGER_PLAYER.jersey_number,
        QA_MANAGER_PLAYER.position,
        QA_MANAGER_PLAYER.phone,
        QA_MANAGER_PLAYER.birth_year,
        QA_MANAGER_PLAYER.avatar_url,
        QA_MANAGER_PLAYER.role,
        QA_MANAGER_PLAYER.access_role,
        QA_MANAGER_PLAYER.username,
        QA_MANAGER_PLAYER.pin_code,
        QA_MANAGER_PLAYER.status
      );
    } finally {
      db.close();
    }
  });

  test.afterAll(() => {
    const db = openQaDb();
    try {
      db.prepare("DELETE FROM players WHERE id = ?").run(QA_MANAGER_ID);
    } finally {
      db.close();
    }
  });

  async function loginAndOpenCollectionTab(
    page: import("@playwright/test").Page
  ) {
    await page.setViewportSize({ width: 1280, height: 800 });
    const loginRes = await page.request.post("/api/auth", {
      headers: {
        origin: "http://127.0.0.1:" + (process.env.PLAYWRIGHT_PORT || "3105"),
      },
      data: {
        action: "login",
        username: "qamgr99",
        pin: "QaMgrStrong@2026",
      },
    });
    expect(loginRes.ok()).toBe(true);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /2\. Thu Tiền & Chi Sân/i }).click();
    await expect(page.getByText(/Thu bởi:/i)).toBeVisible();
  }

  test("renders unresolved recovery UI when dirtyCount === 0, replays exact original payload/key, warns before discard, and blocks on corrupted/quota localStorage", async ({
    page,
  }) => {
    // 1. Seed pending operation for match_id = 2 (CollectionTab defaults to matches[matches.length - 1])
    //    while local draft is empty -> server snapshot converged with draft (dirtyCount === 0).
    const matchId = 2;
    const storageKey = getPendingBatchStorageKey(matchId);
    const originalItems = [
      {
        player_id: 1,
        attended: 1,
        paid: 1,
        amount: 100000,
        walk_in: 0,
        remove: false,
      },
    ];
    const originalCollectedBy = "QA Mgr";
    const originalKey = "e2e-replay-key-001";
    const pendingRecord = {
      match_id: matchId,
      idempotency_key: originalKey,
      payload_fingerprint: computeBatchPayloadFingerprint(
        matchId,
        originalCollectedBy,
        originalItems
      ),
      collected_by: originalCollectedBy,
      items: originalItems,
      state: "unknown_outcome",
      created_at: new Date().toISOString(),
    };

    await loginAndOpenCollectionTab(page);

    await page.evaluate(
      ({ key, value }) => {
        window.localStorage.setItem(key, JSON.stringify(value));
      },
      { key: storageKey, value: pendingRecord }
    );

    // Reload to simulate user returning after lost response when server snapshot converged (dirtyCount === 0)
    await page.reload({ waitUntil: "domcontentloaded" });
    const tabBtn = page.getByRole("button", { name: /2\. Thu Tiền & Chi Sân/i });
    try {
      await tabBtn.waitFor({ state: "visible", timeout: 15000 });
    } catch {
      const snippet = await page.locator("body").innerText();
      throw new Error(`Collection tab button missing after reload. Body text: ${snippet.slice(0, 500)}`);
    }
    await tabBtn.click();

    await expect(page.getByText("Đã đồng bộ với máy chủ")).toHaveCount(0);
    await expect(page.getByText("Có giao dịch thu quỹ chưa đối chiếu")).toBeVisible();
    const retryBtn = page.getByRole("button", { name: /Đối chiếu \/ Thử lại/i });
    const discardKeyBtn = page.getByRole("button", { name: /Xoá Khóa Tạm/i });
    await expect(retryBtn).toBeVisible();
    await expect(discardKeyBtn).toBeVisible();

    // 2. Click Retry -> intercept POST /api/team and assert exact original payload & idempotency_key
    const capturedRequests: Array<{ action?: unknown; payload?: unknown }> = [];
    await page.route("**/api/team", async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        capturedRequests.push(
          JSON.parse(req.postData() || "{}") as { action?: unknown; payload?: unknown }
        );
        const teamRes = await page.request.get("/api/team");
        const snapshot = await teamRes.json();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "X-Idempotent-Replay": "true" },
          body: JSON.stringify(snapshot),
        });
        return;
      }
      await route.continue();
    });

    await retryBtn.click();

    await expect(
      page.getByText("Đã đối chiếu & đồng bộ phiếu thu thành công!")
    ).toBeVisible();
    expect(capturedRequests.length).toBe(1);
    const capturedBody = capturedRequests[0];
    expect(capturedBody?.action).toBe("collect_match_fees_batch");
    expect(capturedBody?.payload).toEqual({
      match_id: matchId,
      collected_by: originalCollectedBy,
      items: originalItems,
      idempotency_key: originalKey,
    });
    const keyAfterReplay = await page.evaluate(
      (k) => window.localStorage.getItem(k),
      storageKey
    );
    expect(keyAfterReplay).toBeNull();
    await page.unroute("**/api/team");

    // 3. Click Xoá Khóa Tạm -> must show explicit warning BEFORE deleting key
    await page.evaluate(
      ({ key, value }) => {
        window.localStorage.setItem(key, JSON.stringify(value));
      },
      { key: storageKey, value: pendingRecord }
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /2\. Thu Tiền & Chi Sân/i }).click();

    await page.getByRole("button", { name: /Xoá Khóa Tạm/i }).click();
    await expect(
      page.getByText("Cảnh báo: Giao dịch có thể đã được ghi nhận trên máy chủ!")
    ).toBeVisible();
    await expect(page.getByText(/CẢNH BÁO ĐỐI CHIẾU/)).toBeVisible();

    // Key is STILL preserved before confirming the warning dialog
    const keyBeforeConfirm = await page.evaluate(
      (k) => window.localStorage.getItem(k),
      storageKey
    );
    expect(keyBeforeConfirm).not.toBeNull();

    await page
      .getByRole("button", { name: /Tôi đã đối chiếu, vẫn xóa nháp/i })
      .click();
    const keyAfterConfirm = await page.evaluate(
      (k) => window.localStorage.getItem(k),
      storageKey
    );
    expect(keyAfterConfirm).toBeNull();

    // 4. Corrupted localStorage JSON -> shows corrupted warning, never sends request
    let teamPostCount = 0;
    await page.route("**/api/team", async (route) => {
      if (route.request().method() === "POST") {
        teamPostCount++;
      }
      await route.continue();
    });

    await page.evaluate((k) => {
      window.localStorage.setItem(k, "{corrupted-json");
    }, storageKey);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /2\. Thu Tiền & Chi Sân/i }).click();

    await expect(page.getByText("Đã đồng bộ với máy chủ")).toHaveCount(0);
    await expect(page.getByText("Khóa thao tác bị hỏng — cần đối chiếu")).toBeVisible();
    expect(teamPostCount).toBe(0);

    // Clear corrupted key, then test QuotaExceededError on save -> zero POST /api/team sent
    await page.evaluate((k) => {
      window.localStorage.removeItem(k);
    }, storageKey);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /2\. Thu Tiền & Chi Sân/i }).click();

    // Add a walk-in player to draft to create dirtyCount = 1
    await page.getByRole("button", { name: /#10 QA Một/i }).click();
    await expect(page.getByRole("button", { name: /Lưu Phiếu Thu \(1\)/i })).toBeVisible();

    await page.evaluate((k) => {
      const origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, val: string) {
        if (key === k) {
          const err = new Error("QuotaExceededError");
          err.name = "QuotaExceededError";
          throw err;
        }
        return origSet.call(this, key, val);
      };
    }, storageKey);

    await page.getByRole("button", { name: /Lưu Phiếu Thu \(1\)/i }).click();
    await expect(
      page.getByText(/Không thể lưu đầy đủ bản ghi thao tác vào bộ nhớ trình duyệt/i)
    ).toBeVisible();
    expect(teamPostCount).toBe(0);

    await page.unroute("**/api/team");
  });
});
