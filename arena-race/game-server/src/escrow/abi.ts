/**
 * Minimal ABI for ArenaRaceEscrow.matches(bytes32).
 * Important: public mapping getter omits fixed-size array fields (playerWallets),
 * so this returns 8 outputs in the deployed contract ABI.
 */
export const ESCROW_MATCHES_ABI = [
  {
    inputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    name: "matches",
    outputs: [
      { internalType: "uint256", name: "entryAmountPerPlayer", type: "uint256" },
      { internalType: "uint256", name: "totalEntry", type: "uint256" },
      { internalType: "uint256", name: "feeAmount", type: "uint256" },
      { internalType: "uint256", name: "poolAmount", type: "uint256" },
      { internalType: "uint8", name: "entriesReceived", type: "uint8" },
      { internalType: "uint8", name: "status", type: "uint8" },
      { internalType: "uint256", name: "resultSubmittedAt", type: "uint256" },
      { internalType: "uint256", name: "entryDeadline", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
