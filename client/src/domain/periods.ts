export type DateRange = {
  start: string;
  end: string;
};

export type PeriodSettings = {
  /** Calendar day on which a period starts. Values above a month's length are clamped. */
  startDay: number;
};

export const defaultPeriodSettings: PeriodSettings = { startDay: 1 };

function normalizeIsoDate(date: string) {
  const day = date.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!day || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) {
    throw new Error(`Fecha inválida: ${date}`);
  }
  return day;
}

function assertStartDay(startDay: number) {
  if (!Number.isInteger(startDay) || startDay < 1 || startDay > 31) {
    throw new Error("El inicio del período debe ser un día entre 1 y 31");
  }
}

function utcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function daysInMonth(year: number, monthIndex: number) {
  return utcDate(year, monthIndex + 1, 0).getUTCDate();
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function periodStartFor(year: number, monthIndex: number, startDay: number) {
  return utcDate(year, monthIndex, Math.min(startDay, daysInMonth(year, monthIndex)));
}

export function periodContaining(date: string, settings: PeriodSettings = defaultPeriodSettings): DateRange {
  const normalizedDate = normalizeIsoDate(date);
  assertStartDay(settings.startDay);
  const current = new Date(`${normalizedDate}T00:00:00Z`);
  const candidate = periodStartFor(current.getUTCFullYear(), current.getUTCMonth(), settings.startDay);
  const start = current.getTime() >= candidate.getTime()
    ? candidate
    : periodStartFor(current.getUTCFullYear(), current.getUTCMonth() - 1, settings.startDay);
  const end = utcDate(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate() - 1);
  return { start: iso(start), end: iso(end) };
}

export function contains(period: DateRange, date: string) {
  const normalizedDate = normalizeIsoDate(date);
  const normalizedStart = normalizeIsoDate(period.start);
  const normalizedEnd = normalizeIsoDate(period.end);
  return normalizedStart <= normalizedDate && normalizedDate <= normalizedEnd;
}

export function nextPeriod(period: DateRange): DateRange {
  const startDate = new Date(`${normalizeIsoDate(period.start)}T00:00:00Z`);
  const nextStart = periodStartFor(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, startDate.getUTCDate());
  const end = utcDate(nextStart.getUTCFullYear(), nextStart.getUTCMonth() + 1, nextStart.getUTCDate() - 1);
  return { start: iso(nextStart), end: iso(end) };
}

export function previousComparablePeriod(period: DateRange): DateRange {
  const startDate = new Date(`${normalizeIsoDate(period.start)}T00:00:00Z`);
  const previousStart = periodStartFor(startDate.getUTCFullYear(), startDate.getUTCMonth() - 1, startDate.getUTCDate());
  const end = utcDate(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() - 1);
  return { start: iso(previousStart), end: iso(end) };
}

export function periodLabel(period: DateRange, locale = "es-DO") {
  const start = new Date(`${period.start}T00:00:00Z`);
  const end = new Date(`${period.end}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}
