/**
 * Step 5 — Run 50–100 simulated testnet matches (entry → escrow → result → payout).
 * Also runs one expiration/refund flow.
 *
 * Usage:
 *   ESCROW_ADDRESS=0x... USDC_ADDRESS=0x... npx hardhat run contracts/scripts/run-testnet-matches.ts --network sepolia
 *
 * Optional: MATCH_COUNT=60 (default 50), SKIP_EXPIRATION=1 to skip the 5-min wait test.
 */
import { ethers } from "hardhat";

const ENTRY_AMOUNT = ethers.parseUnits("10", 6);
const MATCH_COUNT = Math.min(100, Math.max(50, parseInt(process.env.MATCH_COUNT || "50", 10)));

function matchId(seed: number): string {
  return ethers.keccak256(ethers.toBeArray(seed));
}

async function main() {
  const escrowAddress = process.env.ESCROW_ADDRESS;
  const usdcAddress = process.env.USDC_ADDRESS;
  if (!escrowAddress || !usdcAddress) {
    console.error("Set ESCROW_ADDRESS and USDC_ADDRESS (from deploy output).");
    process.exitCode = 1;
    return;
  }

  const [signer, ...rest] = await ethers.getSigners();
  const accounts = [signer, ...rest];
  if (accounts.length < 4) {
    console.error("Need at least 4 accounts (use Hardhat network with multiple accounts or fork).");
    process.exitCode = 1;
    return;
  }

  const escrow = await ethers.getContractAt("ArenaRaceEscrow", escrowAddress);
  const usdc = await ethers.getContractAt("MockERC20", usdcAddress);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < MATCH_COUNT; i++) {
    const mid = matchId(i);
    try {
      await escrow.createMatch(mid, ENTRY_AMOUNT);
      for (let p = 0; p < 4; p++) {
        await usdc.connect(accounts[p]).approve(escrowAddress, ENTRY_AMOUNT);
        await escrow.connect(accounts[p]).submitEntry(mid, ENTRY_AMOUNT);
      }
      const m = await escrow.matches(mid);
      if (Number(m.status) !== 1) {
        throw new Error(`Match ${i} not Escrowed: ${m.status}`);
      }
      const pool = m.poolAmount;
      const a0 = (pool * 3800n) / 10000n;
      const a1 = (pool * 3000n) / 10000n;
      const a2 = (pool * 2000n) / 10000n;
      const a3 = pool - a0 - a1 - a2;
      const payouts = [a0, a1, a2, a3];
      const messageHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "uint256", "uint256", "uint256", "uint256"],
          [mid, payouts[0], payouts[1], payouts[2], payouts[3]]
        )
      );
      const sig = await signer.signMessage(ethers.getBytes(messageHash));
      await escrow.submitResult(mid, payouts, sig);
      const m2 = await escrow.matches(mid);
      if (Number(m2.status) !== 4) {
        throw new Error(`Match ${i} not Resolved: ${m2.status}`);
      }
      ok++;
      if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${MATCH_COUNT} matches OK`);
    } catch (e) {
      fail++;
      console.error(`Match ${i} failed:`, e);
    }
  }

  console.log(`\nMatches: ${ok} OK, ${fail} failed (total ${MATCH_COUNT})`);

  const net = await ethers.provider.getNetwork();
  const isHardhat = net.chainId === 31337n;

  if (!process.env.SKIP_EXPIRATION) {
    if (isHardhat) {
      console.log("\n--- Expiration test (2 entries, evm_increaseTime 301s, expire, refund) ---");
      const expId = matchId(999999);
      await escrow.createMatch(expId, ENTRY_AMOUNT);
      await usdc.connect(accounts[0]).approve(escrowAddress, ENTRY_AMOUNT);
      await escrow.connect(accounts[0]).submitEntry(expId, ENTRY_AMOUNT);
      await usdc.connect(accounts[1]).approve(escrowAddress, ENTRY_AMOUNT);
      await escrow.connect(accounts[1]).submitEntry(expId, ENTRY_AMOUNT);
      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine", []);
      await escrow.expireMatch(expId);
      const mx = await escrow.matches(expId);
      if (Number(mx.status) !== 2) {
        console.error("  Expiration test FAIL: status not Expired:", mx.status);
        process.exitCode = 1;
        return;
      }
      await escrow.connect(accounts[0]).claimRefund(expId);
      await escrow.connect(accounts[1]).claimRefund(expId);
      const mx2 = await escrow.matches(expId);
      if (Number(mx2.status) !== 3) {
        console.error("  Expiration test FAIL: status not Refunded:", mx2.status);
        process.exitCode = 1;
        return;
      }
      console.log("  Expiration + refund verified.");
    } else {
      console.log("\n--- Expiration test on live net: create one match with 2 entries. ---");
      const expId = matchId(999999);
      await escrow.createMatch(expId, ENTRY_AMOUNT);
      await usdc.connect(accounts[0]).approve(escrowAddress, ENTRY_AMOUNT);
      await escrow.connect(accounts[0]).submitEntry(expId, ENTRY_AMOUNT);
      await usdc.connect(accounts[1]).approve(escrowAddress, ENTRY_AMOUNT);
      await escrow.connect(accounts[1]).submitEntry(expId, ENTRY_AMOUNT);
      console.log("  MatchId (expiration test):", expId);
      console.log("  Wait 5+ minutes, then run: npx hardhat run contracts/scripts/expire-and-refund.ts --network sepolia");
      console.log("  With env: EXPIRATION_MATCH_ID=" + expId + " ESCROW_ADDRESS=" + escrowAddress);
    }
  } else {
    console.log("  (SKIP_EXPIRATION=1: expiration test skipped)");
  }

  if (fail > 0 || ok < 50) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
