import type { Account, AccountKind, Budget, Category, CategoryType, ExpenseClassification, FinanceState, Goal, Transaction, TransactionKind } from "@/domain/entities";
import { stableCategoryId } from "@/domain/categories";
import { accountBalance } from "@/domain/ledger";
import { defaultLedgerPolicies, type LedgerPolicies } from "@/domain/policies";
import { moneyFromCents, moneyFromMajorUnits } from "@/domain/money";
import { contains } from "@/domain/periods";
import { db, readState } from "@/persistence/db";

export type CommandResult = { id: string; warnings?: string[] };

export type TransactionInput = {
  id?: string;
  date: string;
  amount: number;
  accountId: string;
  destinationAccountId?: string;
  liabilityAccountId?: string;
  categoryId?: string;
  classification?: ExpenseClassification;
  note?: string;
  policies?: LedgerPolicies;
};

export type AccountInput = {
  id?: string;
  name: string;
  kind: AccountKind;
  openingBalance?: number;
};

export type CategoryInput = {
  id?: string;
  name: string;
  type: CategoryType;
};

function assertPositiveAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("El monto debe ser mayor que cero");
}

function assertDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
    throw new Error("La fecha no es válida");
  }
}

async function requireAccount(id: string, state?: FinanceState): Promise<Account> {
  const currentState = state ?? (await readState());
  const account = currentState.accounts.find((item) => item.id === id && !item.archived);
  if (!account) throw new Error("La cuenta seleccionada no existe o está archivada");
  return account;
}

async function requireDistinctAccount(sourceId: string, destinationId: string) {
  if (sourceId === destinationId) throw new Error("Una transferencia necesita dos cuentas distintas");
  const state = await readState();
  return { source: await requireAccount(sourceId, state), destination: await requireAccount(destinationId, state), state };
}

function assertCanGoNegative(account: Account, amountInCents: number, transactions: Transaction[], policies: LedgerPolicies) {
  if (!policies.preventNegativeAccountBalance) return;
  const nextBalance = accountBalance(account, transactions) - amountInCents;
  if (nextBalance < 0) throw new Error(`La operación dejaría ${account.name} con saldo negativo`);
}

function budgetWarning(input: TransactionInput, state: FinanceState, amountInCents: number, policies: LedgerPolicies) {
  if (!input.categoryId || policies.budgetOverspendingBehavior === "allow") return undefined;
  const budget = state.budgets.find((item) => item.categoryId === input.categoryId && contains({ start: item.periodStart, end: item.periodEnd }, input.date));
  if (!budget) return undefined;
  const spent = state.transactions
    .filter((transaction) => transaction.kind === "expense" && transaction.categoryId === input.categoryId && contains({ start: budget.periodStart, end: budget.periodEnd }, transaction.date))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  if (spent + amountInCents <= budget.amount) return undefined;
  const warning = "Este movimiento supera el presupuesto de la categoría";
  if (policies.budgetOverspendingBehavior === "block") throw new Error(warning);
  return warning;
}

