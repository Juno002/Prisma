export type BudgetOverspendingBehavior = "allow" | "warn" | "block";

export type LedgerPolicies = {
  preventNegativeAccountBalance: boolean;
  budgetOverspendingBehavior: BudgetOverspendingBehavior;
};

export const defaultLedgerPolicies: LedgerPolicies = {
  preventNegativeAccountBalance: false,
  budgetOverspendingBehavior: "warn",
};
