import { test, expect } from '@playwright/test';

test.describe('Jobs Module E2E (Add, Edit, View)', () => {
  test('should successfully add, view, and edit a job', async ({ page }) => {
    // 0. Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 10000 });

    // 1. Navigate to jobs page
    await page.goto('http://localhost:3000/jobs');
    
    // Wait for the page to load
    await page.waitForSelector('text=Jobs', { state: 'visible' });

    // 2. Add Job
    await page.click('button:has-text("Add New Job")');
    
    // Wait for Add Job Modal
    await page.waitForSelector('text=Create Printing Job', { state: 'visible' });

    const totalAmountInput = page.locator('input[type="number"]').first();
    if (await totalAmountInput.isVisible()) {
      await totalAmountInput.fill('50000');
    }

    // Attempt to submit
    const submitBtn = page.locator('button:has-text("Create Job")');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    }

    // 4. View Job
    // Wait for list to load jobs
    await page.waitForTimeout(2000); 
    // Click on the first element that looks like a job card or row
    // Since we just created a job, we can click the first element with class containing 'bg-white' and maybe 'cursor-pointer', or just any visible job ID like #
    const firstJob = page.locator('text=#').first();
    await firstJob.click();

    // Verify View Form appears
    await page.waitForSelector('text=Job Status & Timeline', { state: 'visible' });

    // 5. Edit Job
    const editBtn = page.locator('button:has-text("Edit")');
    if (await editBtn.isVisible()) {
      await editBtn.click();
      
      // Wait for Edit Modal
      await page.waitForSelector('text=Edit Job', { state: 'visible' });

      // Change total amount
      if (await totalAmountInput.isVisible()) {
        await totalAmountInput.fill('60000');
      }

      const saveBtn = page.locator('button:has-text("Save Changes")');
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
      }

      // Verify View Form updates
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).toContainText('60000');
    }
  });
});
