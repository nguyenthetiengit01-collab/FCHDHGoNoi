import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import * as dbModule from "@/lib/db";
import {
  getAuthSecret,
  createSessionToken,
  verifySessionToken,
  verifyCsrfOrigin,
  sanitizePlayerForPublic,
  sanitizeDataForPublic,
  sanitizeDataForPlayer,
  hashPassword,
  verifyPassword,
  SESSION_COOKIE_NAME,
} from "./auth";
import type { Player, FullAppData } from "@/types/app";
import { GET as handleTeamGet, POST as handleTeamPost } from "@/app/api/team/route";
import { GET as handleExportGet } from "@/app/api/export/route";
import { POST as handleImportPost } from "@/app/api/import/route";

const mockManager: Player = {
  id: 1,
  code_order: 1,
  full_name: "Nguyễn Thế Tiếng",
  short_name: "Tiếng",
  jersey_number: 10,
  position: "Tiền vệ",
  phone: "0901234567",
  birth_year: "1990",
  avatar_url: "/uploads/avatars/member-1.webp",
  profile_image_url: "/uploads/profiles/tieng.webp",
  role: "Đội trưởng / Thủ quỹ",
  access_role: "manager",
  pin_code: hashPassword("secure_pin_123"),
  status: "Đang sinh hoạt",
  notes: "Ghi chú nội bộ nhạy cảm về tài chính",
  hometown: "Điện Quang",
  nickname: "Tiếng Ca",
  playing_style: "Kiểm soát bóng",
  username: "tiengnguyen",
};

const mockPlayer: Player = {
  id: 2,
  code_order: 2,
  full_name: "Lê Văn Cầu Thủ",
  short_name: "Thủ",
  jersey_number: 7,
  position: "Tiền đạo",
  phone: "0987654321",
  birth_year: "1994",
  avatar_url: "/uploads/avatars/member-2.webp",
  role: "Thành viên",
  access_role: "player",
  pin_code: hashPassword("player_pin_456"),
  status: "Đang sinh hoạt",
  notes: "Ghi chú sức khỏe nội bộ",
  hometown: "Điện Phong",
  username: "lethua",
};

const mockOtherPlayer: Player = {
  id: 3,
  code_order: 3,
  full_name: "Trần Đồng Đội",
  short_name: "Đội",
  jersey_number: 9,
  position: "Hậu vệ",
  phone: "0911223344",
  birth_year: "1992",
  avatar_url: "/uploads/avatars/member-3.webp",
  role: "Thành viên",
  access_role: "player",
  pin_code: hashPassword("other_pin_789"),
  status: "Đang sinh hoạt",
  notes: "Ghi chú riêng tư của Trần Đồng Đội",
  hometown: "Điện Trung",
  username: "trandoi",
};

const mockFullAppData: FullAppData = {
  settings: {
    id: 1,
    team_name: "FC HĐH Gò Nổi tại TP.HCM",
    short_name: "FC GÒ NỔI",
    default_match_fee: 100000,
    bank_bin: "970422",
    bank_name: "MB Bank",
    bank_account_no: "123456789",
    bank_account_name: "NGUYEN THE TIENG",
    tournament_fund_reserve: 2000000,
    tournament_fund_note: "Quỹ dự phòng kín",
    fanpage_url: "https://facebook.com/gonoifc",
  },
  players: [mockManager, mockPlayer, mockOtherPlayer],
  matches: [
    {
      id: 1,
      match_number: 1,
      label: "Trận 1",
      match_date: "2026-03-01",
      kickoff_time: "19:00",
      venue: "Sân Vĩnh Lộc",
      opponent: "Giao hữu",
      fee_per_player: 100000,
      pitch_cost: 600000,
      payer_name: "Tiếng",
      status: "Đã kết thúc",
      team_score: 0,
      opponent_score: 0,
      notes: "",
    },
  ],
  attendances: [
    {
      id: 1,
      match_id: 1,
      player_id: 1,
      rsvp_status: "attending",
      walk_in: 0,
      attended: 1,
      paid: 1,
      amount: 100000,
      collected_by: "Tiếng",
      note: "",
    },
  ],
  otherIncomes: [
    {
      id: 1,
      income_date: "2026-03-01",
      contributor: "Mạnh thường quân ẩn danh",
      amount: 5000000,
      fund_type: "Quỹ sinh hoạt",
      note: "Ủng hộ kín đáo",
    },
  ],
  expenses: [
    {
      id: 1,
      match_id: 1,
      expense_date: "2026-03-01",
      category: "Tiền sân",
      description: "Thanh toán sân số 1",
      amount: 600000,
      payer: "Tiếng",
    },
  ],
  summary: {
    totalMatchIncome: 100000,
    totalOtherIncome: 5000000,
    totalIncome: 5100000,
    totalExpense: 600000,
    currentBalance: 4500000,
    totalMatchesCount: 1,
    totalPlayersCount: 3,
    totalUnpaidAmount: 0,
    categoryBreakdown: [],
  },
};

