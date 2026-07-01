import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

async function loadFixture(pageName: string): Promise<void> {
  const source = path.join(process.cwd(), 'tests', 'fixtures', pageName);
  const target = path.join(process.cwd(), 'public', 'status.json');
  await fs.copyFile(source, target);
}

test('renders clear state in fixed HUD slot', async ({ page }) => {
  await loadFixture('status-clear.json');
  await page.goto('/sst/');
  const slot = page.locator('.slot');
  await expect(slot).toHaveCSS('width', '458px');
  await expect(slot).toHaveCSS('height', '291px');
  await expect(page.getByText('All clear')).toBeVisible();
  await expect(page).toHaveScreenshot('hud-clear.png', { animations: 'disabled' });
});

test('renders three active incidents without overflow', async ({ page }) => {
  await loadFixture('status-three-incidents.json');
  await page.goto('/sst/');
  const slot = page.locator('.slot');
  await expect(slot).toHaveCSS('width', '458px');
  await expect(slot).toHaveCSS('height', '291px');
  await expect(page.getByText('Workers AI degraded availability')).toBeVisible();
  await expect(page.getByText('Service impact: EC2 API Errors')).toBeVisible();
  await expect(page.locator('.incident')).toHaveCount(3);
  await expect(page).toHaveScreenshot('hud-three-incidents.png', { animations: 'disabled' });
});
