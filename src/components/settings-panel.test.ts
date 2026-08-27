import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProfileProvider } from "@/components/providers/profile-provider";
import { SettingsPanel } from "@/components/settings-panel";

describe("SettingsPanel", () => {
  it("renders without requiring InventoryProvider", () => {
    const profileProps = {
      value: {
        id: "admin-1",
        email: "admin@nomadamotopartes.co",
        displayName: "Admin Nómada",
        role: "admin",
        active: true,
        isPrimary: true,
      },
    } as Parameters<typeof ProfileProvider>[0];
    const view = createElement(
      ProfileProvider,
      profileProps,
      createElement(SettingsPanel, {
        initialLowStockThreshold: 10,
        initialEmailAttempts: [],
        inventoryAvailability: [0, 4, 10, 18],
        isDemo: true,
      }),
    );

    expect(() => renderToStaticMarkup(view)).not.toThrow();
    expect(renderToStaticMarkup(view)).toContain("2 referencias");
  });
});
