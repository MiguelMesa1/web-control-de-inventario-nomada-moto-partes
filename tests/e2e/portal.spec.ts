import { expect, test } from "@playwright/test";

test.describe("portal demo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("shows inventory KPIs and navigates to analytics", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Tu inventario, sin puntos ciegos." }),
    ).toBeVisible();
    await expect(page.getByText("Referencias activas", { exact: true })).toBeVisible();
    await expect(page.locator("[data-chart]").first().locator("svg")).toBeVisible();

    if (test.info().project.name.startsWith("mobile")) {
      await page.getByRole("button", { name: "Abrir menú" }).click();
    }
    await page.getByRole("link", { name: "Analítica", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Analítica de inventario" }),
    ).toBeVisible();
    await expect(page.getByText("Hablamos de existencias, no de ventas")).toBeVisible();
  });

  test("filters inventory by product text", async ({ page }) => {
    await page.goto("/inventory");
    const search = page.getByPlaceholder(/buscar sku o producto/i);
    await search.fill("Pastilla");
    await expect(
      page.getByText(/pastillas de freno/i).filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(page.getByText(/llanta/i)).toHaveCount(0);
  });

  test("validates a CSV before publishing", async ({ page }) => {
    await page.goto("/uploads");
    const input = page.getByLabel("Archivo de Effi");
    await expect(input).toBeEnabled();
    await input.setInputFiles({
      name: "inventario-prueba.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "SKU,Producto,Línea,Bodega,Existencia,Reservado\nPR-1,Producto prueba,Motor,Principal,10,2",
      ),
    });
    await expect(page.getByText("Validación correcta")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publicar inventario" })).toBeEnabled();
    await page.getByRole("button", { name: "Publicar inventario" }).click();
    await expect(page.getByRole("heading", { name: /Carga completada/ })).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: /Carga completada/ })).toBeHidden();
  });

  test("exposes the mobile menu only at compact widths", async ({ page }) => {
    const menuButton = page.getByRole("button", { name: "Abrir menú" });
    if (test.info().project.name.startsWith("mobile")) {
      await expect(menuButton).toBeVisible();
      await expect(async () => {
        await menuButton.click();
        await expect(page.getByRole("navigation")).toBeVisible();
      }).toPass();
    } else {
      await expect(menuButton).toBeHidden();
    }
  });
});
