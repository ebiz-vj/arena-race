#!/usr/bin/env node
/**
 * Run all pre-mainnet verification steps (contract tests, backend replay + 1000 sim, local 100 matches).
 * Usage: node scripts/verify-pre-mainnet.js (from arena-race root)
 * Or: npm run verify:checklist (if added to package.json)
 */
const { execSync } = require("child_process");
const path = require("path");
const root = path.join(__dirname, "..");

function run(title, cmd, cwd = root) {
  console.log("\n---", title, "---");
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
}

console.log("Pre-mainnet checklist verification\n");

run("1. Contract tests (24)", "npx hardhat test");
run("2. Backend: replay + 1000-match simulation", "npm test -- --testPathPattern=\"replay|run1000Matches\"", path.join(root, "backend"));
run("3. Local 100 matches + expiration", "npx hardhat run contracts/scripts/deploy-and-run-local.ts");

console.log("\n--- All verification steps passed ---");
