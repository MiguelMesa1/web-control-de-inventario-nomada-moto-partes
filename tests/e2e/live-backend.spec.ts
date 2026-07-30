import { expect, test } from "@playwright/test";

const email = process.env.LIVE_TEST_EMAIL;
const password = process.env.LIVE_TEST_PASSWORD;
const inventoryFile = process.env.LIVE_INVENTORY_FILE;
const screenshotPath = process.env.LIVE_SCREENSHOT_PATH;

test.describe("backend real", () => {
  test.skip(
    !email || !password || !inventoryFile,
    "Define LIVE_TEST_EMAIL, LIVE_TEST_PASSWORD y LIVE_INVENTORY_FILE.",
  );

  test("admin principal inicia sesión y una carga inválida queda auditada", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator("#email").fill(email ?? "");
    await page.locator("#password").fill(password ?? "");
    await page.getByRole("button", { name: "Entrar al inventario" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("conectado", { exact: true })).toBeVisible();
    await expect(page.getByText("Admin principal", { exact: true })).toBeVisible();
    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    await page.goto("/admin");
    await expect(page.getByText("Cuenta protegida", { exact: true })).toBeVisible();

    await page.goto("/history");
    const auditedFile = page.getByText(
      /32687_17853460921029_107091\.xlsx/i,
    );
    if ((await auditedFile.count()) === 0) {
      await page.goto("/uploads");
      await page.locator("#inventory-file").setInputFiles(inventoryFile ?? "");
      await expect(
        page.getByText(/referencia 5970050 está repetida/i),
      ).toBeVisible({ timeout: 30_000 });
      await page.goto("/history");
    }
    await expect(async () => {
      await page.reload();
      await expect(
        page.getByText(/32687_17853460921029_107091\.xlsx/i),
      ).toBeVisible();
    }).toPass({ timeout: 15_000 });
    await expect(page.getByText("Rechazada", { exact: true })).toBeVisible();
  });
});