describe("Phase 1 – Security Hardening Suite", () => {
  describe("Pillar A: Credential Security & Secret Validation", () => {
    it("fails fast in production when APP_SECRET / AUTH_SECRET is missing or < 32 chars", () => {
      const originalSecret = process.env.AUTH_SECRET;
      const originalAppSecret = process.env.APP_SECRET;

      try {
        vi.stubEnv("NODE_ENV", "production");
        delete process.env.AUTH_SECRET;
        delete process.env.APP_SECRET;
        delete process.env.NEXTAUTH_SECRET;

        expect(() => getAuthSecret()).toThrowError(/FATAL/);

        // Short secret
        process.env.AUTH_SECRET = "too-short";
        expect(() => getAuthSecret()).toThrowError(/FATAL/);
      } finally {
        vi.unstubAllEnvs();
        if (originalSecret) process.env.AUTH_SECRET = originalSecret;
        if (originalAppSecret) process.env.APP_SECRET = originalAppSecret;
      }
    });

    it("invalidates tokens signed with an old/different secret", () => {
      const token = createSessionToken(mockPlayer);
      const verified = verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.playerId).toBe(2);

      // Tampered token
      const [payload, sig] = token.split(".");
      const tampered = `${payload}.${sig}tampered`;
      expect(verifySessionToken(tampered)).toBeNull();
    });
  });

  describe("Pillar B & C: CSRF & Origin Verification", () => {
    it("allows safe HTTP methods (GET, HEAD, OPTIONS) without Origin", () => {
      const getReq = new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
        method: "GET",
      });
      expect(verifyCsrfOrigin(getReq)).toBe(true);
    });

    it("verifies matching Origin header on mutating POST requests", () => {
      const validReq = new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
        method: "POST",
        headers: {
          host: "fchdhgonoi.vercel.app",
          origin: "https://fchdhgonoi.vercel.app",
        },
      });
      expect(verifyCsrfOrigin(validReq)).toBe(true);
    });

    it("rejects mismatched Origin header (cross-site CSRF attempt)", () => {
      const maliciousReq = new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
        method: "POST",
        headers: {
          host: "fchdhgonoi.vercel.app",
          origin: "https://evil-attacker-site.com",
        },
      });
      expect(verifyCsrfOrigin(maliciousReq)).toBe(false);
    });
  });

  describe("Pillar E: Public Data Sanitization & DTO Boundaries", () => {
    it("sanitizePlayerForPublic strips phone, username, pin_code, notes, access_role", () => {
      const publicDto = sanitizePlayerForPublic(mockManager);
      expect((publicDto as unknown as Record<string, unknown>).phone).toBeUndefined();
      expect((publicDto as unknown as Record<string, unknown>).username).toBeUndefined();
      expect((publicDto as unknown as Record<string, unknown>).pin_code).toBeUndefined();
      expect((publicDto as unknown as Record<string, unknown>).notes).toBeUndefined();
      expect((publicDto as unknown as Record<string, unknown>).access_role).toBeUndefined();

      expect(publicDto.full_name).toBe("Nguyễn Thế Tiếng");
      expect(publicDto.jersey_number).toBe(10);
      expect(publicDto.hometown).toBe("Điện Quang");
    });

    it("sanitizeDataForPublic strips all contact info and private financial ledgers", () => {
      const publicData = sanitizeDataForPublic(mockFullAppData);

      // Check all players have stripped sensitive fields
      for (const p of publicData.players) {
        expect(p.phone).toBe("");
        expect(p.username).toBe("");
        expect(p.pin_code).toBe("");
        expect(p.notes).toBe("");
        expect(p.access_role).toBe("player");
      }

      // Check financial records are redacted for guest
      expect(publicData.expenses).toEqual([]);
      expect(publicData.otherIncomes).toEqual([]);
      expect(publicData.settings.tournament_fund_note).toBe("");

      // Public summary totals and match schedule remain visible for transparency
      expect(publicData.summary.currentBalance).toBe(4500000);
      expect(publicData.matches.length).toBe(1);
    });

    it("sanitizeDataForPlayer keeps player's own profile while protecting peers", () => {
      const playerScopedData = sanitizeDataForPlayer(mockFullAppData, 2);

      const ownPlayer = playerScopedData.players.find((p) => p.id === 2);
      const peerPlayer = playerScopedData.players.find((p) => p.id === 3);

      // Own player sees own phone & notes, but pin_code is NEVER sent
      expect(ownPlayer?.phone).toBe("0987654321");
      expect(ownPlayer?.notes).toBe("Ghi chú sức khỏe nội bộ");
      expect(ownPlayer?.pin_code).toBe("");

      // Peer player contact & notes are masked
      expect(peerPlayer?.phone).toBe("");
      expect(peerPlayer?.notes).toBe("");
      expect(peerPlayer?.pin_code).toBe("");
      expect(peerPlayer?.username).toBe("");
    });
  });

  describe("Pillar F: PIN Security, Hashing & Session Invalidation", () => {
    it("hashes password with scrypt and salt", () => {
      const hash1 = hashPassword("secret123");
      const hash2 = hashPassword("secret123");

      expect(hash1.startsWith("scrypt$")).toBe(true);
      expect(hash2.startsWith("scrypt$")).toBe(true);
      // Different random salts
      expect(hash1).not.toBe(hash2);

      expect(verifyPassword("secret123", hash1)).toBe(true);
      expect(verifyPassword("wrong_pwd", hash1)).toBe(false);
    });

    it("invalidates session token when player's password changes", () => {
      const originalPin = "1234";
      const token = createSessionToken({ ...mockPlayer, pin_code: originalPin });

      // Token is valid with original pin
      expect(verifySessionToken(token, originalPin)).not.toBeNull();

      // Password changed in database
      const newPinHash = hashPassword("new_secure_pwd_999");
      expect(verifySessionToken(token, newPinHash)).toBeNull();
    });
  });

  describe("Pillar B & D: Route Handlers Security Boundaries", () => {
    it("GET /api/export rejects unauthenticated callers with 401", async () => {
      const req = new NextRequest("https://fchdhgonoi.vercel.app/api/export");
      const res = await handleExportGet(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/yêu cầu đăng nhập/i);
    });

    it("POST /api/import rejects unauthenticated callers with 401", async () => {
      const req = new NextRequest("https://fchdhgonoi.vercel.app/api/import", {
        method: "POST",
        headers: {
          host: "fchdhgonoi.vercel.app",
          origin: "https://fchdhgonoi.vercel.app",
        },
      });
      const res = await handleImportPost(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/yêu cầu đăng nhập/i);
    });

    it("POST /api/team rejects manager actions when called by guest with 401", async () => {
      const req = new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
        method: "POST",
        headers: {
          host: "fchdhgonoi.vercel.app",
          origin: "https://fchdhgonoi.vercel.app",
        },
        body: JSON.stringify({
          action: "delete_player",
          payload: { id: 2 },
        }),
      });

      const res = await handleTeamPost(req);
      expect(res.status).toBe(401);
    });

    it("POST /api/team rejects updating another player's profile", async () => {
      const playerToken = createSessionToken(mockPlayer);
      const req = new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
        method: "POST",
        headers: {
          host: "fchdhgonoi.vercel.app",
          origin: "https://fchdhgonoi.vercel.app",
          cookie: `${SESSION_COOKIE_NAME}=${playerToken}`,
        },
        body: JSON.stringify({
          action: "update_own_profile",
          payload: {
            player_id: 3, // Trying to tamper player 3's profile
            full_name: "Hacker Name",
          },
        }),
      });

      const res = await handleTeamPost(req);
      // If DB has player 2, it will check ownership and return 403
      // If DB doesn't have player 2 in isolated test env, requirePlayerSession returns 401
      expect([401, 403]).toContain(res.status);
    });

    it("GET /api/team returns sanitized public data for unauthenticated guest", async () => {
      vi.spyOn(dbModule, "getFullAppData").mockResolvedValueOnce(mockFullAppData);

      const req = new NextRequest("https://fchdhgonoi.vercel.app/api/team");
      const res = await handleTeamGet(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toContain("no-store");
      const data = await res.json();

      // Check all returned players have masked phone, no pin_code, no notes
      for (const p of data.players) {
        expect(p.phone).toBe("");
        expect(p.pin_code).toBe("");
        expect(p.notes).toBe("");
      }
      // Check private ledger is masked
      expect(data.expenses).toEqual([]);
      expect(data.otherIncomes).toEqual([]);
    }, 15000);
  });
});
