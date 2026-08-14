import { expect, test } from "@playwright/test";

const email = process.env.LIVE_TEST_EMAIL;
const password = process.env.LIVE_TEST_PASSWORD;

test.describe("Recompra real", () => {
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
      page.getByRole("heading", { name: "Recompra" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Agregar producto" }),
    ).toBeVisible();

    await page.getByRole("combobox", { name: "Filtrar por estado" }).click();
    await page.getByRole("option", { name: "Todos los estados" }).click();

    await page
      .getByPlaceholder("Buscar por producto o referencia…")
      .fill("2292401");
    await expect(
      page.getByText("2292401", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retirar 2292401" }),
    ).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Filtrar por estado" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Filtrar por proveedor" })).toBeVisible();

    await page.getByRole("button", { name: "Agregar producto" }).click();
    await expect(
      page.getByRole("dialog").getByText("Agregar producto de recompra"),
    ).toBeVisible();
  });
});
