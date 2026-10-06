import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createBudget, createGoal, updateGoal } from "@/application/commands";
import { loadFinanceState } from "@/application/finance-service";
import { moneyFromCents } from "@/domain/money";
import { db, importBackup, readState, replaceState } from "@/persistence/db";
import { migrateAndValidateBackup } from "@/persistence/backup-migrations";

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

  it("migrates a v4 backup and rejects future or malformed contracts", () => {
    const migrated = migrateAndValidateBackup({ ...baseState, backupVersion: 4, exportedAt: "2026-10-05T00:00:00.000Z", app: "glitchbudget-pro", moneyUnit: "cents" });
    expect(migrated.backupVersion).toBe(5);
    expect(migrated.recurringRules).toEqual([]);
    expect(migrated.periodSettings.startDay).toBe(1);
    expect(() => migrateAndValidateBackup({ ...baseState, backupVersion: 6, app: "glitchbudget-pro", moneyUnit: "cents" })).toThrow("versión compatible");
    expect(() => migrateAndValidateBackup({ ...baseState, backupVersion: 5, app: "glitchbudget-pro", moneyUnit: "cents", transactions: [{ id: "bad", date: "2026-10-01", amount: 12.5, kind: "expense" }] })).toThrow("entero de centavos");
  });

  it("does not replace local data when import validation fails", async () => {
    await replaceState(baseState);
    const before = await readState();
    await expect(importBackup({ ...baseState, backupVersion: 5, app: "glitchbudget-pro", moneyUnit: "cents", budgets: [{ id: "bad", categoryId: "food", periodStart: "2026-10-01", periodEnd: "2026-10-31", amount: -1 }] })).rejects.toThrow("no negativo");
    expect(await readState()).toEqual(before);
  });
});
