# Playwright E2E 테스트 가이드

## 📋 개요

Playwright는 Chromium, Firefox, WebKit을 자동화하는 크로스 브라우저 테스트 프레임워크입니다.
이 프로젝트에서는 실제 브라우저에서 전체 사용자 플로우를 테스트합니다.

---

## 🎯 테스트 전략

### 테스트 레이어 (4가지)

```
1. Unit Tests (Vitest)
   ├─ 개별 함수, 로직 검증
   └─ 빠른 테스트 (밀리초 단위)

2. Integration Tests (Vitest + Mock)
   ├─ 여러 모듈 간 상호작용
   └─ Supabase Mock

3. E2E Tests (Playwright) ← 지금 구현
   ├─ 실제 브라우저에서 사용자 흐름 테스트
   ├─ 실제 Supabase 데이터 사용 (또는 테스트 DB)
   └─ 느린 테스트 (초 단위)

4. Manual Testing
   └─ 시각적 검증, 사용성 테스트
```

### E2E 테스트가 필요한 이유

- **UI 렌더링**: 실제 DOM, 브라우저 동작 확인
- **네비게이션**: 페이지 전환, 리다이렉트 검증
- **폼 제출**: 로그인, 신청, 상태 변경 플로우
- **데이터 표시**: Supabase에서 실제 데이터 조회 및 표시
- **권한 검증**: Admin 페이지 접근 제어

---

## 🚀 Playwright 설치 및 설정

### 1. 패키지 설치

```bash
npm install --save-dev @playwright/test
npx playwright install
```

### 2. 설정 파일 생성

**`playwright.config.ts`** - 다음 파일을 생성합니다:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 3. package.json 스크립트 추가

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:chrome": "playwright test --project=chromium"
  }
}
```

---

## 📝 테스트 작성 방식

### 기본 구조

```typescript
import { test, expect } from '@playwright/test';

test.describe('기능명', () => {
  
  test.beforeEach(async ({ page }) => {
    // 각 테스트 전 실행
    await page.goto('/');
  });

  test('시나리오 설명', async ({ page }) => {
    // 1. 준비 (Arrange)
    // 2. 실행 (Act)
    // 3. 검증 (Assert)
    
    await expect(page).toHaveTitle('기대되는 제목');
  });
});
```

---

## 🧪 테스트 시나리오

### 1️⃣ 인증 테스트 (Authentication)

**파일**: `e2e/auth.spec.ts`

#### 1.1 로그인 플로우
- [ ] 로그인 페이지 접근 (비로그인 → login 리다이렉트)
- [ ] 유효한 이메일/비밀번호로 로그인
- [ ] 로그인 후 /start 페이지로 리다이렉트
- [ ] 세션 유지 확인 (새로고침 후 접근 유지)

#### 1.2 회원가입 플로우
- [ ] 회원가입 폼 입력
- [ ] 계정 생성 (is_approved = false 저장 확인)
- [ ] 가입 후 로그인 페이지로 복귀
- [ ] 관리자 승인 전까지 접근 제한 확인

#### 1.3 접근 제어
- [ ] 미로그인 사용자: /start 접근 시 /login으로 리다이렉트
- [ ] 로그인 사용자: /login 접근 시 /start로 리다이렉트
- [ ] Admin 페이지: is_admin=false 사용자는 접근 불가

### 2️⃣ 대회 관련 테스트 (Tournaments)

**파일**: `e2e/tournaments.spec.ts`

#### 2.1 대회 목록 조회
- [ ] /tournaments 페이지 로드
- [ ] 대회 목록 표시
- [ ] 각 대회의 등록 상태 표시 ('신청', '확정', '대기', '취소', '미정')

#### 2.2 대회 신청
- [ ] 대회 상세 페이지 접근
- [ ] 신청 폼 입력 (기본정보, 식사, 카풀 등)
- [ ] 신청 제출 → registrations 테이블에 status='applied' 저장
- [ ] 신청 후 status 페이지에서 상태 확인

#### 2.3 대회 상태 변경
- [ ] 상태 확인 페이지 (/t/[id]/status)
- [ ] 예비자 조회 페이지 (/t/[id]/participants)
- [ ] 그룹 조회 페이지 (/t/[id]/groups)

### 3️⃣ Admin 통합 테스트 (Administration)

**파일**: `e2e/admin.spec.ts`

#### 3.1 사용자 관리 (/admin/users)
- [ ] 미승인 사용자 목록 조회
- [ ] 사용자 승인 → is_approved = true 변경
- [ ] 승인된 사용자 로그인 가능

#### 3.2 대회 생성 (/admin/tournaments/new)
- [ ] 대회 생성 폼 입력
- [ ] 대회 생성 → tournaments 테이블 저장
- [ ] 대회 목록에서 확인

#### 3.3 참가자 관리 (/admin/tournaments/[id]/registrations)
- [ ] 신청자 목록 조회
- [ ] 신청 상태 변경: applied → approved
  - [ ] 테이블의 status 갱신 확인
  - [ ] 사용자가 본인 상태 페이지에서 '확정' 표시 확인
- [ ] 반대로 approved → canceled
- [ ] 신청 취소 시 UI 업데이트 확인

#### 3.4 그룹 편성 (/admin/tournaments/[id]/groups)
- [ ] 승인된 참가자만 표시
- [ ] 그룹 생성
- [ ] 그룹에 참가자 배정

#### 3.5 부대행사 (/admin/tournaments/[id]/side-events)
- [ ] 라운드 추가 (Pre/Post)
- [ ] 라운드 식사 설정
- [ ] 라운드 숙박 설정

### 4️⃣ 데이터 무결성 테스트

**파일**: `e2e/data-integrity.spec.ts`

#### 4.1 RLS (Row Level Security) 검증
- [ ] 로그인하지 않은 사용자: 데이터 조회 불가
- [ ] 자신의 데이터만 조회 가능
- [ ] 다른 사용자 비공개 데이터 볼 수 없음

#### 4.2 스키마 정합성
- [ ] registrations.status: 'applied', 'approved', 'waitlisted', 'canceled', 'undecided' 값만 저장
- [ ] side_event_registrations.status: 'applied', 'confirmed', 'waitlisted', 'canceled'
- [ ] 불린 필드: carpool_available, meal_selected, lodging_selected (기본값 false)

#### 4.3 외래키 제약조건
- [ ] 대회 삭제: 하위 신청, 라운드, 파일도 삭제 (CASCADE)
- [ ] 신청 삭제: 추가정보, 활동선택 삭제

### 5️⃣ 사용자 인터페이스 테스트

**파일**: `e2e/ui.spec.ts`

#### 5.1 반응형 디자인
- [ ] 모바일 (375px), 태블릿 (768px), 데스크톱 (1920px)에서 렌더링
- [ ] 버튼, 폼 필드 클릭 가능

#### 5.2 에러 처리
- [ ] 네트워크 에러 시 메시지 표시
- [ ] 폼 검증 에러 표시
- [ ] 권한 없음 메시지 표시

#### 5.3 로딩 상태
- [ ] 데이터 로딩 중 로딩 표시
- [ ] 완료 후 데이터 표시

---

## ⚙️ 실행 방법

### 개발 환경에서 테스트

```bash
# 1. 개발 서버 시작
npm run dev

