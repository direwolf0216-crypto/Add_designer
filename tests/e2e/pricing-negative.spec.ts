import path from "node:path";
import { test, expect, request as apiRequest, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

// Negative end-to-end checks for pricing and job money: signed-out and under-privileged access, malformed
// pricing, tampered job saves, hostile form input and stale settings. WRITES data, so it runs only against
// a disposable database (E2E_SCRATCH_DB=1) seeded with the large-format layout (Size units ft / in / cm /
// sqft / pcs) and three users: E2E_USER_EMAIL (admin), staff@example.com (Staff, no amounts) and
// manager@example.com (Manager), all with E2E_USER_PASSWORD.
const adminEmail = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const scratch = process.env.E2E_SCRATCH_DB === "1";
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

const SEC = "rep_sec_job_event";
const RUN = Date.now();
const STATE = (who: string) => path.join(__dirname, `../../test-results/.pricing-neg-${who}.json`);

const menu = (page: Page) => page.locator('body > div[style*="z-index: 9999"]');
async function choose(page: Page, trigger: Locator, label: string) {
  await trigger.click();
  await menu(page).getByRole("button", { name: label, exact: true }).click();
  await expect(menu(page)).toHaveCount(0);
}

async function logIn(browser: Browser, email: string, who: string) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await page.fill('input[name="identifier"]:visible', email);
  await page.fill('input[type="password"]:visible', password!);
  await page.click('button[type="submit"]:visible');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await context.storageState({ path: STATE(who) });
  await context.close();
}

async function as(browser: Browser, who: "admin" | "staff" | "manager"): Promise<{ context: BrowserContext; page: Page; api: APIRequestContext }> {
  const context = await browser.newContext({ baseURL, storageState: STATE(who) });
  const page = await context.newPage();
  const reminder = page.getByRole("dialog", { name: /coming up/i });
  await page.addLocatorHandler(reminder, () => reminder.getByRole("button", { name: "Dismiss" }).click());
  return { context, page, api: context.request };
}

const RULES = {
  "Flex Printing": { unit: "sqft", defaultRate: 25, sizeUnit: "ft" },
  Standee: { unit: "piece", defaultRate: 450 },
  Banner: { unit: "sqcm", defaultRate: 0.02, sizeUnit: "cm" },
};
const putRules = (api: APIRequestContext, value: unknown) => api.put("/api/settings/system", { data: { key: "pricing_rules", value } });
const rulesNow = async (api: APIRequestContext) => (await (await api.get("/api/settings/system")).json()).pricing_rules;

/** A job body for POST /api/jobs with one line item stored the way the job form stores it. */
type JobBody = { client: { name: string; phone: string }; category: string; date: string; time: string; location: string; packageAmount: number | string; customData: Record<string, unknown> };
function jobBody(client: string, line: { category: string; size?: string; qty?: string; rate: string; unit: string }, packageAmount: number | string, extra: Record<string, unknown> = {}): JobBody {
  return {
    client: { name: client, phone: "9876543210" },
    category: line.category,
    date: "2026-10-23",
    time: "10:00 AM",
    location: "Chennai",
    packageAmount,
    customData: {
      [SEC]: JSON.stringify([{ category: line.category, fld_size: line.size ?? "", fld_qty: line.qty ?? "1", fld_b_date: "2026-10-23", fld_due_date: "2026-10-28" }]),
      fld_financial_rates: JSON.stringify({ [`${SEC}_0`]: line.rate }),
      fld_financial_units: JSON.stringify({ [`${SEC}_0`]: line.unit }),
      ...extra,
    },
  };
}

type ApiJob = { id: string; category: string; customData: Record<string, unknown>; client: { name: string }; order: { package: number; advance: number; due: number } | null };
const jobsFor = async (api: APIRequestContext, client: string): Promise<ApiJob[]> => ((await (await api.get("/api/jobs?limit=500")).json()).items as ApiJob[]).filter((j) => j.client?.name === client);

