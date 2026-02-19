/**
 * Entry flow tests. Step 8: no match start without Escrowed; expire → refund.
 */
import { checkEntryFlow, entryDeadlineFromCreatedAt } from "./entryFlow";
import type { IEscrowAdapter } from "./types";
import { EscrowMatchStatus } from "./types";

function mockAdapter(status: EscrowMatchStatus): IEscrowAdapter {
  return {
    getMatchStatus: async () => status,
    createMatch: async () => {},
    expireMatch: async () => {},
  };
}

describe("entryFlow", () => {
  it("4 players pay → Escrowed → shouldStart true", async () => {
    const adapter = mockAdapter(EscrowMatchStatus.Escrowed);
    const outcome = await checkEntryFlow(adapter, "0x01", entryDeadlineFromCreatedAt(0) + 300, 100);
    expect(outcome).toEqual({ shouldStart: true });
  });

  it("1 player never pays → status stays PendingEntries → shouldStart false", async () => {
    const adapter = mockAdapter(EscrowMatchStatus.PendingEntries);
    const deadline = entryDeadlineFromCreatedAt(0);
    const outcome = await checkEntryFlow(adapter, "0x01", deadline, deadline - 60);
    expect(outcome.shouldStart).toBe(false);
    expect((outcome as { reason: string }).reason).toBe("pending_entries");
  });

  it("entry expires (5 min) → past deadline → triggerRefund", async () => {
    const adapter = mockAdapter(EscrowMatchStatus.PendingEntries);
    const createdAt = 1000;
    const deadline = entryDeadlineFromCreatedAt(createdAt);
    const outcome = await checkEntryFlow(adapter, "0x01", deadline, deadline + 1);
    expect(outcome).toEqual({ shouldStart: false, reason: "expired", triggerRefund: true });
  });

  it("server never starts for Expired status", async () => {
    const adapter = mockAdapter(EscrowMatchStatus.Expired);
    const outcome = await checkEntryFlow(adapter, "0x01", 0, 9999);
    expect(outcome.shouldStart).toBe(false);
    expect((outcome as { reason: string }).reason).toBe("expired");
  });

  it("server never starts for Refunded status", async () => {
    const adapter = mockAdapter(EscrowMatchStatus.Refunded);
    const outcome = await checkEntryFlow(adapter, "0x01", 0, 9999);
    expect(outcome.shouldStart).toBe(false);
    expect((outcome as { reason: string }).reason).toBe("refunded");
  });
});

describe("entryDeadlineFromCreatedAt", () => {
  it("returns createdAt + 300", () => {
    expect(entryDeadlineFromCreatedAt(100)).toBe(400);
  });
});
