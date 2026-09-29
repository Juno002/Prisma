import type { FinanceState } from "@/domain/entities";
import {
  db,
  migrateLegacyLocalStorage,
  migrateLegacyTransactions,
  readState,
  type LegacyTransaction,
  type PersistedState,
} from "@/persistence/db";

export async function loadFinanceState(seed: LegacyTransaction[]): Promise<PersistedState> {
  await migrateLegacyLocalStorage();
  const current = await readState();
  if (current.transactions.length > 0) return current;
  const initial = migrateLegacyTransactions(seed);
  await db.transaction("rw", db.accounts, db.categories, db.transactions, db.budgets, db.goals, async () => {
    await Promise.all([
      db.accounts.bulkAdd(initial.accounts),
      db.categories.bulkAdd(initial.categories),
      db.transactions.bulkAdd(initial.transactions),
      db.budgets.bulkAdd(initial.budgets),
      db.goals.bulkAdd(initial.goals),
    ]);
  });
  return readState();
}

export async function reloadFinanceState(): Promise<FinanceState> {
  return readState();
}
