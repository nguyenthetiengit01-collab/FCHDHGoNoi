import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { AuthSession, FullAppData } from "@/types/app";

const ROOT = process.cwd();
const require = createRequire(import.meta.url);

function loadTsxModule<T = Record<string, unknown>>(relPath: string): T {
  const fullPath = path.join(ROOT, relPath);
  const source = fs.readFileSync(fullPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });

  const mod: { exports: unknown } = { exports: {} };
  const localRequire = (specifier: string) => {
    if (specifier.startsWith("@/")) {
      const resolved = path.join(ROOT, "src", specifier.slice(2));
      if (fs.existsSync(resolved + ".tsx")) {
        return loadTsxModule(path.relative(ROOT, resolved + ".tsx"));
      }
      if (fs.existsSync(resolved + ".ts")) {
        return loadTsxModule(path.relative(ROOT, resolved + ".ts"));
      }
      if (fs.existsSync(path.join(resolved, "index.ts"))) {
        return loadTsxModule(path.relative(ROOT, path.join(resolved, "index.ts")));
      }
      return require(resolved);
    }
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const dir = path.dirname(fullPath);
      const resolved = path.resolve(dir, specifier);
      if (fs.existsSync(resolved + ".tsx")) {
        return loadTsxModule(path.relative(ROOT, resolved + ".tsx"));
      }
      if (fs.existsSync(resolved + ".ts")) {
        return loadTsxModule(path.relative(ROOT, resolved + ".ts"));
      }
      if (fs.existsSync(path.join(resolved, "index.ts"))) {
        return loadTsxModule(path.relative(ROOT, path.join(resolved, "index.ts")));
      }
      return require(resolved);
    }
    return require(specifier);
  };

  const fn = new Function("exports", "require", "module", outputText);
  fn(mod.exports, localRequire, mod);
  return mod.exports as T;
}

const SAMPLE_DATA: FullAppData = {
  settings: {
    id: 1,
    team_name: "FC HĐH Gò Nổi",
    short_name: "Gò Nổi FC",
    default_match_fee: 100000,
    bank_bin: "970415",
    bank_name: "VietinBank",
    bank_account_no: "0000000000",
    bank_account_name: "FC HDH GO NOI",
    tournament_fund_reserve: 500000,
    tournament_fund_note: "Quỹ giải",
  },
  players: [
    {
      id: 1,
      code_order: 1,
      full_name: "Nguyễn Văn A",
      short_name: "Văn A",
      jersey_number: 10,
      position: "Tiền đạo",
      phone: "0905000001",
      birth_year: "1995",
      avatar_url: "",
      role: "Đội trưởng",
      access_role: "manager",
      pin_code: "",
      status: "Đang hoạt động",
      notes: "",
      hometown: "Điện Trung",
    },
    {
      id: 2,
      code_order: 2,
      full_name: "Trần Văn B",
      short_name: "Văn B",
      jersey_number: 7,
      position: "Tiền vệ",
      phone: "0905000002",
      birth_year: "1996",
      avatar_url: "",
      role: "Thành viên",
      access_role: "player",
      pin_code: "",
      status: "Đang hoạt động",
      notes: "",
      hometown: "Điện Phong",
    },
  ],
  matches: [
    {
      id: 11,
      match_number: 1,
      match_date: "2026-11-10",
      kickoff_time: "19:30",
      label: "Tuần 1",
      venue: "Sân Vĩnh Lộc",
      opponent: "FC Bạn",
      team_score: 3,
      opponent_score: 2,
      status: "Đã kết thúc",
      fee_per_player: 100000,
      pitch_cost: 900000,
      payer_name: "Văn A",
      notes: "",
    },
  ],
  attendances: [
    {
      id: 1,
      match_id: 11,
      player_id: 1,
      attended: 1,
      paid: 1,
      amount: 100000,
      rsvp_status: "registered",
      walk_in: 0,
      collected_by: "Văn A",
      note: "",
    },
    {
      id: 2,
      match_id: 11,
      player_id: 2,
      attended: 1,
      paid: 0,
      amount: 100000,
      rsvp_status: "registered",
      walk_in: 0,
      collected_by: "",
      note: "",
    },
  ],
  expenses: [
    {
      id: 101,
      expense_date: "2026-11-10",
      category: "Tiền sân",
      description: "Tiền sân tuần 1",
      amount: 900000,
      payer: "Văn A",
      match_id: 11,
    },
  ],
  otherIncomes: [
    {
      id: 201,
      income_date: "2026-11-09",
      contributor: "Anh Sơn",
      fund_type: "Ủng hộ quỹ",
      amount: 500000,
      note: "Ủng hộ nước uống",
    },
  ],
  summary: {
    totalMatchIncome: 100000,
    totalOtherIncome: 500000,
    totalIncome: 600000,
    totalExpense: 900000,
    currentBalance: -300000,
    totalUnpaidAmount: 100000,
    totalMatchesCount: 1,
    totalPlayersCount: 2,
    categoryBreakdown: [{ category: "Tiền sân", amount: 900000, percentage: 100 }],
  },
  sponsors: [],
  posts: [],
};

