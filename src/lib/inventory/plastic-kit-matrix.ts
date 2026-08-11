import type { PlasticKitAvailability } from "@/types/inventory";
import { normalizeInventoryText } from "./priority-lines";
import { comparePlasticKitsForDisplay } from "./plastic-kits";
import {
  comparePlasticKitModels,
  getPlasticKitFamily,
  getPlasticKitModel,
  PLASTIC_KIT_FAMILIES,
} from "./plastic-kit-taxonomy";

export type PlasticKitMatrixColor = {
  key: string;
  label: string;
};

export type PlasticKitMatrixRow = {
  key: string;
  model: string;
  kitsByColor: Map<string, PlasticKitAvailability[]>;
};

export type PlasticKitMatrixGroup = {
  key: string;
  label: string;
  colors: PlasticKitMatrixColor[];
  rows: PlasticKitMatrixRow[];
};

function getFamilyLabel(kit: PlasticKitAvailability) {
  const family = getPlasticKitFamily(kit);
  return (
    PLASTIC_KIT_FAMILIES.find((item) => item.id === family)?.label ??
    "Otra línea"
  );
}

export function buildPlasticKitMatrix(kits: PlasticKitAvailability[]) {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      colors: Map<string, string>;
      rows: Map<string, PlasticKitMatrixRow>;
    }
  >();
  const sortedKits = [...kits].sort(comparePlasticKitModels);

  for (const kit of sortedKits) {
    const model = getPlasticKitModel(kit);
    const familyKey = String(getPlasticKitFamily(kit));
    const rowKey = normalizeInventoryText(model);
    const colorKey = normalizeInventoryText(kit.color);
    const group = groups.get(familyKey) ?? {
      key: familyKey,
      label: getFamilyLabel(kit),
      colors: new Map<string, string>(),
      rows: new Map<string, PlasticKitMatrixRow>(),
    };

    group.colors.set(
      colorKey,
      group.colors.get(colorKey) ?? kit.color.trim(),
    );

    const row = group.rows.get(rowKey) ?? {
      key: `${familyKey}|${rowKey}`,
      model,
      kitsByColor: new Map<string, PlasticKitAvailability[]>(),
    };
    const cellKits = row.kitsByColor.get(colorKey) ?? [];
    cellKits.push(kit);
    row.kitsByColor.set(
      colorKey,
      cellKits.sort(comparePlasticKitsForDisplay),
    );
    group.rows.set(rowKey, row);
    groups.set(familyKey, group);
  }

  return {
    groups: [...groups.values()].map((group): PlasticKitMatrixGroup => ({
      key: group.key,
      label: group.label,
      colors: [...group.colors.entries()]
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
      rows: [...group.rows.values()],
    })),
  };
}
