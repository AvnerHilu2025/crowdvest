/**
 * Idempotent seed: import TraitDefinition and Archetype + ArchetypeTraitProfile from Excel,
 * then seed Agents and one SimulationRun. Creates one ImportRun per import type.
 */
const path = require("path");
const fs = require("fs");
const { config } = require("dotenv");
const { PrismaClient } = require("../generated/prisma");
const { readWorkbook, normalizeTraitKey, parseValueRange, hashFiles } = require("./import/excelHelpers");

config({ path: path.resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();

const SEED_DATA_DIR = process.env.SEED_DATA_DIR ?? path.join(__dirname, "seed-data");
const FILE_ATTRIBUTES = "Full_Investor_Attribute_Table__English_.xlsx";
const FILE_ARCHETYPES = "Extended_Archetype_Table_with_24_Investor_Types.xlsx";
const SEED_RUN_NAME = "Seed Run";
const SEED_SOURCE_FILENAME = "seed.ts";

const counts = {
  traitDefinition: { created: 0, updated: 0 },
  archetype: { created: 0, updated: 0 },
  archetypeTraitProfile: { created: 0, updated: 0 },
  agent: { created: 0 },
  simulationRun: { created: 0, updated: 0 },
};

/** Manual overrides: archetype column normalized key -> canonical TraitDefinition.key */
const TRAIT_ALIAS_MANUAL = {
  // Add entries if archetype Excel uses different column names than traits Excel.
  // Example: "some_archetype_column_name": "canonical_trait_key",
};

/** Categorical cell value -> numeric (0..1 or scale). Used when cell is not already numeric. */
const TRAIT_CATEGORICAL_MAP = {
  low: 0.25, medium: 0.5, mid: 0.5, high: 0.75,
  yes: 1, no: 0, y: 1, n: 0, true: 1, false: 0,
  strong: 0.8, weak: 0.2,
  strong_agree: 0.9, strongly_agree: 0.9, agree: 0.7, neutral: 0.5, disagree: 0.3, strong_disagree: 0.1, strongly_disagree: 0.1,
  very_low: 0.1, very_high: 0.9,
};

const TRAIT_DESCRIPTION_IMPORTED_FROM_ARCHETYPE = "Imported from archetype file; missing from trait table.";
const TRAIT_VALUE_RANGE_DEFAULT = "0..1 (default)";

const SEED_DEBUG = process.env.SEED_DEBUG === "1";

let datasetVersion = "";
let archetypeReport = {
  totalTraitColumns: 0,
  matchedCount: 0,
  unmatchedCount: 0,
  unmatchedSamples: [],
  traitDefinitionsAutoCreatedFromArchetype: 0,
  finalUnmatchedColumns: [],
  parsedRangeValues: 0,
  skippedValues: 0,
};

function pickColumn(row, ...names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const lower = name.toLowerCase();
    const found = keys.find((k) => k.trim().toLowerCase() === lower);
    if (found) return row[found];
    const withSpaces = keys.find((k) => k.trim().toLowerCase().replace(/\s+/g, " ") === lower);
    if (withSpaces) return row[withSpaces];
  }
  return keys.length > 0 ? row[keys[0]] : undefined;
}

function ensureExcelFiles() {
  const attributesPath = path.join(SEED_DATA_DIR, FILE_ATTRIBUTES);
  const archetypesPath = path.join(SEED_DATA_DIR, FILE_ARCHETYPES);
  if (!fs.existsSync(attributesPath)) {
    throw new Error(
      `Excel file not found: ${attributesPath}. Place ${FILE_ATTRIBUTES} in packages/db/prisma/seed-data/ or set SEED_DATA_DIR.`
    );
  }
  if (!fs.existsSync(archetypesPath)) {
    throw new Error(
      `Excel file not found: ${archetypesPath}. Place ${FILE_ARCHETYPES} in packages/db/prisma/seed-data/ or set SEED_DATA_DIR.`
    );
  }
  return { attributesPath, archetypesPath };
}

async function ensureImportRunTable() {
  try {
    await prisma.importRun.findFirst({ take: 1 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2021") {
      console.error(
        "ImportRun table does not exist. Apply the migration first:\n  pnpm --filter @crowdvest/db prisma:migrate -- --name package-a-plus"
      );
      process.exit(1);
    }
    throw e;
  }
}

async function importTraits(filePath, importRunId) {
  const { rows } = readWorkbook(filePath);
  for (const row of rows) {
    const feature = pickColumn(row, "Feature", "Attribute", "Trait", "Name");
    const key = normalizeTraitKey(feature);
    if (!key) continue;

    const description = pickColumn(row, "Description", "Desc");
    const valueRangeRaw = pickColumn(row, "Value Range", "ValueRange", "Range", "Value Range");
    const { minValue, maxValue, valueRangeText } = parseValueRange(valueRangeRaw);
    const displayName = feature != null ? String(feature).trim() : key;

    const existing = await prisma.traitDefinition.findUnique({ where: { key } });
    await prisma.traitDefinition.upsert({
      where: { key },
      create: {
        key,
        displayName,
        description: description != null ? String(description) : null,
        valueRangeText: valueRangeText ?? null,
        minValue,
        maxValue,
      },
      update: {
        displayName,
        description: description != null ? String(description) : null,
        valueRangeText: valueRangeText ?? null,
        minValue,
        maxValue,
      },
    });
    if (existing) counts.traitDefinition.updated++; else counts.traitDefinition.created++;
  }

  await prisma.importRun.update({
    where: { id: importRunId },
    data: {
      status: "success",
      finishedAt: new Date(),
      summaryJson: { traitDefinition: counts.traitDefinition },
      errorJson: null,
    },
  });
}

function buildTraitAliasMap(traits) {
  const aliasToCanonical = new Map();
  for (const t of traits) {
    aliasToCanonical.set(t.key, t.key);
    const fromDisplay = normalizeTraitKey(t.displayName);
    if (fromDisplay && fromDisplay !== t.key) aliasToCanonical.set(fromDisplay, t.key);
  }
  for (const [alias, canonical] of Object.entries(TRAIT_ALIAS_MANUAL)) {
    const n = normalizeTraitKey(alias);
    if (n) aliasToCanonical.set(n, canonical);
  }
  return aliasToCanonical;
}

function resolveTraitKey(normalizedColKey, aliasMap, traitByKey) {
  const canonical = aliasMap.get(normalizedColKey);
  if (canonical && traitByKey.has(canonical)) return canonical;
  if (traitByKey.has(normalizedColKey)) return normalizedColKey;
  return null;
}

function classifyValue(v) {
  if (v == null || v === "") return "empty";
  if (typeof v === "number") return "number";
  return "string";
}

/** When SEED_DEBUG=1, print sample raw values for final unmatched columns. */
function printDebugUnmatchedColumns(rows, finalUnmatchedColumns) {
  if (!SEED_DEBUG || !finalUnmatchedColumns.length) return;
  console.log("\n--- SEED_DEBUG: sample raw values for final unmatched columns ---");
  const MAX_ROW_SAMPLES = 5;
  const MAX_UNIQUE_VALUES = 20;
  for (const { original: colName, normalized } of finalUnmatchedColumns) {
    console.log("\nColumn:", JSON.stringify(colName), "| normalized key:", JSON.stringify(normalized));
    let rowIndex = 0;
    for (const row of rows) {
      if (rowIndex >= MAX_ROW_SAMPLES) break;
      const rowId = pickColumn(row, "Archetype", "Name", "Type");
      const raw = row[colName];
      const classification = classifyValue(raw);
      if (rowId != null && String(rowId).trim() !== "") {
        rowIndex++;
        console.log("  row", rowIndex, "archetype:", JSON.stringify(rowId), "| raw:", JSON.stringify(raw), "|", classification);
      }
    }
    const uniqueNonEmpty = new Set();
    for (const row of rows) {
      const v = row[colName];
      if (v != null && v !== "") uniqueNonEmpty.add(String(v).trim());
      if (uniqueNonEmpty.size >= MAX_UNIQUE_VALUES) break;
    }
    const arr = [...uniqueNonEmpty].slice(0, MAX_UNIQUE_VALUES);
    console.log("  unique non-empty values (cap " + MAX_UNIQUE_VALUES + "):", arr.length ? arr.map((x) => JSON.stringify(x)).join(", ") : "(none)");
  }
  console.log("\n--- end SEED_DEBUG ---\n");
}

/**
 * Parse range string to (a, b). Accepts: "(70, 100)", "[70,100]", "70, 100", "70-100", "70–100", "70 to 100".
 * Returns { a, b } or null.
 */
function parseRangeString(s) {
  if (s == null || typeof s !== "string") return null;
  const t = s.trim();
  const commaOrDash = t.match(/(-?\d*\.?\d+)\s*[,–\-]\s*(-?\d*\.?\d+)/);
  if (commaOrDash) {
    const a = parseFloat(commaOrDash[1]);
    const b = parseFloat(commaOrDash[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) return { a, b };
  }
  const toMatch = t.match(/(-?\d*\.?\d+)\s+to\s+(-?\d*\.?\d+)/i);
  if (toMatch) {
    const a = parseFloat(toMatch[1]);
    const b = parseFloat(toMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) return { a, b };
  }
  return null;
}

/** Normalize a raw baseline to 0..1: if max <= 1.5 treat as 0..1, else treat as 0..100 (divide by 100). Clamp to [0,1]. */
function normalizeBaselineTo01(raw) {
  if (raw == null || !Number.isFinite(raw)) return null;
  const in01 = Math.abs(raw) <= 1.5 ? raw : raw / 100;
  return Math.max(0, Math.min(1, in01));
}

/**
 * Parse cell to baseline value in [0,1]: range midpoint, numeric (with 0..1 vs 0..100), %, or categorical.
 * Returns number in [0,1] or null. Caller should only write when result is finite and in [0,1].
 */
function parseBaselineValue(cellValue, categoricalMap) {
  const result = parseBaselineValueWithReason(cellValue, categoricalMap);
  return result.parsedNumber;
}

/** Same as parseBaselineValue but returns { cleaned, parsedNumber, reason } for debug. parsedNumber is in [0,1] or null. */
function parseBaselineValueWithReason(cellValue, categoricalMap) {
  if (cellValue == null || cellValue === "") {
    return { cleaned: "", parsedNumber: null, reason: "blank" };
  }
  const rawStr = String(cellValue).trim();
  const s = rawStr.toLowerCase();

  if (typeof cellValue === "number" && Number.isFinite(cellValue)) {
    const norm = normalizeBaselineTo01(cellValue);
    return { cleaned: String(cellValue), parsedNumber: norm, reason: "numeric" };
  }

  if (!s) return { cleaned: "", parsedNumber: null, reason: "blank" };

  const range = parseRangeString(rawStr);
  if (range) {
    const baselineRaw = (range.a + range.b) / 2;
    const maxVal = Math.max(range.a, range.b);
    const norm = maxVal <= 1.5 ? baselineRaw : baselineRaw / 100;
    const parsed = Math.max(0, Math.min(1, norm));
    return { cleaned: rawStr, parsedNumber: parsed, reason: "range-midpoint" };
  }

  let num = null;
  if (s.endsWith("%")) {
    num = parseFloat(s.slice(0, -1));
    if (Number.isFinite(num)) {
      const parsed = Math.max(0, Math.min(1, num / 100));
      return { cleaned: rawStr, parsedNumber: parsed, reason: "numeric" };
    }
  }
  num = parseFloat(s);
  if (Number.isFinite(num)) {
    const parsed = normalizeBaselineTo01(num);
    return { cleaned: rawStr, parsedNumber: parsed, reason: "numeric" };
  }

  const key = normalizeTraitKey(s);
  if (categoricalMap[key] !== undefined) {
    const v = categoricalMap[key];
    const parsed = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null;
    return { cleaned: rawStr, parsedNumber: parsed, reason: "categorical" };
  }
  if (categoricalMap[s] !== undefined) {
    const v = categoricalMap[s];
    const parsed = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null;
    return { cleaned: rawStr, parsedNumber: parsed, reason: "categorical" };
  }
  return { cleaned: rawStr, parsedNumber: null, reason: "categorical-not-mapped" };
}

/** When SEED_DEBUG=1: print per-trait-column raw values, classification, and parse results; plus one row sample. */
function printDebugTraitParsing(rows, traitColumnHeaders, categoricalMap) {
  if (!SEED_DEBUG || !traitColumnHeaders.length) return;
  const MAX_UNIQUE = 10;
  console.log("\n--- SEED_DEBUG: trait column parsing ---");
  for (const colName of traitColumnHeaders) {
    const normKey = normalizeTraitKey(colName);
    console.log("\nColumn:", JSON.stringify(colName), "| normalized key:", JSON.stringify(normKey));
    const seen = new Map();
    for (const row of rows) {
      const raw = row[colName];
      const key = raw == null ? "__null__" : (raw === "" ? "__empty__" : String(raw));
      if (!seen.has(key)) seen.set(key, raw);
      if (seen.size >= MAX_UNIQUE) break;
    }
    const uniqueRaw = [...seen.values()].filter((v) => v != null && v !== "");
    if (uniqueRaw.length === 0) {
      console.log("  (all blank)");
      console.log("  parse result: raw -> cleaned -> null, reason: blank");
      continue;
    }
    const displayUnique = uniqueRaw.slice(0, MAX_UNIQUE);
    console.log("  up to", MAX_UNIQUE, "unique non-empty raw values:", displayUnique.map((v) => JSON.stringify(v)).join(", "));
    for (const raw of displayUnique) {
      const cls = classifyValue(raw);
      const { cleaned, parsedNumber, reason } = parseBaselineValueWithReason(raw, categoricalMap);
      console.log("    raw:", JSON.stringify(raw), "| class:", cls, "| cleaned:", JSON.stringify(cleaned), "| parsed:", parsedNumber, "| reason:", reason);
    }
  }
  const sampleRow = rows.find((r) => {
    const id = pickColumn(r, "Archetype", "Name", "Type");
    return id != null && String(id).trim() !== "";
  });
  if (sampleRow) {
    console.log("\n--- One archetype row sample ---");
    const archetypeName = pickColumn(sampleRow, "Archetype", "Name", "Type");
    console.log("Archetype name:", JSON.stringify(archetypeName));
    for (const colName of traitColumnHeaders) {
      const raw = sampleRow[colName];
      if (raw == null || raw === "") continue;
      const { parsedNumber, reason } = parseBaselineValueWithReason(raw, categoricalMap);
      console.log("  ", JSON.stringify(colName), "| raw:", JSON.stringify(raw), "| parsed:", parsedNumber, "|", reason);
    }
  }
  console.log("\n--- end SEED_DEBUG trait parsing ---\n");
}

/** Ensure a TraitDefinition exists for this archetype column; create from archetype file if missing (idempotent). */
async function ensureTraitDefinitionForColumn(originalColHeader, normKey) {
  const existing = await prisma.traitDefinition.findUnique({ where: { key: normKey } });
  const trait = await prisma.traitDefinition.upsert({
    where: { key: normKey },
    create: {
      key: normKey,
      displayName: originalColHeader.trim() || normKey,
      description: TRAIT_DESCRIPTION_IMPORTED_FROM_ARCHETYPE,
      valueRangeText: TRAIT_VALUE_RANGE_DEFAULT,
      minValue: null,
      maxValue: null,
    },
    update: {},
  });
  if (!existing) archetypeReport.traitDefinitionsAutoCreatedFromArchetype++;
  return trait;
}

async function importArchetypes(filePath, importRunId) {
  let traits = await prisma.traitDefinition.findMany();
  let traitByKey = new Map(traits.map((t) => [t.key, t]));
  const aliasMap = buildTraitAliasMap(traits);
  const { rows } = readWorkbook(filePath);

  // Full names from Excel (authoritative for this dataset)
  const currentNames = new Set();
  for (const row of rows) {
    const nameCell = pickColumn(row, "Archetype", "Name", "Type");
    const name = nameCell != null ? String(nameCell).trim() : "";
    if (name) currentNames.add(name);
  }
  // Cleanup: remove archetypes not in current dataset so we avoid duplicates across versions
  const toRemove = await prisma.archetype.findMany({
    where: { name: { notIn: [...currentNames] } },
    select: { id: true },
  });
  if (toRemove.length > 0) {
    await prisma.archetype.deleteMany({ where: { id: { in: toRemove.map((a) => a.id) } } });
  }

  const SKIP_KEYS = new Set(["archetype", "name", "type", "id", "description", "desc"]);
  const allColumnHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];
  const traitColumnHeaders = allColumnHeaders.filter((h) => {
    const k = normalizeTraitKey(h);
    return k && !SKIP_KEYS.has(k);
  });
  const matchedKeys = new Set();
  const unmatchedSamples = [];
  for (const colHeader of traitColumnHeaders) {
    const norm = normalizeTraitKey(colHeader);
    const resolved = resolveTraitKey(norm, aliasMap, traitByKey);
    if (resolved) matchedKeys.add(norm);
    else unmatchedSamples.push({ original: colHeader, normalized: norm });
  }
  archetypeReport.totalTraitColumns = traitColumnHeaders.length;
  archetypeReport.matchedCount = matchedKeys.size;
  archetypeReport.unmatchedCount = unmatchedSamples.length;
  archetypeReport.unmatchedSamples = unmatchedSamples.slice(0, 20);

  printDebugTraitParsing(rows, traitColumnHeaders, TRAIT_CATEGORICAL_MAP);

  for (const { original: colHeader, normalized: normKey } of unmatchedSamples) {
    await ensureTraitDefinitionForColumn(colHeader, normKey);
  }
  traits = await prisma.traitDefinition.findMany();
  traitByKey = new Map(traits.map((t) => [t.key, t]));

  const columnsWithAtLeastOneValue = new Set();
  for (const row of rows) {
    const nameCell = pickColumn(row, "Archetype", "Name", "Type");
    const name = nameCell != null ? String(nameCell).trim() : "";
    if (!name) continue;

    const existingArchetype = await prisma.archetype.findUnique({ where: { name } });
    const archetype = await prisma.archetype.upsert({
      where: { name },
      create: { name, description: null },
      update: {},
    });
    if (existingArchetype) counts.archetype.updated++; else counts.archetype.created++;

    for (const [colHeader, cellValue] of Object.entries(row)) {
      const normKey = normalizeTraitKey(colHeader);
      if (!normKey || SKIP_KEYS.has(normKey)) continue;

      const resolvedKey = resolveTraitKey(normKey, aliasMap, traitByKey) ?? normKey;
      const trait = traitByKey.get(resolvedKey) ?? null;
      if (!trait) continue;

      const { parsedNumber: num, reason } = parseBaselineValueWithReason(cellValue, TRAIT_CATEGORICAL_MAP);
      if (reason === "range-midpoint") archetypeReport.parsedRangeValues++;
      if (num === null || !Number.isFinite(num) || num < 0 || num > 1) {
        archetypeReport.skippedValues++;
        continue;
      }

      columnsWithAtLeastOneValue.add(normKey);
      const had = await prisma.archetypeTraitProfile.findUnique({
        where: {
          archetypeId_traitDefinitionId: { archetypeId: archetype.id, traitDefinitionId: trait.id },
        },
      });
      await prisma.archetypeTraitProfile.upsert({
        where: {
          archetypeId_traitDefinitionId: { archetypeId: archetype.id, traitDefinitionId: trait.id },
        },
        create: { archetypeId: archetype.id, traitDefinitionId: trait.id, baselineValue: num },
        update: { baselineValue: num },
      });
      if (had) counts.archetypeTraitProfile.updated++; else counts.archetypeTraitProfile.created++;
    }
  }

  archetypeReport.finalUnmatchedColumns = unmatchedSamples
    .filter(({ normalized }) => !columnsWithAtLeastOneValue.has(normalized))
    .map(({ original, normalized }) => ({ original, normalized }));

  printDebugUnmatchedColumns(rows, archetypeReport.finalUnmatchedColumns);

  await prisma.importRun.update({
    where: { id: importRunId },
    data: {
      status: "success",
      finishedAt: new Date(),
      summaryJson: {
        archetype: counts.archetype,
        archetypeTraitProfile: counts.archetypeTraitProfile,
        archetypeReport,
      },
      errorJson: null,
    },
  });
}

async function seedAgents() {
  const archetypes = await prisma.archetype.findMany({ take: 10 });
  if (archetypes.length < 2) return;
  const [conservative, moderate] = [archetypes.find((a) => /conservative/i.test(a.name)), archetypes.find((a) => /moderate/i.test(a.name))];
  const c = conservative ?? archetypes[0];
  const m = moderate ?? archetypes[1];
  const agents = [
    { displayName: "Agent Conservative 1", archetypeId: c.id },
    { displayName: "Agent Conservative 2", archetypeId: c.id },
    { displayName: "Agent Moderate 1", archetypeId: m.id },
  ];
  for (const a of agents) {
    const existing = await prisma.agent.findFirst({
      where: { displayName: a.displayName, archetypeId: a.archetypeId },
    });
    if (!existing) {
      await prisma.agent.create({ data: { displayName: a.displayName, archetypeId: a.archetypeId } });
      counts.agent.created++;
    }
  }
}

async function seedSimulationRun() {
  const existing = await prisma.simulationRun.findUnique({
    where: { name_datasetVersion: { name: SEED_RUN_NAME, datasetVersion } },
  });
  await prisma.simulationRun.upsert({
    where: { name_datasetVersion: { name: SEED_RUN_NAME, datasetVersion } },
    create: {
      name: SEED_RUN_NAME,
      seed: 42,
      modelVersion: "stage1",
      datasetVersion,
      schemaVersion: "v1",
      codeGitSha: null,
    },
    update: { modelVersion: "stage1", schemaVersion: "v1" },
  });
  if (existing) counts.simulationRun.updated++; else counts.simulationRun.created++;
}

function printReport(importRunIds, status) {
  console.log("\n--- Seed report ---");
  console.log("TraitDefinition:       created", counts.traitDefinition.created, "updated", counts.traitDefinition.updated);
  console.log("Archetype:             created", counts.archetype.created, "updated", counts.archetype.updated);
  console.log("ArchetypeTraitProfile: created", counts.archetypeTraitProfile.created, "updated", counts.archetypeTraitProfile.updated);
  console.log("Agent:                 created", counts.agent.created);
  console.log("SimulationRun:         created", counts.simulationRun.created, "updated", counts.simulationRun.updated);
  console.log("datasetVersion:        ", datasetVersion);
  console.log("ImportRun ids:         ", importRunIds.join(", "));
  console.log("Status:                ", status);
  console.log("\n--- Archetype trait column mapping ---");
  console.log("Total trait columns (archetype file):     ", archetypeReport.totalTraitColumns);
  console.log("Matched to existing TraitDefinition:     ", archetypeReport.matchedCount);
  console.log("TraitDefinitions auto-created from cols:  ", archetypeReport.traitDefinitionsAutoCreatedFromArchetype);
  console.log("ArchetypeTraitProfile created/updated:    ", counts.archetypeTraitProfile.created, "/", counts.archetypeTraitProfile.updated);
  console.log("Parsed range values:                      ", archetypeReport.parsedRangeValues);
  console.log("Skipped values:                           ", archetypeReport.skippedValues);
  console.log("Final unmatched (no usable values):       ", archetypeReport.finalUnmatchedColumns.length);
  if (archetypeReport.finalUnmatchedColumns.length > 0) {
    console.log("Final unmatched columns (original -> normalized):");
    for (const { original, normalized } of archetypeReport.finalUnmatchedColumns) {
      console.log("  ", JSON.stringify(original), "->", JSON.stringify(normalized));
    }
  }
  console.log("--------------------------------------\n");
}

async function main() {
  await ensureImportRunTable();

  const { attributesPath, archetypesPath } = ensureExcelFiles();
  datasetVersion = hashFiles([attributesPath, archetypesPath]);

  const importRunIds = [];

  const traitsStartedAt = new Date();
  const traitsImportRun = await prisma.importRun.create({
    data: {
      type: "traits",
      sourceFilename: FILE_ATTRIBUTES,
      sourceHash: hashFiles([attributesPath]),
      status: "pending",
      startedAt: traitsStartedAt,
    },
  });
  importRunIds.push(traitsImportRun.id);
  try {
    await importTraits(attributesPath, traitsImportRun.id);
  } catch (err) {
    await prisma.importRun.update({
      where: { id: traitsImportRun.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorJson: err instanceof Error ? { message: err.message, stack: err.stack } : { message: String(err) },
      },
    });
    printReport(importRunIds, "failed (traits)");
    throw err;
  }

  const archetypesStartedAt = new Date();
  const archetypesImportRun = await prisma.importRun.create({
    data: {
      type: "archetypes",
      sourceFilename: FILE_ARCHETYPES,
      sourceHash: hashFiles([archetypesPath]),
      status: "pending",
      startedAt: archetypesStartedAt,
    },
  });
  importRunIds.push(archetypesImportRun.id);
  try {
    await importArchetypes(archetypesPath, archetypesImportRun.id);
  } catch (err) {
    await prisma.importRun.update({
      where: { id: archetypesImportRun.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorJson: err instanceof Error ? { message: err.message, stack: err.stack } : { message: String(err) },
      },
    });
    printReport(importRunIds, "failed (archetypes)");
    throw err;
  }

  await seedAgents();
  await seedSimulationRun();
  await seedPriceSeriesPoint();
  printReport(importRunIds, "success");
}

/** Default points to seed per symbol. Configurable via PRICE_SERIES_POINTS (default 130). Supports multi-window benchmarks (60/120). */
const DEFAULT_PRICE_SERIES_POINTS = 130;

/** Deterministic seeded RNG. Returns 0..1. */
function createSeededRng(seed) {
  let s = seed | 0;
  return function () {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s = (s + 0x6d2b79f5) | 0;
    return (s >>> 0) / 4294967296;
  };
}

/** Simple hash for IWM seed derivation. Deterministic. */
function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h = h | 0;
  }
  return (h >>> 0) & 0x7fffffff;
}

