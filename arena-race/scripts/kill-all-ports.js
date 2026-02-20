#!/usr/bin/env node
/**
 * Kill processes listening on the game stack ports: 8545, 3000, 3344, 5173.
 * Usage: node scripts/kill-all-ports.js
 * Or: npm run kill:all
 */
const { execSync, spawnSync } = require("child_process");
const os = require("os");

const PORTS = [8545, 3000, 3344, 5173];
const isWindows = os.platform() === "win32";

function getPidsWindows() {
  const pids = new Set();
  try {
    const out = execSync("netstat -ano", { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
    for (const line of out.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      for (const port of PORTS) {
        if (trimmed.includes(`:${port}`) && trimmed.includes("LISTENING")) {
          const parts = trimmed.split(/\s+/);
          const pid = parts[parts.length - 1];
          if (/^\d+$/.test(pid)) pids.add(pid);
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return [...pids];
}

function getPidsUnix() {
  const pids = new Set();
  for (const port of PORTS) {
    try {
      const out = execSync(`lsof -ti :${port} 2>/dev/null`, { encoding: "utf8" });
      out.split(/\s+/).filter(Boolean).forEach((pid) => pids.add(pid));
    } catch {
      // no process on this port
    }
  }
  return [...pids];
}

function killWindows(pids) {
  if (pids.length === 0) {
    console.log("No processes found on ports " + PORTS.join(", ") + ".");
    return;
  }
  const unique = [...new Set(pids)];
  const args = ["/F", ...unique.flatMap((p) => ["/PID", p])];
  try {
    spawnSync("taskkill", args, { stdio: "inherit", shell: true });
    console.log("Killed PIDs: " + unique.join(", "));
  } catch (e) {
    console.error("taskkill failed:", e.message);
  }
}

function killUnix(pids) {
  if (pids.length === 0) {
    console.log("No processes found on ports " + PORTS.join(", ") + ".");
    return;
  }
  const unique = [...new Set(pids)];
  try {
    execSync(`kill -9 ${unique.join(" ")}`, { stdio: "inherit" });
    console.log("Killed PIDs: " + unique.join(", "));
  } catch (e) {
    console.error("kill failed:", e.message);
  }
}

const pids = isWindows ? getPidsWindows() : getPidsUnix();
if (isWindows) killWindows(pids);
else killUnix(pids);
