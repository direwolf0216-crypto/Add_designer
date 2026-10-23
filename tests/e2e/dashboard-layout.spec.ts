import path from "node:path";
import { test, expect, type Browser } from "@playwright/test";

// Dashboard header and figures, the single "Add transaction" action, a single-choice transaction
// category, and the top bar's border on every page. Read-only apart from opening forms.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const scratch = process.env.E2E_SCRATCH_DB === "1";
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const AUTH = path.join(__dirname, "../../test-results/.dashboard-layout-auth.json");

async function open(browser: Browser) {
  const context = await browser.newContext({ baseURL, storageState: AUTH, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const reminder = page.getByRole("dialog", { name: /coming up/i });
  await page.addLocatorHandler(reminder, () => reminder.getByRole("button", { name: "Dismiss" }).click());
  return { context, page };
}

test.describe.serial("dashboard layout (scratch database only)", () => {
  test.skip(!email || !password || !scratch, "Needs E2E_USER_EMAIL, E2E_USER_PASSWORD and E2E_SCRATCH_DB=1");

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    await page.fill('input[name="identifier"]:visible', email!);
    await page.fill('input[type="password"]:visible', password!);
    await page.click('button[type="submit"]:visible');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
    await context.storageState({ path: AUTH });
    await context.close();
  });

  test("one Add transaction button, and the figures in one card under the period picker", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.goto("/dashboard/overview");
    await expect(page.getByRole("button", { name: "Add transaction" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Expense", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Income", exact: true })).toHaveCount(0);

    const overview = page.getByRole("region", { name: "Overview" });
    await expect(overview).toBeVisible();
    for (const label of ["Income", "Expenses", "Net", "Jobs booked"]) await expect(overview.getByText(label, { exact: true })).toBeVisible();
    const picker = page.getByRole("button", { name: /This month/ }).first();
    const pickerBox = (await picker.boundingBox())!;
    const cardBox = (await overview.boundingBox())!;
    expect(pickerBox.y + pickerBox.height).toBeLessThanOrEqual(cardBox.y + 1);
    await context.close();
  });

  test("Add transaction opens the form, and its category takes one choice", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.goto("/dashboard/overview");
    await page.getByRole("button", { name: "Add transaction" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const category = dialog.getByRole("button", { name: /Select Category|Paper Purchase|Ink\/Toner/ }).first();
    await category.click();
    const menu = page.locator('body > div[style*="z-index: 9999"]');
    await expect(menu.getByRole("checkbox")).toHaveCount(0);
    await expect(menu.getByRole("button", { name: "Done" })).toHaveCount(0);
    await menu.getByRole("button", { name: "Paper Purchase", exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(category).toHaveText(/Paper Purchase/);
    await category.click();
    await page.locator('body > div[style*="z-index: 9999"]').getByRole("button", { name: "Ink/Toner", exact: true }).click();
    await expect(category).toHaveText(/Ink\/Toner/);
    await expect(category).not.toHaveText(/Paper Purchase/);
    await context.close();
  });

  test("the top bar has a border under it on every page", async ({ browser }) => {
    const { context, page } = await open(browser);
    for (const p of ["/dashboard/overview", "/jobs", "/transactions/overview", "/settings?section=pricing"]) {
      await page.goto(p);
      const width = await page.locator("header").first().evaluate((el) => getComputedStyle(el).borderBottomWidth);
      expect(width, p).toBe("1px");
    }
    await context.close();
  });
});
