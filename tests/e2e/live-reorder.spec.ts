import { expect, test } from "@playwright/test";

const email = process.env.LIVE_TEST_EMAIL;
const password = process.env.LIVE_TEST_PASSWORD;

test.describe("Punto de Reorden real", () => {
  test.skip(!email || !password, "Define LIVE_TEST_EMAIL y LIVE_TEST_PASSWORD.");

  test("el administrador consulta las referencias y puede abrir el alta", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator("#email").fill(email ?? "");
    await page.locator("#password").fill(password ?? "");
    await page.getByRole("button", { name: "Entrar al inventario" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/reorder");
    await expect(
      page.getByRole("heading", { name: "Punto de Reorden" }),
    ).toBeVisible();
    await expect(page.getByText("112", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Agregar producto" }),
    ).toBeVisible();

    await page
      .getByPlaceholder("Buscar por SKU o producto…")
      .fill("2292401");
    await expect(
      page.getByRole("cell", { name: "2292401", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retirar 2292401" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Filtrar por línea" }),
    ).toContainText("Líneas principales");
    await expect(
      page.getByRole("combobox", { name: "Productos por página" }),
    ).toContainText("50 por página");

    await page.getByRole("button", { name: "Agregar producto" }).click();
    await expect(
      page.getByRole("dialog").getByText("Agregar producto vigilado"),
    ).toBeVisible();
  });
});
