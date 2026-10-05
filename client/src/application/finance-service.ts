import { stableCategoryId } from "@/domain/categories";
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
import { moneyFromCents } from "@/domain/money";

export async function loadFinanceState(seed: LegacyTransaction[]): Promise<PersistedState> {
  await migrateLegacyLocalStorage();
  await ensureStarterCatalog();
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

async function ensureStarterCatalog(): Promise<void> {
  const [accounts, categories] = await Promise.all([db.accounts.toArray(), db.categories.toArray()]);
  const starterCategories = [
    { name: "Alimentación", type: "expense" as const },
    { name: "Transporte", type: "expense" as const },
    { name: "Vivienda", type: "expense" as const },
    { name: "Otros", type: "expense" as const },
    { name: "Ingreso", type: "income" as const },
  ];
  const missingCategories = starterCategories
    .filter((candidate) => !categories.some((category) => category.name === candidate.name && category.type === candidate.type))
    .map((candidate) => ({ id: stableCategoryId(candidate.name, candidate.type), ...candidate, archived: false }));
  const missingAccount = accounts.length === 0
    ? [{ id: "account-cash-default", name: "Efectivo", kind: "cash" as const, openingBalance: moneyFromCents(0), archived: false }]
    : [];
  if (!missingCategories.length && !missingAccount.length) return;
  await db.transaction("rw", db.accounts, db.categories, async () => {
    if (missingAccount.length) await db.accounts.bulkAdd(missingAccount);
    if (missingCategories.length) await db.categories.bulkAdd(missingCategories);
  });
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
