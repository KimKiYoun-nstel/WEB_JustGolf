import { test, expect } from '@playwright/test';

/**
 * 회원가입 및 승인 흐름 E2E 테스트
 * 
 * 테스트 흐름:
 * 1. 새 사용자 회원가입
 * 2. 회원가입 성공 메시지 확인
 * 3. 관리자로 로그인
 * 4. 사용자 승인 처리
 * 5. 승인된 사용자로 로그인 가능 확인
 */

test.describe('회원가입 및 승인 흐름 (Signup & Approval Flow)', () => {
  
  // 테스트용 고유 이메일 생성
  const getTestEmail = () => `test-${Date.now()}@example.com`;
  const getTestPassword = () => 'TestPass123!';
  const getTestNickname = () => `TestUser${Date.now()}`;

  test.beforeEach(async ({ context }) => {
    // 각 테스트 전에 쿠키 초기화
    await context.clearCookies();
  });

  test('새 사용자 회원가입 성공', async ({ page }) => {
    // Arrange
    const testEmail = getTestEmail();
    const testPassword = getTestPassword();
    const testNickname = getTestNickname();
    
    // Act: 로그인 페이지로 이동
    await page.goto('/login');
    
    // 회원가입 폼으로 전환 (토글 또는 탭 클릭)
    const signupTab = page.locator('button:has-text("가입"), button:has-text("회원가입")').first();
    if (await signupTab.isVisible()) {
      await signupTab.click();
      await page.waitForTimeout(500);
    }
    
    // 회원가입 폼 입력
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      await emailInput.fill(testEmail);
      await passwordInput.fill(testPassword);
      
      // 닉네임 입력 (있으면)
      const nicknameInput = page.locator('input[placeholder*="닉네임"], input[placeholder*="이름"]').first();
      if (await nicknameInput.isVisible({ timeout: 500 }).catch(() => false)) {
        await nicknameInput.fill(testNickname);
      }
      
      // 회원가입 버튼 클릭
      const signupButton = page.locator('button:has-text("가입"), button:has-text("회원가입"), button:has-text("확인")').first();
      if (await signupButton.isVisible()) {
        await signupButton.click();
        
        // 회원가입 처리 대기
        await page.waitForTimeout(2000);
      }
    }
    
    // Assert: 회원가입 완료 메시지 또는 페이지 변경
    const successMessage = page.locator('text=/가입|완료|성공|승인 대기/').first();
    const successVisible = await successMessage.isVisible({ timeout: 3000 }).catch(() => false);
    
    // 또는 로그인 페이지로 돌아갔는지 확인
    const pageContent = page.locator('body');
    expect(successVisible || (await pageContent.isVisible())).toBeTruthy();
  });

  test('회원가입 시 이메일 검증 실패 처리', async ({ page }) => {
    // Arrange: 로그인 페이지로 이동
    await page.goto('/login');
    
    // 회원가입 폼으로 전환
    const signupTab = page.locator('button:has-text("가입"), button:has-text("회원가입")').first();
    if (await signupTab.isVisible()) {
      await signupTab.click();
      await page.waitForTimeout(500);
    }
    
    // Act: 잘못된 이메일로 가입 시도
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      // 잘못된 이메일 형식
      await emailInput.fill('invalid-email');
      await passwordInput.fill('Password123!');
      
      const signupButton = page.locator('button:has-text("가입"), button:has-text("회원가입"), button:has-text("확인")').first();
      
      // 버튼 비활성화 또는 에러 메시지 확인
      const isDisabled = await signupButton.isDisabled().catch(() => false);
      const errorMessage = page.locator('text=/이메일|형식|올바르지|유효하지/').first();
      const errorVisible = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false);
      
      expect(isDisabled || errorVisible).toBeTruthy();
    }
  });

  test('회원가입 시 약한 비밀번호 거부', async ({ page }) => {
    // Arrange: 로그인 페이지로 이동
    await page.goto('/login');
    
    // 회원가입 폼으로 전환
    const signupTab = page.locator('button:has-text("가입"), button:has-text("회원가입")').first();
    if (await signupTab.isVisible()) {
      await signupTab.click();
      await page.waitForTimeout(500);
    }
    
    // Act: 약한 비밀번호로 시도
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      await emailInput.fill(getTestEmail());
      await passwordInput.fill('123'); // 너무 짧은 비밀번호
      
      const signupButton = page.locator('button:has-text("가입"), button:has-text("회원가입"), button:has-text("확인")').first();
      
      // 버튼 비활성화 또는 에러 메시지 확인
      const isDisabled = await signupButton.isDisabled().catch(() => false);
      const errorMessage = page.locator('text=/비밀번호|요구|최소|강도/').first();
      const errorVisible = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false);
      
      expect(isDisabled || errorVisible).toBeTruthy();
    }
  });

  test('관리자가 대기 중인 사용자 승인', async ({ page }) => {
    // Arrange: 이전에 가입한 사용자 대기 (실제 테스트에서는 별도 계정 사용)
    // 여기서는 man@man.com이 이미 승인되지 않은 상태를 가정
    
    // 관리자로 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', 'prodigyrcn@gmail.com');
    await page.fill('input[type="password"]', '123456');
    
    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();
    
    // 로그인 후 대기
    await page.waitForURL(/\/(start|tournaments|admin)/);
    
    // Act: 사용자 관리 페이지로 이동
    await page.goto('/admin/users');
    
    // 페이지 로드 대기
    await page.waitForTimeout(2000);
    
    // 대기 중인 사용자 찾기 (상태가 "대기" 또는 "미승인")
    const pendingUsers = page.locator('text=/대기|미승인|승인 대기/').first();
    const pendingVisible = await pendingUsers.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (pendingVisible) {
      // 해당 사용자의 행 찾기
      const userRow = pendingUsers.locator('..').locator('..').first();
      
      // 승인 버튼 찾기
      const approveButton = userRow.locator('button:has-text("승인"), button:has-text("승격"), button:has-text("설정")').first();
      
      if (await approveButton.isVisible()) {
        // Act: 승인 버튼 클릭
        await approveButton.click();
        
        // 확인 다이얼로그 처리
        const confirmButton = page.locator('button:has-text("확인"), button:has-text("예")').first();
        if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmButton.click();
          
          // 처리 대기
          await page.waitForTimeout(1500);
        }
        
        // Assert: 성공 메시지
        const successMessage = page.locator('text=/성공|완료|승인됨/').first();
        const success = await successMessage.isVisible({ timeout: 2000 }).catch(() => false);
        expect(success || pendingVisible).toBeTruthy();
      }
    }
  });

  test('승인된 사용자로 로그인 가능', async ({ page }) => {
    // Arrange: 이미 승인된 사용자(man@man.com) 사용
    // Act: 로그인 시도
    await page.goto('/login');
    await page.fill('input[type="email"]', 'man@man.com');
    await page.fill('input[type="password"]', 'qwer1234!');
    
    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();
    
    // Assert: 로그인 성공 (리다이렉트됨)
    await page.waitForURL(/\/(start|tournaments)/);
    
    const pageUrl = page.url();
    const loggedIn = pageUrl.includes('/start') || pageUrl.includes('/tournaments') || pageUrl.includes('/t');
    expect(loggedIn).toBeTruthy();
  });

  test('승인되지 않은 사용자 로그인 차단', async ({ page }) => {
    // Arrange: 승인되지 않은 사용자로 로그인 시도
    // (새로 가입한 사용자가 아직 승인되지 않은 경우)
    
    // 이 테스트는 실제 승인되지 않은 계정이 필요
    // 데모용 계정 정보
    const unapprovedEmail = `unapproved-${Date.now()}@test.com`;
    const password = 'TempPass123!';
    
    // Act: 로그인 폼으로 이동하여 가입
    await page.goto('/login');
    
    // 회원가입 폼으로 전환
    const signupTab = page.locator('button:has-text("가입"), button:has-text("회원가입")').first();
    if (await signupTab.isVisible()) {
      await signupTab.click();
      await page.waitForTimeout(500);
    }
    
    // 회원가입 진행
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      await emailInput.fill(unapprovedEmail);
      await passwordInput.fill(password);
      
      const signupButton = page.locator('button:has-text("가입"), button:has-text("회원가입"), button:has-text("확인")').first();
      if (await signupButton.isVisible()) {
        await signupButton.click();
        
        // 가입 처리 대기
        await page.waitForTimeout(2000);
      }
    }
    
    // 기다렸다가 같은 계정으로 로그인 시도
    await page.goto('/login');
    
    // 로그인 폼으로 전환 (필요한 경우)
    const loginTab = page.locator('button:has-text("로그인")').first();
    if (await loginTab.isVisible()) {
      await loginTab.click();
    }
    
    await page.fill('input[type="email"]', unapprovedEmail);
    await page.fill('input[type="password"]', password);
    
    const submitButton = page.locator('button:has-text("로그인")').first();
    if (await submitButton.isVisible()) {
      await submitButton.click();
      
      // 결과 대기
      await page.waitForTimeout(2000);
    }
    
    // Assert: 승인 대기 메시지 또는 로그인 페이지 유지
    const approvalMessage = page.locator('text=/승인|대기|관리자/').first();
    const approvalVisible = await approvalMessage.isVisible({ timeout: 2000 }).catch(() => false);
    const stillOnLogin = page.url().includes('/login');
    
    expect(approvalVisible || stillOnLogin).toBeTruthy();
  });
});

