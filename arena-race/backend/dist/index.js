"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayMatchStrict = exports.replayMatch = exports.TURN_WINDOW_MS = exports.isActionOnTime = exports.resolveAction = exports.computePlacement = exports.resolveTurn = exports.defaultAction = exports.createInitialState = void 0;
/**
 * Backend entry for game-server: engine, scoring, turn timer, replay.
 */
var types_1 = require("./engine/types");
Object.defineProperty(exports, "createInitialState", { enumerable: true, get: function () { return types_1.createInitialState; } });
Object.defineProperty(exports, "defaultAction", { enumerable: true, get: function () { return types_1.defaultAction; } });
var resolveTurn_1 = require("./engine/resolveTurn");
Object.defineProperty(exports, "resolveTurn", { enumerable: true, get: function () { return resolveTurn_1.resolveTurn; } });
var scoring_1 = require("./engine/scoring");
Object.defineProperty(exports, "computePlacement", { enumerable: true, get: function () { return scoring_1.computePlacement; } });
var turnTimer_1 = require("./engine/turnTimer");
Object.defineProperty(exports, "resolveAction", { enumerable: true, get: function () { return turnTimer_1.resolveAction; } });
Object.defineProperty(exports, "isActionOnTime", { enumerable: true, get: function () { return turnTimer_1.isActionOnTime; } });
Object.defineProperty(exports, "TURN_WINDOW_MS", { enumerable: true, get: function () { return turnTimer_1.TURN_WINDOW_MS; } });
var replay_1 = require("./replay/replay");
Object.defineProperty(exports, "replayMatch", { enumerable: true, get: function () { return replay_1.replayMatch; } });
Object.defineProperty(exports, "replayMatchStrict", { enumerable: true, get: function () { return replay_1.replayMatchStrict; } });
