/**
 * Preflight safety checks for Turso Cloud Staging backup & restore scripts.
 * Enforces an exact database allowlist (Source: fchdhgonoi-staging, Target: fchdhgonoi-staging-restore),
 * never logs or returns auth tokens, and strictly prevents falling back to Production or SQLite.
 */

export const ALLOWED_STAGING_DATABASES = Object.freeze({
  source: "fchdhgonoi-staging",
  target: "fchdhgonoi-staging-restore",
});

export function extractTursoDbName(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("Turso URL must be a non-empty string.");
  }
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid Turso database URL format.");
  }
  if (parsed.protocol !== "libsql:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported Turso URL protocol "${parsed.protocol}". Expected libsql:// or https://.`);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new Error("Turso URL is missing hostname.");
  }
  const dbName = hostname.split(".")[0] || "";
  return { dbName, safeHost: `${parsed.protocol}//${hostname}` };
}

function matchesExactAllowlistedDb(hostSlug, allowedBaseName) {
  if (hostSlug === allowedBaseName) return true;
  if (!hostSlug.startsWith(`${allowedBaseName}-`)) return false;
  // Ensure "fchdhgonoi-staging" does not accidentally match "fchdhgonoi-staging-restore*"
  if (
    allowedBaseName === ALLOWED_STAGING_DATABASES.source &&
    (hostSlug === ALLOWED_STAGING_DATABASES.target ||
      hostSlug.startsWith(`${ALLOWED_STAGING_DATABASES.target}-`))
  ) {
    return false;
  }
  return true;
}

export function validateStagingTarget({
  url,
  token,
  envUrlName,
  envTokenName,
  role = "source",
  disallowUrls = [],
}) {
  const allowedBaseName = ALLOWED_STAGING_DATABASES[role];
  if (!allowedBaseName) {
    throw new Error(`Preflight blocked: invalid staging role "${role}".`);
  }

  const cleanUrl = typeof url === "string" ? url.trim() : "";
  const cleanToken = typeof token === "string" ? token.trim() : "";

  if (!cleanUrl || !cleanToken) {
    throw new Error(
      `Preflight blocked: missing ${envUrlName} or ${envTokenName}. Refusing to fall back to Production (TURSO_DATABASE_URL) or local SQLite.`
    );
  }

  const { dbName, safeHost } = extractTursoDbName(cleanUrl);

  for (const disallowed of disallowUrls) {
    if (!disallowed || typeof disallowed !== "string") continue;
    try {
      const disallowedParsed = extractTursoDbName(disallowed);
      if (disallowedParsed.safeHost === safeHost || disallowed.trim() === cleanUrl) {
        throw new Error(
          `Preflight blocked: ${envUrlName} points to a disallowed or non-isolated database (${safeHost}).`
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Preflight blocked:")) {
        throw err;
      }
    }
  }

  if (dbName === "fchdhgonoi" || dbName.startsWith("fchdhgonoi-nguyenthetiengit01")) {
    throw new Error(
      `Preflight blocked: database "${dbName}" appears to be Production. Staging/restore target must be an allowlisted database.`
    );
  }

  if (!matchesExactAllowlistedDb(dbName, allowedBaseName)) {
    throw new Error(
      `Preflight blocked: database "${dbName}" is not in the exact allowlist for role "${role}" (expected "${allowedBaseName}").`
    );
  }

  return { dbName, safeHost, allowedBaseName, role };
}

export function isAllowedProductionDbName(dbName) {
  return dbName === "fchdhgonoi" || dbName.startsWith("fchdhgonoi-nguyenthetiengit01");
}

export function validateProductionTarget({
  url,
  token,
  envUrlName = "TURSO_DATABASE_URL",
  envTokenName = "TURSO_AUTH_TOKEN",
  disallowUrls = [],
}) {
  const cleanUrl = typeof url === "string" ? url.trim() : "";
  const cleanToken = typeof token === "string" ? token.trim() : "";

  if (!cleanUrl || !cleanToken) {
    throw new Error(
      `Preflight blocked: missing ${envUrlName} or ${envTokenName} for Production target.`
    );
  }

  const { dbName, safeHost } = extractTursoDbName(cleanUrl);

  for (const disallowed of disallowUrls) {
    if (!disallowed || typeof disallowed !== "string") continue;
    try {
      const disallowedParsed = extractTursoDbName(disallowed);
      if (disallowedParsed.safeHost === safeHost || disallowed.trim() === cleanUrl) {
        throw new Error(
          `Preflight blocked: ${envUrlName} overlaps with a disallowed Staging database (${safeHost}).`
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Preflight blocked:")) {
        throw err;
      }
    }
  }

  if (dbName.startsWith("fchdhgonoi-staging")) {
    throw new Error(
      `Preflight blocked: database "${dbName}" is a Staging database, not Production.`
    );
  }

  if (!isAllowedProductionDbName(dbName)) {
    throw new Error(
      `Preflight blocked: database "${dbName}" is not in the exact Production allowlist.`
    );
  }

  return { dbName, safeHost, role: "production" };
}
