import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createBudget, createGoal, updateGoal } from "@/application/commands";
import { loadFinanceState } from "@/application/finance-service";
import { moneyFromCents } from "@/domain/money";
import { db, readState, replaceState } from "@/persistence/db";

const baseState = {
  accounts: [{ id: "bank", name: "Banco", kind: "bank" as const, openingBalance: moneyFromCents(100000), archived: false }],
  categories: [{ id: "food", name: "Alimentación", type: "expense" as const, archived: false }],
  transactions: [],
  budgets: [],
  goals: [],
};

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("Phase 8 · local product surfaces", () => {
  it("starts with a usable local account and category catalog, without fake transactions", async () => {
    const state = await loadFinanceState([]);
    expect(state.accounts.map((account) => account.name)).toContain("Efectivo");
    expect(state.categories.map((category) => category.name)).toContain("Alimentación");
    expect(state.transactions).toHaveLength(0);
  });

  it("persists a budget and validates a goal update", async () => {
    await replaceState(baseState);
    await createBudget({ id: "budget-food", categoryId: "food", periodStart: "2026-10-01", periodEnd: "2026-10-31", amount: moneyFromCents(30000) });
    const goal = await createGoal({ id: "goal-trip", name: "Viaje", targetAmount: moneyFromCents(100000), allocatedAmount: moneyFromCents(25000) });
    await updateGoal(goal.id, { allocatedAmount: moneyFromCents(40000) });
    const state = await readState();
    expect(state.budgets[0].amount).toBe(30000);
    expect(state.goals[0].allocatedAmount).toBe(40000);
  });
});
