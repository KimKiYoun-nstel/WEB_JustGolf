import { test, expect } from '@playwright/test';

test.describe('Admin Mobile UX Screenshots', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('admin mobile pages capture', async ({ page }, testInfo) => {
    test.setTimeout(120000);
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[placeholder="example@company.com"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await emailInput.waitFor({ timeout: 60000 });
    await emailInput.fill('prodigyrcn@gmail.com');
    await passwordInput.waitFor({ timeout: 60000 });
    await passwordInput.fill('123456');

    const loginButton = page.getByRole('button', { name: '로그인' }).first();
    await loginButton.click();

    await page.waitForURL(/\/(start|tournaments|admin)/);
    await expect(page.locator('body')).toBeTruthy();

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.screenshot({
      path: testInfo.outputPath('admin-dashboard-mobile.png'),
      fullPage: true,
    });

    await page.goto('/admin/tournaments');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.screenshot({
      path: testInfo.outputPath('admin-tournaments-mobile.png'),
      fullPage: true,
    });

    const tournamentId = '1';

    await page.goto(`/admin/tournaments/${tournamentId}/registrations`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.screenshot({
      path: testInfo.outputPath('admin-registrations-mobile.png'),
      fullPage: true,
    });

    const tabMenuButton = page.getByLabel('대회 메뉴 열기');
    if (await tabMenuButton.isVisible()) {
      await tabMenuButton.click();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: testInfo.outputPath('admin-tournament-menu-mobile.png'),
        fullPage: true,
      });
      await page.keyboard.press('Escape');
    }

    await page.goto(`/admin/tournaments/${tournamentId}/side-events`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.screenshot({
      path: testInfo.outputPath('admin-side-events-mobile.png'),
      fullPage: true,
    });

    await page.goto(`/admin/tournaments/${tournamentId}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.screenshot({
      path: testInfo.outputPath('admin-tournament-dashboard-mobile.png'),
      fullPage: true,
    });
  });
});
