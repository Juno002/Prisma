import type { CategoryType, ExpenseClassification } from "./entities";
import type { Money } from "./money";

/** A future intention; it never changes balances until explicitly confirmed. */
export type RecurringRule = {
  id: string;
  title: string;
  amount: Money;
  categoryId?: string;
  accountId?: string;
  categoryType?: CategoryType;
  classification: ExpenseClassification;
  frequency: "weekly" | "biweekly" | "monthly" | "yearly";
  startsOn: string;
  active: boolean;
};

export function isActualExpense(kind: string): kind is "expense" {
  return kind === "expense";
}

export function isPlannedIntent(value: unknown): value is RecurringRule {
  return Boolean(value && typeof value === "object" && "frequency" in value && "startsOn" in value && "active" in value);
}
