import { describe, expect, it } from "vitest";
import {
  getPlasticKitColor,
  getPlasticKitLine,
  PLASTIC_KIT_IDS,
} from "@/lib/inventory/plastic-kits";

describe("plastic kit catalog", () => {
  it("contains every requested kit ID", () => {
    expect(PLASTIC_KIT_IDS.size).toBe(109);
    expect(getPlasticKitLine("1088")?.label).toBe("Boxer CT 100");
    expect(getPlasticKitLine("1372")?.label).toBe("Pulsar NS 200 FI");
  });

  it("detects specific colors before generic color words", () => {
    expect(getPlasticKitColor("KIT PULSAR NS 200 ROJO CHERRY")).toBe("Rojo cherry");
    expect(getPlasticKitColor("KIT XTZ 125 AZUL CON TAPA BLANCA")).toBe("Azul");
    expect(getPlasticKitColor("KIT XTZ 125 TRANSPARENTE")).toBe("Transparente");
  });
});
