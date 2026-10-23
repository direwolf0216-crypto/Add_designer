import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";

// Daily Ledger: Income, Expense and Net Today each split into Cash, UPI and Bank (plus Other when a
// Cheque or unknown mode is used today). Creates real transactions, so it only runs against the
// scratch database, and deletes them again at the end.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const scratch = process.env.E2E_SCRATCH_DB === "1";
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const AUTH = path.join(__dirname, "../../test-results/.ledger-modes-auth.json");

type Figure = "income" | "expense" | "net";
type Mode = "cash" | "upi" | "bank" | "other";
type Reading = Record<Figure, { total: number; modes: Partial<Record<Mode, number>> }>;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
/** "₹1,000.10", "−₹4,000", "+₹50" → number. */
const money = (text: string) => {
  const t = text.replace(/\s/g, "");
  const n = Number.parseFloat(t.replace(/[^0-9.]/g, "") || "0");
  return /^[−-]/.test(t) ? -n : n;
};
/** Today in the business timezone (IST), as the form posts it. */
const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

async function open(browser: Browser) {
  const context = await browser.newContext({ baseURL, storageState: AUTH, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const reminder = page.getByRole("dialog", { name: /coming up/i });
  await page.addLocatorHandler(reminder, () => reminder.getByRole("button", { name: "Dismiss" }).click());
  return { context, page };
}

async function read(page: Page): Promise<Reading> {
  await page.goto("/transactions/overview");
  await expect(page.locator('[data-today-figure="income"] [data-figure-total]')).toBeVisible({ timeout: 30_000 });
  const out = {} as Reading;
  for (const f of ["income", "expense", "net"] as Figure[]) {
    const tile = page.locator(`[data-today-figure="${f}"]`);
    const total = money(await tile.locator("[data-figure-total]").innerText());
    const modes: Partial<Record<Mode, number>> = {};
    for (const chip of await tile.locator("[data-mode]").all()) {
      const key = (await chip.getAttribute("data-mode")) as Mode;
      // A shortened figure (₹1.2 L) carries the exact one in its tooltip.
      const amount = chip.locator("span[title]");
      const text = (await amount.count()) ? `${(await chip.locator("span").first().innerText()).startsWith("+") ? "+" : ""}${await amount.getAttribute("title")}` : await chip.locator("span").first().innerText();
      modes[key] = money(text);
    }
    out[f] = { total, modes };
  }
  return out;
}

test.describe.serial("daily ledger payment modes (scratch database only)", () => {
  test.skip(!email || !password || !scratch, "Needs E2E_USER_EMAIL, E2E_USER_PASSWORD and E2E_SCRATCH_DB=1");
  const created: string[] = [];

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

  test.afterAll(async ({ browser }) => {
    if (!created.length) return;
    const { context, page } = await open(browser);
    for (const id of created) await page.request.delete(`/api/transactions/${id}`, { headers: { Origin: baseURL } });
    await context.close();
  });

  test("each figure shows Cash, UPI and Bank, and the chips add up to it", async ({ browser }) => {
    const { context, page } = await open(browser);
    const r = await read(page);
    for (const f of ["income", "expense", "net"] as Figure[]) {
      for (const m of ["cash", "upi", "bank"] as Mode[]) expect(r[f].modes[m], `${f} ${m}`).not.toBeUndefined();
      const sum = round2(Object.values(r[f].modes).reduce((a, v) => a + (v ?? 0), 0));
      expect(sum, `${f} chips`).toBe(r[f].total);
    }
    expect(round2(r.income.total - r.expense.total)).toBe(r.net.total);
    await context.close();
  });

  test("new transactions move exactly their own mode's chips, in paise", async ({ browser }) => {
    const { context, page } = await open(browser);
    const before = await read(page);
    const date = todayIST();
    const add = [
      { type: "INCOME", paymentMode: "Cash", amount: 1000.1, category: "Xerox" },
      { type: "INCOME", paymentMode: "UPI", amount: 250.2, category: "Xerox" },
      { type: "INCOME", paymentMode: "Bank Transfer", amount: 300, category: "Printing Job" },
      { type: "EXPENSE", paymentMode: "Cash", amount: 99.95, category: "Ink/Toner" },
      { type: "EXPENSE", paymentMode: "UPI", amount: 400, category: "Paper Purchase" },
      { type: "EXPENSE", paymentMode: "Bank Transfer", amount: 0.05, category: "Electricity" },
      { type: "INCOME", paymentMode: "Cheque", amount: 50, category: "Others" },
    ];
    for (const t of add) {
      const res = await page.request.post("/api/transactions", { data: { ...t, date }, headers: { Origin: baseURL } });
      expect(res.ok(), await res.text()).toBe(true);
      const body = await res.json();
      created.push(body.id ?? body.transaction?.id);
    }
    expect(created.every(Boolean)).toBe(true);

    const after = await read(page);
    const delta = (f: Figure, m: Mode) => round2((after[f].modes[m] ?? 0) - (before[f].modes[m] ?? 0));
    expect(delta("income", "cash")).toBe(1000.1);
    expect(delta("income", "upi")).toBe(250.2);
    expect(delta("income", "bank")).toBe(300);
    expect(delta("income", "other")).toBe(50);
    expect(delta("expense", "cash")).toBe(99.95);
    expect(delta("expense", "upi")).toBe(400);
    expect(delta("expense", "bank")).toBe(0.05);
    expect(delta("expense", "other")).toBe(0);
    expect(delta("net", "cash")).toBe(900.15);
    expect(delta("net", "upi")).toBe(-149.8);
    expect(delta("net", "bank")).toBe(299.95);
    expect(delta("net", "other")).toBe(50);
    expect(round2(after.income.total - before.income.total)).toBe(1600.3);
    expect(round2(after.expense.total - before.expense.total)).toBe(500);
    expect(round2(after.net.total - before.net.total)).toBe(1100.3);
    // A Cheque was used today, so the Other chip shows on all three figures.
    for (const f of ["income", "expense", "net"] as Figure[]) {
      expect(after[f].modes.other, `${f} other`).not.toBeUndefined();
      const sum = round2(Object.values(after[f].modes).reduce((a, v) => a + (v ?? 0), 0));
      expect(sum, `${f} chips`).toBe(after[f].total);
    }
    await context.close();
  });

  test("the chips fit on a phone", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.setViewportSize({ width: 360, height: 800 });
    await read(page);
    for (const chip of await page.locator("[data-today-figure] [data-mode]").all()) {
      const fits = await chip.evaluate((el) => {
        const amount = el.querySelector("span")!;
        return amount.scrollWidth <= amount.clientWidth + 1;
      });
      expect(fits).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await context.close();
  });
});
