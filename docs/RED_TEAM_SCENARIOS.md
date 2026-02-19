# Red-Team Pass — Step 18

**Purpose:** Document and verify handling of attack scenarios. Execution Plan Step 18.

| Scenario | Handling | Test / Reference |
|----------|----------|-------------------|
| **Double entry** | One address can only enter once per match; `AlreadyEntered` revert. | `ArenaRaceEscrow.test.ts`: "reverts if already entered" |
| **Reentrancy** | ReentrancyGuard on submitEntry, claimRefund, refundMatch, submitResult; checks-effects-interactions. | `ArenaRaceEscrow.test.ts`: "claimRefund is protected (no reentrancy on transfer)"; OpenZeppelin ReentrancyGuard |
| **Signature replay** | Message includes matchId (and payouts/placement); signature for match A invalid for match B. | `ArenaRaceEscrow.test.ts`: "red-team: signature for match A cannot be used for match B (replay)" |
| **Expired match forced resolution** | submitResult requires status == Escrowed; Expired → NotEscrowed revert. | `ArenaRaceEscrow.test.ts`: "submitResult reverts when status is Expired" |
| **Entry window race** | 4th entry and expiry at same time: block.timestamp and entryDeadline compared atomically; expireMatch only sets Expired when status still PendingEntries and deadline passed. | Contract: submitEntry reverts PastDeadline; expireMatch sets Expired; no Escrowed after Expired. Backend: start match only when Escrowed. |
| **Late submitResult** | No time limit on submitResult for Escrowed matches; idempotency via status = Resolved after first submit. Double submit reverts (NotEscrowed after first). | `ArenaRaceEscrow.test.ts`: "double submitResult blocked" |

**Done when:** All scenarios above handled or documented as non-issues; any missing test added.
