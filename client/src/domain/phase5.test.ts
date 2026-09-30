import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createExpense } from "@/application/commands";
import { isActualExpense, isPlannedIntent, type RecurringRule } from "@/domain/planned";
import { moneyFromCents } from "@/domain/money";
import { db, readState, replaceState } from "@/persistence/db";

describe("Phase 5 · actual versus planned", () => {
  it("keeps fixed, variable, and occasional as classification only", async () => {
    await db.delete();
    await db.open();
    await replaceState({
      accounts: [{ id: "bank", name: "Banco", kind: "bank", openingBalance: moneyFromCents(10000), archived: false }],
      categories: [{ id: "food", name: "Comida", type: "expense", archived: false }],
      transactions: [],
      budgets: [],
      goals: [],
    });
    await createExpense({ id: "expense-1", date: "2026-09-30", amount: 12, accountId: "bank", categoryId: "food", classification: "fixed" });
    const state = await readState();
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].classification).toBe("fixed");
    expect("frequency" in state.transactions[0]).toBe(false);
  });

  it("models a recurring rule as an intention without treating it as a transaction", () => {
    const rule: RecurringRule = {
      id: "rule-rent",
      title: "Alquiler",
      amount: moneyFromCents(160000),
      classification: "fixed",
      frequency: "monthly",
      startsOn: "2026-10-01",
      active: true,
    };
    expect(isPlannedIntent(rule)).toBe(true);
    expect(isActualExpense("recurring-rule")).toBe(false);
  });
});
