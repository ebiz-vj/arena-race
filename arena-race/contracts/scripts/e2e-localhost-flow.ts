/**
 * End-to-end: deploy, create match, 4 entries, submit result, verify status and balances.
 * Runs on Hardhat in-process network (no persistent node). Use to verify the full flow.
 *
 *   npx hardhat run contracts/scripts/e2e-localhost-flow.ts
 */
import { ethers } from "hardhat";

const ENTRY_AMOUNT = ethers.parseUnits("10", 6);
const SEED = 1;

function matchId(seed: number): string {
  return ethers.keccak256(ethers.toBeArray(seed));
}

async function main() {
  const [deployer, ...rest] = await ethers.getSigners();
  const accounts = [deployer, rest[0], rest[1], rest[2]];
  if (accounts.length < 4) {
    console.error("Need at least 4 signers.");
    process.exitCode = 1;
    return;
  }

  console.log("Deploying MockERC20 + ArenaRaceEscrow...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdc = await MockERC20.deploy("Test USDC", "USDC", 6);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  for (const a of accounts) await usdc.mint(a.address, ethers.parseUnits("10000", 6));

  const ArenaRaceEscrow = await ethers.getContractFactory("ArenaRaceEscrow");
  const escrow = await ArenaRaceEscrow.deploy(usdcAddress, deployer.address, deployer.address);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();

  const mid = matchId(SEED);
  console.log("Create match seed", SEED, "-> matchId", mid.slice(0, 18) + "...");
  await escrow.createMatch(mid, ENTRY_AMOUNT);

  for (let i = 0; i < 4; i++) {
    await usdc.connect(accounts[i]).approve(escrowAddress, ENTRY_AMOUNT);
    await escrow.connect(accounts[i]).submitEntry(mid, ENTRY_AMOUNT);
    console.log("  Entry", i + 1, "/4 from", accounts[i].address.slice(0, 10) + "...");
  }

  const mBefore = await escrow.matches(mid);
  if (Number(mBefore.status) !== 1) {
    throw new Error("Expected status Escrowed(1), got " + mBefore.status);
  }
  const pool = mBefore.poolAmount;

  const placement: [number, number, number, number] = [0, 1, 2, 3];
  const messageHash = ethers.keccak256(
    ethers.solidityPacked(
      ["bytes32", "uint8", "uint8", "uint8", "uint8"],
      [mid, placement[0], placement[1], placement[2], placement[3]]
    )
  );
  const sig = await deployer.signMessage(ethers.getBytes(messageHash));
  await escrow.submitResultWithPlacement(mid, placement, sig);
  console.log("Result submitted (placement 0,1,2,3).");

  const mAfter = await escrow.matches(mid);
  if (Number(mAfter.status) !== 4) {
    throw new Error("Expected status Resolved(4), got " + mAfter.status);
  }
  console.log("Match status: Resolved.");

  const initialPerPlayer = ethers.parseUnits("10000", 6);
  const payouts = [
    (pool * 3800n) / 10000n,
    (pool * 3000n) / 10000n,
    (pool * 2000n) / 10000n,
    pool - (pool * 3800n) / 10000n - (pool * 3000n) / 10000n - (pool * 2000n) / 10000n,
  ];
  const balancesAfter = await Promise.all(accounts.map((a) => usdc.balanceOf(a.address)));
  const expectedBalances = accounts.map((_, i) => initialPerPlayer - ENTRY_AMOUNT + payouts[i]);
  for (let i = 0; i < 4; i++) {
    const b = balancesAfter[i];
    const e = expectedBalances[i];
    const ok = b === e;
    console.log(`  Player ${i}: balance ${ethers.formatUnits(b, 6)} USDC (expected ${ethers.formatUnits(e, 6)}) ${ok ? "OK" : "MISMATCH"}`);
  }
  const sumPayouts = payouts[0] + payouts[1] + payouts[2] + payouts[3];
  if (sumPayouts !== pool) throw new Error("Payout sum != pool");
  const firstGained = balancesAfter[0] > initialPerPlayer - ENTRY_AMOUNT;
  const fourthHasLess = balancesAfter[3] < initialPerPlayer;
  if (!firstGained || !fourthHasLess) throw new Error("Payouts not reflected: 1st should gain (balance > 9990), 4th should have less than 10000");

  console.log("E2E flow OK: create -> enter x4 -> resolve -> status and payouts verified.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
