import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { archiveAccount, createExpense, createIncome, createTransfer, renameCategory } from "@/application/commands";
import { deriveMetrics } from "@/domain/ledger";
import { moneyFromCents } from "@/domain/money";
import { db, readState, replaceState } from "@/persistence/db";

const state = {
  accounts: [
    { id: "qik", name: "Qik", kind: "bank" as const, openingBalance: moneyFromCents(10000), archived: false },
    { id: "apap", name: "APAP", kind: "bank" as const, openingBalance: moneyFromCents(20000), archived: false },
    { id: "visa", name: "Visa", kind: "credit" as const, openingBalance: moneyFromCents(0), archived: false },
  ],
  categories: [
    { id: "food", name: "Alimentación", type: "expense" as const, archived: false },
    { id: "salary", name: "Ingreso", type: "income" as const, archived: false },
  ],
  transactions: [],
  budgets: [],
  goals: [],
};

beforeEach(async () => {
  await db.delete();
  await db.open();
  await replaceState(state);
});

describe("Phase 3 · shared commands", () => {
  it("applies an income to the selected account, not a hardcoded default", async () => {
    await createIncome({ id: "income-apap", date: "2026-09-28", amount: 125, accountId: "apap", categoryId: "salary", note: "Nómina" });
    const current = await readState();
    expect(current.transactions[0].accountId).toBe("apap");
    expect(deriveMetrics(current).liquidPosition).toBe(42500);
  });

  it("keeps transfers out of spending and cash flow", async () => {
    await createTransfer({ id: "move-qik-apap", date: "2026-09-28", amount: 50, accountId: "qik", destinationAccountId: "apap", note: "Ahorro" });
    const metrics = deriveMetrics(await readState());
    expect(metrics.spending).toBe(0);
    expect(metrics.cashFlow).toBe(0);
    expect(metrics.liquidPosition).toBe(30000);
  });

  it("can independently block a negative account balance", async () => {
    await expect(createExpense({ id: "too-large", date: "2026-09-28", amount: 200, accountId: "qik", categoryId: "food", policies: { preventNegativeAccountBalance: true, budgetOverspendingBehavior: "allow" } })).rejects.toThrow("saldo negativo");
    await expect(createExpense({ id: "allowed", date: "2026-09-28", amount: 200, accountId: "qik", categoryId: "food", policies: { preventNegativeAccountBalance: false, budgetOverspendingBehavior: "block" } })).resolves.toEqual({ id: "allowed" });
  });

  it("can warn or block budget overspending without changing balance policy", async () => {
    await replaceState({ ...state, budgets: [{ id: "food-budget", categoryId: "food", periodStart: "2026-09-01", periodEnd: "2026-09-30", amount: moneyFromCents(1000) }] });
    await expect(createExpense({ id: "warned", date: "2026-09-28", amount: 20, accountId: "qik", categoryId: "food", policies: { preventNegativeAccountBalance: false, budgetOverspendingBehavior: "warn" } })).resolves.toEqual({ id: "warned", warnings: ["Este movimiento supera el presupuesto de la categoría"] });
    await expect(createExpense({ id: "blocked", date: "2026-09-28", amount: 20, accountId: "qik", categoryId: "food", policies: { preventNegativeAccountBalance: false, budgetOverspendingBehavior: "block" } })).rejects.toThrow("supera el presupuesto");
  });

  it("archives accounts and renames categories without changing identity", async () => {
    await archiveAccount("qik");
    await renameCategory("food", "Comida");
    const current = await readState();
    expect(current.accounts.find((account) => account.id === "qik")?.archived).toBe(true);
    expect(current.categories.find((category) => category.id === "food")?.name).toBe("Comida");
    expect(current.categories.find((category) => category.id === "food")?.id).toBe("food");
  });
});
