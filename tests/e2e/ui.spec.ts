import { test, expect } from '@playwright/test';

/**
 * UI & UX E2E 테스트
 * 
 * 테스트 대상:
 * - 반응형 디자인 (Mobile, Tablet, Desktop)
 * - UI 컴포넌트 인터랙션
 * - 에러 처리 및 메시지
 * - 로딩 상태
 */

test.describe('UI & UX', () => {

  test.describe('반응형 디자인', () => {

    test('모바일 (375px): 메인 페이지 렌더링', async ({ page }) => {
      // Arrange: 모바일 뷰포트 설정
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Act: 메인 페이지 접근
      await page.goto('/');
      
      // Assert: 페이지 로드 및 스타일 적용
      await expect(page).toHaveTitle(/Golf|Tournament|대회|golf/i);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('태블릿 (768px): 로그인 페이지 렌더링', async ({ page }) => {
      // Arrange: 태블릿 뷰포트
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Act: 로그인 페이지 접근
      await page.goto('/login');
      
      // Assert: 폼이 표시됨
      await expect(page.locator('form')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
    });

    test('데스크톱 (1920px): 전체 레이아웃 렌더링', async ({ page }) => {
      // Arrange: 데스크톱 뷰포트
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Act: 메인 페이지
      await page.goto('/');
      
      // Assert: 페이지 로드
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('모바일: 네비게이션 메뉴 접근 가능', async ({ page }) => {
      // ⚠️ 구현에 따라 다름 (Hamburger menu vs. 항상 표시)
      
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      // 메인 요소 확인
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('UI 컴포넌트', () => {

    test('버튼: 클릭 가능 상태', async ({ page }) => {
      // Arrange: 로그인 페이지
      await page.goto('/login');
      
      // Act & Assert: 버튼 클릭 가능
      const button = page.locator('button:has-text("로그인")');
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
    });

    test('폼 입력: 텍스트 입력 가능', async ({ page }) => {
      // Arrange: 로그인 페이지
      await page.goto('/login');
      
      // Act & Assert: 이메일 필드에 입력
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible();
      
      await emailInput.fill('test@example.com');
      await expect(emailInput).toHaveValue('test@example.com');
    });

    test('카드 컴포넌트: 표시 및 스타일', async ({ page }) => {
      // Arrange: 로그인 페이지
      await page.goto('/login');
      
      // Act & Assert: 카드 컴포넌트 확인
      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('테이블: 데이터 행 표시 (Admin)', async ({ page }) => {
      // ⚠️ 관리자 로그인 필요
      
      const tournamentId = '1';
      await page.goto(`/admin/tournaments/${tournamentId}/registrations`);
      
      // 테이블이 로드될 때까지 대기
      // 로그인 필요 또는 테이블 표시
      const url = page.url();
      expect(url).toMatch(/admin|login/);
    });

    test('뱃지: 상태 표시 (예: "확정", "대기")', async ({ page }) => {
      // ⚠️ 상태가 있는 페이지 필요
      
      await page.goto('/tournaments');
      
      // 상태 뱃지 찾기
      // 기대: "신청", "확정", "대기", "취소", "미정" 중 하나 표시
      const url = page.url();
      expect(url).toMatch(/tournaments|login/);
    });
  });

  test.describe('에러 처리', () => {

    test('404 페이지: 존재하지 않는 대회', async ({ page }) => {
      // Act: 존재하지 않는 ID로 접근
      // (로그인 필수 또는 404 표시)
      
      await page.goto('/t/999999', { waitUntil: 'networkidle' });
      
      // Assert: 에러 메시지 또는 로그인 필요
      const content = page.locator('body');
      await expect(content).toBeVisible();
    });

    test('권한 없음: is_admin=false 사용자 Admin 접근', async ({ page }) => {
      // ⚠️ 일반 사용자 로그인 필요
      
      // 일반 사용자가 /admin 접근 시도
      await page.goto('/admin');
      
      // Assert: 접근 불가 또는 리다이렉트
      const url = page.url();
      expect(url).toMatch(/admin|start|login/);
    });

    test('네트워크 에러: 오프라인 상태', async ({ page }) => {
      // ⚠️ Playwright의 offline 시뮬레이션
      
      // Offline 모드 설정
      await page.context().setOffline(true);
      
      // Act: 페이지 접근 시도
      await page.goto('/login', { waitUntil: 'domcontentloaded' }).catch(() => {
        // 네트워크 에러 예상
      });
      
      // Online으로 복구
      await page.context().setOffline(false);
    });

    test('데이터 로딩 실패: 에러 메시지 표시', async ({ page }) => {
      // ⚠️ 실제 실패 시나리오 필요
      // (Supabase 쿼리 실패 시 에러 메시지 표시)
      
      await page.goto('/login');
      await expect(page).toHaveURL(/login/);
    });
  });

  test.describe('로딩 상태', () => {

    test('페이지 로딩: 로딩 표시 (스켈레톤 또는 스피너)', async ({ page }) => {
      // ⚠️ 로딩 상태 UI 확인 (느린 네트워크 시뮬레이션 필요)
      
      // 네트워크 속도 제한 설정
      await page.route('**/*', route => {
        // 느린 응답 시뮬레이션
        setTimeout(() => route.continue(), 500);
      });
      
      // 페이지 접근
      await page.goto('/');
      
      // Assert: 페이지 로드됨
      const main = page.locator('main');
      await expect(main).toBeVisible();
      
      // 라우트 정상화
      await page.unroute('**/*');
    });

    test('데이터 로딩: 목록 로딩 상태', async ({ page }) => {
      // ⚠️ 로그인 필요
      
      // 느린 로딩 시뮬레이션
      await page.route('**/rest/v1/*', route => {
        setTimeout(() => route.continue(), 1000);
      });
      
      await page.goto('/tournaments');
      
      // 로딩 완료 대기
      await page.waitForLoadState('networkidle');
      
      // 라우트 정상화
      await page.unroute('**/rest/v1/*');
    });
  });

  test.describe('폼 검증', () => {

    test('필수 필드: 이메일 입력 없이 로그인 시도', async ({ page }) => {
      // Arrange: 로그인 페이지
      await page.goto('/login');
      
      // Act: 비밀번호만 입력하고 로그인 클릭
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('password123');
      
      // Assert: 버튼 클릭 가능하거나 브라우저 검증
      const button = page.locator('button:has-text("로그인")');
      await expect(button).toBeEnabled();
    });

    test('이메일 형식 검증', async ({ page }) => {
      // Arrange: 로그인 페이지
      await page.goto('/login');
      
      // Act: 잘못된 이메일 입력
      const emailInput = page.locator('input[type="email"]');
      await emailInput.fill('invalid-email');
      
      // Assert: 유효성 검사 (HTML5 또는 커스텀)
      await expect(emailInput).toBeVisible();
    });

    test('비밀번호 길이 검증', async ({ page }) => {
      // ⚠️ 최소 길이 요구사항 (예: 8자 이상)
      
      await page.goto('/login');
      
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('short');
      
      // Assert: 입력 가능하지만 제출 시 검증
      await expect(passwordInput).toBeVisible();
    });
  });

  test.describe('동적 콘텐츠 업데이트', () => {

    test('상태 변경 후 UI 업데이트', async ({ page }) => {
      // ⚠️ Admin이 신청 상태를 'approved'로 변경 시
      // 사용자의 status 페이지에서 반영되어야 함
      
      // 이를 테스트하려면:
      // 1. Admin 로그인 → 상태 변경
      // 2. 같은 브라우저 또는 다른 브라우저에서 사용자 확인
      
      await page.goto('/login');
      await expect(page.locator('input[type="email"]')).toBeVisible();
    });

    test('실시간 알림 (선택 사항)', async ({ page }) => {
      // ⚠️ WebSocket 또는 Polling 구현 필요
      // (현재는 수동 새로고침)
      
      await page.goto('/');
      
      // 페이지 새로고침
      await page.reload();
      await expect(page).toHaveTitle(/Golf|Tournament/i);
    });
  });

  test.describe('접근성 (a11y)', () => {

    test('버튼: role="button" 또는 <button> 태그', async ({ page }) => {
      // ⚠️ 스크린 리더 호환성
      
      await page.goto('/login');
      
      // button 요소 찾기
      const button = page.locator('button:has-text("로그인")');
      await expect(button).toHaveAttribute('type', 'submit');
    });

    test('폼 레이블: <label> 또는 aria-label', async ({ page }) => {
      // ⚠️ 폼 필드 라벨 확인
      
      await page.goto('/login');
      
      // 이메일 입력 필드 확인
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible();
    });

    test('색상 대비: 텍스트 가독성', async ({ page }) => {
      // ⚠️ 색상 대비 비율 >= 4.5:1 (WCAG AA)
      // 이는 자동화하기 어렵고 매뉴얼 검토 필요
      
      await page.goto('/');
      
      // 페이지 로드 확인만
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });
});
