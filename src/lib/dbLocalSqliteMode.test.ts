import path from "node:path";
import os from "node:os";
import { describe, it, expect, afterEach } from "vitest";
import {
  resolveDatabaseMode,
  resolveLocalSqliteQaPath,
  resolveTursoConfig,
} from "./db";

const REPO_ROOT = path.resolve(process.cwd());
const OUTSIDE_QA_DB = path.resolve(
  os.tmpdir(),
  "FCHDHGoNoi-QA-Test",
  "gonoifc.qa.sqlite"
);

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

describe("Phase 3.6.3A.1 – Safe Local SQLite QA Mode", () => {
  it("TEST 1: selects Local SQLite QA adapter in development when USE_LOCAL_SQLITE=true and SQLITE_DB_PATH is valid outside repo", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      USE_LOCAL_SQLITE: "true",
      SQLITE_DB_PATH: OUTSIDE_QA_DB,
    };

    expect(resolveLocalSqliteQaPath(env, REPO_ROOT)).toBe(OUTSIDE_QA_DB);
    expect(resolveTursoConfig(env)).toBeNull();
    expect(resolveDatabaseMode(env, REPO_ROOT)).toEqual({
      adapter: "local-sqlite-qa",
      dbPath: OUTSIDE_QA_DB,
    });
  });

  it("TEST 2: Local QA Mode takes precedence over TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (.env.local simulation)", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      USE_LOCAL_SQLITE: "true",
      SQLITE_DB_PATH: OUTSIDE_QA_DB,
      TURSO_DATABASE_URL: "libsql://example-dummy-db.turso.io",
      TURSO_AUTH_TOKEN: "dummy-token-not-real",
    };

    expect(resolveTursoConfig(env)).toBeNull();
    expect(resolveDatabaseMode(env, REPO_ROOT)).toEqual({
      adapter: "local-sqlite-qa",
      dbPath: OUTSIDE_QA_DB,
    });
  });

  it("TEST 3: rejects USE_LOCAL_SQLITE=true in production", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      USE_LOCAL_SQLITE: "true",
      SQLITE_DB_PATH: OUTSIDE_QA_DB,
    };

    expect(() => resolveLocalSqliteQaPath(env, REPO_ROOT)).toThrow(
      /forbidden in production/i
    );
    expect(() => resolveTursoConfig(env)).toThrow(/forbidden in production/i);
    expect(() => resolveDatabaseMode(env, REPO_ROOT)).toThrow(
      /forbidden in production/i
    );
  });

  it("TEST 4: rejects USE_LOCAL_SQLITE=true on Vercel", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      VERCEL: "1",
      USE_LOCAL_SQLITE: "true",
      SQLITE_DB_PATH: OUTSIDE_QA_DB,
    };

    expect(() => resolveLocalSqliteQaPath(env, REPO_ROOT)).toThrow(
      /forbidden on Vercel/i
    );
    expect(() => resolveDatabaseMode(env, REPO_ROOT)).toThrow(
      /forbidden on Vercel/i
    );
  });

  it("TEST 5: rejects USE_LOCAL_SQLITE=true when SQLITE_DB_PATH is missing without falling back", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      USE_LOCAL_SQLITE: "true",
      TURSO_DATABASE_URL: "libsql://example-dummy-db.turso.io",
      TURSO_AUTH_TOKEN: "dummy-token-not-real",
    };

    expect(() => resolveLocalSqliteQaPath(env, REPO_ROOT)).toThrow(
      /SQLITE_DB_PATH is required/i
    );
    expect(() => resolveTursoConfig(env)).toThrow(/SQLITE_DB_PATH is required/i);
    expect(() => resolveDatabaseMode(env, REPO_ROOT)).toThrow(
      /SQLITE_DB_PATH is required/i
    );
  });

  it("TEST 6: rejects relative SQLITE_DB_PATH", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      USE_LOCAL_SQLITE: "true",
      SQLITE_DB_PATH: "qa-db/gonoifc.qa.sqlite",
    };

    expect(() => resolveLocalSqliteQaPath(env, REPO_ROOT)).toThrow(
      /must be an absolute path/i
    );
    expect(() => resolveDatabaseMode(env, REPO_ROOT)).toThrow(
      /must be an absolute path/i
    );
  });

  it("TEST 7: rejects SQLITE_DB_PATH pointing to default data/gonoifc.sqlite", () => {
    const defaultDb = path.resolve(REPO_ROOT, "data", "gonoifc.sqlite");
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      USE_LOCAL_SQLITE: "true",
      SQLITE_DB_PATH: defaultDb,
    };

    expect(() => resolveLocalSqliteQaPath(env, REPO_ROOT)).toThrow(
      /must not point to the default local database/i
    );
    expect(() => resolveDatabaseMode(env, REPO_ROOT)).toThrow(
      /must not point to the default local database/i
    );
  });

  it("TEST 8: rejects SQLITE_DB_PATH located inside the repository directory", () => {
    const insideRepoPath = path.resolve(REPO_ROOT, "data", "gonoifc.qa.sqlite");
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      USE_LOCAL_SQLITE: "true",
      SQLITE_DB_PATH: insideRepoPath,
    };

    expect(() => resolveLocalSqliteQaPath(env, REPO_ROOT)).toThrow(
      /must be outside the repository directory/i
    );
    expect(() => resolveDatabaseMode(env, REPO_ROOT)).toThrow(
      /must be outside the repository directory/i
    );
  });

  it("TEST 9: preserves Turso selection when QA Mode is not enabled and Turso credentials are configured", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      TURSO_DATABASE_URL: "libsql://example-dummy-db.turso.io",
      TURSO_AUTH_TOKEN: "dummy-token-not-real",
    };

    expect(resolveLocalSqliteQaPath(env, REPO_ROOT)).toBeNull();
    expect(resolveTursoConfig(env)).toEqual({
      url: "libsql://example-dummy-db.turso.io",
      authToken: "dummy-token-not-real",
    });
    expect(resolveDatabaseMode(env, REPO_ROOT)).toEqual({
      adapter: "turso",
      url: "libsql://example-dummy-db.turso.io",
      authToken: "dummy-token-not-real",
    });
  });

  it("TEST 10: preserves default Local SQLite behavior and path when QA Mode is not enabled and no Turso credentials exist", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
    };

    expect(resolveLocalSqliteQaPath(env, REPO_ROOT)).toBeNull();
    expect(resolveTursoConfig(env)).toBeNull();
    expect(resolveDatabaseMode(env, REPO_ROOT)).toEqual({
      adapter: "local-sqlite-default",
      dbPath: path.join(REPO_ROOT, "data", "gonoifc.sqlite"),
    });
  });
});