# 2. 다른 터미널에서 테스트 실행
npm run test:e2e

# 3. UI 모드로 대화형 테스트
npm run test:e2e:ui

# 4. 특정 브라우저만 테스트
npm run test:e2e:chrome
```

### CI/CD 파이프라인에서 테스트

- GitHub Actions, GitLab CI에서 자동 실행
- Pull Request 전 반드시 통과 필요
- 모든 브라우저(Chromium, Firefox, WebKit)에서 검증

---

## 📊 테스트 커버리지 목표

| 항목 | 대상 | 상태 |
|------|------|------|
| 로그인/가입 | 완전 자동화 | 🔴 |
| 대회 신청 | 완전 자동화 | 🔴 |
| Admin 참가자 관리 | 완전 자동화 | 🔴 |
| 권한 검증 | 부분 자동화 | 🔴 |
| 데이터 무결성 | 부분 자동화 | 🔴 |
| UI 렌더링 | 샘플 테스트 | 🔴 |

---

## 🔧 트러블슈팅

### 1. 서버 연결 실패
```bash
# dev 서버가 실행 중인지 확인
npm run dev &
npm run test:e2e
```

### 2. 테스트 타임아웃
```typescript
test('느린 작업', async ({ page }) => {
  // 타임아웃을 30초로 설정
  test.setTimeout(30000);
  
  await page.goto('/');
  // ...
});
```

### 3. 비결정적 테스트 (Flaky Tests)
```typescript
// 올바른 방식: 요소가 나타날 때까지 대기
await expect(page.locator('.button')).toBeVisible();

// 잘못된 방식: 고정 대기
await page.waitForTimeout(1000);
```

---

## 📚 참고 자료

- [Playwright 공식 문서](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Locators](https://playwright.dev/docs/locators)
- [Assertions](https://playwright.dev/docs/assertions)

---

## 🎬 다음 단계

1. ✅ 이 가이드 작성
2. ⏳ `playwright.config.ts` 생성
3. ⏳ `e2e/auth.spec.ts` 작성 및 실행
4. ⏳ `e2e/tournaments.spec.ts` 작성
5. ⏳ `e2e/admin.spec.ts` 작성
6. ⏳ CI/CD 파이프라인 통합
