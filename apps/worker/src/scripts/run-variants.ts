/**
 * A/B variant runner: for each variant, merge config on RunVariant, run decide + crowd metrics,
 * compute validation accuracy + baselines, persist on RunVariant.
 *
 * CLI:
 *   pnpm -C apps/worker run run-variants -- --runId <uuid> --variants path/to/variants.json
 *   pnpm -C apps/worker run run-variants -- --runId <uuid> --variantsJson '[{"name":"A","seed":1}]'
 *
 * variants.json:
 * {
 *   "variants": [
 *     { "name": "control", "label": "ab-control", "seed": 1, "steps": 20, "agents": 200, "assetSymbol": "SPY", "config": { "alpha": 0.35 } }
 *   ]
 * }
 *
 * `label` defaults to `name`. Unique key is (runId, assetSymbol, seed, label).
 * `config` is merged over SimulationRun.configJson and stored on RunVariant.config (opaque; decide uses CLI flags).
 */
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import { PrismaClient, Prisma } from "@crowdvest/db";
import { assertRunExists } from "../lib/assert-run-exists";
import { computeVariantForecastAccuracy } from "../lib/variant-forecast-accuracy";

function loadEnv(): void {
  const cwd = process.cwd();
  for (const p of [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", "..", ".env"),
    path.resolve(__dirname, "..", "..", "..", "..", ".env"),
  ]) {
    try {
      if (!fs.existsSync(p)) continue;
      const content = fs.readFileSync(p, "utf8");
      for (const line of content.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq <= 0) continue;
        const key = t.slice(0, eq).trim();
        const val = t.slice(eq + 1).trim();
        if (key && !(key in process.env)) process.env[key] = val;
      }
    } catch {
      // ignore
    }
  }
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is not set.");
}

async function sumVariantPnl(prisma: PrismaClient, runVariantId: string): Promise<number | null> {
  const agg = await prisma.agentReward.aggregate({
    where: { runVariantId },
    _sum: { pnl: true },
  });
  const s = agg._sum.pnl;
  return s != null && Number.isFinite(s) ? s : null;
}

type VariantInput = {
  name?: string;
  label?: string;
  seed?: number;
  steps?: number;
  agents?: number;
  assetSymbol?: string;
  config?: Record<string, unknown>;
};

function parseArgv(): {
  runId: string;
  variantsPath: string | undefined;
  variantsJson: string | undefined;
  overwrite: boolean;
  persistMode: "lite" | "full";
} {
  const args = process.argv.slice(2);
  let runId = "";
  let variantsPath: string | undefined;
  let variantsJson: string | undefined;
  let overwrite = true;
  let persistMode: "lite" | "full" = "lite";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runId" && args[i + 1]) runId = String(args[++i]).trim();
    else if (args[i] === "--variants" && args[i + 1]) variantsPath = String(args[++i]).trim();
    else if (args[i] === "--variantsJson" && args[i + 1]) variantsJson = String(args[++i]).trim();
    else if (args[i] === "--overwrite") {
      if (args[i + 1] === "false" || args[i + 1] === "0") {
        overwrite = false;
        i++;
      } else overwrite = true;
    } else if (args[i] === "--persist" && args[i + 1]) {
      const v = String(args[++i]).toLowerCase();
      if (v !== "lite" && v !== "full") throw new Error("--persist must be lite or full");
      persistMode = v as "lite" | "full";
    }
  }
  if (!runId) throw new Error("--runId is required");
  if (!variantsPath && !variantsJson) throw new Error("--variants <file.json> or --variantsJson <string> is required");
  return { runId, variantsPath, variantsJson, overwrite, persistMode };
}

function loadVariants(pathOrJson: { variantsPath?: string; variantsJson?: string }): VariantInput[] {
  let raw: unknown;
  if (pathOrJson.variantsJson) {
    raw = JSON.parse(pathOrJson.variantsJson) as unknown;
  } else {
    const p = pathOrJson.variantsPath!;
    const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    if (!fs.existsSync(abs)) throw new Error(`variants file not found: ${abs}`);
    raw = JSON.parse(fs.readFileSync(abs, "utf8")) as unknown;
  }
  const obj = raw as { variants?: unknown };
  if (!obj || !Array.isArray(obj.variants)) {
    throw new Error('variants file must be an object with "variants": [ ... ]');
  }
  return obj.variants as VariantInput[];
}

function runWorker(script: "decide" | "compute-crowd-metrics", extra: string[], repoRoot: string): boolean {
  const r = spawnSync("pnpm", ["--filter", "worker", "run", script, "--", ...extra], {
    stdio: "inherit",
    cwd: repoRoot,
  });
  return r.status === 0;
}

