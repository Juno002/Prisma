import type { BackupV4 } from "@/persistence/db";
import { moneyFromCents } from "@/domain/money";

export const backupV4Fixture: BackupV4 = {
  app: "glitchbudget-pro",
  backupVersion: 4,
  exportedAt: "2026-09-26T12:00:00.000Z",
  moneyUnit: "cents",
  accounts: [
    { id: "account-qik", name: "Qik", kind: "bank", openingBalance: moneyFromCents(2435000), archived: false },
    { id: "account-apap", name: "APAP", kind: "bank", openingBalance: moneyFromCents(5000000), archived: false },
    { id: "account-visa", name: "Visa 2048", kind: "credit", openingBalance: moneyFromCents(-1837000), archived: false },
  ],
  categories: [
    { id: "category-food", name: "Alimentación", type: "expense", archived: false },
    { id: "category-income", name: "Ingreso", type: "income", archived: false },
  ],
  transactions: [
    {
      id: "transaction-grocery",
      date: "2026-09-26",
      amount: moneyFromCents(184000),
      kind: "expense",
      accountId: "account-qik",
      categoryId: "category-food",
      note: "Supermercado Nacional",
      createdAt: "2026-09-26T14:42:00.000Z",
      updatedAt: "2026-09-26T14:42:00.000Z",
    },
    {
      id: "transaction-payroll",
      date: "2026-09-25",
      amount: moneyFromCents(5200000),
      kind: "income",
      accountId: "account-apap",
      categoryId: "category-income",
      note: "Nómina · Septiembre",
      createdAt: "2026-09-25T12:00:00.000Z",
      updatedAt: "2026-09-25T12:00:00.000Z",
    },
  ],
  budgets: [],
  goals: [],
};
