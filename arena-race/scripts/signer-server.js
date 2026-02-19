/**
 * Local result-signer for testing. Signs placement for submitResultWithPlacement.
 * Use the same private key as Hardhat account #0 (deployer / result signer).
 *
 *   node scripts/signer-server.js
 *   POST http://localhost:3344/sign  Body: { "matchId": "0x...", "placement": [0,1,2,3] }
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { ethers } = require("ethers");

const PORT = process.env.SIGNER_PORT || 3344;
const PK = process.env.DEPLOYER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const wallet = new ethers.Wallet(PK);

function runServer() {
  const http = require("http");
  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }
    if (req.method === "GET" && req.url === "/whoami") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ address: wallet.address }));
      return;
    }
    if (req.method !== "POST" || req.url !== "/sign") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "POST /sign with body { matchId, placement }" }));
      return;
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { matchId, placement: placementRaw } = JSON.parse(body);
        if (!matchId || typeof matchId !== "string" || !matchId.startsWith("0x")) {
          res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(JSON.stringify({ error: "matchId must be a bytes32 hex string (0x...)" }));
          return;
        }
        const placement = Array.isArray(placementRaw)
          ? placementRaw.map((p) => (typeof p === "number" ? p : parseInt(String(p), 10)))
          : [];
        if (placement.length !== 4 || placement.some((p) => !Number.isInteger(p) || p < 0 || p > 3)) {
          res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(JSON.stringify({ error: "placement must be [0-3, 0-3, 0-3, 0-3]" }));
          return;
        }
        const messageHash = ethers.keccak256(
          ethers.solidityPacked(
            ["bytes32", "uint8", "uint8", "uint8", "uint8"],
            [matchId, placement[0], placement[1], placement[2], placement[3]]
          )
        );
        const sig = await wallet.signMessage(ethers.getBytes(messageHash));
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ signature: sig }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ error: String(e.message) }));
      }
    });
  });
  server.listen(PORT, () => {
    console.log("Result signer at http://localhost:" + PORT + " (POST /sign, GET /whoami)");
    console.log("Signer address:", wallet.address, "- must match contract resultSigner (deployer).");
  });
}

runServer();
