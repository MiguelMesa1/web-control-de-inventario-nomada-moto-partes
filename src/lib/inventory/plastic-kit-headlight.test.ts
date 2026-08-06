import { describe, expect, it } from "vitest";
import {
  normalizePlasticKitHeadlight,
  plasticKitLineSupportsHeadlight,
} from "./plastic-kit-headlight";

describe("plasticKitLineSupportsHeadlight", () => {
  it.each(["SuperLander", "Super Lander", "lander", "LANDER"])(
    "desactiva la farola para %s",
    (line) => {
      expect(plasticKitLineSupportsHeadlight(line)).toBe(false);
      expect(normalizePlasticKitHeadlight(line, true)).toBeNull();
    },
  );

  it("mantiene la opción para las demás líneas", () => {
    expect(plasticKitLineSupportsHeadlight("Boxer")).toBe(true);
    expect(normalizePlasticKitHeadlight("Boxer", true)).toBe(true);
  });

  it("conserva el estado no aplica en líneas configurables", () => {
    expect(normalizePlasticKitHeadlight("Boxer", null)).toBeNull();
  });
});
