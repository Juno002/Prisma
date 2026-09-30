import type { CategoryType } from "./entities";

export const defaultCategories: ReadonlyArray<{ name: string; type: CategoryType }> = [
  { name: "Alimentación", type: "expense" },
  { name: "Vivienda", type: "expense" },
  { name: "Transporte", type: "expense" },
  { name: "Otros", type: "expense" },
  { name: "Ingreso", type: "income" },
];

export function normalizeCategoryName(name: string) {
  return name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sin-categoria";
}

export function stableCategoryId(name: string, type: CategoryType = "expense") {
  return `category-${type}-${normalizeCategoryName(name)}`;
}
