---
name: supabase-rls-security-check
description: Validate Supabase integration safety in WEB_JustGolf, including env separation, client/server boundary, Service Role handling, and RLS impact checks. Use when adding or modifying DB access, auth logic, admin APIs, or policies.
---

# Supabase RLS Security Check

Supabase 연동 변경 시 권한/보안/환경 구성을 점검한다.

## 핵심 출력물
- 권한 영향 분석
- RLS 검증 체크리스트
- env/키 노출 점검 결과

## 워크플로
1. 접근 경계를 먼저 분류한다.
- 브라우저: `createBrowserClient` 사용
- 서버(Route Handler/Server Component): 요청 쿠키 기반 서버 클라이언트 사용
- 관리자 배치/API: Service Role 클라이언트 사용

2. env 사용 위치를 점검한다.
- 개발: `.env.local`
- 운영: `.env.production.local` + Vercel 환경변수
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 코드에서만 사용한다.

3. RLS 영향 범위를 작성한다.
- 관리자
- 일반 로그인 사용자
- 비로그인 사용자
- 각 역할의 `SELECT/INSERT/UPDATE/DELETE` 기대 동작을 명시한다.

4. DB 변경 절차를 준수한다.
- SQL은 `db/migrations/*.sql`에 작성한다.
- 정책/스키마 SQL은 코드에서 실행하지 않는다.
- Supabase SQL Editor 수동 실행 절차를 함께 기록한다.

5. API 가드를 확인한다.
- `lib/apiGuard.ts` 기반 권한 체크와 충돌 없는지 확인한다.
- Service Role 우회 지점에는 관리자 검증을 이중으로 둔다.

6. 검증 테스트를 수행한다.
- 비로그인 접근 차단
- 일반 사용자의 관리자 경로 차단
- 관리자 전용 쓰기 동작 허용
- 필요 시 Playwright 또는 API 스모크로 재현

## 레포 전용 규칙
- 미들웨어와 API 가드의 역할 분담을 유지한다.
- `db/migrations`와 실제 정책 상태가 어긋나지 않게 검증한다.
- 개인정보 필드는 응답 필드 레벨까지 점검한다.

## 빠른 체크 명령 예시
```bash
rg -n "SUPABASE_SERVICE_ROLE_KEY|createServiceRoleSupabaseClient|from\(\"profiles\"\)" app lib
rg -n "createBrowserClient|createServerClient" lib app
```
