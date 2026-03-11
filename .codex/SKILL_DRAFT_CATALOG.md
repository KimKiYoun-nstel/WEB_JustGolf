# WEB_JustGolf 스킬 초안 카탈로그 (v0)

이 문서는 현재 레포 구조를 기준으로 자주 쓰는 절차를 스킬로 분리한 초안이다.

## 분리 원칙
- 기존 `git-work-report` 스킬은 유지한다.
- 새 스킬은 "작업 수행 절차" 중심으로 설계한다.
- 중복을 줄이기 위해 유사 목적은 합친다.

## 제안 스킬 목록
1. `feature-delivery-prep`
- 목적: 구현 시작 전 분석/설계/단계 계획 문서 완성
- 커버: 요구사항 분석, 영향 파일, RLS/권한 영향, 테스트 전략, 단계별 실행 계획
- 사용자 요구 매핑: 1번

2. `playwright-e2e-regression`
- 목적: 신규/기존 기능 E2E 검증 절차 표준화
- 커버: 시나리오 설계, Playwright 작성 규칙, 실행/리포트, 회귀 검증
- 사용자 요구 매핑: 2번

3. `ui-ux-implementation-loop`
- 목적: UI 구현 기준 준수 + 사용자 피드백 기반 수정 루프
- 커버: UI 품질 기준, 반응형/접근성, 스크린샷 검증, 피드백 반영 루프
- 사용자 요구 매핑: 3번 + 5번

4. `git-delivery-gate`
- 목적: 기능 개발 단위의 Git 운영 품질 게이트
- 커버: 브랜치/커밋/검증/푸시 체크리스트
- 사용자 요구 매핑: 4번

5. `supabase-rls-security-check`
- 목적: Supabase 연동 시 env/권한/RLS 안전성 점검
- 커버: 클라이언트 경계, Service Role 보호, 마이그레이션 흐름, RLS 검증
- 사용자 요구 매핑: 6번

## 기존 스킬과의 중복 점검
- `git-work-report`와 새 `git-delivery-gate`는 목적이 다르다.
- `git-work-report`: 기간별 커밋 리포트 자동 생성
- `git-delivery-gate`: 개발 중 Git 운영 절차와 품질 게이트

## 레포 반영 근거(요약)
- App Router + Supabase + Vercel 구조
- `db/migrations/*.sql` 존재, 권한 정책 다수 운영
- `e2e/*.spec.ts`와 `playwright.config.ts`가 이미 활성 사용 중
- 미들웨어/`lib/apiGuard.ts` 기반 권한 경계 존재
- `AGENTS.md`의 빌드 게이트(`npm run build`)와 Service Role 비노출 규칙 존재
