import path from "node:path";
import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";

// After creating jobs the app opens the new job's details page (the first one when the form made
// several, with the others linked under "Same order"); editing stays where it is. WRITES data, so it
// runs only against a disposable database (E2E_SCRATCH_DB=1) seeded with the large-format layout.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const scratch = process.env.E2E_SCRATCH_DB === "1";
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const AUTH = path.join(__dirname, "../../test-results/.job-nav-auth.json");
const RUN = Date.now();

const menu = (page: Page) => page.locator('body > div[style*="z-index: 9999"]');
async function choose(page: Page, trigger: Locator, label: string) {
  await trigger.click();
  await menu(page).getByRole("button", { name: label, exact: true }).click();
  await expect(menu(page)).toHaveCount(0);
}

async function open(browser: Browser, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ baseURL, storageState: AUTH, viewport, ...(viewport.width < 768 ? { isMobile: true, hasTouch: true } : {}) });
  const page = await context.newPage();
  const reminder = page.getByRole("dialog", { name: /coming up/i });
  await page.addLocatorHandler(reminder, () => reminder.getByRole("button", { name: "Dismiss" }).click());
  return { context, page };
}

/** Fill job card `i` of the open job form. */
async function fillCard(page: Page, i: number, category: string, dims: string, qty: string) {
  const dialog = page.getByRole("dialog");
  const due = dialog.locator(`#field-container-fld_due_date-${i}`);
  await due.locator("div.cursor-pointer").first().click();
  await due.getByText("28", { exact: true }).last().click();
  const cat = dialog.locator(`#field-container-category-${i} button`).first();
  if ((await cat.textContent())?.trim() !== category) await choose(page, cat, category);
  await dialog.locator(`#field-container-fld_size-${i}`).getByLabel("Size").fill(dims);
  await dialog.locator(`#field-container-fld_qty-${i} input`).fill(qty);
}

