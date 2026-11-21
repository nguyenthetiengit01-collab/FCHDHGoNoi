const FORMULA_TRIGGER_REGEX = /^[\t\r=+\-@]/;

/**
 * Neutralize potential Excel formula injection in user-controlled text cells
 * by prefixing a single quote when the string begins with =, +, -, @, \t, or \r.
 */
export function sanitizeExcelTextCell(val: unknown): string {
  if (val === null || val === undefined) {
    return "";
  }
  const str = typeof val === "string" ? val : String(val);
  if (FORMULA_TRIGGER_REGEX.test(str)) {
    return `'${str}`;
  }
  return str;
}
