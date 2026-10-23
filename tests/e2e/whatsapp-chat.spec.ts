import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { test, expect, request as apiRequest, type Browser } from "@playwright/test";

// Click-to-chat: a job's "Chat on WhatsApp" opens wa.me with a ready-made message filled from the job.
// Nothing is sent by the server. WRITES data: scratch database only (E2E_SCRATCH_DB=1), with the admin
// (E2E_USER_EMAIL) and staff@example.com (Staff, no amounts) sharing E2E_USER_PASSWORD.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const scratch = process.env.E2E_SCRATCH_DB === "1";
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const STATE = (who: string) => path.join(__dirname, `../../test-results/.wa-chat-${who}.json`);
const RUN = Date.now();
const python = process.env.E2E_PYTHON;

async function logIn(browser: Browser, user: string, who: string) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await page.fill('input[name="identifier"]:visible', user);
  await page.fill('input[type="password"]:visible', password!);
  await page.click('button[type="submit"]:visible');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await context.storageState({ path: STATE(who) });
  return { context, page };
}

async function as(browser: Browser, who: "admin" | "staff") {
  const context = await browser.newContext({ baseURL, storageState: STATE(who), permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  const reminder = page.getByRole("dialog", { name: /coming up/i });
  await page.addLocatorHandler(reminder, () => reminder.getByRole("button", { name: "Dismiss" }).click());
  // Never leave for WhatsApp during the test.
  await context.route(/https:\/\/wa\.me\/.*/, (route) => route.fulfill({ status: 200, body: "wa.me" }));
  return { context, page };
}

const SEC = "rep_sec_job_event";
function jobBody(client: string, phone: string, extra: Record<string, unknown> = {}) {
  return {
    client: { name: client, phone },
    category: "Standee",
    date: "2026-10-23",
    time: "10:00 AM",
    location: "Chennai",
    status: "Ready for Delivery",
    packageAmount: 1000,
    installments: [{ amount: 400, date: "2026-10-23", paymentMode: "Cash" }],
    customData: {
      fld_b_status: "Ready for Delivery",
      [SEC]: JSON.stringify([{ category: "Standee", fld_size: "", fld_qty: "1", fld_b_date: "2026-10-23", fld_due_date: "2026-10-28" }]),
      fld_financial_rates: JSON.stringify({ [`${SEC}_0`]: "1000" }),
      fld_financial_units: JSON.stringify({ [`${SEC}_0`]: "piece" }),
      ...extra,
    },
  };
}

test.describe.serial("chat on WhatsApp (scratch database only)", () => {
  test.skip(!email || !password || !scratch, "Needs E2E_USER_EMAIL, E2E_USER_PASSWORD and E2E_SCRATCH_DB=1");
  test.setTimeout(90_000);
  let jobId = "";
  let badPhoneJobId = "";
  let staffJobId = "";
  let paidJobId = "";

  test.beforeAll(async ({ browser }) => {
    const admin = await logIn(browser, email!, "admin");
    await admin.page.request.put("/api/settings/system", { data: { key: "business_upi_id", value: "addesigner@okhdfc" } });
    await admin.page.request.put("/api/settings/system", { data: { key: "business_name", value: "Add designer" } });
    const a = await admin.page.request.post("/api/jobs", { data: jobBody(`WA ${RUN}`, "073737 87172") });
    expect(a.status()).toBe(201);
    jobId = (await a.json()).id;
    const b = await admin.page.request.post("/api/jobs", { data: { ...jobBody(`WA Bad ${RUN}`, "12345"), packageAmount: 1000 } });
    expect(b.status()).toBe(201);
    badPhoneJobId = (await b.json()).id;
    const paid = await admin.page.request.post("/api/jobs", { data: { ...jobBody(`WA Paid ${RUN}`, "9876543210"), installments: [{ amount: 1000, date: "2026-10-23", paymentMode: "UPI" }] } });
    expect(paid.status()).toBe(201);
    paidJobId = (await paid.json()).id;
    await admin.context.close();
    // Staff see only the jobs assigned to them, so the staff user creates their own.
    const staff = await logIn(browser, "staff@example.com", "staff");
    const c = await staff.page.request.post("/api/jobs", { data: jobBody(`WA Staff ${RUN}`, "9876543210") });
    expect(c.status()).toBe(201);
    staffJobId = (await c.json()).id;
    await staff.context.close();
  });

  test("the old gateway endpoints are gone", async ({ browser }) => {
    const { context, page } = await as(browser, "admin");
    for (const p of ["config", "status", "messages", "test", "webhook"]) {
      expect((await page.request.get(`/api/integrations/whatsapp/${p}`)).status(), p).toBe(404);
    }
    await page.goto("/settings?section=pricing");
    await expect(page.getByRole("button", { name: "WhatsApp" })).toHaveCount(0);
    await context.close();
  });

  test("opens WhatsApp with a message filled from the job, edited text included", async ({ browser }) => {
    const { context, page } = await as(browser, "admin");
    await page.goto(`/jobs/details/${jobId}`);
    await page.getByRole("button", { name: "Chat on WhatsApp" }).click();
    const dialog = page.getByRole("dialog", { name: "Chat on WhatsApp" });
    await expect(dialog).toContainText(`WA ${RUN} · +91 73737 87172`);
    const box = dialog.getByRole("textbox", { name: "Message" });
    const link = dialog.getByRole("link", { name: "Open WhatsApp" });
    const textOf = async () => new URL((await link.getAttribute("href"))!).searchParams.get("text");

    // Status update (first) names the customer and the current stage.
    await expect(box).toHaveValue(new RegExp(`^Hi WA ${RUN}, an update on job .+: it is now Ready for Delivery\\.`));
    expect(new URL((await link.getAttribute("href"))!).pathname).toBe("/917373787172");

    // Payment reminder: balance, total, paid and UPI ID from the job and Business Details.
    await dialog.getByRole("radio", { name: /Payment reminder/ }).click();
    await expect(box).toHaveValue(/balance of ₹600 \(total ₹1,000, paid ₹400\)\. You can pay by UPI to addesigner@okhdfc\./);
    expect(await textOf()).toBe(await box.inputValue());

    // Whatever is typed is exactly what WhatsApp receives, special characters included.
    await box.fill("Hi! Your banner is ready & packed — 50% paid? Reply #yes");
    expect(await textOf()).toBe("Hi! Your banner is ready & packed — 50% paid? Reply #yes");
    await dialog.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByText("Message copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("Hi! Your banner is ready & packed — 50% paid? Reply #yes");

    // A blank message can't be opened.
    await dialog.getByRole("radio", { name: /Write your own/ }).click();
    await expect(box).toHaveValue("");
    await expect(dialog.getByRole("link", { name: "Open WhatsApp" })).toHaveCount(0);

    // Opening goes to wa.me in a new tab and closes the dialog.
    await dialog.getByRole("radio", { name: /Status update/ }).click();
    expect(await link.getAttribute("target")).toBe("_blank");
    const popup = page.waitForEvent("popup");
    await link.click();
    expect((await popup).url()).toMatch(/^https:\/\/wa\.me\/917373787172\?text=/);
    await expect(page.getByRole("dialog", { name: "Chat on WhatsApp" })).toHaveCount(0);

    // The same dialog opens from the phone number in the client card.
    await page.getByRole("button", { name: "WhatsApp", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Chat on WhatsApp" })).toBeVisible();
    await context.close();
  });

  test("a phone WhatsApp can't use is explained instead of opening a broken chat", async ({ browser }) => {
    const { context, page } = await as(browser, "admin");
    await page.goto(`/jobs/details/${badPhoneJobId}`);
    await page.getByRole("button", { name: "Chat on WhatsApp" }).click();
    const dialog = page.getByRole("dialog", { name: "Chat on WhatsApp" });
    await expect(dialog).toContainText("“12345” isn't a phone number WhatsApp can use.");
    await expect(dialog.getByRole("link", { name: "Open WhatsApp" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Copy" })).toBeEnabled();
    await context.close();
  });

  test("staff without 'See amounts' get no money in any message", async ({ browser }) => {
    const { context, page } = await as(browser, "staff");
    await page.goto(`/jobs/details/${staffJobId}`);
    await page.getByRole("button", { name: "Chat on WhatsApp" }).click();
    const dialog = page.getByRole("dialog", { name: "Chat on WhatsApp" });
    await expect(dialog.getByRole("radio")).toHaveText([/Status update/, /Order confirmation/, /Write your own/]);
    for (const name of [/Status update/, /Order confirmation/]) {
      await dialog.getByRole("radio", { name }).click();
      await expect(dialog.getByRole("textbox", { name: "Message" })).not.toHaveValue(/₹|balance|paid|total/i);
    }
    await context.close();
  });

  test("sends the invoice as a link anyone can open, and as the PDF itself", async ({ browser }) => {
    const { context, page } = await as(browser, "admin");
    await page.goto(`/jobs/details/${jobId}`);
    await page.getByRole("button", { name: "Chat on WhatsApp" }).click();
    const dialog = page.getByRole("dialog", { name: "Chat on WhatsApp" });
    const box = dialog.getByRole("textbox", { name: "Message" });
    await expect(dialog.getByRole("radio", { name: /Invoice/ })).toContainText("Creates the invoice, then adds its link");
    await dialog.getByRole("radio", { name: /Invoice/ }).click();
    await expect(box).toHaveValue(new RegExp(`^Hi WA ${RUN}, here is your invoice INV-\\d{4} from Add designer for job .+:\\nhttp://localhost:3100/api/public/invoice/\\S+\\nTotal ₹1,000, paid ₹400, balance ₹600\\. You can pay by UPI to addesigner@okhdfc\\. Thank you!$`), { timeout: 30_000 });
    const message = await box.inputValue();
    const invoiceNumber = message.match(/INV-\d{4}/)![0];
    const link = message.match(/http:\/\/\S+\/api\/public\/invoice\/\S+/)![0];
    expect(new URL((await dialog.getByRole("link", { name: "Open WhatsApp" }).getAttribute("href"))!).searchParams.get("text")).toBe(message);
    await expect(dialog).toContainText(`${invoiceNumber} · the link opens the PDF without an account for 90 days.`);

    // The customer opens it without an account: the real invoice PDF.
    const anon = await apiRequest.newContext();
    const res = await anon.get(link);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    const pdf = await res.body();
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    if (python) {
      const file = test.info().outputPath("shared-invoice.pdf");
      writeFileSync(file, pdf);
      const text = execFileSync(python, ["-I", "-c", "import sys,pypdf;print(' '.join(p.extract_text() for p in pypdf.PdfReader(sys.argv[1]).pages))", file]).toString().replace(/(\d)\s+([.,]\d)/g, "$1$2");
      expect(text).toContain(invoiceNumber);
      expect(text).toContain(`WA ${RUN}`);
      expect(text).toContain("Rs 600.00");
    }
    // A changed or truncated link opens nothing.
    const tampered = link.slice(0, -1) + (link.endsWith("A") ? "B" : "A");
    for (const bad of [tampered, link.replace(/\.[^.]+\.[^.]+$/, ".zz.x"), `${new URL(link).origin}/api/public/invoice/nope`]) {
      const r = await anon.get(bad);
      expect(r.status(), bad).toBe(404);
      expect(await r.text()).toContain("This invoice link is invalid or has expired");
    }
    await anon.dispose();

    // Share PDF: browsers that can't share files (desktop Chromium) download it instead.
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Share PDF" }).click();
    expect((await download).suggestedFilename()).toBe(`${invoiceNumber}.pdf`);

    // Reopening reuses the same invoice rather than making another.
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Chat on WhatsApp" }).click();
    await expect(page.getByRole("dialog", { name: "Chat on WhatsApp" }).getByRole("radio", { name: /Invoice/ })).toContainText(`${invoiceNumber}, as a link and a PDF`);
    await page.getByRole("dialog", { name: "Chat on WhatsApp" }).getByRole("radio", { name: /Invoice/ }).click();
    await expect(page.getByRole("dialog", { name: "Chat on WhatsApp" }).getByRole("textbox", { name: "Message" })).toHaveValue(new RegExp(invoiceNumber), { timeout: 30_000 });
    await context.close();
  });

  test("a fully paid job's invoice message thanks the customer instead of asking for money", async ({ browser }) => {
    const { context, page } = await as(browser, "admin");
    await page.goto(`/jobs/details/${paidJobId}`);
    await page.getByRole("button", { name: "Chat on WhatsApp" }).click();
    const dialog = page.getByRole("dialog", { name: "Chat on WhatsApp" });
    await expect(dialog.getByRole("radio", { name: /Payment reminder/ })).toHaveCount(0);
    await dialog.getByRole("radio", { name: /Invoice/ }).click();
    await expect(dialog.getByRole("textbox", { name: "Message" })).toHaveValue(/\nTotal ₹1,000, fully paid\. Thank you for your business!$/, { timeout: 30_000 });
    await context.close();
  });
});
