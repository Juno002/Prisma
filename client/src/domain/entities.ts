import type { Money } from "./money";

export type AccountKind = "cash" | "bank" | "credit";
export type TransactionKind = "income" | "expense" | "transfer" | "debt-payment" | "investment";
export type CategoryType = "income" | "expense" | "both";
export type ExpenseClassification = "fixed" | "variable" | "occasional";
export type RecurrenceFrequency = "weekly" | "biweekly" | "monthly" | "yearly";
export type PlannedOccurrenceStatus = "pending" | "confirmed" | "skipped" | "overdue";

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  openingBalance: Money;
  archived: boolean;
};

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  icon?: string;
  archived: boolean;
};

export type Transaction = {
  id: string;
  date: string;
  amount: Money;
  kind: TransactionKind;
  accountId?: string;
  destinationAccountId?: string;
  categoryId?: string;
  liabilityAccountId?: string;
  classification?: ExpenseClassification;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type Budget = {
  id: string;
  categoryId: string;
  periodStart: string;
  periodEnd: string;
  amount: Money;
};

export type Goal = {
  id: string;
  name: string;
  targetAmount: Money;
  allocatedAmount: Money;
  targetDate?: string;
  archived: boolean;
};

export type RecurringRule = {
  id: string;
  title: string;
  amount: Money;
  kind: TransactionKind;
  accountId: string;
  destinationAccountId?: string;
  liabilityAccountId?: string;
  categoryId?: string;
  classification?: ExpenseClassification;
  frequency: RecurrenceFrequency;
  startsOn: string;
  endsOn?: string;
  active: boolean;
};

export type PlannedOccurrence = {
  id: string;
  ruleId: string;
  scheduledDate: string;
  status: PlannedOccurrenceStatus;
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type PeriodSettings = {
  startDay: number;
};

export type FinanceState = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  recurringRules: RecurringRule[];
  plannedOccurrences: PlannedOccurrence[];
  periodSettings: PeriodSettings;
};
