/**
 * Deploy to a running Hardhat node (localhost:8545).
 * Mints test USDC to first 5 accounts and writes addresses to webapp for the UI.
 *
 * 1. Start node: npx hardhat node   (leave it running)
 * 2. In another terminal: npx hardhat run contracts/scripts/deploy-localhost.ts --network localhost
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const ENTRY_AMOUNT = ethers.parseUnits("10", 6);

async function main() {
  let signers;
  try {
    signers = await ethers.getSigners();
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string; cause?: { message?: string } };
    const msg = [err?.message, err?.cause?.message].filter(Boolean).join(" ");
    if (
      err?.code === "ECONNREFUSED" ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("Cannot connect to the network") ||
      msg.includes("HH108")
    ) {
      console.error("\nCannot connect to http://127.0.0.1:8545");
      console.error("Start the node first in a separate terminal:");
      console.error("  cd arena-race");
      console.error("  npm run node:localhost");
      console.error("Wait until you see 'Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/',");
      console.error("then run this deploy command again in another terminal.\n");
      process.exitCode = 1;
      return;
    }
    throw e;
  }
  const deployer = signers[0];
  if (signers.length < 5) {
    console.error("Need at least 5 accounts (deployer + 4 players). Start with: npx hardhat node");
    process.exitCode = 1;
    return;
  }

  console.log("Deploying to localhost...");
  console.log("Deployer:", deployer.address);

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdc = await MockERC20.deploy("Test USDC", "USDC", 6);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("MockERC20:", usdcAddress);

  await usdc.mint(deployer.address, ethers.parseUnits("1000000", 6));
  for (let i = 0; i < 5; i++) {
    await usdc.mint(signers[i].address, ethers.parseUnits("10000", 6));
  }
  console.log("Minted 10k USDC to first 5 accounts.");

  const ArenaRaceEscrow = await ethers.getContractFactory("ArenaRaceEscrow");
  const escrow = await ArenaRaceEscrow.deploy(usdcAddress, deployer.address, deployer.address);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("ArenaRaceEscrow:", escrowAddress);

  const out = {
    chainId: 31337,
    usdc: usdcAddress,
    escrow: escrowAddress,
    entryAmount: ENTRY_AMOUNT.toString(),
  };

  const webappDir = path.join(__dirname, "..", "..", "webapp", "public");
  fs.mkdirSync(webappDir, { recursive: true });
  const outPath = path.join(webappDir, "deployed-local.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Wrote", outPath);

  console.log("\n--- Next steps ---");
  console.log("1. In MetaMask: add network Localhost 8545 (http://127.0.0.1:8545, chain id 31337)");
  console.log("2. Import one of the Hardhat node accounts (see terminal where 'npx hardhat node' is running)");
  console.log("3. Start the webapp: cd webapp && npm run dev");
  console.log("4. Open http://localhost:5173 and connect wallet");
  console.log("\n(Deploy exits here; node, signer, game and web keep running in dev:all.)");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
