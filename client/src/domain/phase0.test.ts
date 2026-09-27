import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { backupV4Fixture } from "@/fixtures/backup-v4";
import { deriveMetrics } from "@/domain/ledger";
import { moneyFromCents, moneyFromMajorUnits } from "@/domain/money";
import { db, exportBackup, importBackup, migrateLegacyTransactions, readState, replaceState } from "@/persistence/db";

describe("Phase 0 · money", () => {
  it("stores money as integer cents, never floating point units", () => {
    expect(moneyFromMajorUnits(18.4)).toBe(1840);
    expect(Number.isInteger(moneyFromMajorUnits(18.4))).toBe(true);
    expect(() => moneyFromCents(18.4)).toThrow();
  });
});

describe("Phase 0 · ledger invariants", () => {
  it("keeps transfers out of spending and cash flow", () => {
    const state = {
      accounts: [
        { id: "bank-a", name: "A", kind: "bank" as const, openingBalance: moneyFromCents(100000), archived: false },
        { id: "bank-b", name: "B", kind: "bank" as const, openingBalance: moneyFromCents(0), archived: false },
      ],
      categories: [],
      transactions: [
        { id: "income", date: "2026-09-01", amount: moneyFromCents(50000), kind: "income" as const, accountId: "bank-a", createdAt: "x", updatedAt: "x" },
        { id: "expense", date: "2026-09-02", amount: moneyFromCents(10000), kind: "expense" as const, accountId: "bank-a", createdAt: "x", updatedAt: "x" },
        { id: "transfer", date: "2026-09-03", amount: moneyFromCents(25000), kind: "transfer" as const, accountId: "bank-a", destinationAccountId: "bank-b", createdAt: "x", updatedAt: "x" },
      ],
      budgets: [],
      goals: [],
    };
    const metrics = deriveMetrics(state);
    expect(metrics.liquidPosition).toBe(140000);
    expect(metrics.spending).toBe(10000);
    expect(metrics.cashFlow).toBe(40000);
  });
});

describe("Phase 0 · compatibility and backup", () => {
  it("migrates legacy visible amounts into cents without losing records", () => {
    const migrated = migrateLegacyTransactions([
      { id: "legacy-1", title: "Café", category: "Otros", account: "Qik", date: "Hoy", amount: -18.4, kind: "Gasto" },
    ]);
    expect(migrated.transactions).toHaveLength(1);
    expect(migrated.transactions[0].amount).toBe(1840);
    expect(migrated.transactions[0].note).toBe("Café");
  });

  it("round-trips backup v4 with the same data and derived metrics", async () => {
    await db.delete();
    await db.open();
    await replaceState(backupV4Fixture);
    const before = await readState();
    const beforeMetrics = deriveMetrics(before);
    const backup = await exportBackup();
    await db.delete();
    await db.open();
    await importBackup(backup);
    const after = await readState();
    expect(after).toEqual(before);
    expect(deriveMetrics(after)).toEqual(beforeMetrics);
  });
});
