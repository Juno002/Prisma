import Dexie, { type Table } from "dexie";
import { stableCategoryId } from "@/domain/categories";
import type { Account, Budget, Category, FinanceState, Goal, PeriodSettings, PlannedOccurrence, RecurringRule, Transaction } from "@/domain/entities";
import { defaultPeriodSettings } from "@/domain/periods";
import { moneyFromCents, moneyFromMajorUnits } from "@/domain/money";

export const BACKUP_VERSION = 5;

export type PersistedState = FinanceState;
export type BackupV4 = Omit<FinanceState, "recurringRules" | "plannedOccurrences" | "periodSettings"> & {
  backupVersion: 4;
  exportedAt: string;
  app: "glitchbudget-pro";
  moneyUnit: "cents";
};
export type BackupV5 = FinanceState & { backupVersion: 5; exportedAt: string; app: "glitchbudget-pro"; moneyUnit: "cents" };

class GlitchBudgetDatabase extends Dexie {
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  budgets!: Table<Budget, string>;
  goals!: Table<Goal, string>;
  recurringRules!: Table<RecurringRule, string>;
  plannedOccurrences!: Table<PlannedOccurrence, string>;
  settings!: Table<{ key: string; value: PeriodSettings }, string>;

  constructor() {
    super("glitchbudget-pro");
    this.version(1).stores({ accounts: "id, kind, archived", categories: "id, type, archived", transactions: "id, date, kind, accountId, categoryId", budgets: "id, categoryId, periodStart, periodEnd", goals: "id, archived" });
    this.version(2).stores({ recurringRules: "id, active, frequency, startsOn", plannedOccurrences: "id, ruleId, scheduledDate, status, [ruleId+scheduledDate]", settings: "key" });
  }
}

export const db = new GlitchBudgetDatabase();

export async function readPeriodSettings(): Promise<PeriodSettings> {
  return (await db.settings.get("period"))?.value ?? defaultPeriodSettings;
}

export async function savePeriodSettings(settings: PeriodSettings): Promise<void> {
  if (!Number.isInteger(settings.startDay) || settings.startDay < 1 || settings.startDay > 31) throw new Error("El inicio del período debe ser un día entre 1 y 31");
  await db.settings.put({ key: "period", value: settings });
}

export async function readState(): Promise<PersistedState> {
  const [accounts, categories, transactions, budgets, goals, recurringRules, plannedOccurrences, periodSettings] = await Promise.all([
    db.accounts.toArray(), db.categories.toArray(), db.transactions.toArray(), db.budgets.toArray(), db.goals.toArray(), db.recurringRules.toArray(), db.plannedOccurrences.toArray(), readPeriodSettings(),
  ]);
  return { accounts, categories, transactions, budgets, goals, recurringRules, plannedOccurrences, periodSettings };
}

export async function replaceState(state: Omit<PersistedState, "recurringRules" | "plannedOccurrences" | "periodSettings"> & Partial<Pick<PersistedState, "recurringRules" | "plannedOccurrences" | "periodSettings">>): Promise<void> {
  const complete: PersistedState = {
    ...state,
    recurringRules: state.recurringRules ?? [],
    plannedOccurrences: state.plannedOccurrences ?? [],
    periodSettings: state.periodSettings ?? defaultPeriodSettings,
  };
  await (db.transaction as any)("rw", db.accounts, db.categories, db.transactions, db.budgets, db.goals, db.recurringRules, db.plannedOccurrences, db.settings, async () => {
    await Promise.all([db.accounts.clear(), db.categories.clear(), db.transactions.clear(), db.budgets.clear(), db.goals.clear(), db.recurringRules.clear(), db.plannedOccurrences.clear(), db.settings.clear()]);
    await Promise.all([db.accounts.bulkAdd(complete.accounts), db.categories.bulkAdd(complete.categories), db.transactions.bulkAdd(complete.transactions), db.budgets.bulkAdd(complete.budgets), db.goals.bulkAdd(complete.goals), db.recurringRules.bulkAdd(complete.recurringRules), db.plannedOccurrences.bulkAdd(complete.plannedOccurrences), db.settings.put({ key: "period", value: complete.periodSettings })]);
  });
}

export async function exportBackup(): Promise<BackupV5> {
  return { ...(await readState()), backupVersion: BACKUP_VERSION, exportedAt: new Date().toISOString(), app: "glitchbudget-pro", moneyUnit: "cents" };
}

