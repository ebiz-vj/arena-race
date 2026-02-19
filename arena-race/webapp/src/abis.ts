export const ESCROW_ABI = [
  "function createMatch(bytes32 matchId, uint256 entryAmountPerPlayer) external",
  "function submitEntry(bytes32 matchId, uint256 amount) external",
  "function submitResultWithPlacement(bytes32 matchId, uint8[4] calldata placement, bytes calldata signature) external",
  "function matches(bytes32) view returns (uint256 entryAmountPerPlayer, uint256 totalEntry, uint256 feeAmount, uint256 poolAmount, uint8 entriesReceived, uint8 status, uint256 resultSubmittedAt, uint256 entryDeadline)",
  "function owner() view returns (address)",
  "function resultSigner() view returns (address)",
] as const;

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
] as const;
