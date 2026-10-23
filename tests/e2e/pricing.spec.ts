import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { splitProportionally } from "../../src/lib/jobs/multiJob";

// Money-critical, end to end in the real app: Settings → Pricing, the job form's line rates and totals,
// the saved jobs, Job Details and the invoice PDF. It WRITES data, so it runs only against a disposable
// database (E2E_SCRATCH_DB=1) seeded with the large-format job layout and a Size field offering
// ft / in / cm / sqft / pcs. E2E_PYTHON (a python with pypdf) lets it read the invoice PDF's text.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const scratch = process.env.E2E_SCRATCH_DB === "1";
const python = process.env.E2E_PYTHON;

const CLIENT = `E2E Pricing ${Date.now()}`;
const SEC = "rep_sec_job_event";

/** The dropdown menu CustomDropdown portals to <body>. */
const menu = (page: Page) => page.locator('body > div[style*="z-index: 9999"]');
async function choose(page: Page, trigger: Locator, label: string) {
  await trigger.click();
  await menu(page).getByRole("button", { name: label, exact: true }).click();
  await expect(menu(page)).toHaveCount(0);
}

// One sign-in for the whole file (the login form is rate limited); every test reuses the session.
const AUTH = path.join(__dirname, "../../test-results/.pricing-auth.json");

async function signIn(page: Page) {
  const reminder = page.getByRole("dialog", { name: /coming up/i });
  await page.addLocatorHandler(reminder, () => reminder.getByRole("button", { name: "Dismiss" }).click());
}