/** Generate IWM closes: higher volatility, regime-like (trend/mean-revert blocks). Independent of SPY/QQQ. */
function generateIwmCloses(points, seed) {
  const rng = createSeededRng(seed);
  const closes = [];
  let close = 100;
  const volatility = 0.004;
  const blockSize = 15;
  for (let i = 0; i < points; i++) {
    const block = Math.floor(i / blockSize) % 2;
    let delta;
    if (block === 0) {
      delta = volatility * (0.2 + rng());
    } else {
      const pull = (100 - close) / close * 0.08;
      delta = pull + volatility * (rng() - 0.5);
    }
    close = Math.max(0.01, close * (1 + delta));
    closes.push(close);
  }
  return closes;
}

/** Seed PriceSeriesPoint deterministically. Idempotent: EXACT_N rows per symbol. No external data. */
async function seedPriceSeriesPoint() {
  const points = Math.min(
    Math.max(29, parseInt(process.env.PRICE_SERIES_POINTS ?? String(DEFAULT_PRICE_SERIES_POINTS), 10) || DEFAULT_PRICE_SERIES_POINTS),
    365,
  );
  const padWidth = 4;
  const datesWanted = [];
  for (let i = 1; i <= points; i++) {
    datesWanted.push(String(i).padStart(padWidth, "0"));
  }

  const datasetVersion = "priceseed";
  const symbols = ["SPY", "QQQ", "IWM"];
  const spyRng = createSeededRng(42);
  const qqqRng = createSeededRng(43);
  const iwmSeed = simpleHash(datasetVersion + "IWM" + points);
  const iwmCloses = generateIwmCloses(points, iwmSeed);

  const spyCloses = [];
  let close = 100;
  for (let i = 0; i < points; i++) {
    const delta = 0.002 * (spyRng() - 0.5);
    close = Math.max(0.01, close * (1 + delta));
    spyCloses.push(close);
  }

  for (const symbol of symbols) {
    const beforeCount = await prisma.priceSeriesPoint.count({ where: { symbol } });
    const { count: deletedExtra } = await prisma.priceSeriesPoint.deleteMany({
      where: { symbol, date: { notIn: datesWanted } },
    });

    for (let i = 0; i < points; i++) {
      const date = datesWanted[i];
      let closeVal;
      if (symbol === "SPY") {
        closeVal = spyCloses[i];
      } else if (symbol === "QQQ") {
        closeVal = Math.max(0.01, spyCloses[i] * (1.02 + 0.015 * (qqqRng() - 0.5)));
      } else {
        closeVal = iwmCloses[i];
      }

      await prisma.priceSeriesPoint.upsert({
        where: { symbol_date: { symbol, date } },
        create: { symbol, date, close: closeVal },
        update: { close: closeVal },
      });
    }

    const afterCount = await prisma.priceSeriesPoint.count({ where: { symbol } });
    console.log(
      "PriceSeriesPoint:",
      symbol,
      "beforeCount=" + beforeCount,
      "afterCount=" + afterCount,
      "pointsWanted=" + points,
      "deletedExtra=" + deletedExtra,
    );
  }
}

main()
  .then(() => {
    console.log("Seed completed.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
