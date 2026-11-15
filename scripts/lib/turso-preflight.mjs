/**
 * Preflight safety checks for Turso Cloud Staging backup & restore scripts.
 * Never logs or returns auth tokens, and strictly prevents falling back to Production.
 */

const SAFE_STAGING_NAME_PATTERN = /(staging|restore|drill|dev|test)/i;

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

export function validateStagingTarget({
  url,
  token,
  envUrlName,
  envTokenName,
  disallowUrls = [],
}) {
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
      `Preflight blocked: database "${dbName}" appears to be Production. Staging/restore target must be a separate database.`
    );
  }

  if (!SAFE_STAGING_NAME_PATTERN.test(dbName)) {
    throw new Error(
      `Preflight blocked: database name "${dbName}" must explicitly include one of [staging, restore, drill, dev, test].`
    );
  }

  return { dbName, safeHost };
}