async function logIn(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await page.fill('input[name="identifier"]:visible', email!);
  await page.fill('input[type="password"]:visible', password!);
  await page.click('button[type="submit"]:visible');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

const row = (page: Page, category: string) => page.locator(`[data-testid="pricing-row"][data-category="${category}"]`);
const unitTrigger = (page: Page, category: string) => row(page, category).getByTestId("pricing-unit").getByRole("button");

async function pdfText(page: Page, url: string, name: string): Promise<string | null> {
  const res = await page.request.get(url);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  const body = await res.body();
  expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  if (!python) return null;
  const file = test.info().outputPath(`${name}.pdf`);
  writeFileSync(file, body);
  const raw = execFileSync(python, ["-I", "-c", "import sys,pypdf;print('\\n'.join(p.extract_text() for p in pypdf.PdfReader(sys.argv[1]).pages))", file]).toString();
  // Text extraction can split a number at a kerning gap ("2,967 .76"); join digits back together.
  return raw.replace(/(\d)\s+([.,]\d)/g, "$1$2");
}

/** Generate invoice opens the PDF in a new tab; return the PDF's URL from the request that tab makes. */
async function generateInvoice(page: Page): Promise<string> {
  const request = page.context().waitForEvent("request", (r) => /\/api\/invoices\/[^/]+\/pdf$/.test(new URL(r.url()).pathname));
  await page.getByRole("button", { name: "Generate invoice" }).click();
  await expect(page.getByText("Invoice generated successfully!")).toBeVisible({ timeout: 30_000 });
  return (await request).url();
}

type ApiJob = { id: string; category: string; customData: Record<string, unknown>; client: { name: string }; order: { package: number; advance: number; due: number } };
async function jobsForClient(page: Page): Promise<ApiJob[]> {
  const res = await page.request.get("/api/jobs?limit=100");
  expect(res.ok()).toBe(true);
  const { items } = (await res.json()) as { items: ApiJob[] };
  return items.filter((j) => j.client?.name === CLIENT);
}

test.describe.serial("pricing end to end (scratch database only)", () => {
  test.skip(!email || !password || !scratch, "Needs E2E_USER_EMAIL, E2E_USER_PASSWORD and E2E_SCRATCH_DB=1");
  test.setTimeout(180_000);
  test.use({ storageState: AUTH });

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await logIn(page);
    await context.storageState({ path: AUTH });
    // Start from no pricing rules, whatever another suite left behind.
    const reset = await page.request.put("/api/settings/system", { data: { key: "pricing_rules", value: {} } });
    expect(reset.status()).toBe(200);
    await context.close();
  });

  test("Settings → Pricing: Size-field units, rates, calculator, unsaved guard and save", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings?section=pricing");
    await expect(row(page, "Flex Printing")).toBeVisible();

    // The unit menu is "piece" plus exactly the Size field's values, nothing converted or hard-coded.
    await unitTrigger(page, "Flex Printing").click();
    await expect(menu(page).getByRole("button")).toHaveText(["/ piece", "/ ft", "/ in", "/ cm", "/ sqft", "/ pcs"]);
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);

    const set = async (category: string, unit: string, rate: string) => {
      await choose(page, unitTrigger(page, category), unit);
      const input = row(page, category).getByLabel(`Default rate for ${category}`);
      await input.fill("");
      await input.pressSequentially(rate); // typed key by key so "0." survives until the next digit
      await expect(input).toHaveValue(rate);
      await expect(unitTrigger(page, category)).toHaveText(unit);
    };
    await set("Flex Printing", "/ ft", "25");
    await set("Vinyl Printing", "/ in", "0.5");
    await set("Banner", "/ cm", "0.02");
    await set("Standee", "/ piece", "450");
    await set("LED Lighting Board", "/ sqft", "30");
    await set("Lighting Board", "/ pcs", "1200");
    // Rejects anything that isn't a number.
    const flex = row(page, "Flex Printing").getByLabel("Default rate for Flex Printing");
    await flex.pressSequentially("a-.");
    await expect(flex).toHaveValue("25."); // letters and minus dropped; the dot waits for its digits
    await flex.pressSequentially(".5.");
    await expect(flex).toHaveValue("25.5"); // only one decimal point
    await flex.fill("25");
    await expect(flex).toHaveValue("25");

    await expect(page.getByText("6 unsaved changes")).toBeVisible();

    // Leaving the tab with unsaved edits asks first; "Keep editing" stays put with the edits intact.
    await page.getByRole("button", { name: "Business Details" }).first().click();
    const guard = page.getByRole("dialog", { name: "Discard unsaved changes?" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "Keep editing" }).click();
    await expect(page).toHaveURL(/section=pricing/);
    await expect(page.getByText("6 unsaved changes")).toBeVisible();

    // The calculator prices with the rules being edited.
    const calc = page.getByTestId("pricing-calculator");
    const calcButtons = calc.getByRole("button");
    const tryPrice = async (category: string, dims: string, sizeUnit: string, qty: string, total: string) => {
      await choose(page, calcButtons.nth(0), category);
      await calc.getByLabel("Size").fill(dims);
      if ((await calcButtons.nth(1).textContent())?.trim() !== sizeUnit) await choose(page, calcButtons.nth(1), sizeUnit);
      await calc.getByLabel("Qty").fill(qty);
      await expect(calc.getByTestId("calc-total")).toHaveText(total);
    };
    await tryPrice("Flex Printing", "10 x 6", "ft", "2", "₹3,000");
    await expect(calc.getByTestId("calc-breakdown")).toContainText("60 ft² × 2 × ₹25 / ft");
    await tryPrice("Flex Printing", "120 x 60", "cm", "1", "₹193.75"); // 7.75 sq ft
    await tryPrice("Vinyl Printing", "3.5 x 2", "in", "3", "₹10.5");
    await tryPrice("Banner", "120 x 60", "cm", "1", "₹144");
    await tryPrice("Banner", "1 x 1", "ft", "1", "₹18.58"); // 929.03 sq cm × 0.02
    await tryPrice("LED Lighting Board", "60", "sqft", "1", "₹1,800");
    await tryPrice("Lighting Board", "4 x 3", "pcs", "2", "₹2,400");
    await tryPrice("Standee", "6 x 2", "ft", "2", "₹900");
    await tryPrice("Flex Printing", "A4", "ft", "2", "₹50"); // unreadable size: per piece, never zero
    await expect(calc.getByTestId("calc-breakdown")).toContainText("Can't measure this size");

    await page.getByRole("button", { name: "Save pricing" }).click();
    await expect(page.getByText("Pricing saved")).toBeVisible();
    await expect(page.getByText(/unsaved change/)).toHaveCount(0);

    const saved = await (await page.request.get("/api/settings/system")).json();
    expect(saved.pricing_rules).toEqual({
      "Flex Printing": { unit: "sqft", defaultRate: 25, sizeUnit: "ft" },
      "Vinyl Printing": { unit: "sqin", defaultRate: 0.5, sizeUnit: "in" },
      Banner: { unit: "sqcm", defaultRate: 0.02, sizeUnit: "cm" },
      Standee: { unit: "piece", defaultRate: 450 },
      "LED Lighting Board": { unit: "sqft", defaultRate: 30, sizeUnit: "sqft" },
      "Lighting Board": { unit: "piece", defaultRate: 1200, sizeUnit: "pcs" },
    });

    // Survives a reload exactly as typed.
    await page.reload();
    await expect(unitTrigger(page, "Vinyl Printing")).toHaveText("/ in");
    await expect(row(page, "Vinyl Printing").getByLabel("Default rate for Vinyl Printing")).toHaveValue("0.5");
    await expect(unitTrigger(page, "Lighting Board")).toHaveText("/ pcs");
    await expect(unitTrigger(page, "LED Lighting Board")).toHaveText("/ sqft");
  });

  test("the server rejects pricing it can't price", async ({ page }) => {
    await signIn(page);
    for (const value of [{ Flex: { unit: "sqkm" } }, { Flex: { unit: "sqft", defaultRate: -5 } }, { Flex: { unit: "sqft", defaultRate: "25" } }]) {
      const res = await page.request.put("/api/settings/system", { data: { key: "pricing_rules", value } });
      expect(res.status(), JSON.stringify(value)).toBe(422);
    }
    const after = await (await page.request.get("/api/settings/system")).json();
    expect(after.pricing_rules["Flex Printing"]).toEqual({ unit: "sqft", defaultRate: 25, sizeUnit: "ft" });
  });

  // Four Job Details cards become four jobs, each with its own line, discount share and advance share.
  const LINES = [
    { category: "Flex Printing", dims: "10 x 6", unit: "ft", qty: "2", prefill: "25", rate: "25", label: "Rate / ft²", hint: "60 ft² × 2 = 120 ft²", total: 3000 },
    { category: "Vinyl Printing", dims: "3.5 x 2", unit: "in", qty: "3", prefill: "0.5", rate: "0.75", label: "Rate / in²", hint: "7 in² × 3 = 21 in²", total: 15.75 },
    { category: "Banner", dims: "120 x 60", unit: "cm", qty: "1", prefill: "0.02", rate: "0.02", label: "Rate / cm²", hint: "7,200 cm²", total: 144 },
    { category: "Lighting Board", dims: "4 x 3", unit: "pcs", qty: "2", prefill: "1200", rate: "1200", label: "Rate", hint: null, total: 2400 },
  ];
  const DISCOUNT = 59.75;
  const ADVANCE = 1000;
  const SUM = LINES.reduce((a, l) => a + l.total, 0); // 5,559.75
  const discountShares = splitProportionally(DISCOUNT, LINES.map((l) => l.total));
  const advanceShares = splitProportionally(ADVANCE, LINES.map((l) => l.total));
  const packages = LINES.map((l, i) => Math.round((l.total - discountShares[i]) * 100) / 100);

  test("job form: rates prefill per unit, totals add up, and four jobs save with exact shares", async ({ page }) => {
    await signIn(page);
    await page.goto("/jobs");
    await page.getByRole("button", { name: /new job|add new job/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#field-container-title input").fill(CLIENT);
    await dialog.locator("#field-container-phone input").fill("9876543210");

    for (const [i, line] of LINES.entries()) {
      if (i > 0) await dialog.getByRole("button", { name: /Add another job/ }).click();
      const due = dialog.locator(`#field-container-fld_due_date-${i}`);
      // A new card may start with the previous card's due date; pick the 28th either way.
      await due.locator("div.cursor-pointer").first().click();
      await due.getByText("28", { exact: true }).last().click();
      await expect(due).toContainText("28/10/26");
      const cat = dialog.locator(`#field-container-category-${i} button`).first();
      if ((await cat.textContent())?.trim() !== line.category) await choose(page, cat, line.category);
      const size = dialog.locator(`#field-container-fld_size-${i}`);
      await size.getByLabel("Size").fill(line.dims);
      const unitBtn = size.getByRole("button");
      if ((await unitBtn.textContent())?.trim() !== line.unit) await choose(page, unitBtn, line.unit);
      await dialog.locator(`#field-container-fld_qty-${i} input`).fill(line.qty);
    }

    for (const [i, line] of LINES.entries()) {
      const r = dialog.locator(`[data-testid="rate-row"][data-rate-key="${SEC}_${i}"]`);
      const rateInput = r.getByRole("textbox");
      await expect(rateInput).toHaveValue(line.prefill); // the category's default rate
      if (line.rate !== line.prefill) await rateInput.fill(line.rate); // typing always wins
      await expect(r).toContainText(line.label);
      if (line.hint) await expect(r).toContainText(line.hint);
      await expect(r.getByTestId("rate-line-total")).toHaveText(`₹ ${line.total.toLocaleString("en-IN")}`);
    }

    await dialog.locator("#field-container-fld_b_discount input").fill(String(DISCOUNT));
    await expect(dialog.getByTestId("grand-total")).toHaveText(`₹ ${(SUM - DISCOUNT).toLocaleString("en-IN")}`);
    await dialog.getByRole("button", { name: "Add Installment" }).first().click();
    await dialog.getByPlaceholder("Amount").first().fill(String(ADVANCE));
    await expect(dialog.getByTestId("outstanding-balance")).toHaveText(`₹ ${(SUM - DISCOUNT - ADVANCE).toLocaleString("en-IN")}`);

    await dialog.getByRole("button", { name: "Create 4 Jobs" }).click();
    await expect(page.getByText("Created 4 jobs")).toBeVisible({ timeout: 60_000 });

    const jobs = await jobsForClient(page);
    expect(jobs).toHaveLength(4);
    const byCategory = (c: string) => jobs.find((j) => j.category === c)!;
    const units = ["sqft", "sqin", "sqcm", "piece"];
    LINES.forEach((line, i) => {
      const job = byCategory(line.category);
      expect(job, line.category).toBeTruthy();
      expect(job.order.package).toBe(packages[i]);
      expect(job.order.advance).toBe(advanceShares[i]);
      expect(job.order.due).toBe(Math.round((packages[i] - advanceShares[i]) * 100) / 100);
      expect(JSON.parse(job.customData.fld_financial_units as string)).toEqual({ [`${SEC}_0`]: units[i] });
      expect(JSON.parse(job.customData.fld_financial_rates as string)).toEqual({ [`${SEC}_0`]: line.rate });
    });
    expect(Math.round(jobs.reduce((a, j) => a + j.order.package, 0) * 100)).toBe(Math.round((SUM - DISCOUNT) * 100));
    expect(Math.round(jobs.reduce((a, j) => a + j.order.advance, 0) * 100)).toBe(ADVANCE * 100);
  });

  test("Job Details and the invoice PDF show the same money as the form", async ({ page }) => {
    await signIn(page);
    const jobs = await jobsForClient(page);
    const labels = ["₹ 25 / ft²", "₹ 0.75 / in²", "₹ 0.02 / cm²", "₹ 1,200"];
    for (const [i, line] of LINES.entries()) {
      const job = jobs.find((j) => j.category === line.category)!;
      await page.goto(`/jobs/details/${job.id}`);
      await expect(page.getByText(labels[i], { exact: true })).toBeVisible();
      await expect(page.getByText(`₹ ${line.total.toLocaleString("en-IN")}`, { exact: true }).first()).toBeVisible();
    }

    const flex = jobs.find((j) => j.category === "Flex Printing")!;
    await page.goto(`/jobs/details/${flex.id}`);
    const pdfUrl = await generateInvoice(page);
    const text = await pdfText(page, pdfUrl, "flex-invoice");
    if (text) {
      const rs = (n: number) => `Rs ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      expect(text).toContain("10 x 6 ft (60 ft²)");
      expect(text).toContain(rs(3000));
      expect(text).toContain(rs(discountShares[0]));
      expect(text).toContain(rs(packages[0]));
      expect(text).toContain(rs(Math.round((packages[0] - advanceShares[0]) * 100) / 100));
    }
    test.info().annotations.push({ type: "invoice", description: pdfUrl });
  });

  test("changing Settings → Pricing never reprices a saved job", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings?section=pricing");
    await choose(page, unitTrigger(page, "Flex Printing"), "/ piece");
    const input = row(page, "Flex Printing").getByLabel("Default rate for Flex Printing");
    await input.fill("100");
    await page.getByRole("button", { name: "Save pricing" }).click();
    await expect(page.getByText("Pricing saved")).toBeVisible();

    const flex = (await jobsForClient(page)).find((j) => j.category === "Flex Printing")!;
    expect(flex.order.package).toBe(packages[0]);
    await page.goto(`/jobs/details/${flex.id}`);
    await expect(page.getByText("₹ 25 / ft²", { exact: true })).toBeVisible();
    await expect(page.getByText("₹ 3,000", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Priced per ft² when this job was saved\. Flex Printing is now priced per piece/)).toBeVisible();

    const invoices = await page.request.get(`/api/jobs/${flex.id}`);
    expect(invoices.ok()).toBe(true);
    const text = await pdfText(page, await generateInvoice(page), "flex-invoice-after-reprice");
    if (text) expect(text).toContain(`Rs ${packages[0].toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
  });

  test("editing a saved job: a new discount updates the total right away and is what gets saved", async ({ page }) => {
    await signIn(page);
    // Banner is still per sq cm at ₹0.02, so editing keeps its line at 7,200 sq cm × ₹0.02 = ₹144.
    const banner = (await jobsForClient(page)).find((j) => j.category === "Banner")!;
    await page.goto(`/jobs/details/${banner.id}`);
    await page.getByRole("button", { name: "Edit job" }).click();
    const dialog = page.getByRole("dialog");
    const r = dialog.locator(`[data-testid="rate-row"][data-rate-key="${SEC}_0"]`);
    await expect(r.getByRole("textbox")).toHaveValue("0.02"); // the saved rate, not refilled
    await expect(r.getByTestId("rate-line-total")).toHaveText("₹ 144");
    const discount = dialog.locator("#field-container-fld_b_discount input");
    await discount.fill("44");
    await expect(dialog.getByTestId("grand-total")).toHaveText("₹ 100");
    await discount.fill("0");
    await expect(dialog.getByTestId("grand-total")).toHaveText("₹ 144");
    await discount.fill("200"); // more than the line: the total stops at zero
    await expect(dialog.getByTestId("grand-total")).toHaveText("₹ 0");
    await discount.fill("44");
    await expect(dialog.getByTestId("grand-total")).toHaveText("₹ 100");
    await dialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Job updated successfully!")).toBeVisible({ timeout: 60_000 });
    const after = (await jobsForClient(page)).find((j) => j.id === banner.id)!;
    expect(after.order.package).toBe(100);
    expect(after.order.due).toBe(Math.round((100 - after.order.advance) * 100) / 100);
  });
});
