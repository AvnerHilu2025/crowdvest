"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");

/**
 * Read first sheet of an Excel file into array of row objects (first row = headers).
 * @param {string} filePath - absolute or relative path
 * @returns {{ sheetName: string, rows: Record<string, unknown>[] }}
 */
function readWorkbook(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Excel file not found: ${resolved}`);
  }
  const workbook = XLSX.readFile(resolved, { type: "file" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  return { sheetName, rows };
}

/**
 * Normalize a string to a trait slug key (shared by TraitDefinition key and archetype column matching).
 * - trim, lowercase
 * - replace spaces and punctuation with underscore
 * - collapse multiple underscores
 * - trim leading/trailing underscores
 * - remove any remaining non-alphanumeric except underscore
 * @param {unknown} value
 * @returns {string}
 */
function normalizeTraitKey(value) {
  if (value == null) return "";
  let s = String(value).trim().toLowerCase();
  s = s.replace(/[\s\W]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  s = s.replace(/[^a-z0-9_]/g, "");
  return s || "";
}

/** @deprecated Use normalizeTraitKey for trait/column matching. */
function normalizeKey(value) {
  return normalizeTraitKey(value);
}

/**
 * Parse value range text for min/max numbers (e.g. "0-1", "0 to 30", "0.0 - 1.0").
 * @param {unknown} valueRangeText
 * @returns {{ minValue: number | null, maxValue: number | null, valueRangeText: string | null }}
 */
function parseValueRange(valueRangeText) {
  if (valueRangeText == null || valueRangeText === "") {
    return { minValue: null, maxValue: null, valueRangeText: null };
  }
  const text = String(valueRangeText).trim();
  const match = text.match(/^(-?\d*\.?\d+)\s*[-–to]+\s*(-?\d*\.?\d+)$/i);
  if (match) {
    const minVal = parseFloat(match[1]);
    const maxVal = parseFloat(match[2]);
    if (Number.isFinite(minVal) && Number.isFinite(maxVal)) {
      return { minValue: minVal, maxValue: maxVal, valueRangeText: text };
    }
  }
  return { minValue: null, maxValue: null, valueRangeText: text };
}

/**
 * Compute sha256 hex of concatenated file contents (order matters).
 * @param {string[]} filePaths - paths to files
 * @returns {string} 64-char hex
 */
function hashFiles(filePaths) {
  const hash = crypto.createHash("sha256");
  for (const p of filePaths) {
    const resolved = path.isAbsolute(p) ? p : path.resolve(p);
    if (fs.existsSync(resolved)) {
      hash.update(fs.readFileSync(resolved));
    }
  }
  return hash.digest("hex");
}

module.exports = { readWorkbook, normalizeKey, normalizeTraitKey, parseValueRange, hashFiles };
