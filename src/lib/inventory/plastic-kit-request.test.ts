import { describe, expect, it } from "vitest";
import type { PlasticKitDefinition } from "@/types/inventory";
import { buildPlasticKitSavePayload } from "./plastic-kit-request";

const kit: PlasticKitDefinition = {
  id: "local-id",
  name: "Kit Boxer negro",
  brand: "Boxer",
  color: "Negro",
  hasHeadlight: false,
  model: "Boxer",
  warehouse: "Principal",
  active: true,
  parts: [
    {
      sku: "ABC-1",
      productName: "Pieza uno",
      quantityRequired: 1,
      position: 0,
    },
    {
      sku: "ABC-2",
      productName: "Pieza dos",
      quantityRequired: 1,
      position: 1,
    },
  ],
};

describe("buildPlasticKitSavePayload", () => {
  it("omite el id local al crear un kit", () => {
    expect(buildPlasticKitSavePayload(kit)).not.toHaveProperty("id");
  });

  it("envía el id existente al editar un kit", () => {
    expect(buildPlasticKitSavePayload(kit, "database-id")).toHaveProperty(
      "id",
      "database-id",
    );
  });

  it("incluye la versión de farola en la solicitud", () => {
    expect(buildPlasticKitSavePayload({ ...kit, hasHeadlight: true })).toHaveProperty(
      "hasHeadlight",
      true,
    );
  });

  it("fuerza SuperLander al estado no aplica", () => {
    expect(
      buildPlasticKitSavePayload({
        ...kit,
        brand: "SuperLander",
        model: "SuperLander",
        hasHeadlight: true,
      }),
    ).toHaveProperty("hasHeadlight", null);
  });

  it("permite guardar un kit cuya farola no aplica", () => {
    expect(
      buildPlasticKitSavePayload({ ...kit, hasHeadlight: null }),
    ).toHaveProperty("hasHeadlight", null);
  });
});
