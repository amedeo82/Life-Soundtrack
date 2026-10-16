import { expect, test } from '@playwright/test';

test('la shell dell app è visibile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Life-Soundtrack' })).toBeVisible();
});
