---
name: playwright-e2e-regression
description: Design and execute Playwright E2E validation for WEB_JustGolf features and regressions. Use when new features or refactors need browser-level verification, role-based flow checks, RLS behavior validation, and reproducible test reports.
---

# Playwright E2E Regression

신규 기능과 기존 기능의 회귀를 Playwright로 검증한다.

## 핵심 출력물
- 신규 또는 보강된 `e2e/*.spec.ts`
- 실행 결과 요약(성공/실패, 실패 원인, 재현 커맨드)

## 워크플로
1. 변경사항 위험도를 분류한다.
- 인증/권한
- 관리자 기능
- 데이터 쓰기
- UI 반응형

2. 시나리오를 역할 기반으로 설계한다.
- 관리자
- 일반 사용자
- 비로그인 사용자

3. 테스트 범위를 확정한다.
- 신규 기능 happy path
- 권한 차단 path
- 기존 핵심 플로우 회귀 1~2개

4. Playwright 스펙을 작성한다.
- 우선순위 선택자: `getByRole`, `getByLabel`, `getByTestId`
- 취약한 선택자(`nth-child`, 과도한 텍스트 일치) 사용을 줄인다.
- 필요 시 `storageState`로 로그인 컨텍스트를 재사용한다.

5. 실행과 리포트를 정리한다.
- 전체: `npm run test:e2e`
- 단일 브라우저: `npm run test:e2e:chrome`
- UI 모드: `npm run test:e2e:ui`
- 디버그: `npm run test:e2e:debug`

6. 실패 분석을 남긴다.
- trace/screenshot 기반으로 원인을 분류한다.
- flaky 가능성이 있으면 대기 전략을 명시적으로 개선한다.

## 레포 전용 규칙
- `playwright.config.ts`의 `webServer` 흐름(`npm run dev`)을 기준으로 실행한다.
- 테스트 데이터 의존성이 있으면 `.env.local` 전제 조건을 먼저 명시한다.
- 빌드 게이트(`npm run build`) 전에 주요 회귀 E2E 스모크를 통과시킨다.

## 최소 결과 보고 형식
- 추가/수정한 스펙 파일
- 실행 커맨드
- 실패 여부와 핵심 로그
- 남은 리스크
