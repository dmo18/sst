import { expect, Page, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

async function mockStatus(page: Page, fixtureName: string): Promise<void> {
  const body = await fs.readFile(path.join(process.cwd(), 'tests', 'fixtures', fixtureName), 'utf8');
  await page.route('**/status.json**', route => route.fulfill({ status: 200, contentType: 'application/json', body }));
  await page.route('**/raw.githubusercontent.com/dmo18/sst/main/status.json**', route => route.fulfill({ status: 200, contentType: 'application/json', body }));
}

test('renders clear state in fixed HUD slot', async ({ page }) => {
  await mockStatus(page, 'status-clear.json');
  await page.goto('/sst/');
  const slot = page.locator('.slot');
  await expect(slot).toHaveCSS('width', '458px');
  await expect(slot).toHaveCSS('height', '291px');
  await expect(page.getByText('All clear')).toBeVisible();
  await expect(page).toHaveScreenshot('hud-clear.png', { animations: 'disabled' });
});

test('renders three active incidents without overflow', async ({ page }) => {
  await mockStatus(page, 'status-three-incidents.json');
  await page.goto('/sst/');
  const slot = page.locator('.slot');
  await expect(slot).toHaveCSS('width', '458px');
  await expect(slot).toHaveCSS('height', '291px');
  await expect(page.getByText('Workers AI degraded availability')).toBeVisible();
  await expect(page.getByText('Service impact: EC2 API Errors')).toBeVisible();
  await expect(page.locator('.incident')).toHaveCount(3);
  await expect(page).toHaveScreenshot('hud-three-incidents.png', { animations: 'disabled' });
});
