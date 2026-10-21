import { test, expect } from "@playwright/test";

// Read-only checks that need no account and never write data.
test.describe("access control smoke tests", () => {
  test("app pages redirect to login when signed out", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  for (const path of ["/api/jobs", "/api/transactions", "/api/users", "/api/recycle-bin", "/api/settings/system"]) {
    test(`GET ${path} requires a session`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(401);
    });
  }

  test("cron endpoints fail closed without the secret", async ({ request }) => {
    const res = await request.get("/api/cron/purge-recycle-bin");
    expect(res.status()).toBe(401);
  });

  test("removed unauthenticated routes stay gone", async ({ request }) => {
    const res = await request.post("/api/password-reset-tokens", {
      data: { email: "x@example.com", token: "x", expires: "2099-01-01" },
    });
    expect([404, 405]).toContain(res.status());
  });
});
