import type { PlasticKitDefinition } from "@/types/inventory";

export function buildPlasticKitSavePayload(
  definition: PlasticKitDefinition,
  existingId?: string,
) {
  const payload = {
    name: definition.name,
    brand: definition.brand,
    color: definition.color,
    hasHeadlight: definition.hasHeadlight,
    model: definition.model,
    warehouse: definition.warehouse,
    active: definition.active,
    parts: definition.parts,
  };

  return existingId ? { ...payload, id: existingId } : payload;
}
