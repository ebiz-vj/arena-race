# Replay & Dispute — Admin Runbook

**Step 14.** TDD §13.

## Purpose

- Re-run a match from stored turn log to verify final score and placement.
- Detect tampering (modified actions → replay result differs from stored).
- Support dispute resolution: approve or correct payout.

## Flow

1. **Load match** by `match_id` from DB (`matches` + `match_turns`).
2. **Build turn list:** For each turn, load `state_before`, `actions`, `state_after` (from `match_turns`).
3. **Replay:** Call `replayMatch(turns, storedPlacement)` (backend: `arena-race/backend/replay/replay.ts`).
4. **Compare:**
   - If `result.match === true`: replay matches stored result → dispute rejected or closed.
   - If `result.match === false`: mismatch → investigate; correct result; approve supplementary transfer or clawback per dispute policy.
5. **Tamper check:** If `replayMatchStrict(turns)` returns `match: false`, a turn’s `state_after` does not match recomputed state; log `firstMismatchTurn` for audit.

## Implementation

- **Replay engine:** `backend/replay/replay.ts` — `replayMatch(turns, storedPlacement)` and `replayMatchStrict(turns)`.
- **Input:** `StoredTurn[]` (stateBefore, actions, stateAfter per turn) and stored placement from match result.
- **Output:** `ReplayResult` (match flag, replayed placement, stored placement).

## Security

- Replay uses only stored actions and state; no timestamps in resolution.
- Tampered action log produces different final placement → mismatch detected.
