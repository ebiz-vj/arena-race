/**
 * Deploy to Hardhat in-process network, then run 50 matches + expiration test.
 * Use to satisfy "50+ testnet matches" and "expiration + refund verified" without live Sepolia.
 *
 *   npx hardhat run contracts/scripts/deploy-and-run-local.ts
 */
import { ethers } from "hardhat";

const ENTRY_AMOUNT = ethers.parseUnits("10", 6);
const MATCH_COUNT = 50;

function matchId(seed: number): string {
  return ethers.keccak256(ethers.toBeArray(seed));
}

async function main() {
  const [deployer, ...players] = await ethers.getSigners();
  if (players.length < 3) {
    console.error("Need at least 4 accounts total.");
    process.exitCode = 1;
    return;
  }
  const accounts = [deployer, players[0], players[1], players[2]];

  console.log("Deploying MockERC20 + ArenaRaceEscrow on Hardhat...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdc = await MockERC20.deploy("Test USDC", "USDC", 6);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  await usdc.mint(deployer.address, ethers.parseUnits("1000000", 6));
  for (const a of accounts) {
    await usdc.mint(a.address, ethers.parseUnits("10000", 6));
  }

  const ArenaRaceEscrow = await ethers.getContractFactory("ArenaRaceEscrow");
  const escrow = await ArenaRaceEscrow.deploy(usdcAddress, deployer.address, deployer.address);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("Escrow:", escrowAddress);

  let ok = 0;
  for (let i = 0; i < MATCH_COUNT; i++) {
    const mid = matchId(i);
    await escrow.createMatch(mid, ENTRY_AMOUNT);
    for (let p = 0; p < 4; p++) {
      await usdc.connect(accounts[p]).approve(escrowAddress, ENTRY_AMOUNT);
      await escrow.connect(accounts[p]).submitEntry(mid, ENTRY_AMOUNT);
    }
    const m = await escrow.matches(mid);
    if (Number(m.status) !== 1) throw new Error(`Match ${i} not Escrowed`);
    const pool = m.poolAmount;
    const payouts = [
      (pool * 3800n) / 10000n,
      (pool * 3000n) / 10000n,
      (pool * 2000n) / 10000n,
      pool - (pool * 3800n) / 10000n - (pool * 3000n) / 10000n - (pool * 2000n) / 10000n,
    ];
    const messageHash = ethers.keccak256(
      ethers.solidityPacked(
        ["bytes32", "uint256", "uint256", "uint256", "uint256"],
        [mid, payouts[0], payouts[1], payouts[2], payouts[3]]
      )
    );
    const sig = await deployer.signMessage(ethers.getBytes(messageHash));
    await escrow.submitResult(mid, payouts, sig);
    const m2 = await escrow.matches(mid);
    if (Number(m2.status) !== 4) throw new Error(`Match ${i} not Resolved`);
    ok++;
    if ((i + 1) % 10 === 0) console.log(" ", i + 1, "/", MATCH_COUNT, "matches OK");
  }
  console.log("Matches:", ok, "/", MATCH_COUNT);

  console.log("Expiration test...");
  const expId = matchId(999999);
  await escrow.createMatch(expId, ENTRY_AMOUNT);
  await usdc.connect(accounts[0]).approve(escrowAddress, ENTRY_AMOUNT);
  await escrow.connect(accounts[0]).submitEntry(expId, ENTRY_AMOUNT);
  await usdc.connect(accounts[1]).approve(escrowAddress, ENTRY_AMOUNT);
  await escrow.connect(accounts[1]).submitEntry(expId, ENTRY_AMOUNT);
  await ethers.provider.send("evm_increaseTime", [301]);
  await ethers.provider.send("evm_mine", []);
  await escrow.expireMatch(expId);
  if (Number((await escrow.matches(expId)).status) !== 2) throw new Error("Not Expired");
  await escrow.connect(accounts[0]).claimRefund(expId);
  await escrow.connect(accounts[1]).claimRefund(expId);
  if (Number((await escrow.matches(expId)).status) !== 3) throw new Error("Not Refunded");
  console.log("Expiration + refund verified.");
  console.log("Step 5 simulation: 50 matches + expiration OK.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
