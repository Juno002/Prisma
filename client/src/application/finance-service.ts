import type { FinanceState } from "@/domain/entities";
import { generateOccurrences } from "@/domain/planned";
import {
  db,
  migrateLegacyLocalStorage,
  migrateLegacyTransactions,
  readState,
  type LegacyTransaction,
  type PersistedState,
} from "@/persistence/db";
import { periodContaining } from "@/domain/periods";

export async function loadFinanceState(seed: LegacyTransaction[]): Promise<PersistedState> {
  await migrateLegacyLocalStorage();
  const current = await readState();
  if (current.transactions.length > 0 || current.accounts.length > 0 || current.recurringRules.length > 0) {
    await ensureUpcomingOccurrences(current);
    return readState();
  }
  const initial = migrateLegacyTransactions(seed);
  await db.transaction("rw", db.accounts, db.categories, db.transactions, db.budgets, db.goals, async () => {
    await Promise.all([db.accounts.bulkAdd(initial.accounts), db.categories.bulkAdd(initial.categories), db.transactions.bulkAdd(initial.transactions), db.budgets.bulkAdd(initial.budgets), db.goals.bulkAdd(initial.goals)]);
  });
  await ensureUpcomingOccurrences(await readState());
  return readState();
}

export async function ensureUpcomingOccurrences(state: PersistedState, today = new Date().toISOString().slice(0, 10)): Promise<void> {
  const current = periodContaining(today, state.periodSettings);
  const horizon = new Date(`${current.end}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 90);
  const end = horizon.toISOString().slice(0, 10);
  const additions = generateOccurrences(state.recurringRules, state.plannedOccurrences, current.start, end);
  if (additions.length) await db.plannedOccurrences.bulkAdd(additions);
}

export async function reloadFinanceState(): Promise<FinanceState> {
  return readState();
}
