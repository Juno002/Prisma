import type { FinanceState, TransactionKind } from "@/domain/entities";
import { moneyFromMajorUnits } from "@/domain/money";
import {
  db,
  migrateLegacyLocalStorage,
  migrateLegacyTransactions,
  readState,
  type LegacyTransaction,
  type PersistedState,
} from "@/persistence/db";

export type CreateTransactionInput = {
  id: string;
  date: string;
  amount: number;
  kind: TransactionKind;
  accountId?: string;
  destinationAccountId?: string;
  categoryId?: string;
  note?: string;
};

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

export async function createTransaction(input: CreateTransactionInput): Promise<void> {
  const now = new Date().toISOString();
  await db.transactions.add({
    id: input.id,
    date: input.date,
    amount: moneyFromMajorUnits(Math.abs(input.amount)),
    kind: input.kind,
    accountId: input.accountId,
    destinationAccountId: input.destinationAccountId,
    categoryId: input.categoryId,
    note: input.note,
    createdAt: now,
    updatedAt: now,
  });
}

export async function reloadFinanceState(): Promise<FinanceState> {
  return readState();
}
