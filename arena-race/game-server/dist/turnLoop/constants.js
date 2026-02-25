"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BOARD = exports.DEFAULT_START = exports.DEFAULT_TURNS_PER_MATCH = exports.MATCH_MAX_MS = exports.TURN_MS = exports.TURN_WINDOW_MS = void 0;
/**
 * Turn loop constants. TDD §4.1–4.4.
 */
exports.TURN_WINDOW_MS = 6000;
exports.TURN_MS = exports.TURN_WINDOW_MS;
exports.MATCH_MAX_MS = 300000; // 5 min
exports.DEFAULT_TURNS_PER_MATCH = 15;
/** Board A start positions (runMatch.ts). */
exports.DEFAULT_START = [
    [42, 43, 44], // P0 bottom-left lane
    [45, 46, 47], // P1 bottom-right lane
    [35, 36, 37], // P2 mid-bottom left lane
    [38, 39, 40], // P3 mid-bottom right lane
];
exports.DEFAULT_BOARD = { trapTiles: [12, 24, 36] };
