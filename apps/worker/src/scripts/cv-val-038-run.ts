/**
 * CV-VAL-038: diverse agents (--cvVal038 + --transformMode none → cv_val038_diverse_agents_* labels).
 * Usage:
 *   npx tsx src/scripts/cv-val-038-run.ts --runId <uuid> [--assetSymbol SPY] [--seed 0] [--steps 20]
 */
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";

const WORKER_DIR = path.resolve(__dirname, "../..");
const DECIDE = path.join(__dirname, "decide.ts");
const METRICS = path.join(__dirname, "compute-crowd-metrics.ts");

const SYN = 0.4;
const INFO = 0.4;
const EVT = 0.2;
const REG = 0.2;
const TH = 0.02;
const DS = 0.7;
const AGENT_NS = [100, 2000, 10_000] as const;

function loadEnv(): void {
  const repoRoot = path.resolve(__dirname, "../../../../.env");
  try {
    if (!fs.existsSync(repoRoot)) return;
    const content = fs.readFileSync(repoRoot, "utf8");
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

function runStep(title: string, cmd: string, args: string[]): void {
  console.log(`\n--- ${title} ---`);
  console.log(`${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: WORKER_DIR, stdio: "inherit", shell: false });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`${title} exited with status ${r.status}`);
  }
}

function parseArgv(): { runId: string; assetSymbol: string; seed: number; steps: number } {
  const args = process.argv.slice(2);
  let runId = "";
  let assetSymbol = "SPY";
  let seed = 0;
  let steps = 20;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--runId" && args[i + 1]) runId = args[++i]!.trim();
    else if (a === "--assetSymbol" && args[i + 1]) assetSymbol = args[++i]!.trim() || "SPY";
    else if (a === "--seed" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n)) seed = n;
    } else if (a === "--steps" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n) && n >= 1) steps = n;
    }
  }
  if (!runId) throw new Error("--runId is required");
  return { runId, assetSymbol, seed, steps };
}

async function main(): Promise<void> {
  loadEnv();
  const { runId, assetSymbol, seed, steps } = parseArgv();
  console.log(
    `[CV-VAL-038] runId=${runId} assetSymbol=${assetSymbol} seed=${seed} steps=${steps} agentNs=${AGENT_NS.join(",")} (transformMode=none + --cvVal038)`,
  );

  for (const n of AGENT_NS) {
    runStep(
      "decide",
      "npx",
      [
        "tsx",
        DECIDE,
        "--runId",
        runId,
        "--assetSymbol",
        assetSymbol,
        "--seed",
        String(seed),
        "--steps",
        String(steps),
        "--cvVal029",
        "--cvVal038",
        "--transformMode",
        "none",
        "--weightPreset",
        "baseline",
        "--overwrite",
        "--agents",
        String(n),
        "--overrideSyn",
        String(SYN),
        "--overrideInfo",
        String(INFO),
        "--overrideEvt",
        String(EVT),
        "--overrideReg",
        String(REG),
        "--overrideThreshold",
        String(TH),
        "--overrideDecisionScale",
        String(DS),
      ],
    );
    const labelTail = `syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n${n}`;
    const label = `cv_val038_diverse_agents_${labelTail}`;
    runStep(
      "compute-crowd-metrics",
      "npx",
      ["tsx", METRICS, "--runId", runId, "--assetSymbol", assetSymbol, "--label", label, "--overwrite", "true"],
    );
  }
  console.log("\n[CV-VAL-038] done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
