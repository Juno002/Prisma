import { describe, expect, it } from "vitest";
import { budgetUsage } from "@/domain/ledger";
import { contains, nextPeriod, periodContaining, previousComparablePeriod } from "@/domain/periods";
import { moneyFromCents } from "@/domain/money";

describe("Phase 6 · configurable periods", () => {
  it("uses the configured start day and satisfies the roadmap gate", () => {
    const period = periodContaining("2026-09-24", { startDay: 25 });
    expect(period).toEqual({ start: "2026-08-25", end: "2026-09-24" });
    expect(contains(period, "2026-08-25")).toBe(true);
    expect(contains(period, "2026-09-24")).toBe(true);
    expect(contains(period, "2026-09-24T04:04:44.255Z")).toBe(true);
    expect(contains(period, "2026-09-25")).toBe(false);
  });

  it("navigates comparable periods without relying on YYYY-MM", () => {
    const current = { start: "2026-08-25", end: "2026-09-24" };
    expect(previousComparablePeriod(current)).toEqual({ start: "2026-07-25", end: "2026-08-24" });
    expect(nextPeriod(current)).toEqual({ start: "2026-09-25", end: "2026-10-24" });
  });

  it("uses the range when calculating budget usage", () => {
    const usage = budgetUsage([
      { id: "inside", date: "2026-09-24", amount: moneyFromCents(1200), kind: "expense", categoryId: "food", createdAt: "x", updatedAt: "x" },
      { id: "outside", date: "2026-09-25", amount: moneyFromCents(900), kind: "expense", categoryId: "food", createdAt: "x", updatedAt: "x" },
    ], "food", { start: "2026-08-25", end: "2026-09-24" });
    expect(usage).toBe(1200);
  });
});
