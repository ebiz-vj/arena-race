/**
 * Turn loop constants. TDD §4.1–4.4.
 */
export const TURN_WINDOW_MS = 6000;
export const TURN_MS = TURN_WINDOW_MS;
export const MATCH_MAX_MS = 300_000; // 5 min
export const DEFAULT_TURNS_PER_MATCH = 15;

/** Board A start positions (runMatch.ts). */
export const DEFAULT_START = [
  [42, 43, 44], // P0 bottom-left lane
  [45, 46, 47], // P1 bottom-right lane
  [35, 36, 37], // P2 mid-bottom left lane
  [38, 39, 40], // P3 mid-bottom right lane
] as const;

export const DEFAULT_BOARD = { trapTiles: [12, 24, 36] };
