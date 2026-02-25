"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitResult = submitResult;
/**
 * After match end: get signature from signer, submit to contract. TDD §4.1 step 6–8, Plan G6.
 * placement from computePlacement is rank-per-player (1-4); contract expects [1st_place_player, 2nd_place_player, ...].
 */
const ethers_1 = require("ethers");
const config_1 = require("./config");
const db_1 = require("./db");
const db_2 = require("./db");
const ESCROW_ABI = [
    "function submitResultWithPlacement(bytes32 matchId, uint8[4] calldata placement, bytes calldata signature) external",
];
/** Convert placement[playerIndex]=rank (1-4) to contract order [1st_place_player_index, 2nd_place_player_index, ...] */
function toContractOrder(placement) {
    return [
        placement.indexOf(1),
        placement.indexOf(2),
        placement.indexOf(3),
        placement.indexOf(4),
    ];
}
async function submitResult(matchId, placement) {
    const order = toContractOrder(placement);
    let signature;
    try {
        const res = await fetch(`${config_1.config.signerUrl}/sign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matchId, placement: order }),
        });
        if (!res.ok) {
            const err = await res.text();
            return { ok: false, error: `signer: ${err}` };
        }
        const data = await res.json();
        signature = data.signature;
        if (!signature)
            return { ok: false, error: "signer returned no signature" };
    }
    catch (e) {
        return { ok: false, error: `signer request failed: ${e.message}` };
    }
    const pk = process.env.SUBMITTER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
    if (!pk || !config_1.config.escrowAddress) {
        return { ok: false, error: "SUBMITTER_PRIVATE_KEY and ESCROW_ADDRESS required to submit" };
    }
    try {
        const provider = new ethers_1.JsonRpcProvider(config_1.config.chainRpcUrl);
        const wallet = new ethers_1.Wallet(pk, provider);
        const contract = new ethers_1.Contract(config_1.config.escrowAddress, ESCROW_ABI, wallet);
        const tx = await contract.submitResultWithPlacement(matchId, order, signature);
        const receipt = await tx.wait();
        const txHash = receipt?.hash ?? tx.hash;
        const db = (0, db_1.getDbInstance)();
        if (db) {
            db_2.matches.updateMatchStatus(db, matchId, "result_submitted", {
                contract_tx_hash: txHash,
            });
        }
        return { ok: true, txHash };
    }
    catch (e) {
        return { ok: false, error: `contract submit failed: ${e.message}` };
    }
}