test.describe.serial("pricing negative end to end (scratch database only)", () => {
  test.skip(!adminEmail || !password || !scratch, "Needs E2E_USER_EMAIL, E2E_USER_PASSWORD and E2E_SCRATCH_DB=1");
  test.setTimeout(180_000);

  test.beforeAll(async ({ browser }) => {
    await logIn(browser, adminEmail!, "admin");
    await logIn(browser, "staff@example.com", "staff");
    await logIn(browser, "manager@example.com", "manager");
    const { context, api } = await as(browser, "admin");
    expect((await putRules(api, RULES)).status()).toBe(200);
    await context.close();
  });

  test("signed out: every pricing and job-money request is refused", async ({ browser }) => {
    const anon = await apiRequest.newContext({ baseURL });
    expect((await anon.get("/api/settings/system")).status()).toBe(401);
    expect((await anon.put("/api/settings/system", { data: { key: "pricing_rules", value: {} } })).status()).toBe(401);
    expect((await anon.post("/api/jobs", { data: jobBody("anon", { category: "Standee", rate: "1", unit: "piece" }, 1) })).status()).toBe(401);
    expect((await anon.get("/api/jobs")).status()).toBe(401);
    await anon.dispose();
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto("/settings?section=pricing");
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test("staff and managers can't change pricing or open the Pricing tab", async ({ browser }) => {
    for (const who of ["staff", "manager"] as const) {
      const { context, page, api } = await as(browser, who);
      const res = await putRules(api, { "Flex Printing": { unit: "piece", defaultRate: 1 } });
      expect(res.status(), who).toBe(403);
      await page.goto("/settings?section=pricing");
      await expect(page).not.toHaveURL(/\/settings/);
      await expect(page.locator('[data-testid="pricing-row"]')).toHaveCount(0);
      await context.close();
    }
    const { context, api } = await as(browser, "admin");
    expect(await rulesNow(api)).toEqual(RULES);
    await context.close();
  });

  test("the server rejects malformed pricing and keeps what was saved", async ({ browser }) => {
    const { context, api } = await as(browser, "admin");
    const bad: [string, unknown][] = [
      ["unknown unit", { Flex: { unit: "sqkm" } }],
      ["old unit spelling", { Flex: { unit: "sq ft" } }],
      ["missing unit", { Flex: { defaultRate: 5 } }],
      ["negative rate", { Flex: { unit: "sqft", defaultRate: -1 } }],
      ["rate above ₹1 crore", { Flex: { unit: "sqft", defaultRate: 10_000_001 } }],
      ["rate as text", { Flex: { unit: "sqft", defaultRate: "25" } }],
      ["empty category name", { "   ": { unit: "piece" } }],
      ["Size unit too long", { Flex: { unit: "sqft", sizeUnit: "centimetres" } }],
      ["a list instead of a map", [{ unit: "piece" }]],
      ["null", null],
      ["a number", 42],
    ];
    for (const [label, value] of bad) expect((await putRules(api, value)).status(), label).toBe(422);
    expect((await api.put("/api/settings/system", { data: { key: "pricing_rulez", value: RULES } })).status()).toBe(422);
    expect((await api.put("/api/settings/system", { headers: { "Content-Type": "application/json" }, data: Buffer.from("{not json") })).status()).toBe(400);
    expect(await rulesNow(api)).toEqual(RULES);
    await context.close();
  });

  test("the server refuses job totals that don't match their line items", async ({ browser }) => {
    const { context, api } = await as(browser, "admin");
    const client = `Neg API ${RUN}`;
    const flex = { category: "Flex Printing", size: "10 x 6 ft", qty: "2", rate: "25", unit: "sqft" }; // 3,000
    const refused: [string, JobBody, RegExp][] = [
      ["a total below the lines", jobBody(client, flex, 1), /doesn't match the line items \(₹3,000\.00\)/],
      ["a total above the lines", jobBody(client, flex, 3500), /doesn't match the line items/],
      ["a total two paise off", jobBody(client, flex, 3000.02), /doesn't match/],
      ["the total before the discount", jobBody(client, flex, 3000, { fld_b_discount: "500" }), /doesn't match the line items \(₹2,500\.00\)/],
      ["a negative rate", jobBody(client, { ...flex, rate: "-25" }, 3000), /doesn't match the line items \(₹0\.00\)/],
      ["a negative discount that would add money", jobBody(client, flex, 3500, { fld_b_discount: "-500" }), /doesn't match/],
      ["a negative total without lines", { ...jobBody(client, flex, "-50"), customData: {} }, /can't be negative/],
    ];
    for (const [label, body, message] of refused) {
      const res = await api.post("/api/jobs", { data: body });
      expect(res.status(), label).toBe(400);
      expect((await res.json()).error, label).toMatch(message);
    }
    expect(await jobsFor(api, client), "nothing was saved").toHaveLength(0);

    const accepted: [string, JobBody, number][] = [
      ["the exact total", jobBody(client, flex, 3000), 3000],
      ["a paisa of rounding", jobBody(client, flex, 3000.01), 3000.01],
      ["the total after the discount", jobBody(client, flex, 2500, { fld_b_discount: "500" }), 2500],
      ["a quantity with digit grouping", jobBody(client, { ...flex, qty: "1,000" }, 1_500_000), 1_500_000],
      ["a negative quantity priced at zero", jobBody(client, { ...flex, qty: "-3" }, 0), 0],
      ["a discount bigger than the lines", jobBody(client, flex, 0, { fld_b_discount: "99999" }), 0],
      ["the units saved with the line, not today's rules", jobBody(client, { ...flex, unit: "piece" }, 50), 50],
      ["a typed total without line items", { ...jobBody(client, flex, 1234), customData: {} }, 1234],
    ];
    for (const [label, body, pkg] of accepted) {
      const res = await api.post("/api/jobs", { data: body });
      expect(res.status(), label).toBe(201);
      expect((await res.json()).order.package, label).toBe(pkg);
    }
    expect(await jobsFor(api, client)).toHaveLength(accepted.length);
    await context.close();
  });

  test("a Staff user without 'See amounts' can't set any money, even by tampering", async ({ browser }) => {
    const staff = await as(browser, "staff");
    const client = `Neg Staff ${RUN}`;
    const res = await staff.api.post("/api/jobs", { data: jobBody(client, { category: "Flex Printing", size: "10 x 6 ft", qty: "2", rate: "9999", unit: "sqft" }, 999999) });
    expect(res.status()).toBe(201);
    const created = await res.json();
    expect(created.order?.package ?? null).toBeNull(); // amounts are hidden from them
    await staff.page.goto("/jobs");
    await staff.page.getByRole("button", { name: /new job|add new job/i }).first().click();
    const dialog = staff.page.getByRole("dialog");
    await expect(dialog.locator("#field-container-category-0")).toBeVisible();
    await expect(dialog.getByText("Rates per Job")).toHaveCount(0);
    await expect(dialog.getByTestId("grand-total")).toHaveCount(0);
    await staff.context.close();

    const admin = await as(browser, "admin");
    const [job] = await jobsFor(admin.api, client);
    expect(job.order?.package ?? 0).toBe(0);
    expect(job.customData.fld_financial_rates).toBeUndefined();
    await admin.context.close();
  });

  test("Settings → Pricing: orphan categories, units the Size field dropped, bad input and discarding edits", async ({ browser }) => {
    const { context, page, api } = await as(browser, "admin");
    // A rule for a category that's gone from the form, and one priced in yd² though the Size field has no yd.
    await putRules(api, { ...RULES, "Ghost Category": { unit: "piece", defaultRate: 5 }, Standee: { unit: "sqyd", defaultRate: 3 } });
    await page.goto("/settings?section=pricing");
    const row = (c: string) => page.locator(`[data-testid="pricing-row"][data-category="${c}"]`);
    const unit = (c: string) => row(c).getByTestId("pricing-unit").getByRole("button");

    await expect(row("Ghost Category")).toContainText("Not in form");
    await expect(unit("Standee")).toHaveText("/ yd² (removed)");
    await unit("Standee").click();
    await expect(menu(page).getByRole("button")).toHaveText(["/ piece", "/ ft", "/ in", "/ cm", "/ sqft", "/ pcs", "/ yd² (removed)"]);
    await menu(page).getByRole("button", { name: "/ piece", exact: true }).click();
    await expect(unit("Standee")).toHaveText("/ piece");
    await unit("Standee").click();
    await expect(menu(page).getByRole("button", { name: /removed/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // The rate box only takes a number with one decimal point.
    const rate = row("Standee").getByLabel("Default rate for Standee");
    await rate.fill("");
    await rate.pressSequentially("abc-1.2.3₹ ");
    await expect(rate).toHaveValue("1.23");
    await rate.fill("450");

    await row("Ghost Category").getByRole("button", { name: "Clear rule" }).click();
    await expect(row("Ghost Category")).toHaveCount(0);
    await page.getByRole("button", { name: "Save pricing" }).click();
    await expect(page.getByText("Pricing saved")).toBeVisible();
    expect(await rulesNow(api)).toEqual(RULES);

    // Discarding unsaved edits really throws them away.
    await row("Flex Printing").getByLabel("Default rate for Flex Printing").fill("999");
    await page.getByRole("button", { name: "Business Details" }).first().click();
    const guard = page.getByRole("dialog", { name: "Discard unsaved changes?" });
    await guard.getByRole("button", { name: "Discard changes" }).click();
    await expect(page).toHaveURL(/section=business/);
    await page.getByRole("button", { name: "Pricing" }).first().click();
    await expect(row("Flex Printing").getByLabel("Default rate for Flex Printing")).toHaveValue("25");
    expect(await rulesNow(api)).toEqual(RULES);

    // The calculator never prices an unreadable size at zero and reads grouped quantities.
    const calc = page.getByTestId("pricing-calculator");
    const buttons = calc.getByRole("button");
    await choose(page, buttons.nth(0), "Banner");
    await calc.getByLabel("Size").fill("A4");
    await calc.getByLabel("Qty").fill("3");
    await expect(calc.getByTestId("calc-breakdown")).toContainText("Can't measure this size");
    await expect(calc.getByTestId("calc-total")).toHaveText("₹0.06");
    await choose(page, buttons.nth(0), "Standee");
    await calc.getByLabel("Qty").fill("1,000");
    await expect(calc.getByTestId("calc-total")).toHaveText("₹4,50,000");
    await calc.getByLabel("Qty").fill("");
    await expect(calc.getByTestId("calc-total")).toHaveText("₹450");
    await context.close();
  });

  test("job form: bad quantities and sizes are stopped before saving, and huge discounts floor at zero", async ({ browser }) => {
    const { context, page, api } = await as(browser, "admin");
    const client = `Neg Form ${RUN}`;
    await page.goto("/jobs");
    await page.getByRole("button", { name: /new job|add new job/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#field-container-title input").fill(client);
    await dialog.locator("#field-container-phone input").fill("9876543210");
    const due = dialog.locator("#field-container-fld_due_date-0");
    await due.locator("div.cursor-pointer").first().click();
    await due.getByText("28", { exact: true }).last().click();
    const size = dialog.locator("#field-container-fld_size-0").getByLabel("Size");
    const qty = dialog.locator("#field-container-fld_qty-0 input");
    const rateRow = dialog.locator(`[data-testid="rate-row"][data-rate-key="${SEC}_0"]`);
    const create = dialog.getByRole("button", { name: "Create Job" });

    // An empty size on a required Size field.
    await qty.fill("2");
    await create.click();
    await expect(page.getByText("Job 1: Size is required")).toBeVisible();

    await size.fill("10 x 6");
    for (const [value, message] of [["-5", "Job 1: Quantity can't be negative"], ["abc", "Job 1: Quantity must be a number"], ["0", "Job 1: Quantity must be at least 1"]] as const) {
      await qty.fill(value);
      if (value === "-5") await expect(rateRow.getByTestId("rate-line-total")).toHaveText("₹ 0");
      await create.click();
      await expect(page.getByText(message)).toBeVisible();
    }
    expect(await jobsFor(api, client), "nothing saved yet").toHaveLength(0);

    // The rate box drops letters and signs.
    const rate = rateRow.getByRole("textbox");
    await rate.fill("");
    await rate.pressSequentially("-2a5");
    await expect(rate).toHaveValue("25");

    // An unreadable size on a per-area line prices per piece, never zero.
    await qty.fill("4");
    await size.fill("A4");
    await expect(rateRow).toContainText("Add a size, e.g. 10 × 6");
    await expect(rateRow.locator('[title^="Priced per ft²: enter the size as width x height"]')).toBeVisible();
    await expect(rateRow.getByTestId("rate-line-total")).toHaveText("₹ 100");

    // A grouped quantity; a discount larger than the job floors the total at zero.
    await size.fill("10 x 6");
    await qty.fill("1,000");
    await expect(rateRow.getByTestId("rate-line-total")).toHaveText("₹ 15,00,000");
    const discount = dialog.locator("#field-container-fld_b_discount input");
    await discount.fill("99999999");
    await expect(dialog.getByTestId("grand-total")).toHaveText("₹ 0");
    await discount.fill("500");
    await expect(dialog.getByTestId("grand-total")).toHaveText("₹ 14,99,500");
    await create.click();
    await expect(page.getByText("Job created successfully!")).toBeVisible({ timeout: 60_000 });
    const [job] = await jobsFor(api, client);
    expect(job.order?.package).toBe(1_499_500);
    await context.close();
  });

  test("switching a line to a category whose form hides Size drops the old size everywhere", async ({ browser }) => {
    const { context, page, api } = await as(browser, "admin");
    const client = `Neg Switch ${RUN}`;
    // Size is shown only for Flex Printing (as many shops set it up), for this test only.
    const original = await (await api.get("/api/settings/layouts/JOB_FORM")).json();
    const schema = structuredClone(original.schema);
    const sizeField = schema.sections.find((s: { id: string }) => s.id === "sec_job_event").fields.find((f: { id: string }) => f.id === "fld_size");
    sizeField.visibilityRule = { match: "all", conditions: [{ fieldId: "fld_b_job_category", operator: "EQUALS", values: ["Flex Printing"] }] };
    sizeField.mandatory = false;
    const put = (sc: unknown) => api.put("/api/settings/layouts", { data: { formKey: "JOB_FORM", name: original.name, description: original.description ?? undefined, schema: sc, action: "publish" } });
    expect((await put(schema)).ok()).toBe(true);
    try {
      await page.goto("/jobs");
      await page.getByRole("button", { name: /new job|add new job/i }).first().click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("#field-container-title input").fill(client);
      await dialog.locator("#field-container-phone input").fill("9876543210");
      const due = dialog.locator("#field-container-fld_due_date-0");
      await due.locator("div.cursor-pointer").first().click();
      await due.getByText("28", { exact: true }).last().click();
      const category = dialog.locator("#field-container-category-0 button").first();
      const rateRow = dialog.locator(`[data-testid="rate-row"][data-rate-key="${SEC}_0"]`);

      await choose(page, category, "Flex Printing");
      await dialog.locator("#field-container-fld_size-0").getByLabel("Size").fill("3*5");
      await dialog.locator("#field-container-fld_qty-0 input").fill("2");
      await expect(rateRow).toContainText("3*5");

      // Standee hides Size: the size typed for Flex must not linger in the row, the details or the save.
      await choose(page, category, "Standee");
      await expect(dialog.locator("#field-container-fld_size-0")).toHaveCount(0);
      await expect(rateRow).not.toContainText("3*5");
      await expect(rateRow).toContainText("Qty: 2");
      await expect(rateRow.getByTestId("rate-line-total")).toHaveText("₹ 900");
      // Back to Flex: the old size doesn't come back.
      await choose(page, category, "Flex Printing");
      await expect(dialog.locator("#field-container-fld_size-0").getByLabel("Size")).toHaveValue("");
      await choose(page, category, "Standee");

      await dialog.getByRole("button", { name: "Create Job" }).click();
      await expect(page.getByText("Job created successfully!")).toBeVisible({ timeout: 60_000 });
      const [job] = await jobsFor(api, client);
      const entry = JSON.parse(String(job.customData[SEC]))[0];
      expect(entry.category).toBe("Standee");
      expect(entry.fld_size ?? "").toBe("");
      expect(job.order?.package).toBe(900);

      // The details page shows no size, and nothing as N/A.
      await page.goto(`/jobs/details/${job.id}`);
      await expect(page.getByText("Standee").first()).toBeVisible();
      await expect(page.getByText("3*5")).toHaveCount(0);
      await expect(page.getByText("N/A", { exact: true })).toHaveCount(0);
    } finally {
      await put(original.schema);
      await context.close();
    }
  });

  test("a job form save altered in transit is refused and saves nothing", async ({ browser }) => {
    const { context, page, api } = await as(browser, "admin");
    const client = `Neg Tamper ${RUN}`;
    let tampered = 0;
    // Rewrite the package the form sends to the server (the server action's multipart body).
    await page.route("**/*", async (route) => {
      const req = route.request();
      const body = req.method() === "POST" && req.headers()["next-action"] ? req.postData() : null;
      if (body && body.includes("fld_financial_rates") && body.includes(client)) {
        const next = body.replace(/(name="[^"]*package"\r\n\r\n)[^\r\n]*/, (_m, head) => `${head}1`);
        if (next !== body) tampered++;
        return route.continue({ postData: next });
      }
      return route.continue();
    });
    await page.goto("/jobs");
    await page.getByRole("button", { name: /new job|add new job/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#field-container-title input").fill(client);
    await dialog.locator("#field-container-phone input").fill("9876543210");
    const due = dialog.locator("#field-container-fld_due_date-0");
    await due.locator("div.cursor-pointer").first().click();
    await due.getByText("28", { exact: true }).last().click();
    await dialog.locator("#field-container-fld_size-0").getByLabel("Size").fill("10 x 6");
    await dialog.locator("#field-container-fld_qty-0 input").fill("2");
    await expect(dialog.getByTestId("grand-total")).toHaveText("₹ 3,000");
    await dialog.getByRole("button", { name: "Create Job" }).click();
    await expect(page.getByText(/doesn't match the line items \(₹3,000\.00\)/)).toBeVisible({ timeout: 60_000 });
    expect(tampered).toBeGreaterThan(0);
    expect(await jobsFor(api, client)).toHaveLength(0);
    await context.close();
  });
});
