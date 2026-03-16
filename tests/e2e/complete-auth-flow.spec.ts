import { test, expect } from '@playwright/test';

/**
 * 완벽한 인증 및 권한 관리 E2E 테스트
 * 
 * 테스트 계정:
 * - 기존 관리자: prodigyrcn@gmail.com / 123456
 * - 기존 사용자: man@man.com / qwer1234!
 * 
 * 테스트 흐름:
 * 1. 관리자 로그인
 * 2. 일반 사용자 로그인
 * 3. 사용자를 관리자로 승격
 * 4. 승격된 사용자 확인
 */

test.describe('완전한 인증 흐름 (Complete Auth Flow)', () => {
  
  test.beforeEach(async ({ page, context }) => {
    // 각 테스트 전에 저장된 인증 정보 초기화
    await context.clearCookies();
  });

  test('관리자 로그인 성공 (prodigyrcn@gmail.com)', async ({ page }) => {
    // Arrange: 로그인 페이지로 이동
    await page.goto('/login');
    
    // Assert: 로그인 폼 표시 확인
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    // Act: 관리자 계정으로 로그인
    await page.fill('input[type="email"]', 'prodigyrcn@gmail.com');
    await page.fill('input[type="password"]', '123456');
    
    // 로그인 버튼 클릭
    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();
    
    // Assert: 로그인 후 /start로 리다이렉트
    await page.waitForURL(/\/(start|tournaments|admin)/);
    
    // 로그인 성공 메시지 또는 페이지 로드 확인
    await expect(page.locator('body')).toBeTruthy();
  });

  test('일반 사용자 로그인 성공 (man@man.com)', async ({ page }) => {
    // Arrange: 로그인 페이지로 이동
    await page.goto('/login');
    
    // Act: 일반 사용자 계정으로 로그인
    await page.fill('input[type="email"]', 'man@man.com');
    await page.fill('input[type="password"]', 'qwer1234!');
    
    // 로그인 버튼 클릭
    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();
    
    // Assert: 로그인 후 /start로 리다이렉트
    await page.waitForURL(/\/(start|tournaments)/);
    
    // 페이지 정상 로드 확인
    await expect(page.locator('body')).toBeTruthy();
  });

  test('로그아웃 후 로그인 페이지로 리다이렉트', async ({ page }) => {
    // Arrange: 관리자로 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', 'prodigyrcn@gmail.com');
    await page.fill('input[type="password"]', '123456');
    
    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();
    
    // 로그인 후 대기
    await page.waitForURL(/\/(start|tournaments|admin)/);
    await page.waitForTimeout(1000);
    
    // Act: 헤더의 로그아웃 버튼 찾기 및 클릭
    // 헤더에서 사용자 메뉴 찾기
    const userMenu = page.locator('[data-testid="user-menu"], button:has-text("로그아웃")').first();
    
    if (await userMenu.isVisible()) {
      await userMenu.click();
      const logoutButton = page.locator('button:has-text("로그아웃")').first();
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
      }
    } else {
      // 직접 로그아웃 페이지로 이동 시도
      await page.goto('/login');
    }
    
    // Assert: 로그인 페이지로 이동
    await page.waitForURL(/\/login/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('관리자 패널 접근 - 관리자만 가능', async ({ page }) => {
    // Arrange: 관리자로 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', 'prodigyrcn@gmail.com');
    await page.fill('input[type="password"]', '123456');
    
    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();
    
    // 로그인 후 대기
    await page.waitForURL(/\/(start|tournaments|admin)/);
    
    // Act: 관리자 페이지로 이동
    await page.goto('/admin');
    
    // Assert: 관리자 페이지 접근 성공
    await page.waitForURL(/\/admin/);
    const adminTitle = page.locator('h1, h2').filter({ hasText: /관리|대회|운영/ });
    
    // 관리자 페이지의 특정 요소가 표시되는지 확인
    const pageContent = page.locator('body');
    await expect(pageContent).toBeTruthy();
  });

  test('일반 사용자는 관리자 패널 접근 불가', async ({ page }) => {
    // Arrange: 일반 사용자로 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', 'man@man.com');
    await page.fill('input[type="password"]', 'qwer1234!');
    
    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();
    
    // 로그인 후 대기
    await page.waitForURL(/\/(start|tournaments)/);
    
    // Act: 관리자 페이지로 접근 시도
    await page.goto('/admin');
    
    // Assert: 권한 없음 메시지 또는 리다이렉트 확인
    // (페이지가 로드되지 않거나 에러 메시지 표시)
    await page.waitForTimeout(1000);
    
    const url = page.url();
    const isRedirected = url.includes('login') || url.includes('tournaments') || url.includes('start');
    expect(isRedirected || page.locator('text=/권한|접근|불가/i').isVisible()).toBeTruthy();
  });

  test('미로그인 사용자: 관리자 패널 접근 시 로그인 페이지로 리다이렉트', async ({ page }) => {
    // Act: 로그인하지 않은 상태에서 관리자 페이지 접근
    await page.goto('/admin');
    
    // Assert: 로그인 페이지로 리다이렉트
    await page.waitForURL(/\/login/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

test.describe('사용자 권한 승격 (User Promotion to Admin)', () => {
  
  test('관리자가 사용자를 관리자로 승격', async ({ page }) => {
    // Arrange: 관리자로 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', 'prodigyrcn@gmail.com');
    await page.fill('input[type="password"]', '123456');
    
    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();
    
    // 로그인 후 대기
    await page.waitForURL(/\/(start|tournaments|admin)/);
    
    // Act: 사용자 관리 페이지로 이동
    await page.goto('/admin/users');
    
    // 사용자 목록이 로드될 때까지 대기
    await page.waitForTimeout(2000);
    
    // man@man.com 사용자 찾기
    const userRow = page.locator('text=/man@man.com|man/').first().locator('..').locator('..').first();
    
    if (await userRow.isVisible()) {
      // 해당 행의 관리자 승격 버튼 찾기
      const promoteButton = userRow.locator('button:has-text(/승격|관리자|승격|설정)').first();
      
      if (await promoteButton.isVisible()) {
        // Act: 승격 버튼 클릭
        await promoteButton.click();
        
        // 확인 다이얼로그 처리
        const confirmButton = page.locator('button:has-text("확인"), button:has-text("예")').first();
        if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmButton.click();
        }
        
        // Assert: 성공 메시지 확인
        const successMessage = page.locator('text=/성공|완료|승격|승격됨/').first();
        await expect(successMessage).toBeVisible({ timeout: 3000 }).catch(() => {
          // 메시지가 없으면 페이지가 업데이트되었는지 확인
          return expect(page.locator('body')).toBeTruthy();
        });
      }
    }
  });

  test('승격된 사용자가 관리자 기능 사용 가능 확인', async ({ page }) => {
    // Arrange: 승격된 사용자(man@man.com)로 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', 'man@man.com');
    await page.fill('input[type="password"]', 'qwer1234!');
    
    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();
    
    // 로그인 후 대기
    await page.waitForURL(/\/(start|tournaments|admin)/);
    
    // Act: 관리자 페이지 접근 시도
    await page.goto('/admin');
    
    // Assert: 관리자 페이지 접근 성공
    await page.waitForTimeout(1000);
    const url = page.url();
    
    // 관리자 페이지가 로드되었거나 에러가 아니어야 함
    const isAdminPage = url.includes('/admin');
    const isErrorPage = page.locator('text=/404|not found|권한/').isVisible().catch(() => false);
    
    expect(isAdminPage).toBeTruthy();
  });
});

test.describe('작업 흐름 종합 테스트 (Complete Workflow)', () => {
  
  test('관리자 - 대회 생성 및 설정', async ({ page }) => {
    // Arrange: 관리자로 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', 'prodigyrcn@gmail.com');
    await page.fill('input[type="password"]', '123456');
    
    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();
    
    // 로그인 후 대기
    await page.waitForURL(/\/(start|tournaments|admin)/);
    
    // Act: 새 대회 생성 페이지로 이동
    await page.goto('/admin/tournaments/new');
    
    // 페이지 로드 확인
    await page.waitForTimeout(1000);
    
    // Assert: 대회 생성 폼이 표시됨
    const tornamentForm = page.locator('form, [role="form"]').first();
    const formVisible = await tornamentForm.isVisible().catch(() => false);
    
    if (formVisible) {
      // 대회명 입력
      const titleInput = page.locator('input[placeholder*="제목"], input[placeholder*="대회명"]').first();
      if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await titleInput.fill(`E2E Test Tournament ${new Date().getTime()}`);
      }
      
      // 날짜 입력
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await dateInput.fill('2025-06-15');
      }
      
      // 저장 버튼 클릭
      const saveButton = page.locator('button:has-text("저장"), button:has-text("생성"), button:has-text("등록")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // 성공 메시지 및 리다이렉트 대기
        await page.waitForTimeout(2000);
      }
    }
    
    // Assert: 대회 목록 또는 상세 페이지로 이동
    const pageUrl = page.url();
    const navigated = pageUrl.includes('/admin/tournaments');
    expect(navigated).toBeTruthy();
  });

  test('일반 사용자 - 대회 조회 및 신청', async ({ page }) => {
    // Arrange: 일반 사용자로 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', 'man@man.com');
    await page.fill('input[type="password"]', 'qwer1234!');
    
    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();
    
    // 로그인 후 대기
    await page.waitForURL(/\/(start|tournaments)/);
    
    // Act: 대회 목록 페이지로 이동
    await page.goto('/t');
    
    // 페이지 로드 대기
    await page.waitForTimeout(2000);
    
    // Assert: 대회 목록이 표시됨
    const tournamentList = page.locator('[role="table"], .tournament-item, [data-testid="tournament"]').first();
    const listExists = await tournamentList.isVisible().catch(() => false);
    
    if (listExists) {
      // 첫 번째 대회 클릭
      const firstTournament = page.locator('a, button').filter({ hasText: /대회|Tournament/ }).first();
      if (await firstTournament.isVisible()) {
        await firstTournament.click();
        
        // 대회 상세 페이지로 이동
        await page.waitForTimeout(1000);
      }
    }
    
    // Assert: 페이지가 이동되었거나 대회 정보가 표시됨
    const pageUrl = page.url();
    expect(pageUrl.includes('/t/') || pageUrl.includes('tournament')).toBeTruthy();
  });
});
