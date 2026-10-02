import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { confirmOccurrence, createRecurringRule } from "@/application/planned-service";
import { generateOccurrences, datesForRule } from "@/domain/planned";
import { moneyFromCents } from "@/domain/money";
import type { PlannedOccurrence, RecurringRule } from "@/domain/entities";
import { db, readPeriodSettings, readState, replaceState, savePeriodSettings } from "@/persistence/db";

const rule: RecurringRule = { id: "rule-rent", title: "Alquiler", amount: moneyFromCents(160000), kind: "expense", accountId: "bank", categoryId: "home", classification: "fixed", frequency: "monthly", startsOn: "2026-01-31", active: true };

describe("Phase 7 · recurring rules and planned occurrences", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await replaceState({ accounts: [{ id: "bank", name: "Banco", kind: "bank", openingBalance: moneyFromCents(500000), archived: false }], categories: [{ id: "home", name: "Hogar", type: "expense", archived: false }], transactions: [], budgets: [], goals: [], recurringRules: [], plannedOccurrences: [], periodSettings: { startDay: 1 } });
  });

  it("uses the original weekly and biweekly interval from the start date", () => {
    expect(datesForRule({ ...rule, frequency: "weekly", startsOn: "2026-09-02" }, "2026-09-01", "2026-09-24")).toEqual(["2026-09-02", "2026-09-09", "2026-09-16", "2026-09-23"]);
    expect(datesForRule({ ...rule, frequency: "biweekly", startsOn: "2026-09-02" }, "2026-09-01", "2026-10-01")).toEqual(["2026-09-02", "2026-09-16", "2026-09-30"]);
  });

  it("clamps days 29–31 to the last valid day without drifting the anchor", () => {
    expect(datesForRule(rule, "2026-01-01", "2026-05-31")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });

  it("generates a unique rule/date pair", () => {
    const existing: PlannedOccurrence = { id: "rule-rent::2026-01-31", ruleId: rule.id, scheduledDate: "2026-01-31", status: "pending", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
    const generated = generateOccurrences([rule], [existing], "2026-01-01", "2026-02-28", "2026-01-01T00:00:00Z");
    expect(generated.map((item) => item.id)).toEqual(["rule-rent::2026-02-28"]);
  });

  it("confirms an occurrence only once and does not duplicate the transaction", async () => {
    await db.recurringRules.add({ ...rule, startsOn: "2026-10-01" });
    await db.plannedOccurrences.add({ id: "rule-rent::2026-10-01", ruleId: rule.id, scheduledDate: "2026-10-01", status: "pending", createdAt: "2026-09-30T00:00:00Z", updatedAt: "2026-09-30T00:00:00Z" });
    const first = await confirmOccurrence("rule-rent::2026-10-01");
    const second = await confirmOccurrence("rule-rent::2026-10-01");
    expect(first.alreadyConfirmed).toBe(false);
    expect(second).toMatchObject({ id: first.id, alreadyConfirmed: true });
    expect((await readState()).transactions).toHaveLength(1);
    expect((await readState()).plannedOccurrences[0].status).toBe("confirmed");
  });

  it("persists the period start day and creates the first occurrence window with a rule", async () => {
    await savePeriodSettings({ startDay: 25 });
    expect((await readPeriodSettings()).startDay).toBe(25);
    await createRecurringRule({ ...rule, id: "rule-internet", title: "Internet", amount: moneyFromCents(150000), startsOn: "2026-10-25" });
    const state = await readState();
    expect(state.periodSettings.startDay).toBe(25);
    expect(state.plannedOccurrences.some((item) => item.ruleId === "rule-internet" && item.scheduledDate === "2026-10-25")).toBe(true);
  });
});