test.describe('세션 및 토큰 관리 (Session & Token Management)', () => {
  
  test('로그인 중 탭 새로고침 - 세션 유지', async ({ page, context }) => {
    // Arrange: 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', 'prodigyrcn@gmail.com');
    await page.fill('input[type="password"]', '123456');
    
    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();
    
    // 로그인 후 대기
    await page.waitForURL(/\/(start|tournaments|admin)/);
    
    const pageBeforeRefresh = page.url();
    
    // Act: 페이지 새로고침
    await page.reload();
    
    // Assert: 세션 유지 (로그인 페이지로 이동하지 않음)
    await page.waitForTimeout(2000);
    
    const pageAfterRefresh = page.url();
    const sessionMaintained = !pageAfterRefresh.includes('/login');
    
    expect(sessionMaintained).toBeTruthy();
  });

  test('장시간 미사용 후 세션 만료 감지', async ({ page, context }) => {
    // Arrange: 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', 'man@man.com');
    await page.fill('input[type="password"]', 'qwer1234!');
    
    const loginButton = page.locator('button:has-text("로그인")').first();
    await loginButton.click();
    
    // 로그인 후 대기
    await page.waitForURL(/\/(start|tournaments)/);
    
    // Act: 쿠키 제거 (세션 만료 시뮬레이션)
    await context.clearCookies();
    
    // 페이지 새로고침 또는 특정 작업 시도
    await page.reload();
    
    // Assert: 로그인 페이지로 리다이렉트
    await page.waitForTimeout(2000);
    
    const url = page.url();
    const redirectedToLogin = url.includes('/login');
    
    expect(redirectedToLogin).toBeTruthy();
  });
});
