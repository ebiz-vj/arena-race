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
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [9, 10, 11],
];
exports.DEFAULT_BOARD = { trapTiles: [12, 24, 36] };
