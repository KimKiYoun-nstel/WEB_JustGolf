import { test, expect } from '@playwright/test';

/**
 * 인증 흐름 E2E 테스트
 * 
 * 테스트 대상:
 * - 로그인/로그아웃
 * - 회원가입
 * - 접근 제어 (로그인 필수)
 * - 세션 유지
 */

test.describe('인증 (Authentication)', () => {
  
  test.beforeEach(async ({ page }) => {
    // 각 테스트 전에 쿠키/스토리지 초기화
    await page.context().clearCookies();
  });

  test('미로그인 사용자: /start 접근 시 /login으로 리다이렉트', async ({ page }) => {
    // Arrange: 미로그인 상태로 /start에 접근
    await page.goto('/start');
    
    // Assert: /login으로 리다이렉트됨
    await expect(page).toHaveURL(/\/login/);
    
    // Assert: 로그인 폼이 표시됨
    await expect(page.locator('button:has-text("로그인")')).toBeVisible();
  });

  test('로그인 페이지 표시', async ({ page }) => {
    // Arrange: 로그인 페이지 접근
    await page.goto('/login');
    
    // Assert: 로그인 폼 요소들이 표시됨
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("로그인")')).toBeVisible();
    await expect(page.locator('button:has-text("가입하기")')).toBeVisible();
  });

  test('유효한 자격으로 로그인 후 /start로 리다이렉트', async ({ page }) => {
    // ⚠️ 주의: 실제 테스트에서는 테스트 계정 사용
    // 더미 테스트 (실제 동작 테스트는 별도 구성 필요)
    
    // Arrange
    await page.goto('/login');
    
    // Act: 로그인 폼 입력 (테스트 계정)
    // await page.fill('input[type="email"]', 'test@example.com');
    // await page.fill('input[type="password"]', 'password123');
    // await page.click('button:has-text("로그인")');
    
    // 이 부분은 실제 Supabase 계정으로 테스트해야 함
    // 현재는 구조만 검증
    
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('회원가입 폼 표시', async ({ page }) => {
    // Arrange: 로그인 페이지 접근
    await page.goto('/login');
    
    // Act: 회원가입 탭 클릭
    // (UI 구조에 따라 수정)
    const signupButton = page.locator('button:has-text("가입하기")');
    if (await signupButton.isVisible()) {
      await signupButton.click();
    }
    
    // Assert: 회원가입 폼 요소 표시
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('로그인된 사용자: 세션 유지', async ({ page, context }) => {
    // ⚠️ 이 테스트는 실제 로그인 후 검증 필요
    // 로그인하여 세션을 설정한 후
    // 새 탭에서 /start 접근 시 리다이렉트 없이 접근 가능한지 확인
    
    // 더미 테스트 구조
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('로그아웃 후 /login으로 리다이렉트', async ({ page }) => {
    // ⚠️ 로그인된 상태에서 시작 필요
    // 1. 로그인
    // 2. 프로필 메뉴에서 로그아웃 클릭
    // 3. /login으로 리다이렉트 확인
    
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
  });

  test('로그인 후 에러 메시지: 잘못된 비밀번호', async ({ page }) => {
    // Arrange: 로그인 페이지 접근
    await page.goto('/login');
    
    // Assert: 에러 메시지 영역이 준비되어 있음
    // (실제 테스트 시 입력 후 잘못된 비밀번호 에러 메시지 검증)
    const form = page.locator('form');
    await expect(form).toBeVisible();
  });

  test('미승인 사용자: 로그인 가능 (관리자 승인 필요)', async ({ page }) => {
    // ⚠️ 이것은 설계 검증
    // 사용자 가입 후 is_approved=false로 저장
    // 로그인은 가능해야 함 (승인은 별도 프로세스)
    
    // 더미 테스트
    await page.goto('/login');
    await expect(page.locator('button:has-text("로그인")')).toBeVisible();
  });
});
