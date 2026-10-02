import type { RecurringRule, PlannedOccurrence, PlannedOccurrenceStatus } from "./entities";

export { type RecurringRule, type PlannedOccurrence, type PlannedOccurrenceStatus } from "./entities";

function parseDay(date: string) {
  const day = date.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!day) throw new Error(`Fecha inválida: ${date}`);
  return new Date(`${day}T00:00:00Z`);
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonthsClamped(date: Date, months: number, anchorDay = date.getUTCDate()) {
  const targetMonth = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const day = Math.min(anchorDay, daysInMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

export function occurrenceId(ruleId: string, scheduledDate: string) {
  return `${ruleId}::${scheduledDate}`;
}

export function datesForRule(rule: RecurringRule, from: string, to: string): string[] {
  const start = parseDay(rule.startsOn);
  const lower = parseDay(from);
  const upper = parseDay(to);
  const dates: string[] = [];
  const anchorDay = start.getUTCDate();
  let cursor = start;
  while (cursor <= upper) {
    const date = iso(cursor);
    if (cursor >= lower && (!rule.endsOn || date <= rule.endsOn)) dates.push(date);
    if (rule.frequency === "weekly") cursor = addDays(cursor, 7);
    else if (rule.frequency === "biweekly") cursor = addDays(cursor, 14);
    else if (rule.frequency === "monthly") cursor = addMonthsClamped(cursor, 1, anchorDay);
    else cursor = addMonthsClamped(cursor, 12, anchorDay);
  }
  return dates;
}

export function generateOccurrences(rules: RecurringRule[], existing: PlannedOccurrence[], from: string, to: string, now = new Date().toISOString()): PlannedOccurrence[] {
  const known = new Set(existing.map((item) => item.id));
  const today = iso(parseDay(now));
  const generated: PlannedOccurrence[] = [];
  for (const rule of rules.filter((item) => item.active)) {
    for (const scheduledDate of datesForRule(rule, from, to)) {
      const id = occurrenceId(rule.id, scheduledDate);
      if (known.has(id)) continue;
      generated.push({ id, ruleId: rule.id, scheduledDate, status: scheduledDate < today ? "overdue" : "pending", createdAt: now, updatedAt: now });
      known.add(id);
    }
  }
  return generated;
}

export function isActualExpense(kind: string): kind is "expense" {
  return kind === "expense";
}

export function isPlannedIntent(value: unknown): value is RecurringRule {
  return Boolean(value && typeof value === "object" && "frequency" in value && "startsOn" in value && "active" in value);
}
