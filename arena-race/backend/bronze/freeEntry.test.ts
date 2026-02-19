/**
 * Step 12 tests: free entry flow; token consumed on use; expiry.
 */
import { getFreeEntryPlayerIndex, shouldTreasuryFundEntry, useFreeTokenIfEligible } from "./freeEntry";
import { InMemoryBronzeStore } from "./inMemoryBronzeStore";

describe("freeEntry", () => {
  it("getFreeEntryPlayerIndex returns index of free-token user", () => {
    const players: [string, string, string, string] = ["a", "b", "c", "d"];
    expect(getFreeEntryPlayerIndex(players, "b")).toBe(1);
    expect(getFreeEntryPlayerIndex(players, "x")).toBe(null);
    expect(getFreeEntryPlayerIndex(players, null)).toBe(null);
  });

  it("shouldTreasuryFundEntry true only for free-entry player index", () => {
    expect(shouldTreasuryFundEntry(0, 0)).toBe(true);
    expect(shouldTreasuryFundEntry(1, 0)).toBe(false);
    expect(shouldTreasuryFundEntry(1, 1)).toBe(true);
    expect(shouldTreasuryFundEntry(0, null)).toBe(false);
  });

  it("useFreeTokenIfEligible consumes token on use", async () => {
    const store = new InMemoryBronzeStore();
    await store.grantToken("u1", 1000);
    const { used } = await useFreeTokenIfEligible(store, "u1", "match-1", 2000);
    expect(used).toBe(true);
    const again = await useFreeTokenIfEligible(store, "u1", "match-2", 3000);
    expect(again.used).toBe(false);
  });

  it("token expiry: cannot use expired token", async () => {
    const store = new InMemoryBronzeStore();
    await store.grantToken("u1", 0);
    const expiry = 8 * 86400 * 1000;
    const { used } = await useFreeTokenIfEligible(store, "u1", "match-1", expiry);
    expect(used).toBe(false);
  });
});
