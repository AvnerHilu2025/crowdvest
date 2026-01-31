/**
 * Loads repo-root .env (if present) then runs Prisma CLI or seed.
 * Does not override existing env vars (e.g. from CI).
 * Usage:
 *   node scripts/with-env.js [prisma args...]  → runs prisma
 *   node scripts/with-env.js seed             → runs tsx prisma/seed.ts
 */
const path = require("path");
const { spawnSync } = require("child_process");

const repoRootEnv = path.resolve(__dirname, "../../../.env");
require("dotenv").config({ path: repoRootEnv });

const cwd = path.join(__dirname, "..");
const isSeed = process.argv[2] === "seed";

let result;
if (isSeed) {
  const tsxBin = path.join(__dirname, "..", "node_modules", ".bin", "tsx");
  result = spawnSync(tsxBin, ["prisma/seed.ts"], {
    stdio: "inherit",
    cwd,
    env: { ...process.env },
  });
} else {
  const prismaBin = path.join(__dirname, "..", "node_modules", ".bin", "prisma");
  result = spawnSync(prismaBin, process.argv.slice(2), { stdio: "inherit", cwd });
}

process.exit(result.status ?? 1);