async function startJob(page: Page, client: string, from = "/jobs") {
  await page.goto(from);
  await page.getByRole("button", { name: /new job|add new job/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#field-container-title input").fill(client);
  await dialog.locator("#field-container-phone input").fill("9876543210");
  return dialog;
}

const detailsUrl = /\/jobs\/details\/([a-z0-9]+)$/;
const idOf = (page: Page) => page.url().match(detailsUrl)?.[1] ?? "";

test.describe.serial("opening a job after it's created (scratch database only)", () => {
  test.skip(!email || !password || !scratch, "Needs E2E_USER_EMAIL, E2E_USER_PASSWORD and E2E_SCRATCH_DB=1");
  test.setTimeout(120_000);

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
    // Known prices, whatever another suite left: Flex per ft² at ₹25, Standee per piece at ₹450.
    const res = await page.request.put("/api/settings/system", {
      data: { key: "pricing_rules", value: { "Flex Printing": { unit: "sqft", defaultRate: 25, sizeUnit: "ft" }, Standee: { unit: "piece", defaultRate: 450 } } },
    });
    expect(res.status()).toBe(200);
    await context.close();
  });

  test("one new job opens on its details page, and Back returns to the jobs list", async ({ browser }) => {
    const { context, page } = await open(browser);
    const client = `Nav One ${RUN}`;
    const dialog = await startJob(page, client);
    await fillCard(page, 0, "Flex Printing", "10 x 6", "2");
    await dialog.getByRole("button", { name: "Create Job" }).click();
    await expect(page.getByText("Job created successfully!")).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(detailsUrl, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: client })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Same order:")).toHaveCount(0);
    await page.getByRole("button", { name: /Back to Jobs/ }).click();
    await expect(page).toHaveURL(/\/jobs(\?|$)/);
    await context.close();
  });

  test("two jobs from one form open the first, linked to the second under Same order", async ({ browser }) => {
    const { context, page } = await open(browser);
    const client = `Nav Two ${RUN}`;
    const dialog = await startJob(page, client);
    await fillCard(page, 0, "Flex Printing", "10 x 6", "2");
    await dialog.getByRole("button", { name: /Add another job/ }).click();
    await fillCard(page, 1, "Standee", "6 x 2", "1");
    await dialog.getByRole("button", { name: "Create 2 Jobs" }).click();
    await expect(page.getByText("Created 2 jobs")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Showing the first one; the others are linked under “Same order”.")).toBeVisible();
    await expect(page).toHaveURL(detailsUrl, { timeout: 30_000 });
    const firstId = idOf(page);

    // The first job (Flex) shows the second (Standee) under Same order, and the link opens it.
    await expect(page.getByRole("heading", { name: client })).toBeVisible();
    await expect(page.getByText("Flex Printing ·", { exact: false }).first()).toBeVisible();
    const sameOrder = page.locator("p", { hasText: "Same order:" });
    await expect(sameOrder.getByRole("link")).toHaveCount(1);
    await expect(sameOrder.getByRole("link")).toContainText("Standee");
    await sameOrder.getByRole("link").click();
    await expect(page).not.toHaveURL(new RegExp(`/jobs/details/${firstId}$`), { timeout: 30_000 });
    await expect(page).toHaveURL(detailsUrl);
    const secondId = idOf(page);
    expect(secondId).not.toBe(firstId);
    await expect(page.locator("p", { hasText: "Same order:" }).getByRole("link")).toContainText("Flex Printing");

    // Both exist once, for this client.
    const items = (await (await page.request.get("/api/jobs?limit=500")).json()).items as { id: string; client: { name: string }; category: string }[];
    const mine = items.filter((j) => j.client?.name === client);
    expect(mine.map((j) => j.category).sort()).toEqual(["Flex Printing", "Standee"]);
    expect(mine.map((j) => j.id).sort()).toEqual([firstId, secondId].sort());
    await context.close();
  });

  test("editing a job from its page stays there and shows the saved change", async ({ browser }) => {
    const { context, page } = await open(browser);
    const items = (await (await page.request.get("/api/jobs?limit=500")).json()).items as { id: string; client: { name: string } }[];
    const job = items.find((j) => j.client?.name === `Nav One ${RUN}`)!;
    await page.goto(`/jobs/details/${job.id}`);
    await expect(page.getByText("₹ 3,000", { exact: true }).first()).toBeVisible(); // 10 x 6 ft × 2 × ₹25
    await page.getByRole("button", { name: "Edit job" }).click();
    const dialog = page.getByRole("dialog");
    await expect(page).toHaveURL(new RegExp(`/jobs/details/${job.id}$`));
    await dialog.locator("#field-container-fld_qty-0 input").fill("3");
    await dialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Job updated successfully!")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/jobs/details/${job.id}$`));
    await expect(page.getByText("₹ 4,500", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await context.close();
  });

  test("creating from the dashboard also opens the new job", async ({ browser }) => {
    const { context, page } = await open(browser);
    const client = `Nav Dash ${RUN}`;
    const dialog = await startJob(page, client, "/dashboard/overview");
    await fillCard(page, 0, "Standee", "6 x 2", "1");
    await dialog.getByRole("button", { name: "Create Job" }).click();
    await expect(page).toHaveURL(detailsUrl, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: client })).toBeVisible();
    await context.close();
  });

  test("on a phone, a new job opens on its details page too", async ({ browser }) => {
    const { context, page } = await open(browser, { width: 390, height: 844 });
    const client = `Nav Phone ${RUN}`;
    const dialog = await startJob(page, client);
    await fillCard(page, 0, "Flex Printing", "8 x 4", "1");
    await dialog.getByRole("button", { name: "Create Job" }).click();
    await expect(page).toHaveURL(detailsUrl, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: client })).toBeVisible();
    const vw = await page.evaluate(() => document.documentElement.clientWidth);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw + 1);
    await context.close();
  });
});
