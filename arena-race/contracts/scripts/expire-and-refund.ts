/**
 * Call expireMatch for an expiration-test match (after 5+ min).
 * Use after run-testnet-matches.ts on live Sepolia: wait 5 min, then run this.
 * Players who entered must then call claimRefund(matchId) from their wallets.
 *
 * Usage:
 *   ESCROW_ADDRESS=0x... EXPIRATION_MATCH_ID=0x... npx hardhat run contracts/scripts/expire-and-refund.ts --network sepolia
 */
import { ethers } from "hardhat";

async function main() {
  const escrowAddress = process.env.ESCROW_ADDRESS;
  const matchIdHex = process.env.EXPIRATION_MATCH_ID;
  if (!escrowAddress || !matchIdHex) {
    console.error("Set ESCROW_ADDRESS and EXPIRATION_MATCH_ID.");
    process.exitCode = 1;
    return;
  }
  const matchId =
    matchIdHex.startsWith("0x") && matchIdHex.length === 66
      ? matchIdHex
      : ethers.keccak256(ethers.toBeArray(parseInt(matchIdHex, 10)));

  const escrow = await ethers.getContractAt("ArenaRaceEscrow", escrowAddress);
  const m = await escrow.matches(matchId);
  if (Number(m.status) !== 0) {
    console.error("Match not PendingEntries:", m.status);
    process.exitCode = 1;
    return;
  }
  if (Number(m.entriesReceived) >= 4) {
    console.error("Match already has 4 entries.");
    process.exitCode = 1;
    return;
  }

  await escrow.expireMatch(matchId);
  const m2 = await escrow.matches(matchId);
  if (Number(m2.status) !== 2) {
    console.error("expireMatch did not set Expired:", m2.status);
    process.exitCode = 1;
    return;
  }
  console.log("Match expired. Entries received:", m.entriesReceived);
  console.log("Each player who entered must call: escrow.claimRefund(matchId)");
  console.log("  matchId:", matchId);
  for (let i = 0; i < Number(m.entriesReceived); i++) {
    console.log("  player", i, ":", m.playerWallets[i]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
