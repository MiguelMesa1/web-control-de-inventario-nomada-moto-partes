import { describe, expect, it } from "vitest";
import type { PlasticKitAvailability } from "@/types/inventory";
import { buildPlasticKitMatrix } from "./plastic-kit-matrix";

function kit(
  id: string,
  model: string,
  color: string,
  hasHeadlight: boolean | null,
): PlasticKitAvailability {
  return {
    id,
    name: `${model} ${color}`,
    brand: model,
    model,
    color,
    hasHeadlight,
    warehouse: "Principal",
    active: true,
    available: 4,
    limitingPartSkus: [],
    parts: [],
  };
}

describe("buildPlasticKitMatrix", () => {
  it("agrupa por modelo y color sin mezclar las variantes de farola", () => {
    const matrix = buildPlasticKitMatrix([
      kit("sin", "Boxer", "Negro", false),
      kit("con", "Boxer", "Negro", true),
      kit("rojo", "Boxer", "Rojo", false),
    ]);

    expect(matrix.groups).toHaveLength(1);
    expect(matrix.groups[0]?.colors.map((color) => color.label)).toEqual([
      "Negro",
      "Rojo",
    ]);
    expect(
      matrix.groups[0]?.rows[0]?.kitsByColor
        .get("negro")
        ?.map((item) => item.id),
    ).toEqual(["sin", "con"]);
  });

  it("usa solamente los colores de cada línea", () => {
    const matrix = buildPlasticKitMatrix([
      kit("boxer", "Boxer", "Negro", false),
      kit("xtz", "XTZ 125", "Azul", false),
    ]);

    expect(matrix.groups.map((group) => group.label)).toEqual([
      "XTZ 125",
      "Boxer",
    ]);
    expect(matrix.groups[0]?.colors.map((color) => color.label)).toEqual([
      "Azul",
    ]);
    expect(matrix.groups[1]?.colors.map((color) => color.label)).toEqual([
      "Negro",
    ]);
  });

  it("no modifica el orden recibido", () => {
    const kits = [
      kit("xtz", "XTZ 125", "Negro", false),
      kit("boxer", "Boxer", "Negro", false),
    ];

    buildPlasticKitMatrix(kits);

    expect(kits.map((item) => item.id)).toEqual(["xtz", "boxer"]);
  });
});
