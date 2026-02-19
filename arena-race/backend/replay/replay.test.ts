/**
 * Step 14 tests: replay reproduces result; tamper detected.
 */
import { replayMatch, replayMatchStrict } from "./replay";
import { createInitialState } from "../engine/types";
import { resolveTurn } from "../engine/resolveTurn";
import { computePlacement } from "../engine/scoring";
import type { BoardConfig, TokenPositions, PlayerAction } from "../engine/types";
import type { StoredTurn } from "./types";

const BOARD_CONFIG: BoardConfig = { trapTiles: [] };
const START: TokenPositions = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [9, 10, 11],
];

function buildTurns(count: number): StoredTurn[] {
  const turns: StoredTurn[] = [];
  let state = createInitialState(BOARD_CONFIG, START);
  const actions: [PlayerAction, PlayerAction, PlayerAction, PlayerAction] = [
    { moves: [0, 1, 2] },
    { moves: [3, 4, 5] },
    { moves: [6, 7, 8] },
    { moves: [9, 10, 11] },
  ];

  for (let i = 0; i < count; i++) {
    const next = resolveTurn(state, actions);
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
    const storedPlacement = computePlacement(last.scores, last.overtakeCounts);
    const result = replayMatch(turns, storedPlacement);
    expect(result.match).toBe(true);
    expect(result.replayedPlacement).toEqual(storedPlacement);
  });

  it("tamper: modified stored placement → replay shows mismatch", () => {
    const turns = buildTurns(5);
    const last = turns[turns.length - 1].stateAfter;
    const correctPlacement = computePlacement(last.scores, last.overtakeCounts);
    const wrongPlacement: [number, number, number, number] = [
      correctPlacement[1],
      correctPlacement[0],
      correctPlacement[3],
      correctPlacement[2],
    ];
    const result = replayMatch(turns, wrongPlacement);
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
    const { match } = replayMatchStrict(tampered);
    expect(match).toBe(false);
  });

  it("replayMatchStrict detects state_after mismatch", () => {
    const turns = buildTurns(2);
    const tampered = [...turns];
    tampered[0] = {
      ...tampered[0],
      stateAfter: tampered[1].stateAfter,
    };
    const { match, firstMismatchTurn } = replayMatchStrict(tampered);
    expect(match).toBe(false);
    expect(firstMismatchTurn).toBe(0);
  });
});