const MANAGER_SESSION: AuthSession = {
  role: "manager",
  playerId: 1,
  fullName: "Nguyễn Văn A",
  shortName: "Văn A",
  jerseyNumber: 10,
  position: "Tiền đạo",
  teamRole: "Đội trưởng",
};

describe("Phase 3.4 – Responsive Data Tables & Mobile UX", () => {
  const { FinanceTab } = loadTsxModule<{
    FinanceTab: React.ComponentType<Record<string, unknown>>;
  }>("src/components/FinanceTab.tsx");

  const { MatrixTab } = loadTsxModule<{
    MatrixTab: React.ComponentType<Record<string, unknown>>;
  }>("src/components/MatrixTab.tsx");

  it("FinanceTab renders both mobile card list and desktop table while preserving totals and actions", () => {
    const html = renderToStaticMarkup(
      React.createElement(FinanceTab, {
        data: SAMPLE_DATA,
        onMutate: vi.fn(),
        isSaving: false,
      })
    );

    expect(html).toContain('aria-label="Sổ chi tiêu quỹ đội bóng (di động)"');
    expect(html).toContain('aria-label="Sổ chi tiêu quỹ đội bóng"');
    expect(html).toContain("md:hidden space-y-2.5");
    expect(html).toContain("hidden md:block ds-table-wrap");
    expect(html).toContain("Tiền sân tuần 1");
    expect(html).toContain('aria-label="Sửa khoản chi Tiền sân tuần 1"');
    expect(html).toContain('aria-label="Xoá khoản chi Tiền sân tuần 1"');
    expect(html).toContain("min-h-11 min-w-11 sm:min-h-9 sm:min-w-9");
    expect(html).toContain("focus-visible:outline-focus-on-light");
  });

  it("MatrixTab renders sticky corner/col cells, keyboard-focusable scroll region, and accurate player/match data", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatrixTab, {
        data: SAMPLE_DATA,
        session: MANAGER_SESSION,
      })
    );

    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Ma trận điểm danh và đóng quỹ theo cầu thủ và trận đấu"');
    expect(html).toContain("sticky-corner");
    expect(html).toContain("sticky-col");
    expect(html).toContain("Nguyễn Văn A");
    expect(html).toContain("Trần Văn B");
    expect(html).toContain("Tuần 1");
    expect(html).toContain("Nợ");
    expect(html).toContain("Bạn");
  });

  it("globals.css defines sticky column rules, mobile sticky width bounds, and touch scrolling", () => {
    const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
    expect(css).toContain(".matrix-table .sticky-corner");
    expect(css).toContain(".matrix-table .sticky-col");
    expect(css).toContain("position: sticky;");
    expect(css).toContain("left: 0;");
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("-webkit-overflow-scrolling: touch;");
  });
});
