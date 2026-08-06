import type { PlasticKitDefinition } from "@/types/inventory";
import { normalizePlasticKitHeadlight } from "./plastic-kit-headlight";

export function buildPlasticKitSavePayload(
  definition: PlasticKitDefinition,
  existingId?: string,
) {
  const payload = {
    name: definition.name,
    brand: definition.brand,
    color: definition.color,
    hasHeadlight: normalizePlasticKitHeadlight(
      definition.model ?? definition.brand,
      definition.hasHeadlight,
    ),
    model: definition.model,
    warehouse: definition.warehouse,
    active: definition.active,
    parts: definition.parts,
  };

  return existingId ? { ...payload, id: existingId } : payload;
}
