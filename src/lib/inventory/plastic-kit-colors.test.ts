import { describe, expect, it } from "vitest";
import { getPlasticKitColorStyle } from "./plastic-kit-colors";

describe("getPlasticKitColorStyle", () => {
  it.each([
    ["Azul", "rgb(59 130 246 / 0.88)"],
    ["Rojo cherry", "rgb(190 18 60 / 0.82)"],
    ["Negro mate", "rgb(23 23 23 / 0.9)"],
    ["Blanco", "rgb(203 213 225 / 0.92)"],
  ])("asigna un borde reconocible a %s", (color, border) => {
    expect(getPlasticKitColorStyle(color).border).toBe(border);
  });

  it("usa el color principal para un nombre desconocido", () => {
    expect(getPlasticKitColorStyle("Personalizado").border).toBe(
      "hsl(var(--primary) / 0.62)",
    );
  });

  it("mantiene superficies diferentes para negro, gris y blanco", () => {
    const surfaces = ["Negro", "Gris", "Blanco"].map(
      (color) => getPlasticKitColorStyle(color).surface,
    );

    expect(new Set(surfaces).size).toBe(3);
  });

  it("marca el negro para mostrar una franja diferenciadora", () => {
    expect(getPlasticKitColorStyle("Negro mate").emphasis).toBe("black");
    expect(getPlasticKitColorStyle("Gris").emphasis).toBe("standard");
  });

  it("separa claramente las superficies oscuras de gris y blanco", () => {
    expect(getPlasticKitColorStyle("Gris").surfaceDark).toBe(
      "rgb(115 115 115 / 0.3)",
    );
    expect(getPlasticKitColorStyle("Blanco").surfaceDark).toBe(
      "rgb(255 255 255 / 0.22)",
    );
  });
});
