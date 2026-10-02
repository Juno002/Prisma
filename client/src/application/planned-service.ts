import type { PlannedOccurrence, RecurringRule, PlannedOccurrenceStatus } from "@/domain/entities";
import { generateOccurrences, occurrenceId } from "@/domain/planned";
import { periodContaining } from "@/domain/periods";
import { db, readState } from "@/persistence/db";

function assertDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) throw new Error("La fecha no es válida");
}

export async function createRecurringRule(input: Omit<RecurringRule, "id"> & { id?: string }) {
  assertDate(input.startsOn);
  if (input.endsOn) assertDate(input.endsOn);
  if (!input.title.trim() || input.amount <= 0) throw new Error("La regla necesita título y monto positivo");
  const state = await readState();
  if (!state.accounts.some((account) => account.id === input.accountId && !account.archived)) throw new Error("La cuenta de la regla no existe o está archivada");
  const id = input.id ?? `rule-${crypto.randomUUID()}`;
  const rule = { ...input, id, title: input.title.trim() };
  await db.recurringRules.add(rule);
  const period = periodContaining(new Date().toISOString().slice(0, 10), state.periodSettings);
  const horizon = new Date(`${period.end}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 90);
  const additions = generateOccurrences([rule], [], period.start, horizon.toISOString().slice(0, 10));
  if (additions.length) await db.plannedOccurrences.bulkAdd(additions);
  return { id };
}

export async function updateOccurrenceStatus(id: string, status: Exclude<PlannedOccurrenceStatus, "confirmed">) {
  const occurrence = await db.plannedOccurrences.get(id);
  if (!occurrence) throw new Error("La ocurrencia no existe");
  if (occurrence.status === "confirmed") throw new Error("Una ocurrencia confirmada no puede cambiar de estado");
  await db.plannedOccurrences.put({ ...occurrence, status, updatedAt: new Date().toISOString() });
  return { id };
}

export async function confirmOccurrence(id: string) {
  const occurrence = await db.plannedOccurrences.get(id);
  if (!occurrence) throw new Error("La ocurrencia no existe");
  if (occurrence.status === "confirmed" && occurrence.transactionId) return { id: occurrence.transactionId, occurrenceId: id, alreadyConfirmed: true };
  if (occurrence.status === "skipped") throw new Error("Una ocurrencia omitida no puede confirmarse");
  const rule = await db.recurringRules.get(occurrence.ruleId);
  if (!rule) throw new Error("La regla recurrente no existe");
  const state = await readState();
  const account = state.accounts.find((item) => item.id === rule.accountId && !item.archived);
  if (!account) throw new Error("La cuenta de la regla no existe o está archivada");
  const transactionId = `tx-occurrence-${id}`;
  const now = new Date().toISOString();
  await db.transaction("rw", db.transactions, db.plannedOccurrences, async () => {
    const current = await db.plannedOccurrences.get(id);
    if (!current) throw new Error("La ocurrencia no existe");
    if (current.status === "confirmed" && current.transactionId) return;
    await db.transactions.add({ id: transactionId, date: occurrence.scheduledDate, amount: rule.amount, kind: rule.kind, accountId: rule.accountId, destinationAccountId: rule.destinationAccountId, liabilityAccountId: rule.liabilityAccountId, categoryId: rule.categoryId, classification: rule.classification, note: rule.title, createdAt: now, updatedAt: now });
    await db.plannedOccurrences.put({ ...current, status: "confirmed", transactionId, updatedAt: now });
  });
  return { id: transactionId, occurrenceId: id, alreadyConfirmed: false };
}

export function occurrenceBucket(date: string, today = new Date().toISOString().slice(0, 10)) {
  const current = new Date(`${today}T00:00:00Z`).getTime();
  const target = new Date(`${date}T00:00:00Z`).getTime();
  const days = Math.round((target - current) / 86_400_000);
  if (days < 0) return "overdue" as const;
  if (days === 0) return "today" as const;
  if (days === 1) return "tomorrow" as const;
  if (days <= 7) return "next7days" as const;
  return "later" as const;
}
