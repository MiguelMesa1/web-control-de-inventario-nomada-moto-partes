import { expect, test } from "@playwright/test";

test("renders the selected theme without hydration or script errors", async ({
  page,
  request,
}) => {
  const renderErrors: string[] = [];

  page.on("console", (message) => {
    if (
      ["error", "warning"].includes(message.type()) &&
      /hydration|encountered a script tag/i.test(message.text())
    ) {
      renderErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (/hydration|encountered a script tag/i.test(error.message)) {
      renderErrors.push(error.message);
    }
  });

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");

  await expect(
    page.getByRole("button", { name: /Activar modo (claro|oscuro)/ }).first(),
  ).toBeVisible();
  await expect.poll(() => renderErrors).toEqual([]);

  const iconResponse = await request.get("/icon.png");
  expect(iconResponse.ok()).toBe(true);
  expect(iconResponse.headers()["content-type"]).toContain("image/png");
});
