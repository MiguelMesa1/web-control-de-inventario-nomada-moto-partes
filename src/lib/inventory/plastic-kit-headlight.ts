import { normalizeInventoryText } from "@/lib/inventory/priority-lines";

const LINES_WITHOUT_HEADLIGHT = new Set([
  "lander",
  "super lander",
  "superlander",
]);

export function plasticKitLineSupportsHeadlight(line?: string) {
  return !LINES_WITHOUT_HEADLIGHT.has(normalizeInventoryText(line ?? ""));
}

export function normalizePlasticKitHeadlight(
  line: string | undefined,
  hasHeadlight: boolean | null,
) {
  return plasticKitLineSupportsHeadlight(line) ? hasHeadlight : null;
}
