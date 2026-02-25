"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Movement unit tests. TDD §4.4: fixed player order.
 */
const movement_1 = require("./movement");
describe("movement", () => {
    it("applies submitted moves for each token, including shared destination tiles", () => {
        const positions = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [9, 10, 11],
        ];
        const actions = [
            { moves: [20, 1, 2] },
            { moves: [20, 4, 5] },
            { moves: [6, 7, 8] },
            { moves: [9, 10, 11] },
        ];
        const next = (0, movement_1.applyMovement)(positions, actions);
        expect(next[0][0]).toBe(20);
        expect(next[1][0]).toBe(20);
        expect(next[2][0]).toBe(6);
        expect(next[3][0]).toBe(9);
    });
    it("no-op leaves positions unchanged", () => {
        const positions = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [9, 10, 11],
        ];
        const actions = [
            { moves: [0, 1, 2] },
            { moves: [3, 4, 5] },
            { moves: [6, 7, 8] },
            { moves: [9, 10, 11] },
        ];
        const next = (0, movement_1.applyMovement)(positions, actions);
        expect(next).toEqual(positions);
    });
});
