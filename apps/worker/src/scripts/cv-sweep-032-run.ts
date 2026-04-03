/**
 * CV-SWEEP-032: coarse param sweep (CV-VAL-029 path + overrides).
 * Usage:
 *   npx tsx src/scripts/cv-sweep-032-run.ts --runId <uuid> [--assetSymbol RUN] [--seed 0] [--steps 20] [--limit 2]
 */
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";

const WORKER_DIR = path.resolve(__dirname, "../..");
const DECIDE_TS = path.join(__dirname, "decide.ts");
const METRICS_TS = path.join(__dirname, "compute-crowd-metrics.ts");

const SYN_VALS = [0.3, 0.4] as const;
const INFO_VALS = [0.3, 0.4] as const;
const REG_VALS = [0.1, 0.2, 0.3] as const;
const TH_VALS = [0.01, 0.02, 0.03] as const;
const EVT_FIXED = 0.2;
const DS_FIXED = 0.7;
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

/** Compact token: 0.4 -> 0p4, 0.02 -> 0p02 */
function sweepNumToken(x: number): string {
  const r = Math.round(x * 10000) / 10000;
  let s = r.toFixed(4);
  s = s.replace(/(\.\d*?[1-9])0+$/, "$1");
  s = s.replace(/\.0+$/, "");
  return s.replace(".", "p");
}

function buildLabel(syn: number, info: number, evt: number, reg: number, th: number, ds: number, n: number): string {
  return (
    `cv_sweep032_syn${sweepNumToken(syn)}_info${sweepNumToken(info)}_evt${sweepNumToken(evt)}_reg${sweepNumToken(reg)}_th${sweepNumToken(th)}_ds${sweepNumToken(ds)}_n${n}`
  );
}

type Combo = { syn: number; info: number; reg: number; th: number };

function allCombinations(): Combo[] {
  const out: Combo[] = [];
  for (const syn of SYN_VALS) {
    for (const info of INFO_VALS) {
      for (const reg of REG_VALS) {
        for (const th of TH_VALS) {
          out.push({ syn, info, reg, th });
        }
      }
    }
  }
  return out;
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

function parseArgv(): {
  runId: string;
  assetSymbol: string;
  seed: number;
  steps: number;
  limit: number | undefined;
} {
  const args = process.argv.slice(2);
  let runId = "";
  let assetSymbol = "RUN";
  let seed = 0;
  let steps = 20;
  let limit: number | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--runId" && args[i + 1]) runId = args[++i]!.trim();
    else if (a === "--assetSymbol" && args[i + 1]) assetSymbol = args[++i]!.trim() || "RUN";
    else if (a === "--seed" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n)) seed = n;
    } else if (a === "--steps" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n) && n >= 1) steps = n;
    } else if (a === "--limit" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n) && n >= 1) limit = n;
    }
  }
  if (!runId) throw new Error("--runId is required");
  return { runId, assetSymbol, seed, steps, limit };
}

async function main(): Promise<void> {
  loadEnv();
  const { runId, assetSymbol, seed, steps, limit } = parseArgv();
  let combos = allCombinations();
  if (limit != null) combos = combos.slice(0, limit);
  console.log(
    `[CV-SWEEP-032] runId=${runId} assetSymbol=${assetSymbol} seed=${seed} steps=${steps} combos=${combos.length}×${AGENT_NS.length} agent runs`,
  );

  let comboIdx = 0;
  for (const c of combos) {
    comboIdx++;
    console.log(
      `\n######## COMBO ${comboIdx}/${combos.length}: syn=${c.syn} info=${c.info} evt=${EVT_FIXED} reg=${c.reg} th=${c.th} ds=${DS_FIXED} ########`,
    );
    for (const n of AGENT_NS) {
      const label = buildLabel(c.syn, c.info, EVT_FIXED, c.reg, c.th, DS_FIXED, n);
      console.log(`\n>>> ${label}`);
      runStep(
        "decide",
        "npx",
        [
          "tsx",
          DECIDE_TS,
          "--runId",
          runId,
          "--assetSymbol",
          assetSymbol,
          "--seed",
          String(seed),
          "--steps",
          String(steps),
          "--cvVal029",
          "--weightPreset",
          "baseline",
          "--overwrite",
          "--agents",
          String(n),
          "--label",
          label,
          "--overrideSyn",
          String(c.syn),
          "--overrideInfo",
          String(c.info),
          "--overrideEvt",
          String(EVT_FIXED),
          "--overrideReg",
          String(c.reg),
          "--overrideThreshold",
          String(c.th),
          "--overrideDecisionScale",
          String(DS_FIXED),
      ],
      );
      runStep(
        "compute-crowd-metrics",
        "npx",
        ["tsx", METRICS_TS, "--runId", runId, "--assetSymbol", assetSymbol, "--label", label, "--overwrite", "true"],
      );
    }
  }
  console.log("\n[CV-SWEEP-032] done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
