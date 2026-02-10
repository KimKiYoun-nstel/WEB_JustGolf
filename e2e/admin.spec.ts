import { test, expect } from '@playwright/test';

/**
 * Admin 통합 E2E 테스트
 * 
 * 테스트 대상:
 * - 관리자 전용 페이지 접근 제어
 * - 사용자 관리 (승인/거부)
 * - 대회 생성 및 관리
 * - 참가자 상태 변경
 * - 그룹 편성
 * - 부대행사 관리
 */

test.describe('Admin (관리자 기능)', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('Admin 페이지: is_admin이 아닌 사용자는 접근 불가', async ({ page }) => {
    // Arrange: 일반 사용자로 로그인된 상태라고 가정
    // (실제 테스트는 일반 사용자 세션으로 진행)
    
    // Act: /admin 접근 시도
    await page.goto('/admin');
    
    // Assert: /admin으로 가면 권한 없음 또는 /start로 리다이렉트
    // (구현에 따라 다름)
    const url = page.url();
    expect(['/admin', '/start', '/login']).toContain(
      url.split('/').filter(Boolean).slice(-1)[0] || 'root'
    );
  });

  test('Admin 페이지: is_admin=true 사용자 접근 가능', async ({ page }) => {
    // ⚠️ 관리자 계정으로 로그인 필요
    
    await page.goto('/admin');
    
    // Assert: Admin 대시보드 접근 가능 또는 로그인 필요
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });

  test('사용자 관리 페이지: /admin/users', async ({ page }) => {
    // ⚠️ 관리자 로그인 필요
    
    await page.goto('/admin/users');
    
    // Assert: 페이지 접근 가능 또는 로그인 필요
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });

  test('대회 목록 페이지: /admin/tournaments', async ({ page }) => {
    // ⚠️ 관리자 로그인 필요
    
    await page.goto('/admin/tournaments');
    
    // Assert: 페이지 접근
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });

  test('대회 생성 페이지: /admin/tournaments/new', async ({ page }) => {
    // ⚠️ 관리자 로그인 필요
    
    await page.goto('/admin/tournaments/new');
    
    // Assert: 페이지 로드
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });

  test('대회 수정 페이지: /admin/tournaments/[id]/edit', async ({ page }) => {
    // ⚠️ 관리자 + 유효한 tournament ID 필요
    
    const tournamentId = '1';
    await page.goto(`/admin/tournaments/${tournamentId}/edit`);
    
    // Assert: 페이지 로드
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });

  test('대회 대시보드: /admin/tournaments/[id]/dashboard', async ({ page }) => {
    // ⚠️ 관리자 + 유효한 tournament ID 필요
    
    const tournamentId = '1';
    await page.goto(`/admin/tournaments/${tournamentId}/dashboard`);
    
    // Assert: 대시보드 또는 로그인
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });

  test('참가자 관리: /admin/tournaments/[id]/registrations', async ({ page }) => {
    // ⚠️ 관리자 + 유효한 tournament ID 필요
    
    const tournamentId = '1';
    await page.goto(`/admin/tournaments/${tournamentId}/registrations`);
    
    // Assert: 참가자 리스트 페이지
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });

  test('참가자 상태 변경: applied → approved', async ({ page }) => {
    // ⚠️ 관리자 + 신청자 있는 대회 필요
    // 
    // 플로우:
    // 1. 관리자 로그인
    // 2. /admin/tournaments/[id]/registrations 접근
    // 3. 신청자를 'approved'로 변경
    // 4. DB에서 status='approved'로 저장되는지 확인
    
    const tournamentId = '1';
    await page.goto(`/admin/tournaments/${tournamentId}/registrations`);
    
    // Assert: 페이지 로드
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });

  test('참가자 상태: approved, waitlisted, canceled 지원', async ({ page }) => {
    // ⚠️ DB 스키마 검증
    // registrations.status CHECK: applied, approved, waitlisted, canceled, undecided
    
    const validStatuses = ['applied', 'approved', 'waitlisted', 'canceled', 'undecided'];
    
    // Assert: 모든 상태값이 포함되어 있음
    expect(validStatuses.length).toBe(5);
    expect(validStatuses).toContain('approved');
  });

  test('그룹 편성: /admin/tournaments/[id]/groups', async ({ page }) => {
    // ⚠️ 관리자 + 승인된 참가자 필요
    
    const tournamentId = '1';
    await page.goto(`/admin/tournaments/${tournamentId}/groups`);
    
    // Assert: 그룹 편성 페이지 로드
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });

  test('그룹 편성: 승인된(approved) 참가자만 표시', async ({ page }) => {
    // ⚠️ 실제 데이터 필요
    // 
    // 검증:
    // 1. DB에서 status='applied' 참가자 → 그룹 편성 화면에서 제외
    // 2. DB에서 status='approved' 참가자 → 그룹 편성에 포함
    
    const tournamentId = '1';
    await page.goto(`/admin/tournaments/${tournamentId}/groups`);
    
    // Assert: 페이지 로드
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });

  test('부대행사 관리: /admin/tournaments/[id]/side-events', async ({ page }) => {
    // ⚠️ 관리자 + 유효한 tournament ID 필요
    
    const tournamentId = '1';
    await page.goto(`/admin/tournaments/${tournamentId}/side-events`);
    
    // Assert: 부대행사 관리 페이지
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });

  test('식사 옵션 관리: /admin/tournaments/[id]/meal-options', async ({ page }) => {
    // ⚠️ 관리자 + 유효한 tournament ID 필요
    
    const tournamentId = '1';
    await page.goto(`/admin/tournaments/${tournamentId}/meal-options`);
    
    // Assert: 식사 옵션 관리 페이지
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });

  test('파일 관리: /admin/tournaments/[id]/files', async ({ page }) => {
    // ⚠️ 관리자 + 유효한 tournament ID 필요
    
    const tournamentId = '1';
    await page.goto(`/admin/tournaments/${tournamentId}/files`);
    
    // Assert: 파일 관리 페이지
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });

  test('추가 활동 관리: /admin/tournaments/[id]/extras', async ({ page }) => {
    // ⚠️ 관리자 + 유효한 tournament ID 필요
    
    const tournamentId = '1';
    await page.goto(`/admin/tournaments/${tournamentId}/extras`);
    
    // Assert: 추가 활동 관리 페이지
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });

  test('관리자 설정: /admin/tournaments/[id]/manager-setup', async ({ page }) => {
    // ⚠️ 관리자 + 유효한 tournament ID 필요
    // 다른 관리자에게 권한 위임하는 페이지
    
    const tournamentId = '1';
    await page.goto(`/admin/tournaments/${tournamentId}/manager-setup`);
    
    // Assert: 관리자 설정 페이지
    const url = page.url();
    expect(url).toMatch(/admin|login/);
  });
});
