export const PRIORITY_PRODUCT_LINES = [
  "XTZ 125",
  "XTZ 150",
  "Boxer",
  "Pulsar 180 - 200 - 220",
  "Pulsar NS 125-150-160-200",
  "SuperLander",
] as const;

export type StockLevel = "exhausted" | "low" | "medium" | "high";

export function normalizeInventoryText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

const priorityOrder = new Map(
  PRIORITY_PRODUCT_LINES.map((line, index) => [
    normalizeInventoryText(line),
    index,
  ]),
);

export function isPriorityProductLine(line: string) {
  return priorityOrder.has(normalizeInventoryText(line));
}

export function compareProductLines(a: string, b: string) {
  const aOrder = priorityOrder.get(normalizeInventoryText(a));
  const bOrder = priorityOrder.get(normalizeInventoryText(b));

  if (aOrder !== undefined || bOrder !== undefined) {
    if (aOrder === undefined) return 1;
    if (bOrder === undefined) return -1;
    return aOrder - bOrder;
  }

  return a.localeCompare(b, "es");
}

export function getStockLevel(
  available: number,
  lowStockThreshold: number,
): StockLevel {
  if (available <= 0) return "exhausted";
  if (available <= lowStockThreshold) return "low";
  if (available <= Math.max(10, lowStockThreshold * 2)) return "medium";
  return "high";
}
