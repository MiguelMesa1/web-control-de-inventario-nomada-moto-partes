import type { ReorderStatus } from "@/types/inventory";

export function reorderEmailStatusLabel(status: ReorderStatus) {
  if (status === "missing") return "Sin registro";
  if (status === "exhausted") return "Agotado";
  if (status === "low") return "Por reponer";
  return "Nivel estable";
}
