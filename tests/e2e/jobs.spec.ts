import { test, expect } from "@playwright/test";

// Writes data: runs only against a disposable database with a test account supplied via env.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe("jobs flow (requires E2E_USER_EMAIL / E2E_USER_PASSWORD)", () => {
  test.skip(!email || !password, "No E2E test account configured");

  test("sign in and open the job form", async ({ page }) => {
    // The "Coming up next" reminder opens over any page at set times of day: close it whenever it shows.
    const reminder = page.getByRole("dialog", { name: /coming up/i });
    await page.addLocatorHandler(reminder, () => reminder.getByRole("button", { name: "Dismiss" }).click());
    await page.goto("/login");
    await page.fill('input[name="identifier"]:visible', email!);
    await page.fill('input[type="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard/**");

    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/jobs(\?|$)/);
    await page.getByRole("button", { name: /new job|add new job/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
