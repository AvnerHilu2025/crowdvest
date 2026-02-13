#!/usr/bin/env node
/**
 * CrowdWisdom sanity check:
 * - Independence: avg |corr| between sampled agent action series is low
 * - Diversity: action entropy per agent is not collapsed
 * - Crowd advantage: crowd directional accuracy >= median agent accuracy (sampled)
 *
 * API:
 * - GET /results/crowd-wisdom-dump?runId=&assetSymbol= -> { runId, assetSymbol, steps, agents, decisions, returns }
 * Requires RUN_ID env var.
 */

const API = process.env.API ?? "http://localhost:4001";
const ASSET = process.env.ASSET ?? "SPY";
const SAMPLE_AGENTS = Number(process.env.SAMPLE_AGENTS ?? 60);
const SAMPLE_PAIRS = Number(process.env.SAMPLE_PAIRS ?? 200);

async function httpJson(path) {
  const url = `${API}${path}`;
  const res = await fetch(url, { headers: { "accept": "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}\n${text}`);
  }
  return res.json();
}

function actionToNum(a) {
  if (a === "BUY") return 1;
  if (a === "SELL") return -1;
  return 0; // HOLD or other
}

function sign(x) {
  if (x > 0) return 1;
  if (x < 0) return -1;
  return 0;
}

function pearson(x, y) {
  const n = x.length;
  if (n !== y.length || n < 3) return 0;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const ax = x[i] - mx;
    const ay = y[i] - my;
    num += ax * ay;
    dx += ax * ax;
    dy += ay * ay;
  }
  const den = Math.sqrt(dx) * Math.sqrt(dy);
  if (!isFinite(den) || den === 0) return 0;
  return num / den;
}

function entropy3(countBuy, countSell, countHold) {
  const n = countBuy + countSell + countHold;
  if (n === 0) return 0;
  const p = [countBuy, countSell, countHold].map(c => c / n).filter(p => p > 0);
  // natural log entropy (0..ln3)
  return -p.reduce((s, pi) => s + pi * Math.log(pi), 0);
}

function pickRandom(arr, k) {
  const copy = [...arr];
  // Fisher-Yates partial shuffle
  for (let i = 0; i < Math.min(k, copy.length); i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(k, copy.length));
}

function median(arr) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

async function main() {
  const runId = process.env.RUN_ID?.trim();
  if (!runId) {
    throw new Error("RUN_ID env var is required. Example: RUN_ID=uuid-here node scripts/crowd-wisdom-check.mjs");
  }

  // crowd-wisdom-dump (decisions + returns)
  const dump = await httpJson(
    `/results/crowd-wisdom-dump?runId=${encodeURIComponent(runId)}&assetSymbol=${encodeURIComponent(ASSET)}`
  );

  if (!dump || !dump.decisions || !dump.returns) {
    throw new Error("Invalid crowd-wisdom-dump response shape");
  }

  const decisions = dump.decisions;
  const returns = dump.returns;

  const returnsByStep = new Map();
  for (const r of returns) {
    if (typeof r.step === "number" && typeof r.stepReturn === "number") {
      returnsByStep.set(r.step, r.stepReturn);
    }
  }

  if (returnsByStep.size < 5) {
    throw new Error(`Too few returns from crowd-wisdom-dump: ${returnsByStep.size}`);
  }

  // build agent -> step series
  const agentSteps = new Map(); // agentId -> Map(step -> actionNum)
  let stepsSet = new Set();
  for (const d of decisions) {
    const agentId = d.agentId;
    const step = d.step;
    const action = d.action;
    if (!agentId || typeof step !== "number") continue;
    stepsSet.add(step);
    if (!agentSteps.has(agentId)) agentSteps.set(agentId, new Map());
    agentSteps.get(agentId).set(step, actionToNum(action));
  }
  const steps = [...stepsSet].sort((a, b) => a - b);
  if (steps.length < 5) throw new Error(`Too few steps from decisions: ${steps.length}`);

  const allAgents = [...agentSteps.keys()];
  if (allAgents.length < 10) throw new Error(`Too few agents from decisions: ${allAgents.length}`);

  // sample agents (note: sampling uses Math.random but only for choosing subset; metrics are not persisted)
  const sampledAgents = pickRandom(allAgents, SAMPLE_AGENTS);

  // Independence: avg abs correlation among random pairs
  function series(agentId) {
    const m = agentSteps.get(agentId);
    const arr = [];
    for (const s of steps) {
      // missing -> 0 (HOLD)
      arr.push(m?.get(s) ?? 0);
    }
    return arr;
  }

  const seriesCache = new Map();
  for (const a of sampledAgents) seriesCache.set(a, series(a));

  let corrAbsSum = 0;
  let corrCount = 0;
  for (let i = 0; i < SAMPLE_PAIRS; i++) {
    const a = sampledAgents[Math.floor(Math.random() * sampledAgents.length)];
    const b = sampledAgents[Math.floor(Math.random() * sampledAgents.length)];
    if (a === b) continue;
    const ca = seriesCache.get(a);
    const cb = seriesCache.get(b);
    const c = pearson(ca, cb);
    corrAbsSum += Math.abs(c);
    corrCount++;
  }
  const avgAbsCorr = corrCount ? corrAbsSum / corrCount : 0;

  // Diversity: median entropy per agent (BUY/SELL/HOLD distribution)
  const entropies = [];
  for (const a of sampledAgents) {
    const arr = seriesCache.get(a);
    let b = 0, s = 0, h = 0;
    for (const v of arr) {
      if (v === 1) b++;
      else if (v === -1) s++;
      else h++;
    }
    entropies.push(entropy3(b, s, h));
  }
  const medEntropy = median(entropies);
  const maxEntropy = Math.log(3);

  // Crowd advantage: compare crowd directional accuracy vs sampled median agent accuracy
  // crowd signal per step: sign(mean actions)
  const crowdCorrect = [];
  const agentAcc = [];

  // precompute step returns sign
  const retSignByStep = steps.map(s => sign(returnsByStep.get(s) ?? 0));

  // crowd accuracy
  let crowdHits = 0;
  let crowdTotal = 0;
  for (let i = 0; i < steps.length; i++) {
    const rs = retSignByStep[i];
    if (rs === 0) continue;
    let sum = 0;
    for (const a of sampledAgents) sum += seriesCache.get(a)[i];
    const crowdAction = sign(sum);
    if (crowdAction === 0) continue;
    crowdTotal++;
    if (crowdAction === rs) crowdHits++;
  }
  const crowdDA = crowdTotal ? crowdHits / crowdTotal : 0;

  // per-agent accuracy
  for (const a of sampledAgents) {
    const arr = seriesCache.get(a);
    let hits = 0;
    let total = 0;
    for (let i = 0; i < steps.length; i++) {
      const rs = retSignByStep[i];
      if (rs === 0) continue;
      const aa = sign(arr[i]);
      if (aa === 0) continue;
      total++;
      if (aa === rs) hits++;
    }
    agentAcc.push(total ? hits / total : 0);
  }
  const medAgentDA = median(agentAcc);

  // Print report
  const report = {
    runId,
    steps: steps.length,
    agentsTotal: allAgents.length,
    agentsSampled: sampledAgents.length,
    independence_avgAbsCorr: Number(avgAbsCorr.toFixed(4)),
    diversity_medEntropy: Number(medEntropy.toFixed(4)),
    diversity_medEntropy_norm01: Number((medEntropy / maxEntropy).toFixed(4)),
    crowdDirectionalAccuracy_sampled: Number(crowdDA.toFixed(4)),
    medianAgentDirectionalAccuracy_sampled: Number(medAgentDA.toFixed(4)),
    crowdAdvantage_delta: Number((crowdDA - medAgentDA).toFixed(4)),
  };

  // PASS/FAIL gates (tunable):
  // independence: avg abs corr should be low
  // diversity: normalized entropy should not collapse
  // advantage: crowd should beat median agent by >= 0 (non-negative)
  const PASS = {
    independence: avgAbsCorr <= 0.35,
    diversity: (medEntropy / maxEntropy) >= 0.35,
    crowdAdvantage: (crowdDA - medAgentDA) >= 0.0,
  };

  console.log(JSON.stringify({ report, PASS }, null, 2));

  const ok = Object.values(PASS).every(Boolean);
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(String(e?.stack ?? e));
  process.exit(1);
});