async function addTransaction(kind: TransactionKind, input: TransactionInput): Promise<CommandResult> {
  assertPositiveAmount(input.amount);
  assertDate(input.date);
  const state = await readState();
  const account = await requireAccount(input.accountId, state);
  const policies = input.policies ?? defaultLedgerPolicies;
  const amount = moneyFromMajorUnits(input.amount);
  const outgoing = kind === "expense" || kind === "debt-payment" || kind === "investment";
  if (outgoing && account.kind !== "credit") assertCanGoNegative(account, amount, state.transactions, policies);
  const warning = kind === "expense" ? budgetWarning(input, state, amount, policies) : undefined;
  if (input.destinationAccountId) await requireAccount(input.destinationAccountId, state);
  if (input.liabilityAccountId) await requireAccount(input.liabilityAccountId, state);
  const id = input.id ?? `tx-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const transaction: Transaction = {
    id,
    date: input.date,
    amount,
    kind,
    accountId: input.accountId,
    destinationAccountId: input.destinationAccountId,
    liabilityAccountId: input.liabilityAccountId,
    categoryId: input.categoryId,
    classification: input.classification,
    note: input.note,
    createdAt: now,
    updatedAt: now,
  };
  await db.transactions.add(transaction);
  return warning ? { id, warnings: [warning] } : { id };
}

export function createIncome(input: TransactionInput) {
  return addTransaction("income", input);
}

export function createExpense(input: TransactionInput) {
  return addTransaction("expense", input);
}

export async function createTransfer(input: TransactionInput): Promise<CommandResult> {
  if (!input.destinationAccountId) throw new Error("Una transferencia necesita una cuenta destino");
  const { source } = await requireDistinctAccount(input.accountId, input.destinationAccountId);
  const state = await readState();
  const policies = input.policies ?? defaultLedgerPolicies;
  const amount = moneyFromMajorUnits(input.amount);
  assertPositiveAmount(input.amount);
  assertDate(input.date);
  if (source.kind !== "credit") assertCanGoNegative(source, amount, state.transactions, policies);
  return addTransaction("transfer", input);
}

export async function createDebtPayment(input: TransactionInput): Promise<CommandResult> {
  if (!input.liabilityAccountId) throw new Error("Un pago de deuda necesita un pasivo destino");
  const liability = await requireAccount(input.liabilityAccountId);
  if (liability.kind !== "credit") throw new Error("El pasivo destino debe ser una tarjeta o cuenta de crédito");
  return addTransaction("debt-payment", input);
}

export async function updateTransaction(id: string, patch: Partial<Omit<Transaction, "id" | "createdAt" | "updatedAt">>): Promise<CommandResult> {
  const current = await db.transactions.get(id);
  if (!current) throw new Error("El movimiento no existe");
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  if (next.amount <= 0 || !Number.isInteger(next.amount)) throw new Error("El importe almacenado debe ser entero y positivo");
  await db.transactions.put(next);
  return { id };
}

export async function deleteTransaction(id: string): Promise<CommandResult> {
  const current = await db.transactions.get(id);
  if (!current) throw new Error("El movimiento no existe");
  await db.transactions.delete(id);
  return { id };
}

export async function createAccount(input: AccountInput): Promise<CommandResult> {
  if (!input.name.trim()) throw new Error("La cuenta necesita un nombre");
  const id = input.id ?? `account-${crypto.randomUUID()}`;
  await db.accounts.add({ id, name: input.name.trim(), kind: input.kind, openingBalance: moneyFromMajorUnits(input.openingBalance ?? 0), archived: false });
  return { id };
}

export async function archiveAccount(id: string): Promise<CommandResult> {
  const account = await db.accounts.get(id);
  if (!account) throw new Error("La cuenta no existe");
  await db.accounts.put({ ...account, archived: true });
  return { id };
}

export async function archiveCategory(id: string): Promise<CommandResult> {
  const category = await db.categories.get(id);
  if (!category) throw new Error("La categoría no existe");
  await db.categories.put({ ...category, archived: true });
  return { id };
}

export async function createCategory(input: CategoryInput): Promise<CommandResult> {
  const name = input.name.trim();
  if (!name) throw new Error("La categoría necesita un nombre");
  const id = input.id ?? stableCategoryId(name, input.type);
  const existing = await db.categories.get(id);
  if (existing) return { id };
  await db.categories.add({ id, name, type: input.type, archived: false });
  return { id };
}

export async function renameCategory(id: string, name: string): Promise<CommandResult> {
  const category: Category | undefined = await db.categories.get(id);
  if (!category) throw new Error("La categoría no existe");
  if (!name.trim()) throw new Error("La categoría necesita un nombre");
  await db.categories.put({ ...category, name: name.trim() });
  return { id };
}

export type BudgetInput = Omit<Budget, "id"> & { id?: string };

export async function createBudget(input: BudgetInput): Promise<CommandResult> {
  if (!input.categoryId || !input.periodStart || !input.periodEnd || !Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("El presupuesto necesita categoría, período y un monto positivo");
  }
  assertDate(input.periodStart);
  assertDate(input.periodEnd);
  if (input.periodStart > input.periodEnd) throw new Error("El período del presupuesto no es válido");
  const category = await db.categories.get(input.categoryId);
  if (!category || category.archived) throw new Error("La categoría seleccionada no existe o está archivada");
  const id = input.id ?? `budget-${crypto.randomUUID()}`;
  await db.budgets.put({ ...input, id });
  return { id };
}

export async function deleteBudget(id: string): Promise<CommandResult> {
  if (!(await db.budgets.get(id))) throw new Error("El presupuesto no existe");
  await db.budgets.delete(id);
  return { id };
}

export type GoalInput = Omit<Goal, "id" | "allocatedAmount" | "archived"> & { id?: string; allocatedAmount?: Goal["allocatedAmount"] };

export async function createGoal(input: GoalInput): Promise<CommandResult> {
  if (!input.name.trim() || !Number.isInteger(input.targetAmount) || input.targetAmount <= 0) throw new Error("La meta necesita nombre y objetivo positivo");
  if (input.targetDate) assertDate(input.targetDate);
  const allocatedAmount = input.allocatedAmount ?? moneyFromCents(0);
  if (!Number.isInteger(allocatedAmount) || allocatedAmount < 0 || allocatedAmount > input.targetAmount) throw new Error("La asignación de la meta no es válida");
  const id = input.id ?? `goal-${crypto.randomUUID()}`;
  await db.goals.add({ id, name: input.name.trim(), targetAmount: input.targetAmount, allocatedAmount, targetDate: input.targetDate, archived: false });
  return { id };
}

export async function updateGoal(id: string, patch: Partial<Pick<Goal, "name" | "targetAmount" | "allocatedAmount" | "targetDate">>): Promise<CommandResult> {
  const goal = await db.goals.get(id);
  if (!goal) throw new Error("La meta no existe");
  const next = { ...goal, ...patch };
  if (!next.name.trim() || !Number.isInteger(next.targetAmount) || next.targetAmount <= 0 || !Number.isInteger(next.allocatedAmount) || next.allocatedAmount < 0 || next.allocatedAmount > next.targetAmount) throw new Error("Los datos de la meta no son válidos");
  if (next.targetDate) assertDate(next.targetDate);
  await db.goals.put(next);
  return { id };
}

export async function archiveGoal(id: string): Promise<CommandResult> {
  const goal = await db.goals.get(id);
  if (!goal) throw new Error("La meta no existe");
  await db.goals.put({ ...goal, archived: true });
  return { id };
}
