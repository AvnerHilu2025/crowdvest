#!/usr/bin/env node
/**
 * CI helper for bench regression gate.
 * Calls GET /bench/windows/gate with failOnRegression=true.
 * Exit 0: pass, 1: regression, 2: request/runtime error.
 */

const baseUrl = process.env.BENCH_API_URL || "http://localhost:4001";
const url = `${baseUrl}/bench/windows/gate?baselineTag=baseline-v1&symbols=SPY,QQQ,IWM&windows=29,60,120&n=20&failOnRegression=true`;

async function main() {
  try {
    const res = await fetch(url);
    const body = await res.json();

    console.log(JSON.stringify(body));

    if (typeof body.ok !== "boolean") {
      process.exit(2);
    }
    if (body.ok === true) {
      process.exit(0);
    }
    process.exit(1);
  } catch (err) {
    console.error(err.message || err);
    process.exit(2);
  }
}

main();
