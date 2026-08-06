import type { PlasticKitDefinition } from "@/types/inventory";
import { normalizeInventoryText } from "@/lib/inventory/priority-lines";

export const PLASTIC_KIT_FAMILIES = [
  { id: "xtz-125", label: "XTZ 125", models: [] },
  { id: "xtz-150", label: "XTZ 150", models: [] },
  { id: "boxer", label: "Boxer", models: [] },
  {
    id: "pulsar",
    label: "Pulsar",
    models: ["Pulsar 180", "Pulsar 200-220", "Pulsar modelo viejo"],
  },
  {
    id: "ns",
    label: "NS",
    models: ["NS 125-150-160", "NS 160 FI", "NS 200", "NS 200 FI"],
  },
  { id: "superlander", label: "SuperLander", models: [] },
] as const;

export type PlasticKitFamilyId = (typeof PLASTIC_KIT_FAMILIES)[number]["id"];

export const PLASTIC_KIT_LINE_OPTIONS = PLASTIC_KIT_FAMILIES.flatMap((family) =>
  family.models.length ? [...family.models] : [family.label],
);

const familyOrder = new Map(
  PLASTIC_KIT_FAMILIES.map((family, index) => [family.id, index]),
);
const modelOrder = new Map(
  PLASTIC_KIT_LINE_OPTIONS.map((model, index) => [normalizeInventoryText(model), index]),
);

export function getPlasticKitFamily(kit: PlasticKitDefinition): PlasticKitFamilyId | "other" {
  const value = normalizeInventoryText(
    [kit.model, kit.brand, kit.name].filter(Boolean).join(" "),
  );
  if (/\bns(?=\s|[-_/]|\d|$)/.test(value)) return "ns";
  if (/\bpulsar\b/.test(value)) return "pulsar";
  if (/\bxtz\s*125\b/.test(value)) return "xtz-125";
  if (/\bxtz\s*150\b/.test(value)) return "xtz-150";
  if (/\bboxer\b/.test(value)) return "boxer";
  if (/\bsuper\s*lander\b|\bsuperlander\b/.test(value)) return "superlander";
  return "other";
}

export function getPlasticKitModel(kit: PlasticKitDefinition) {
  const family = getPlasticKitFamily(kit);
  const kitName = normalizeInventoryText(kit.name);
  const storedModel = normalizeInventoryText(kit.model ?? "");

  if (family === "ns") {
    if (/\bns\s*200\s*(?:fi|f\.?i\.?)\b/.test(kitName) || storedModel === "ns 200 fi") {
      return "NS 200 FI";
    }
    if (/\bns\s*200\b/.test(kitName) || storedModel === "ns 200") return "NS 200";
    if (/\bns\s*160\s*(?:fi|f\.?i\.?)\b/.test(kitName) || storedModel === "ns 160 fi") {
      return "NS 160 FI";
    }
    return "NS 125-150-160";
  }

  if (family === "pulsar") {
    if (/modelo\s*(?:viejo|antiguo)|linea\s*(?:vieja|antigua)/.test(kitName) || storedModel === "pulsar modelo viejo") {
      return "Pulsar modelo viejo";
    }
    if (/\bpulsar\s*180\b/.test(kitName) || storedModel === "pulsar 180") {
      return "Pulsar 180";
    }
    return "Pulsar 200-220";
  }

  const familyDefinition = PLASTIC_KIT_FAMILIES.find((item) => item.id === family);
  return familyDefinition?.label ?? kit.model?.trim() ?? kit.brand.trim();
}

export function comparePlasticKitModels(a: PlasticKitDefinition, b: PlasticKitDefinition) {
  const aFamily = getPlasticKitFamily(a);
  const bFamily = getPlasticKitFamily(b);
  const familyDifference =
    (familyOrder.get(aFamily as PlasticKitFamilyId) ?? Number.MAX_SAFE_INTEGER) -
    (familyOrder.get(bFamily as PlasticKitFamilyId) ?? Number.MAX_SAFE_INTEGER);
  if (familyDifference) return familyDifference;

  const aModel = getPlasticKitModel(a);
  const bModel = getPlasticKitModel(b);
  return (
    (modelOrder.get(normalizeInventoryText(aModel)) ?? Number.MAX_SAFE_INTEGER) -
      (modelOrder.get(normalizeInventoryText(bModel)) ?? Number.MAX_SAFE_INTEGER) ||
    aModel.localeCompare(bModel, "es", { numeric: true, sensitivity: "base" })
  );
}

export function matchesPlasticKitSearch(kit: PlasticKitDefinition, rawQuery: string) {
  const query = normalizeInventoryText(rawQuery);
  if (!query) return true;

  const fields = [
    kit.name,
    getPlasticKitModel(kit),
    ...kit.parts.flatMap((part) => [part.sku, part.productName]),
  ];
  return fields.some((field) => normalizeInventoryText(field).includes(query));
}
