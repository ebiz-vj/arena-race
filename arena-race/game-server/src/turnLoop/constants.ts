/**
 * Turn loop constants. TDD §4.1–4.4.
 */
export const TURN_WINDOW_MS = 6000;
export const TURN_MS = TURN_WINDOW_MS;
export const MATCH_MAX_MS = 300_000; // 5 min
export const DEFAULT_TURNS_PER_MATCH = 15;

/** Board A start positions (runMatch.ts). */
export const DEFAULT_START = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [9, 10, 11],
] as const;

export const DEFAULT_BOARD = { trapTiles: [12, 24, 36] };
