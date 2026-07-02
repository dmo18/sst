import { expect, Page, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

async function mockStatus(page: Page, fixtureName: string): Promise<void> {
  const body = await fs.readFile(path.join(process.cwd(), 'tests', 'fixtures', fixtureName), 'utf8');
  await page.route('**/status.json**', route => route.fulfill({ status: 200, contentType: 'application/json', body }));
}

test('renders clear v8 issues only control panel', async ({ page }, testInfo) => {
  await mockStatus(page, 'status-clear.json');
  await page.goto('/sst/');
  const panel = page.locator('.control-panel');
  await expect(panel).toHaveCSS('width', '458px');
  await expect(panel).toHaveCSS('height', '291px');
  await expect(page.getByText('ISSUES ONLY')).toBeVisible();
  await expect(page.getByText('v8')).toBeVisible();
  await expect(page.getByText('No active issues')).toBeVisible();
  await expect(page.getByText('DIAGNOSTIC PROVIDER LIST')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('v8-clear.png'), fullPage: true });
});

test('renders active issues and diagnostic rows', async ({ page }, testInfo) => {
  await mockStatus(page, 'status-three-incidents.json');
  await page.goto('/sst/');
  const panel = page.locator('.control-panel');
  await expect(panel).toHaveCSS('width', '458px');
  await expect(panel).toHaveCSS('height', '291px');
  await expect(page.getByText('Workers AI degraded availability')).toBeVisible();
  await expect(page.locator('.issue-card')).toHaveCount(3);
  await expect(page.locator('.diag-panel tbody tr').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('v8-issues.png'), fullPage: true });
});
