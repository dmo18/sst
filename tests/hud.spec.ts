import { expect, Page, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

async function mockStatus(page: Page, fixtureName: string): Promise<void> {
  const body = await fs.readFile(path.join(process.cwd(), 'tests', 'fixtures', fixtureName), 'utf8');
  await page.route('**/status.json**', route => route.fulfill({ status: 200, contentType: 'application/json', body }));
}

test('renders clear v7 compact radar in allotted space', async ({ page }, testInfo) => {
  await mockStatus(page, 'status-clear.json');
  await page.goto('/sst/');
  const tile = page.locator('.tile');
  await expect(tile).toHaveCSS('width', '458px');
  await expect(tile).toHaveCSS('height', '291px');
  await expect(page.getByText('MSP STATUS')).toBeVisible();
  await expect(page.getByText('v7')).toBeVisible();
  await expect(page.getByText('All clear')).toBeVisible();
  await expect(page.locator('.status-pixel').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('v7-radar-clear.png'), fullPage: true });
});

test('renders active incident in v7 compact radar', async ({ page }, testInfo) => {
  await mockStatus(page, 'status-three-incidents.json');
  await page.goto('/sst/');
  const tile = page.locator('.tile');
  await expect(tile).toHaveCSS('width', '458px');
  await expect(tile).toHaveCSS('height', '291px');
  await expect(page.getByText('Workers AI degraded availability')).toBeVisible();
  await expect(page.locator('.radar')).toBeVisible();
  await expect(page.locator('.priority-node')).toHaveCount(6);
  await expect(page.locator('.status-pixel').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('v7-radar-incidents.png'), fullPage: true });
});
