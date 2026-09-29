import { describe, expect, it } from "vitest";
import { deriveMetrics } from "@/domain/ledger";
import { moneyFromCents } from "@/domain/money";

describe("Phase 2 · canonical ledger", () => {
  it("keeps a credit purchase as spending and liability, not cash movement", () => {
    const state = {
      accounts: [
        { id: "bank", name: "Cuenta", kind: "bank" as const, openingBalance: moneyFromCents(100000), archived: false },
        { id: "visa", name: "Visa", kind: "credit" as const, openingBalance: moneyFromCents(-20000), archived: false },
      ],
      categories: [],
      transactions: [
        { id: "purchase", date: "2026-09-01", amount: moneyFromCents(5000), kind: "expense" as const, accountId: "visa", createdAt: "x", updatedAt: "x" },
      ],
      budgets: [],
      goals: [],
    };
    const metrics = deriveMetrics(state);
    expect(metrics.liquidPosition).toBe(100000);
    expect(metrics.spending).toBe(5000);
    expect(metrics.netWorth).toBe(75000);
  });

  it("reduces cash and liability together when a debt payment is recorded", () => {
    const state = {
      accounts: [
        { id: "bank", name: "Cuenta", kind: "bank" as const, openingBalance: moneyFromCents(100000), archived: false },
        { id: "visa", name: "Visa", kind: "credit" as const, openingBalance: moneyFromCents(-25000), archived: false },
      ],
      categories: [],
      transactions: [
        { id: "payment", date: "2026-09-02", amount: moneyFromCents(5000), kind: "debt-payment" as const, accountId: "bank", liabilityAccountId: "visa", createdAt: "x", updatedAt: "x" },
      ],
      budgets: [],
      goals: [],
    };
    const metrics = deriveMetrics(state);
    expect(metrics.liquidPosition).toBe(95000);
    expect(metrics.spending).toBe(0);
    expect(metrics.cashFlow).toBe(-5000);
    expect(metrics.netWorth).toBe(75000);
  });
});
