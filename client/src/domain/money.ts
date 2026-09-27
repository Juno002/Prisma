export type Money = number & { readonly __brand: "MoneyInCents" };

export function moneyFromCents(value: number): Money {
  if (!Number.isInteger(value)) {
    throw new Error("Money must be stored as an integer number of cents");
  }
  return value as Money;
}

export function moneyFromMajorUnits(value: number): Money {
  if (!Number.isFinite(value)) {
    throw new Error("Money amount must be finite");
  }
  return moneyFromCents(Math.round(value * 100));
}

export function moneyToMajorUnits(value: Money): number {
  return value / 100;
}

export function addMoney(...values: Money[]): Money {
  return moneyFromCents(values.reduce((sum, value) => sum + value, 0));
}

export function subtractMoney(left: Money, right: Money): Money {
  return moneyFromCents(left - right);
}

export function negateMoney(value: Money): Money {
  return moneyFromCents(-value);
}

export function isMoney(value: unknown): value is Money {
  return typeof value === "number" && Number.isInteger(value);
}
