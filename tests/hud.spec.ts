import { expect, Page, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

async function mockStatus(page: Page, fixtureName: string): Promise<void> {
  const body = await fs.readFile(path.join(process.cwd(), 'tests', 'fixtures', fixtureName), 'utf8');
  await page.route('**/status.json**', route => route.fulfill({ status: 200, contentType: 'application/json', body }));
}

test('renders clear incident briefing console', async ({ page }, testInfo) => {
  await mockStatus(page, 'status-clear.json');
  await page.goto('/sst/');
  const panel = page.locator('.briefing-console');
  await expect(panel).toHaveCSS('width', '458px');
  await expect(panel).toHaveCSS('height', '291px');
  await expect(page.getByText('INCIDENT BRIEF')).toBeVisible();
  await expect(page.getByText('v10')).toBeVisible();
  await expect(page.getByText('No active issues')).toBeVisible();
  await expect(page.getByText('DIAGNOSTIC PROVIDER LIST')).toBeVisible();
  await expect(page.locator('.diag-panel tbody tr').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('clear.png'), fullPage: true });
});

test('renders active incident briefing and diagnostics', async ({ page }, testInfo) => {
  await mockStatus(page, 'status-three-incidents.json');
  await page.goto('/sst/');
  const panel = page.locator('.briefing-console');
  await expect(panel).toHaveCSS('width', '458px');
  await expect(panel).toHaveCSS('height', '291px');
  await expect(page.locator('.lead-brief')).toHaveCount(1);
  await expect(page.locator('.issue-summary')).toHaveCount(2);
  await expect(page.locator('.diag-panel tbody tr').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('issues.png'), fullPage: true });
});
