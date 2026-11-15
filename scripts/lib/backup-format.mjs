/**
 * Shared serialization, validation, and topological ordering helpers for
 * Backup/Restore v2 & v3 (SQLite and Turso libSQL).
 */

export const SUPPORTED_BACKUP_VERSIONS = new Set([2, 3]);

export function encodeValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return {
      __type: "blob",
      encoding: "base64",
      data: Buffer.from(value).toString("base64"),
    };
  }
  if (value instanceof ArrayBuffer) {
    return {
      __type: "blob",
      encoding: "base64",
      data: Buffer.from(new Uint8Array(value)).toString("base64"),
    };
  }
  if (typeof value === "bigint") {
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  }
  return value;
}

export function decodeValue(value) {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.__type === "blob" &&
    value.encoding === "base64" &&
    typeof value.data === "string"
  ) {
    return Buffer.from(value.data, "base64");
  }
  return value;
}

export function encodeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = encodeValue(v);
  }
  return out;
}

export function decodeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = decodeValue(v);
  }
  return out;
}

export function isValidIdentifier(name) {
  return typeof name === "string" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

export function validateBackupPayload(backup) {
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
    throw new Error("Invalid backup file: root must be a JSON object.");
  }

  const version = backup.version === undefined ? 2 : backup.version;
  if (!SUPPORTED_BACKUP_VERSIONS.has(version)) {
    throw new Error(
      `Unsupported backup format version "${String(version)}". Supported versions: 2, 3.`
    );
  }

  if (!backup.tables || typeof backup.tables !== "object" || Array.isArray(backup.tables)) {
    throw new Error("Invalid backup file: missing or invalid 'tables' object.");
  }

  for (const [tableName, rows] of Object.entries(backup.tables)) {
    if (!isValidIdentifier(tableName)) {
      throw new Error(`Invalid backup file: unsafe table name "${tableName}".`);
    }
    if (!Array.isArray(rows)) {
      throw new Error(`Invalid backup file: rows for table "${tableName}" must be an array.`);
    }
  }

  if (version === 3) {
    if (!backup.objects || typeof backup.objects !== "object" || Array.isArray(backup.objects)) {
      throw new Error("Invalid v3 backup file: missing 'objects' metadata.");
    }
    for (const kind of ["tables", "indexes", "triggers", "views"]) {
      if (!Array.isArray(backup.objects[kind])) {
        throw new Error(`Invalid v3 backup file: 'objects.${kind}' must be an array.`);
      }
      for (const obj of backup.objects[kind]) {
        if (
          !obj ||
          typeof obj !== "object" ||
          !isValidIdentifier(obj.name) ||
          typeof obj.sql !== "string" ||
          !obj.sql.trim()
        ) {
          throw new Error(`Invalid v3 backup file: malformed ${kind} DDL entry.`);
        }
      }
    }
    if (!backup.rowCounts || typeof backup.rowCounts !== "object" || Array.isArray(backup.rowCounts)) {
      throw new Error("Invalid v3 backup file: missing 'rowCounts' object.");
    }
    if (backup.sequences !== undefined) {
      if (!Array.isArray(backup.sequences)) {
        throw new Error("Invalid v3 backup file: 'sequences' must be an array.");
      }
      for (const s of backup.sequences) {
        if (
          !s ||
          typeof s !== "object" ||
          !isValidIdentifier(s.name) ||
          typeof s.seq !== "number" ||
          !Number.isInteger(s.seq) ||
          s.seq < 0
        ) {
          throw new Error("Invalid v3 backup file: malformed sqlite_sequence entry.");
        }
      }
    }
  }

  return { version };
}

/**
 * Sorts table names so referenced parent tables appear before child tables.
 * @param {string[]} tableNames
 * @param {Array<{ child: string, parent: string }>} fkEdges
 */
export function topoSortTables(tableNames, fkEdges) {
  const uniqueNames = Array.from(new Set(tableNames));
  const parentsOf = new Map(uniqueNames.map((t) => [t, new Set()]));

  for (const { child, parent } of fkEdges) {
    if (child && parent && child !== parent && parentsOf.has(child) && parentsOf.has(parent)) {
      parentsOf.get(child).add(parent);
    }
  }

  const ordered = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(name) {
    if (visited.has(name)) return;
    if (visiting.has(name)) return; // cycle guard
    visiting.add(name);
    for (const parent of parentsOf.get(name) || []) {
      visit(parent);
    }
    visiting.delete(name);
    visited.add(name);
    ordered.push(name);
  }

  for (const name of uniqueNames) {
    visit(name);
  }

  return ordered;
}
