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

/**
 * Lexical scanner that checks whether a SQL string contains more than one statement
 * outside string literals, quoted identifiers, and comments.
 */
export function hasMultipleSqlStatements(sql, kind = "") {
  let i = 0;
  const n = sql.length;
  let sawTrailingSemicolon = false;
  let blockDepth = 0;

  while (i < n) {
    const ch = sql[i];
    const next = i + 1 < n ? sql[i + 1] : "";

    // Whitespace
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    // Line comment -- ...
    if (ch === "-" && next === "-") {
      i += 2;
      while (i < n && sql[i] !== "\n") i += 1;
      continue;
    }

    // Block comment /* ... */
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) i += 1;
      if (i >= n) return true; // Unterminated comment treated as malformed
      i += 2;
      continue;
    }

    if (sawTrailingSemicolon) {
      return true;
    }

    // Single-quoted string literal '...'
    if (ch === "'") {
      i += 1;
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    // Double-quoted or backtick identifier
    if (ch === '"' || ch === "`") {
      const quote = ch;
      i += 1;
      while (i < n) {
        if (sql[i] === quote && sql[i + 1] === quote) {
          i += 2;
          continue;
        }
        if (sql[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    // Bracket-quoted identifier [...]
    if (ch === "[") {
      i += 1;
      while (i < n && sql[i] !== "]") i += 1;
      if (i < n) i += 1;
      continue;
    }

    // Track BEGIN / CASE ... END blocks inside CREATE TRIGGER
    if (kind === "triggers" && /[a-zA-Z_]/.test(ch)) {
      let endWord = i + 1;
      while (endWord < n && /[a-zA-Z0-9_]/.test(sql[endWord])) endWord += 1;
      const word = sql.slice(i, endWord).toUpperCase();
      if (word === "BEGIN" || word === "CASE") {
        blockDepth += 1;
      } else if (word === "END" && blockDepth > 0) {
        blockDepth -= 1;
      }
      i = endWord;
      continue;
    }

    if (ch === ";") {
      if (kind === "triggers" && blockDepth > 0) {
        i += 1;
        continue;
      }
      sawTrailingSemicolon = true;
      i += 1;
      continue;
    }

    i += 1;
  }

  return false;
}

export function extractDdlObjectName(sql, kind) {
  const cleaned = sql.replace(/^\s*(?:--[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*/g, "");
  let pattern;
  if (kind === "tables") {
    pattern = /^CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([a-zA-Z_][a-zA-Z0-9_]*))\s*\.\s*)?(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([a-zA-Z_][a-zA-Z0-9_]*))/i;
  } else if (kind === "indexes") {
    pattern = /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([a-zA-Z_][a-zA-Z0-9_]*))\s*\.\s*)?(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([a-zA-Z_][a-zA-Z0-9_]*))/i;
  } else if (kind === "triggers") {
    pattern = /^CREATE\s+(?:TEMP(?:ORARY)?\s+)?TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([a-zA-Z_][a-zA-Z0-9_]*))\s*\.\s*)?(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([a-zA-Z_][a-zA-Z0-9_]*))/i;
  } else if (kind === "views") {
    pattern = /^CREATE\s+(?:TEMP(?:ORARY)?\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([a-zA-Z_][a-zA-Z0-9_]*))\s*\.\s*)?(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([a-zA-Z_][a-zA-Z0-9_]*))/i;
  } else {
    return null;
  }
  const m = cleaned.match(pattern);
  if (!m) return null;
  // Last 4 capture groups correspond to the object name (schema-less or schema.object)
  return m[5] || m[6] || m[7] || m[8] || null;
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
    if (!backup.schema || typeof backup.schema !== "object" || Array.isArray(backup.schema)) {
      throw new Error("Invalid v3 backup file: missing or invalid 'schema' object.");
    }
    if (!backup.objects || typeof backup.objects !== "object" || Array.isArray(backup.objects)) {
      throw new Error("Invalid v3 backup file: missing 'objects' metadata.");
    }
    const ddlMatchers = {
      tables: /^\s*CREATE\s+TABLE\b/i,
      indexes: /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\b/i,
      triggers: /^\s*CREATE\s+TRIGGER\b/i,
      views: /^\s*CREATE\s+VIEW\b/i,
    };
    for (const kind of ["tables", "indexes", "triggers", "views"]) {
      if (!Array.isArray(backup.objects[kind])) {
        throw new Error(`Invalid v3 backup file: 'objects.${kind}' must be an array.`);
      }
      const seenNames = new Set();
      for (const obj of backup.objects[kind]) {
        if (
          !obj ||
          typeof obj !== "object" ||
          !isValidIdentifier(obj.name) ||
          typeof obj.sql !== "string" ||
          !obj.sql.trim() ||
          !ddlMatchers[kind].test(obj.sql) ||
          hasMultipleSqlStatements(obj.sql, kind)
        ) {
          throw new Error(`Invalid v3 backup file: malformed ${kind} DDL entry.`);
        }
        const parsedName = extractDdlObjectName(obj.sql, kind);
        if (!parsedName || parsedName !== obj.name) {
          throw new Error(
            `Invalid v3 backup file: ${kind} DDL name mismatch ("${obj.name}" vs "${String(parsedName)}").`
          );
        }
        if (seenNames.has(obj.name)) {
          throw new Error(`Invalid v3 backup file: duplicate ${kind} object "${obj.name}".`);
        }
        seenNames.add(obj.name);
      }
    }

    const declaredTables = new Set(backup.objects.tables.map((t) => t.name));
    for (const t of backup.objects.tables) {
      if (
        typeof backup.schema[t.name] !== "string" ||
        !ddlMatchers.tables.test(backup.schema[t.name]) ||
        backup.schema[t.name] !== t.sql
      ) {
        throw new Error(`Invalid v3 backup file: 'schema.${t.name}' missing or mismatched.`);
      }
    }
    for (const [schemaTbl, schemaSql] of Object.entries(backup.schema)) {
      if (!isValidIdentifier(schemaTbl) || typeof schemaSql !== "string" || !ddlMatchers.tables.test(schemaSql)) {
        throw new Error(`Invalid v3 backup file: malformed schema entry "${schemaTbl}".`);
      }
      if (!declaredTables.has(schemaTbl)) {
        throw new Error(`Invalid v3 backup file: schema table "${schemaTbl}" missing from objects.tables.`);
      }
    }

    for (const tableName of Object.keys(backup.tables)) {
      if (!declaredTables.has(tableName)) {
        throw new Error(`Invalid v3 backup file: table "${tableName}" missing from objects.tables DDL metadata.`);
      }
    }

    for (const declaredTable of declaredTables) {
      if (
        !Object.prototype.hasOwnProperty.call(backup.tables, declaredTable) ||
        !Array.isArray(backup.tables[declaredTable])
      ) {
        throw new Error(
          `Invalid v3 backup file: missing row data in 'tables' for declared table "${declaredTable}".`
        );
      }
    }

    if (!backup.rowCounts || typeof backup.rowCounts !== "object" || Array.isArray(backup.rowCounts)) {
      throw new Error("Invalid v3 backup file: missing 'rowCounts' object.");
    }
    for (const declaredTable of declaredTables) {
      if (!Object.prototype.hasOwnProperty.call(backup.rowCounts, declaredTable)) {
        throw new Error(
          `Invalid v3 backup file: missing rowCounts for declared table "${declaredTable}".`
        );
      }
    }
    for (const [tableName, count] of Object.entries(backup.rowCounts)) {
      if (!isValidIdentifier(tableName)) {
        throw new Error(`Invalid v3 backup file: unsafe rowCounts table name "${tableName}".`);
      }
      if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
        throw new Error(`Invalid v3 backup file: rowCounts["${tableName}"] must be a non-negative integer.`);
      }
      if (!declaredTables.has(tableName) || !Array.isArray(backup.tables[tableName])) {
        throw new Error(`Invalid v3 backup file: rowCounts["${tableName}"] has no matching table data.`);
      }
      if (backup.tables[tableName].length !== count) {
        throw new Error(
          `Invalid v3 backup file: rowCounts["${tableName}"] (${count}) does not match rows (${backup.tables[tableName].length}).`
        );
      }
    }
    for (const [tableName, rows] of Object.entries(backup.tables)) {
      if (backup.rowCounts[tableName] !== rows.length) {
        throw new Error(`Invalid v3 backup file: missing or mismatched rowCounts for "${tableName}".`);
      }
    }

    if (!Array.isArray(backup.sequences)) {
      throw new Error("Invalid v3 backup file: missing or invalid 'sequences' array.");
    }
    const seenSeqNames = new Set();
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
      if (seenSeqNames.has(s.name)) {
        throw new Error(`Invalid v3 backup file: duplicate sqlite_sequence entry "${s.name}".`);
      }
      if (!declaredTables.has(s.name)) {
        throw new Error(
          `Invalid v3 backup file: sqlite_sequence entry "${s.name}" has no matching declared table.`
        );
      }
      seenSeqNames.add(s.name);
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
