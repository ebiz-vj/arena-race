"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Turn timer tests. Step 10: late packet ignored; default applied; simultaneous before deadline accepted.
 */
const turnTimer_1 = require("./turnTimer");
describe("turnTimer", () => {
    const turnStart = 1000;
    const turnDeadline = turnStart + turnTimer_1.TURN_WINDOW_MS;
    it("accepts action when receivedAt <= turnDeadline", () => {
        expect((0, turnTimer_1.isActionOnTime)(turnDeadline - 1, turnDeadline)).toBe(true);
        expect((0, turnTimer_1.isActionOnTime)(turnDeadline, turnDeadline)).toBe(true);
    });
    it("rejects late packet (receivedAt > turnDeadline)", () => {
        expect((0, turnTimer_1.isActionOnTime)(turnDeadline + 1, turnDeadline)).toBe(false);
    });
    it("resolveAction uses default when late", () => {
        const positions = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [9, 10, 11],
        ];
        const lateAction = { moves: [99, 99, 99] };
        const resolved = (0, turnTimer_1.resolveAction)(lateAction, turnDeadline + 100, turnStart, positions, 0);
        expect(resolved.moves).toEqual([0, 1, 2]);
    });
    it("resolveAction uses submitted when on time", () => {
        const positions = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [9, 10, 11],
        ];
        const onTimeAction = { moves: [5, 6, 7] };
        const resolved = (0, turnTimer_1.resolveAction)(onTimeAction, turnDeadline - 1, turnStart, positions, 0);
        expect(resolved.moves).toEqual([5, 6, 7]);
    });
    it("simultaneous actions before deadline all accepted", () => {
        const positions = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [9, 10, 11],
        ];
        const at = turnDeadline - 10;
        for (let p = 0; p < 4; p++) {
            const action = { moves: [p * 10, p * 10 + 1, p * 10 + 2] };
            const resolved = (0, turnTimer_1.resolveAction)(action, at, turnStart, positions, p);
            expect(resolved).toEqual(action);
        }
    });
});
