import { expect, test } from "@playwright/test";

const sampleQuery = ".products[] | select(.inStock) | {name, price}";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "jqw" })).toBeVisible();
});

test("runs jq, reports errors, formats JSON, and copies output", async ({
  browserName,
  context,
  page,
}) => {
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  }
  const query = page.getByRole("textbox", { name: "jq Query" });
  const jsonEditor = page.getByRole("textbox", { name: "JSON input editor" });
  const output = page.getByRole("textbox", { name: "jq output" });

  await expect(output).toContainText("Field Notes");
  await expect(output).toContainText("Desk Tray");

  await query.fill(".products[");
  await expect(page.getByTestId("query-error")).toContainText("jq error");

  await query.fill(".products | length");
  await expect(output).toHaveText("3");

  await jsonEditor.fill('{"alpha":1,}');
  await expect(page.getByTestId("query-error")).toContainText("Invalid JSON");

  await jsonEditor.fill('{"alpha":1,"nested":{"ok":true}}');
  await page.getByRole("button", { name: "Format JSON" }).click();
  await expect(jsonEditor).toContainText('  "alpha": 1');

  await query.fill(".nested");
  await expect(output).toContainText('"ok": true');
  if (browserName === "chromium") {
    await page.getByRole("button", { name: "Copy output" }).click();
    await expect(
      page.getByRole("button", { name: "Copied output" }),
    ).toContainText("Copied");
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('{\n  "ok": true\n}');
  }
});

test("persists only the selected theme across reloads", async ({ page }) => {
  const query = page.getByRole("textbox", { name: "jq Query" });
  const jsonEditor = page.getByRole("textbox", { name: "JSON input editor" });

  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await query.fill(".changed");
  await jsonEditor.fill('{"private":"not persisted"}');

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(query).toHaveValue(sampleQuery);
  await expect(jsonEditor).toContainText('"products"');
  await expect(jsonEditor).not.toContainText("not persisted");
});

test("resizes the desktop workspace with the keyboard", async ({ page }) => {
  const inputPanel = page
    .getByRole("region", { name: "JSON Input" })
    .locator("..");
  const handle = page.getByRole("separator", {
    name: "Resize JSON input and output panels",
  });
  const initialStyle = await inputPanel.getAttribute("style");

  await handle.press("ArrowRight");
  await handle.press("ArrowRight");

  await expect(inputPanel).not.toHaveAttribute("style", initialStyle ?? "");
});

test("does not request resources from another origin", async ({ page }) => {
  const origins = new Set<string>();
  page.on("request", (request) => origins.add(new URL(request.url()).origin));

  await page.reload();
  await expect(page.getByRole("textbox", { name: "jq output" })).toContainText(
    "Field Notes",
  );

  expect([...origins]).toEqual(["http://127.0.0.1:4173"]);
});

test("mobile layout stacks both work areas without horizontal overflow", async ({
  page,
}) => {
  await expect(page.getByRole("region", { name: "JSON Input" })).toBeVisible();
  await expect(page.getByRole("region", { name: "jq Query" })).toBeVisible();
  await expect(
    page.getByRole("separator", {
      name: "Resize JSON input and output panels",
    }),
  ).toHaveCount(0);

  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
});
