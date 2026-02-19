"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Step 14 tests: replay reproduces result; tamper detected.
 */
const replay_1 = require("./replay");
const types_1 = require("../engine/types");
const resolveTurn_1 = require("../engine/resolveTurn");
const scoring_1 = require("../engine/scoring");
const BOARD_CONFIG = { trapTiles: [] };
const START = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [9, 10, 11],
];
function buildTurns(count) {
    const turns = [];
    let state = (0, types_1.createInitialState)(BOARD_CONFIG, START);
    const actions = [
        { moves: [0, 1, 2] },
        { moves: [3, 4, 5] },
        { moves: [6, 7, 8] },
        { moves: [9, 10, 11] },
    ];
    for (let i = 0; i < count; i++) {
        const next = (0, resolveTurn_1.resolveTurn)(state, actions);
        turns.push({
            turnIndex: i,
            stateBefore: state,
            actions,
            stateAfter: next,
        });
        state = next;
    }
    return turns;
}
describe("replay", () => {
    it("replay reproduces stored placement", () => {
        const turns = buildTurns(5);
        const last = turns[turns.length - 1].stateAfter;
        const storedPlacement = (0, scoring_1.computePlacement)(last.scores, last.overtakeCounts);
        const result = (0, replay_1.replayMatch)(turns, storedPlacement);
        expect(result.match).toBe(true);
        expect(result.replayedPlacement).toEqual(storedPlacement);
    });
    it("tamper: modified stored placement → replay shows mismatch", () => {
        const turns = buildTurns(5);
        const last = turns[turns.length - 1].stateAfter;
        const correctPlacement = (0, scoring_1.computePlacement)(last.scores, last.overtakeCounts);
        const wrongPlacement = [
            correctPlacement[1],
            correctPlacement[0],
            correctPlacement[3],
            correctPlacement[2],
        ];
        const result = (0, replay_1.replayMatch)(turns, wrongPlacement);
        expect(result.match).toBe(false);
        expect(result.replayedPlacement).toEqual(correctPlacement);
    });
    it("tamper: modified action changes replayed state (strict detects mismatch)", () => {
        const turns = buildTurns(3);
        const tampered = [...turns];
        tampered[1] = {
            ...tampered[1],
            actions: [
                { moves: [40, 41, 42] },
                tampered[1].actions[1],
                tampered[1].actions[2],
                tampered[1].actions[3],
            ],
        };
        tampered[1].stateAfter = turns[1].stateAfter;
        const { match } = (0, replay_1.replayMatchStrict)(tampered);
        expect(match).toBe(false);
    });
    it("replayMatchStrict detects state_after mismatch", () => {
        const turns = buildTurns(2);
        const tampered = [...turns];
        tampered[0] = {
            ...tampered[0],
            stateAfter: tampered[1].stateAfter,
        };
        const { match, firstMismatchTurn } = (0, replay_1.replayMatchStrict)(tampered);
        expect(match).toBe(false);
        expect(firstMismatchTurn).toBe(0);
    });
});