function deepMergeConfig(
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (
      v != null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      typeof out[k] === "object" &&
      out[k] != null &&
      !Array.isArray(out[k])
    ) {
      out[k] = deepMergeConfig(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function main(): Promise<void> {
  loadEnv();
  const argv = parseArgv();
  const workerRoot = path.resolve(__dirname, "..", "..");
  const repoRoot = path.resolve(workerRoot, "..", "..");

  const prisma = new PrismaClient();
  await assertRunExists(prisma, argv.runId);

  const runRow = await prisma.simulationRun.findUnique({
    where: { id: argv.runId },
    select: { configJson: true },
  });
  if (!runRow) throw new Error("Run not found");
  const baseCfg =
    runRow.configJson != null &&
    typeof runRow.configJson === "object" &&
    !Array.isArray(runRow.configJson)
      ? { ...(runRow.configJson as Record<string, unknown>) }
      : {};

  const variants = loadVariants({
    variantsPath: argv.variantsPath,
    variantsJson: argv.variantsJson,
  });

  console.log(`run-variants runId=${argv.runId} count=${variants.length}`);

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]!;
    const variantName = (v.name ?? `variant-${i}`).trim() || `variant-${i}`;
    const variantLabel = (v.label ?? variantName).trim() || `variant-${i}`;
    const seed = typeof v.seed === "number" && Number.isFinite(v.seed) ? Math.floor(v.seed) : 1;
    const steps = typeof v.steps === "number" && v.steps >= 1 ? Math.floor(v.steps) : 20;
    const agents = typeof v.agents === "number" && v.agents >= 1 ? Math.min(Math.floor(v.agents), 10_000) : 200;
    const assetSymbol = (v.assetSymbol ?? "SPY").trim().toUpperCase() || "SPY";
    const variantCfg =
      v.config != null && typeof v.config === "object" && !Array.isArray(v.config)
        ? (v.config as Record<string, unknown>)
        : {};
    const mergedConfig = deepMergeConfig(baseCfg, variantCfg);

    const variantRecord = await prisma.runVariant.upsert({
      where: {
        runId_assetSymbol_seed_label: {
          runId: argv.runId,
          assetSymbol,
          seed,
          label: variantLabel,
        },
      },
      update: {
        agents,
        steps,
        name: variantName,
        config: mergedConfig as Prisma.InputJsonValue,
        accuracy: null,
        baselineBuy: null,
        baselineSell: null,
        pnl: null,
        startedAt: new Date(),
        completedAt: null,
        durationMs: null,
      },
      create: {
        runId: argv.runId,
        assetSymbol,
        seed,
        label: variantLabel,
        agents,
        steps,
        name: variantName,
        config: mergedConfig as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    const variantId = variantRecord.id;
    const t0 = Date.now();
    console.log(`--- variant ${i + 1}/${variants.length} id=${variantId} name=${variantName} label=${variantLabel} ---`);

    if (
      !runWorker(
        "decide",
        [
          "--runVariantId",
          variantId,
          "--steps",
          String(steps),
          "--agents",
          String(agents),
          "--overwrite",
          argv.overwrite ? "true" : "false",
          "--allowSmallCrowd",
          "--persist",
          argv.persistMode,
        ],
        repoRoot,
      )
    ) {
      throw new Error(`decide failed for variant ${variantName} (${variantId})`);
    }

    if (
      !runWorker(
        "compute-crowd-metrics",
        ["--runVariantId", variantId, "--overwrite", argv.overwrite ? "true" : "false"],
        repoRoot,
      )
    ) {
      throw new Error(`compute-crowd-metrics failed for variant ${variantName} (${variantId})`);
    }

    const { accuracy, baselineBuy, baselineSell } = await computeVariantForecastAccuracy(
      prisma,
      argv.runId,
      variantId,
      assetSymbol,
    );
    const pnl = await sumVariantPnl(prisma, variantId);

    await prisma.runVariant.update({
      where: { id: variantId },
      data: {
        accuracy,
        baselineBuy,
        baselineSell,
        pnl,
        completedAt: new Date(),
        durationMs: Date.now() - t0,
      },
    });

    console.log(
      `stored accuracy=${accuracy.toFixed(4)} baselineBuy=${baselineBuy.toFixed(4)} baselineSell=${baselineSell.toFixed(4)} pnl=${pnl != null ? pnl.toFixed(4) : "null"}`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("run-variants failed:", e);
  process.exit(1);
});
