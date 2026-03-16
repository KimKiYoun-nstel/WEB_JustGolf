import { test, expect } from '@playwright/test';

/**
 * 핵심 인증 흐름 E2E 테스트 (Simplified)
 * 
 * 테스트 계정:
 * - 기존 관리자: prodigyrcn@gmail.com / 123456
 * - 기존 사용자: man@man.com / qwer1234!
 */

test.describe('기본 인증 흐름 (Basic Auth Flow)', () => {

  test('로그인 페이지 접근 가능', async ({ page }) => {
    // Act: 로그인 페이지로 이동
    await page.goto('/login');

    // Assert: 페이지가 로드됨
    await expect(page).toHaveTitle(/로그인|login/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('관리자 로그인 성공', async ({ page }) => {
    // Arrange: 로그인 페이지로 이동
    await page.goto('/login');

    // Assert: 로그인 폼 표시
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Act: 관리자 계정으로 로그인
    await emailInput.fill('prodigyrcn@gmail.com');
    await passwordInput.fill('123456');

    const loginButton = page.locator('button:has-text("로그인")').first();
    await expect(loginButton).toBeVisible();
    await loginButton.click();

    // Assert: 로그인 성공 후 페이지 이동
    await page.waitForURL(/\/(start|tournaments|admin)/, { timeout: 15000 });
    expect(page.url()).not.toContain('/login');
  });

  test('일반 사용자 로그인 성공', async ({ page }) => {
    // Arrange: 로그인 페이지로 이동
    await page.goto('/login');

    // Act: 일반 사용자 계정으로 로그인
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    await emailInput.fill('man@man.com');
    await passwordInput.fill('qwer1234!');

    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();

    // Assert: 로그인 성공 후 페이지 이동
    await page.waitForURL(/\/(start|tournaments|admin)/, { timeout: 15000 });
    expect(page.url()).not.toContain('/login');
  });

  test('잘못된 비밀번호로 로그인 실패', async ({ page }) => {
    // Arrange: 로그인 페이지로 이동
    await page.goto('/login');

    // Act: 잘못된 비밀번호로 로그인 시도
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    await emailInput.fill('prodigyrcn@gmail.com');
    await passwordInput.fill('wrongpassword');

    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();

    // Assert: 로그인 페이지에 남아있거나 에러 메시지 표시
    await page.waitForTimeout(2000);
    
    const url = page.url();
    const stillOnLogin = url.includes('/login');
    
    // 에러 메시지 확인
    const errorMessage = page.locator('text=/실패|오류|자격|비밀번호|로그인 불가/i').first();
    const errorVisible = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false);

    expect(stillOnLogin || errorVisible).toBeTruthy();
  });

  test('미로그인 사용자: /start 접근 시 /login으로 리다이렉트', async ({ page }) => {
    // Act: 미로그인 상태에서 /start로 접근
    await page.goto('/start');

    // Assert: /login으로 리다이렉트됨
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });
});

test.describe('관리자 기능 접근 제어 (Admin Access Control)', () => {

  test('관리자만 관리 페이지 접근 가능', async ({ page }) => {
    // Arrange: 관리자로 로그인
    await page.goto('/login');
    
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    await emailInput.fill('prodigyrcn@gmail.com');
    await passwordInput.fill('123456');

    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();

    // 로그인 대기
    await page.waitForURL(/\/(start|tournaments|admin)/, { timeout: 15000 });

    // Act: 관리 페이지로 접근
    await page.goto('/admin');

    // Assert: 관리 페이지 접근 가능
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/admin');
  });

  test('일반 사용자는 관리 페이지 접근 불가', async ({ page }) => {
    // Arrange: 일반 사용자로 로그인
    await page.goto('/login');
    
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    await emailInput.fill('man@man.com');
    await passwordInput.fill('qwer1234!');

    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();

    // 로그인 대기
    await page.waitForURL(/\/(start|tournaments|admin)/, { timeout: 15000 });

    // Act: 관리 페이지로 접근 시도
    await page.goto('/admin');

    // Assert: 관리 페이지에 접근하지 못함
    await page.waitForTimeout(1000);
    
    const url = page.url();
    const isBlockedOrRedirected = !url.includes('/admin') || url.includes('/login') || url.includes('/tournaments');
    
    expect(isBlockedOrRedirected).toBeTruthy();
  });
});

test.describe('사용자 권한 관리 (User Permission Management)', () => {

  test('관리자가 사용자 권한 설정 페이지 접근', async ({ page }) => {
    // Arrange: 관리자로 로그인
    await page.goto('/login');
    
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    await emailInput.fill('prodigyrcn@gmail.com');
    await passwordInput.fill('123456');

    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();

    // 로그인 대기
    await page.waitForURL(/\/(start|tournaments|admin)/, { timeout: 15000 });

    // Act: 사용자 관리 페이지로 접근
    await page.goto('/admin/users');

    // Assert: 사용자 관리 페이지 로드됨
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/admin/users');
  });

  test('관리자가 사용자 목록 조회', async ({ page }) => {
    // Arrange: 관리자로 로그인
    await page.goto('/login');
    
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    await emailInput.fill('prodigyrcn@gmail.com');
    await passwordInput.fill('123456');

    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();

    // 로그인 대기
    await page.waitForURL(/\/(start|tournaments|admin)/, { timeout: 15000 });

    // Act: 사용자 관리 페이지로 접근
    await page.goto('/admin/users');

    // Assert: 페이지가 로드되고 콘텐츠 표시
    await page.waitForTimeout(2000);
    
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
    
    // 사용자 관련 텍스트가 있는지 확인
    const hasUserContent = page.locator('text=/사용자|user|관리|admin/i').first();
    const contentExists = await hasUserContent.isVisible({ timeout: 2000 }).catch(() => false);
    
    expect(page.url().includes('/admin/users') || contentExists).toBeTruthy();
  });
});