function normalizeBackup(input: unknown): PersistedState & { backupVersion: number } {
  if (!input || typeof input !== "object") throw new Error("Backup inválido");
  const candidate = input as Partial<BackupV4> & Partial<BackupV5>;
  if (candidate.app !== "glitchbudget-pro" || ![4, 5].includes(candidate.backupVersion ?? 0) || candidate.moneyUnit !== "cents") throw new Error("Versión de backup no compatible");
  for (const key of ["accounts", "categories", "transactions", "budgets", "goals"] as const) if (!Array.isArray(candidate[key])) throw new Error(`Backup inválido: falta ${key}`);
  return {
    accounts: candidate.accounts!, categories: candidate.categories!, transactions: candidate.transactions!, budgets: candidate.budgets!, goals: candidate.goals!,
    recurringRules: Array.isArray(candidate.recurringRules) ? candidate.recurringRules : [], plannedOccurrences: Array.isArray(candidate.plannedOccurrences) ? candidate.plannedOccurrences : [], periodSettings: candidate.periodSettings ?? defaultPeriodSettings,
    backupVersion: candidate.backupVersion!,
  };
}

export async function importBackup(input: unknown): Promise<BackupV5> {
  const normalized = normalizeBackup(input);
  await replaceState(normalized);
  return { ...(await readState()), backupVersion: BACKUP_VERSION, exportedAt: new Date().toISOString(), app: "glitchbudget-pro", moneyUnit: "cents" };
}

export type LegacyTransaction = { id: string; title: string; category: string; account: string; date: string; amount: number; kind: "Gasto" | "Ingreso" | "Transferencia" };

export function migrateLegacyTransactions(raw: LegacyTransaction[], existingCategories: Category[] = []): PersistedState {
  const accountNames = Array.from(new Set(raw.flatMap((item) => item.account.split(" → "))));
  const accounts: Account[] = accountNames.map((name, index) => ({ id: `legacy-account-${index + 1}`, name, kind: name.toLowerCase().includes("efectivo") ? "cash" : "bank", openingBalance: moneyFromCents(0), archived: false }));
  const categories: Category[] = Array.from(new Set(raw.map((item) => item.category))).map((name) => { const type = name === "Ingreso" ? "income" : "expense"; const existing = existingCategories.find((category) => category.name === name && (category.type === type || category.type === "both")); return existing ?? { id: stableCategoryId(name, type), name, type, archived: false }; });
  const accountIdFor = (name: string) => accounts.find((account) => account.name === name)?.id;
  const categoryIdFor = (name: string) => categories.find((category) => category.name === name)?.id;
  const transactions: Transaction[] = raw.map((item) => { const kind = item.kind === "Ingreso" ? "income" : item.kind === "Transferencia" ? "transfer" : "expense"; const [accountName, destinationName] = item.account.split(" → "); const now = new Date().toISOString(); return { id: item.id, date: item.date.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? now, amount: moneyFromMajorUnits(Math.abs(item.amount)), kind, accountId: accountIdFor(accountName), destinationAccountId: destinationName ? accountIdFor(destinationName) : undefined, categoryId: categoryIdFor(item.category), note: item.title, createdAt: now, updatedAt: now }; });
  return { accounts, categories, transactions, budgets: [], goals: [], recurringRules: [], plannedOccurrences: [], periodSettings: defaultPeriodSettings };
}

export async function migrateLegacyLocalStorage(storage?: Storage): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const source = storage ?? window.localStorage;
  const raw = source.getItem("glitchbudget.transactions"); if (!raw) return false;
  try { const current = await readState(); const incoming = migrateLegacyTransactions(JSON.parse(raw) as LegacyTransaction[], current.categories); const currentTransactionIds = new Set(current.transactions.map((transaction) => transaction.id)); const newTransactions = incoming.transactions.filter((transaction) => !currentTransactionIds.has(transaction.id)); const newAccounts = incoming.accounts.filter((account) => !current.accounts.some((item) => item.id === account.id)); const newCategories = incoming.categories.filter((category) => !current.categories.some((item) => item.id === category.id)); if (!newTransactions.length && !newAccounts.length && !newCategories.length) return false; await db.transaction("rw", db.accounts, db.categories, db.transactions, async () => { await Promise.all([db.accounts.bulkAdd(newAccounts), db.categories.bulkAdd(newCategories), db.transactions.bulkAdd(newTransactions)]); }); return true; } catch { return false; }
}
