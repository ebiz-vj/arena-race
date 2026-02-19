/**
 * Verify that the escrow at addresses in webapp/public/deployed-local.json
 * exists on localhost:8545 and responds to matches(bytes32).
 * Run with node running and after deploy:localhost.
 *
 *   node scripts/verify-localhost-escrow.js
 */
const fs = require("fs");
const path = require("path");
const { JsonRpcProvider, Contract, getBytes, keccak256, toBeHex } = require("ethers");

const ESCROW_ABI = [
  "function matches(bytes32) view returns (uint256 entryAmountPerPlayer, uint256 totalEntry, uint256 feeAmount, uint256 poolAmount, uint8 entriesReceived, uint8 status, uint256 resultSubmittedAt, uint256 entryDeadline)",
  "function owner() view returns (address)",
];

function matchIdToBytes32(seed) {
  const n = BigInt(seed);
  return keccak256(getBytes(toBeHex(n)));
}

async function main() {
  const deployedPath = path.join(__dirname, "..", "webapp", "public", "deployed-local.json");
  if (!fs.existsSync(deployedPath)) {
    console.error("Missing", deployedPath, "- run npm run deploy:localhost first.");
    process.exit(1);
  }
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const provider = new JsonRpcProvider("http://127.0.0.1:8545");

  const code = await provider.getCode(deployed.escrow);
  if (!code || code === "0x" || code.length < 10) {
    console.error("No contract at escrow", deployed.escrow, "- run deploy:localhost with the node running.");
    process.exit(1);
  }
  console.log("Escrow has code at", deployed.escrow);

  const escrow = new Contract(deployed.escrow, ESCROW_ABI, provider);
  const mid = matchIdToBytes32(1);
  const m = await escrow.matches(mid);
  if (m.entryDeadline === 0n || m.entryDeadline === 0) {
    console.log("matches(seed 1): no match yet (entryDeadline 0). OK - contract responds.");
  } else {
    console.log("matches(seed 1): status", m.status, "entries", m.entriesReceived + "/4");
  }
  const owner = await escrow.owner();
  console.log("owner():", owner);
  console.log("Localhost escrow verification OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
