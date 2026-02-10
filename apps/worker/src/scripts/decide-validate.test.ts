/**
 * Unit-style check for decide.ts parse flags and validateCrowdSize.
 * Run: pnpm -C apps/worker exec tsx src/scripts/decide-validate.test.ts
 */
import { validateCrowdSize } from "./decide";

const DEFAULT_MIN = 100;

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`Assert failed: ${msg}`);
}

function testValidateCrowdSize(): void {
  assert(validateCrowdSize(100, DEFAULT_MIN, false).ok === true, "100 >= 100 ok");
  assert(validateCrowdSize(101, DEFAULT_MIN, false).ok === true, "101 >= 100 ok");
  assert(validateCrowdSize(99, DEFAULT_MIN, false).ok === false, "99 < 100 fails");
  assert(validateCrowdSize(10, DEFAULT_MIN, false).ok === false, "10 < 100 fails");

  assert(validateCrowdSize(10, DEFAULT_MIN, true).ok === true, "allowSmallCrowd bypasses");
  assert(validateCrowdSize(0, DEFAULT_MIN, true).ok === true, "allowSmallCrowd even for 0");

  const r = validateCrowdSize(5, 100, false);
  assert(r.ok === false && r.message.includes("loaded=5") && r.message.includes("min=100"), "error message format");
  assert(r.ok === false && r.message.includes("POST /agents/generate"), "error mentions generate endpoint");
}

testValidateCrowdSize();
console.log("decide-validate.test: all assertions passed");
