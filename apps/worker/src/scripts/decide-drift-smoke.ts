/**
 * Smoke test for measurable learning/drift across decide runs when overwrite=false.
 *
 * Run: pnpm -C apps/worker exec tsx src/scripts/decide-drift-smoke.ts -- --runId <uuid> [--seed 123]
 *
 * Expects:
 * - Run decide overwrite=true (seed 123) -> capture step0 histogram + avgConf
 * - Run decide overwrite=false (same seed) -> capture step0 histogram + avgConf
 * - At least one of BUY/SELL/HOLD counts differs OR avgConfidence differs by > 0.001
 *
 * Prerequisites: run must exist with agents. Generate first: POST /agents/generate?runId=...&overwrite=true
 */
import { spawnSync } from "child_process";
import path from "path";

function loadEnv(): void {
  const root = path.resolve(__dirname, "..", "..", "..");
  try {
    const fs = require("fs");
    const envPath = path.join(root, ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (key && !(key in process.env)) process.env[key] = value;
      }
    }
  } catch {
    // ignore
  }
}

function parseStep0Line(stdout: string): { BUY: number; SELL: number; HOLD: number; avgConf: number } | null {
  const step0Re = /Step\s+0:.*BUY=(\d+)\s+SELL=(\d+)\s+HOLD=(\d+).*avgConf=([\d.]+)/;
  const m = stdout.match(step0Re);
  if (!m) return null;
  return {
    BUY: parseInt(m[1]!, 10),
    SELL: parseInt(m[2]!, 10),
    HOLD: parseInt(m[3]!, 10),
    avgConf: parseFloat(m[4]!),
  };
}

function main(): number {
  loadEnv();
  const args = process.argv.slice(2);
  let runId = "";
  let seed = 123;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runId" && args[i + 1]) runId = args[++i]!.trim();
    else if (args[i] === "--seed" && args[i + 1]) seed = parseInt(args[++i]!, 10);
  }
  if (!runId) {
    console.error("Usage: tsx decide-drift-smoke.ts -- --runId <uuid> [--seed 123]");
    return 1;
  }

  const workerDir = path.resolve(__dirname, "..", "..");
  const script = path.join(workerDir, "src", "scripts", "decide.ts");
  const tsx = path.join(workerDir, "node_modules", ".bin", "tsx");

  const runDecide = (overwrite: boolean): string => {
    const argv = [script, "--runId", runId, "--seed", String(seed), "--steps", "5", "--allowSmallCrowd"];
    if (overwrite) argv.push("--overwrite");
    const result = spawnSync(tsx, argv, { cwd: workerDir, encoding: "utf8", timeout: 60000 });
    return (result.stdout || "") + (result.stderr || "");
  };

  console.log("Running decide overwrite=true (seed=%d)...", seed);
  const out1 = runDecide(true);
  const step0a = parseStep0Line(out1);
  if (!step0a) {
    console.error("Could not parse step0 from overwrite=true output");
    return 1;
  }
  console.log("  Step 0 overwrite=true: BUY=%d SELL=%d HOLD=%d avgConf=%.3f", step0a.BUY, step0a.SELL, step0a.HOLD, step0a.avgConf);

  console.log("Running decide overwrite=false (same seed)...");
  const out2 = runDecide(false);
  const step0b = parseStep0Line(out2);
  if (!step0b) {
    console.error("Could not parse step0 from overwrite=false output");
    return 1;
  }
  console.log("  Step 0 overwrite=false: BUY=%d SELL=%d HOLD=%d avgConf=%.3f", step0b.BUY, step0b.SELL, step0b.HOLD, step0b.avgConf);

  const countsDiffer = step0a.BUY !== step0b.BUY || step0a.SELL !== step0b.SELL || step0a.HOLD !== step0b.HOLD;
  const confDiffers = Math.abs(step0a.avgConf - step0b.avgConf) > 0.001;

  if (countsDiffer || confDiffers) {
    console.log("PASS: Drift detected (counts differ=%s, avgConf diff>0.001=%s)", countsDiffer, confDiffers);
    return 0;
  }
  console.error("FAIL: No measurable drift. Expected at least one of BUY/SELL/HOLD or avgConf to differ.");
  return 1;
}

process.exit(main());
