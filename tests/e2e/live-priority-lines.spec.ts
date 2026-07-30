import { expect, test } from "@playwright/test";

const email = process.env.LIVE_TEST_EMAIL;
const password = process.env.LIVE_TEST_PASSWORD;

test.describe("líneas prioritarias con inventario real", () => {
  test.setTimeout(120_000);
  test.skip(!email || !password, "Define LIVE_TEST_EMAIL y LIVE_TEST_PASSWORD.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(email ?? "");
    await page.locator("#password").fill(password ?? "");
    await page
      .getByRole("button", { name: /Iniciar sesión|Entrar al inventario/ })
      .click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  });

  test("encuentra el SKU 2292423 y filtra XTZ 150", async ({ page }) => {
    await page.goto("/inventory?sku=2292423");
    await expect(
      page.getByText("2292423", { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(
        "CARENAJE BASE EXTERNO YAMAHA XTZ 150 ARENA",
        { exact: true },
      ).filter({ visible: true }).first(),
    ).toBeVisible();

    const search = page.getByRole("textbox", {
      name: "Buscar por SKU o producto",
    });
    await expect(
      page.getByRole("combobox", { name: "Productos por página" }),
    ).toContainText("Mostrar 50");
    await search.clear();
    await page.getByRole("combobox").filter({ hasText: /Todas las líneas/ }).click();

    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    const background = await listbox.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(background).not.toBe("rgba(0, 0, 0, 0)");
    await page.getByRole("option", { name: "XTZ 150", exact: true }).click();

    await expect(
      page.getByText(
        "CARENAJE BASE EXTERNO YAMAHA XTZ 150 ARENA",
        { exact: true },
      ).filter({ visible: true }).first(),
    ).toBeVisible();
  });

  test("muestra viñetas, analítica prioritaria y notificaciones", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Prioridad de recompra", { exact: true })).toBeVisible();
    await expect(
      page.getByTestId("dashboard-reorder-list").getByRole("link"),
    ).toHaveCount(10);

    await page.goto("/lines");
    await page.getByRole("button", { name: /XTZ 150/ }).click();
    await expect(
      page.getByText(
        "CARENAJE BASE EXTERNO YAMAHA XTZ 150 ARENA",
        { exact: true },
      ).filter({ visible: true }).first(),
    ).toBeVisible();

    await page.goto("/analytics");
    await expect(
      page.getByRole("heading", {
        name: "Analítica de líneas principales",
      }),
    ).toBeVisible();
    await expect(page.locator("#analytics-line")).toContainText(
      "Líneas principales",
    );

    await page.getByRole("button", { name: /notificaciones de reorden/ }).click();
    await expect(page.getByText("Avisos de reorden")).toBeVisible();
    await expect(page.getByText(/quedan \d+ unidades/).first()).toBeVisible();
  });
});
