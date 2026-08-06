import { describe, expect, it } from "vitest";
import type { PlasticKitDefinition } from "@/types/inventory";
import {
  getPlasticKitFamily,
  getPlasticKitModel,
  matchesPlasticKitSearch,
} from "@/lib/inventory/plastic-kit-taxonomy";

function nsKit(name: string): PlasticKitDefinition {
  return {
    id: name,
    name,
    brand: "Pulsar NS 125-150-160-200",
    model: "Pulsar NS 125-150-160-200",
    color: "Negro",
    hasHeadlight: false,
    warehouse: "Principal",
    active: true,
    parts: [
      { sku: `SKU-${name}`, productName: `Carenaje ${name}`, quantityRequired: 1, position: 0 },
    ],
  };
}

describe("plastic kit taxonomy", () => {
  it("separa los submodelos NS aunque el modelo guardado sea la línea antigua", () => {
    const kit = nsKit("Kit NS 200 FI azul");

    expect(getPlasticKitFamily(kit)).toBe("ns");
    expect(getPlasticKitModel(kit)).toBe("NS 200 FI");
  });

  it("reconoce NS 125-150-160 cuando la referencia antigua viene pegada", () => {
    const kit = {
      ...nsKit("Kit plástico negro"),
      brand: "Pulsar",
      model: "Pulsar NS125-150-160",
      parts: [
        {
          sku: "NS-GENERICO",
          productName: "Tapas laterales NS125-150-160 negras",
          quantityRequired: 1,
          position: 0,
        },
      ],
    };

    expect(getPlasticKitFamily(kit)).toBe("ns");
    expect(getPlasticKitModel(kit)).toBe("NS 125-150-160");
  });

  it("no deja que una pieza NS 200 cambie un kit NS 125-150-160", () => {
    const kit = {
      ...nsKit("KIT SIN FAROLA NS 125-150-160 NEGRO"),
      parts: [
        {
          sku: "PIEZA-COMPARTIDA",
          productName: "Pieza compartida Pulsar NS 200 negra",
          quantityRequired: 1,
          position: 0,
        },
      ],
    };

    expect(getPlasticKitModel(kit)).toBe("NS 125-150-160");
    expect(matchesPlasticKitSearch(kit, "pieza compartida")).toBe(true);
  });

  it("distingue NS 200 de NS 200 FI y deja ambos bajo la búsqueda NS 200", () => {
    const ns160 = nsKit("Kit NS 160 rojo");
    const ns200 = nsKit("Kit NS 200 negro");
    const ns200Fi = nsKit("Kit NS 200 FI azul");

    expect([ns160, ns200, ns200Fi].filter((kit) => matchesPlasticKitSearch(kit, "ns 200")))
      .toEqual([ns200, ns200Fi]);
  });

  it("busca por SKU y por nombre de pieza sin mezclar campos", () => {
    const kit = nsKit("Kit NS 160 rojo");

    expect(matchesPlasticKitSearch(kit, `SKU-${kit.name}`)).toBe(true);
    expect(matchesPlasticKitSearch(kit, "carenaje kit ns 160")).toBe(true);
    expect(matchesPlasticKitSearch(kit, "azul")).toBe(false);
  });
});
