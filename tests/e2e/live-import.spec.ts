import path from "node:path";
import { expect, test } from "@playwright/test";

const email = process.env.LIVE_TEST_EMAIL;
const password = process.env.LIVE_TEST_PASSWORD;
const inventoryFile = process.env.LIVE_VALID_INVENTORY_FILE;

test.describe("publicación real de inventario", () => {
  test.skip(
    !email || !password || !inventoryFile,
    "Define LIVE_TEST_EMAIL, LIVE_TEST_PASSWORD y LIVE_VALID_INVENTORY_FILE.",
  );

  test("el admin publica un Excel válido y conserva la trazabilidad", async ({
    page,
  }) => {
    const filename = path.basename(inventoryFile ?? "");

    await page.goto("/login");
    await page.locator("#email").fill(email ?? "");
    await page.locator("#password").fill(password ?? "");
    await page.getByRole("button", { name: "Entrar al inventario" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/history");
    const completedRun = page
      .getByRole("row")
      .filter({ hasText: filename })
      .filter({ hasText: "Completada" });

    if ((await completedRun.count()) === 0) {
      await page.goto("/uploads");
      await expect(
        page.getByRole("button", { name: "Seleccionar Excel o CSV" }),
      ).toBeVisible();
      await page.locator("#inventory-file").setInputFiles(inventoryFile ?? "");
      await expect(page.getByText("Validación correcta")).toBeVisible({
        timeout: 30_000,
      });
      await page.getByRole("button", { name: "Publicar inventario" }).click();
      await expect(page.getByText("Carga lista")).toBeVisible({
        timeout: 30_000,
      });
    }

    await page.goto("/history");
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: filename })
        .filter({ hasText: "Completada" }),
    ).toBeVisible();

    await page.goto("/inventory");
    await expect(
      page.getByRole("cell", { name: "5970050", exact: true }),
    ).toBeVisible();
  });
});
