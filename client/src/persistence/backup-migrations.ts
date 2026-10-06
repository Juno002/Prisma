import type { BackupV5 } from "./db";
import { defaultPeriodSettings } from "@/domain/periods";

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`Backup inválido: ${label} debe ser un objeto.`);
  return value;
};
const requireArray = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`Backup inválido: falta ${label}.`);
  return value;
};
const requireString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Backup inválido: ${label} debe ser texto.`);
  return value;
};
const requireMoney = (value: unknown, label: string): void => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`Backup inválido: ${label} debe ser un entero de centavos no negativo.`);
};
const requireBalance = (value: unknown, label: string): void => {
  if (!Number.isSafeInteger(value)) throw new Error(`Backup inválido: ${label} debe ser un entero de centavos.`);
};
const requireDate = (value: unknown, label: string): void => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) throw new Error(`Backup inválido: ${label} debe ser una fecha ISO.`);
};

function validateRows(state: Record<string, unknown>): void {
  requireArray(state.accounts, "accounts").forEach((row, index) => {
    const item = requireRecord(row, `accounts[${index}]`);
    requireString(item.id, `accounts[${index}].id`); requireString(item.name, `accounts[${index}].name`); requireBalance(item.openingBalance, `accounts[${index}].openingBalance`);
    if (!["cash", "bank", "credit"].includes(String(item.kind))) throw new Error(`Backup inválido: accounts[${index}].kind no reconocido.`);
  });
  requireArray(state.categories, "categories").forEach((row, index) => {
    const item = requireRecord(row, `categories[${index}]`); requireString(item.id, `categories[${index}].id`); requireString(item.name, `categories[${index}].name`);
    if (!["income", "expense", "both"].includes(String(item.type))) throw new Error(`Backup inválido: categories[${index}].type no reconocido.`);
  });
  requireArray(state.transactions, "transactions").forEach((row, index) => {
    const item = requireRecord(row, `transactions[${index}]`); requireString(item.id, `transactions[${index}].id`); requireDate(item.date, `transactions[${index}].date`); requireMoney(item.amount, `transactions[${index}].amount`);
    if (!["income", "expense", "transfer", "debt-payment", "investment"].includes(String(item.kind))) throw new Error(`Backup inválido: transactions[${index}].kind no reconocido.`);
  });
  requireArray(state.budgets, "budgets").forEach((row, index) => {
    const item = requireRecord(row, `budgets[${index}]`); requireString(item.id, `budgets[${index}].id`); requireString(item.categoryId, `budgets[${index}].categoryId`); requireDate(item.periodStart, `budgets[${index}].periodStart`); requireDate(item.periodEnd, `budgets[${index}].periodEnd`); requireMoney(item.amount, `budgets[${index}].amount`);
  });
  requireArray(state.goals, "goals").forEach((row, index) => {
    const item = requireRecord(row, `goals[${index}]`); requireString(item.id, `goals[${index}].id`); requireString(item.name, `goals[${index}].name`); requireMoney(item.targetAmount, `goals[${index}].targetAmount`); requireMoney(item.allocatedAmount, `goals[${index}].allocatedAmount`);
    if (Number(item.allocatedAmount) > Number(item.targetAmount)) throw new Error(`Backup inválido: goals[${index}] asigna más que su objetivo.`);
  });
  requireArray(state.recurringRules, "recurringRules").forEach((row, index) => {
    const item = requireRecord(row, `recurringRules[${index}]`); requireString(item.id, `recurringRules[${index}].id`); requireString(item.title, `recurringRules[${index}].title`); requireString(item.accountId, `recurringRules[${index}].accountId`); requireDate(item.startsOn, `recurringRules[${index}].startsOn`); requireMoney(item.amount, `recurringRules[${index}].amount`);
  });
  requireArray(state.plannedOccurrences, "plannedOccurrences").forEach((row, index) => {
    const item = requireRecord(row, `plannedOccurrences[${index}]`); requireString(item.id, `plannedOccurrences[${index}].id`); requireString(item.ruleId, `plannedOccurrences[${index}].ruleId`); requireDate(item.scheduledDate, `plannedOccurrences[${index}].scheduledDate`);
    if (!["pending", "confirmed", "skipped", "overdue"].includes(String(item.status))) throw new Error(`Backup inválido: plannedOccurrences[${index}].status no reconocido.`);
  });
  const settings = requireRecord(state.periodSettings, "periodSettings");
  if (!Number.isInteger(settings.startDay) || Number(settings.startDay) < 1 || Number(settings.startDay) > 31) throw new Error("Backup inválido: periodSettings.startDay fuera de rango.");
}

/** Migrates supported backup versions to the current contract before replacing local data. */
export function migrateAndValidateBackup(input: unknown): BackupV5 {
  const source = requireRecord(input, "raíz");
  if (source.app !== "glitchbudget-pro" || source.moneyUnit !== "cents") throw new Error("Versión de backup no compatible.");
  if (source.backupVersion !== 4 && source.backupVersion !== 5) throw new Error("Esta copia requiere una versión compatible de Prisma.");
  const migrated = {
    ...source,
    backupVersion: 5 as const,
    recurringRules: Array.isArray(source.recurringRules) ? source.recurringRules : [],
    plannedOccurrences: Array.isArray(source.plannedOccurrences) ? source.plannedOccurrences : [],
    periodSettings: source.periodSettings ?? defaultPeriodSettings,
  };
  validateRows(migrated);
  return migrated as unknown as BackupV5;
}
