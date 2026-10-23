import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";

// Changing a job's stage from its page: the tapped pill shows a spinner while the save runs, the other
// pills wait, and a failed save unlocks them again. WRITES data: scratch database only (E2E_SCRATCH_DB=1)
// seeded with the large-format layout (Pending → Designing → Printing → …).
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const scratch = process.env.E2E_SCRATCH_DB === "1";
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const AUTH = path.join(__dirname, "../../test-results/.status-pill-auth.json");
const RUN = Date.now();

async function open(browser: Browser) {
  const context = await browser.newContext({ baseURL, storageState: AUTH, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const reminder = page.getByRole("dialog", { name: /coming up/i });
  await page.addLocatorHandler(reminder, () => reminder.getByRole("button", { name: "Dismiss" }).click());
  return { context, page };
}

/** Hold (or fail) the next server action the page sends, e.g. the stage save. */
async function interceptActions(page: Page, mode: "slow" | "fail") {
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (req.method() === "POST" && req.headers()["next-action"]) {
      if (mode === "fail") return route.abort("internetdisconnected");
      await new Promise((r) => setTimeout(r, 2500));
    }
    return route.continue();
  });
}

const pill = (page: Page, label: string) => page.locator("ol button", { hasText: new RegExp(`^${label}$`) });

test.describe.serial("status pills (scratch database only)", () => {
  test.skip(!email || !password || !scratch, "Needs E2E_USER_EMAIL, E2E_USER_PASSWORD and E2E_SCRATCH_DB=1");
  test.setTimeout(90_000);
  let jobId = "";

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
    const res = await page.request.post("/api/jobs", {
      data: { client: { name: `Pill ${RUN}`, phone: "9876543210" }, category: "Standee", date: "2026-10-23", time: "10:00 AM", location: "Chennai", status: "Pending", packageAmount: 0, customData: { fld_b_status: "Pending" } },
    });
    expect(res.status()).toBe(201);
    jobId = (await res.json()).id;
    await context.close();
  });

  test("a slow save shows a spinner in the tapped pill and locks the others until it lands", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.goto(`/jobs/details/${jobId}`);
    await expect(pill(page, "Pending")).toHaveAttribute("aria-current", "step");
    await interceptActions(page, "slow");

    await pill(page, "Designing").click();
    const designing = pill(page, "Designing");
    await expect(designing.getByTestId("status-spinner")).toBeVisible();
    await expect(designing).toHaveAttribute("aria-busy", "true");
    await expect(page.getByTestId("status-spinner")).toHaveCount(1);
    for (const other of ["Pending", "Printing", "Delivered"]) await expect(pill(page, other)).toBeDisabled();

    await expect(page.getByText("Status updated to Designing")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("status-spinner")).toHaveCount(0);
    await expect(pill(page, "Designing")).toHaveAttribute("aria-current", "step", { timeout: 15_000 });
    await expect(pill(page, "Printing")).toBeEnabled();
    await context.close();
  });

  test("a failed save says so and unlocks the pills instead of spinning forever", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.goto(`/jobs/details/${jobId}`);
    await expect(pill(page, "Designing")).toHaveAttribute("aria-current", "step");
    await interceptActions(page, "fail");

    await pill(page, "Printing").click();
    await expect(page.getByText("Couldn't reach the server. Check your connection and try again.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("status-spinner")).toHaveCount(0);
    await expect(pill(page, "Printing")).toBeEnabled();
    await expect(pill(page, "Designing")).toHaveAttribute("aria-current", "step");
    await context.close();
  });
});
