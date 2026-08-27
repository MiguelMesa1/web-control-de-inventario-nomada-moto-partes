import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlasticKitsOverview } from "@/components/plastic-kits-overview";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { ProfileProvider } from "@/components/providers/profile-provider";
import {
  demoInventoryData,
  demoPlasticKits,
  demoProfile,
} from "@/lib/demo-data";

describe("PlasticKitsOverview", () => {
  it("presenta los kits como una experiencia visual y operativa", () => {
    const whiteKit = {
      ...demoPlasticKits[1],
      id: "demo-kit-xtz-150-blanco",
      name: "Kit sin farola XTZ 150 blanco",
      model: "XTZ 150",
      color: "Blanco",
    };
    const inventoryProps = {
      value: demoInventoryData,
    } as Parameters<typeof InventoryProvider>[0];
    const profileProps = {
      value: demoProfile,
    } as Parameters<typeof ProfileProvider>[0];

    const html = renderToStaticMarkup(
      createElement(
        InventoryProvider,
        inventoryProps,
        createElement(
          ProfileProvider,
          profileProps,
          createElement(PlasticKitsOverview, {
            initialKits: [...demoPlasticKits, whiteKit],
          }),
        ),
      ),
    );

    expect(html).toContain("Taller de kits");
    expect(html).toContain("Listos para armar");
    expect(html).toContain("Galería");
    expect(html).toContain("Capacidad actual");
    expect(html).toContain("Pieza limitante");
    expect(html).toContain("Kit sin farola XTZ 150 blanco");
    expect(html).toContain("plastic-kit-color-card");
  });
});
