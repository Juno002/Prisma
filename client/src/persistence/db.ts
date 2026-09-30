import Dexie, { type Table } from "dexie";
import { stableCategoryId } from "@/domain/categories";
import type { Account, Budget, Category, Goal, Transaction } from "@/domain/entities";
import { moneyFromCents, moneyFromMajorUnits } from "@/domain/money";

export const BACKUP_VERSION = 4;

export type PersistedState = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
};

export type BackupV4 = PersistedState & {
  backupVersion: 4;
  exportedAt: string;
  app: "glitchbudget-pro";
  moneyUnit: "cents";
};

class GlitchBudgetDatabase extends Dexie {
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  budgets!: Table<Budget, string>;
  goals!: Table<Goal, string>;

  constructor() {
    super("glitchbudget-pro");
    this.version(1).stores({
      accounts: "id, kind, archived",
      categories: "id, type, archived",
      transactions: "id, date, kind, accountId, categoryId",
      budgets: "id, categoryId, periodStart, periodEnd",
      goals: "id, archived",
    });
  }
}

export const db = new GlitchBudgetDatabase();

export async function readState(): Promise<PersistedState> {
  const [accounts, categories, transactions, budgets, goals] = await Promise.all([
    db.accounts.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.goals.toArray(),
  ]);
  return { accounts, categories, transactions, budgets, goals };
}

export async function replaceState(state: PersistedState): Promise<void> {
  await db.transaction("rw", db.accounts, db.categories, db.transactions, db.budgets, db.goals, async () => {
    await Promise.all([
      db.accounts.clear(),
      db.categories.clear(),
      db.transactions.clear(),
      db.budgets.clear(),
      db.goals.clear(),
    ]);
    await Promise.all([
      db.accounts.bulkAdd(state.accounts),
      db.categories.bulkAdd(state.categories),
      db.transactions.bulkAdd(state.transactions),
      db.budgets.bulkAdd(state.budgets),
      db.goals.bulkAdd(state.goals),
    ]);
  });
}

export async function exportBackup(): Promise<BackupV4> {
  return {
    ...(await readState()),
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: "glitchbudget-pro",
    moneyUnit: "cents",
  };
}

function validateBackup(input: unknown): asserts input is BackupV4 {
  if (!input || typeof input !== "object") throw new Error("Backup inválido");
  const candidate = input as Partial<BackupV4>;
  if (candidate.app !== "glitchbudget-pro" || candidate.backupVersion !== 4 || candidate.moneyUnit !== "cents") {
    throw new Error("Versión de backup no compatible");
  }
  for (const key of ["accounts", "categories", "transactions", "budgets", "goals"] as const) {
    if (!Array.isArray(candidate[key])) throw new Error(`Backup inválido: falta ${key}`);
  }
}

export async function importBackup(input: unknown): Promise<BackupV4> {
  validateBackup(input);
  const backup = structuredClone(input);
  await replaceState(backup);
  return backup;
}

export type LegacyTransaction = {
  id: string;
  title: string;
  category: string;
  account: string;
  date: string;
  amount: number;
  kind: "Gasto" | "Ingreso" | "Transferencia";
};

export function migrateLegacyTransactions(raw: LegacyTransaction[], existingCategories: Category[] = []): PersistedState {
  const accountNames = Array.from(new Set(raw.flatMap((item) => item.account.split(" → "))));
  const accounts: Account[] = accountNames.map((name, index) => ({
    id: `legacy-account-${index + 1}`,
    name,
    kind: name.toLowerCase().includes("efectivo") ? "cash" : "bank",
    openingBalance: moneyFromCents(0),
    archived: false,
  }));
  const categories: Category[] = Array.from(new Set(raw.map((item) => item.category))).map((name) => {
    const type = name === "Ingreso" ? "income" : "expense";
    const existing = existingCategories.find((category) => category.name === name && (category.type === type || category.type === "both"));
    return existing ?? { id: stableCategoryId(name, type), name, type, archived: false };
  });
  const accountIdFor = (name: string) => accounts.find((account) => account.name === name)?.id;
  const categoryIdFor = (name: string) => categories.find((category) => category.name === name)?.id;
  const transactions: Transaction[] = raw.map((item) => {
    const kind = item.kind === "Ingreso" ? "income" : item.kind === "Transferencia" ? "transfer" : "expense";
    const [accountName, destinationName] = item.account.split(" → ");
    return {
      id: item.id,
      date: new Date().toISOString(),
      amount: moneyFromMajorUnits(Math.abs(item.amount)),
      kind,
      accountId: accountIdFor(accountName),
      destinationAccountId: destinationName ? accountIdFor(destinationName) : undefined,
      categoryId: categoryIdFor(item.category),
      note: item.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
  return { accounts, categories, transactions, budgets: [], goals: [] };
}

export async function migrateLegacyLocalStorage(storage: Storage = window.localStorage): Promise<boolean> {
  const raw = storage.getItem("glitchbudget.transactions");
  if (!raw) return false;
  try {
    const current = await readState();
    const incoming = migrateLegacyTransactions(JSON.parse(raw) as LegacyTransaction[], current.categories);
    const currentTransactionIds = new Set(current.transactions.map((transaction) => transaction.id));
    const newTransactions = incoming.transactions.filter((transaction) => !currentTransactionIds.has(transaction.id));
    const newAccounts = incoming.accounts.filter((account) => !current.accounts.some((item) => item.id === account.id));
    const newCategories = incoming.categories.filter((category) => !current.categories.some((item) => item.id === category.id));
    if (newTransactions.length === 0 && newAccounts.length === 0 && newCategories.length === 0) return false;
    await db.transaction("rw", db.accounts, db.categories, db.transactions, async () => {
      await Promise.all([
        db.accounts.bulkAdd(newAccounts),
        db.categories.bulkAdd(newCategories),
        db.transactions.bulkAdd(newTransactions),
      ]);
    });
    return true;
  } catch {
    return false;
  }
}
