# AGENTS.md — OpenAI Codex 작업 지침 (WEB_JustGolf)

## 언어/커뮤니케이션
- 기본 언어는 **한국어(한글)**.
- PR/커밋 메시지/릴리즈 노트는 팀 규칙이 따로 없으면 한국어로 작성하되, 제목은 짧고 명확하게.

## 기술 스택(필수 명시)
- **Next.js (App Router)**
- **Supabase (Postgres/Auth/RLS/Realtime, @supabase/ssr 사용)**
- **Vercel 배포**

## 환경 분리 (Dev/Prod)
- Supabase는 개발/운영 프로젝트가 분리되어 있으며:
  - 개발 환경: `env.local` 또는 `.env.local`
  - 운영 환경: `env.production.local`
- 사용 환경변수(최소):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (서버 전용)

## 절대 규칙 (Gate)
1) **git push 전에 `npm run build`가 반드시 성공**해야 한다.
2) 사용자가 특정 구현가이드 문서(DevGuide/Docs 등)를 지정하면 **그 문서를 최우선으로 준수**한다.
3) DB 변경은 `db/migrations/*.sql`로 작성하고, **Supabase SQL Editor에서 수동 실행**되는 흐름을 따른다(코드에서 정책/스키마 변경 SQL을 직접 실행하지 않음).
4) Service Role Key는 절대 클라이언트에 노출하지 않는다.

## 저장소에서 확인된 개발/테스트 도구
- scripts:
  - build: `npm run build`
  - lint: `npm run lint`
  - unit test: `npm run test` (vitest)
  - e2e: `npm run test:e2e` (playwright)
- 테스트는 `.env.local`을 로드하는 구성이므로, 로컬에서 테스트 시 env 준비가 필요하다.

## 작업 진행 프로토콜
### 1) 착수 전(필수)
- “요구사항 → 영향 파일 → 데이터/권한(RLS) 영향 → 테스트 전략” 순서로 짧게 계획을 제출한다.
- API/권한 변경이 있으면:
  - RLS 정책 영향
  - 관리자/일반 사용자 플로우
  - 비로그인 차단 여부
  를 반드시 체크한다.

### 2) 구현 중(필수)
- Next.js App Router 기준으로 서버/클라이언트 경계를 지킨다.
- Supabase 접근은 상황에 따라:
  - 브라우저: 브라우저 클라이언트
  - 서버/Route Handler: 요청 쿠키 기반 서버 클라이언트
  - 관리자/배치: Service Role 클라이언트(키 노출 금지)
- 타입스크립트 strict 기준을 유지한다.

### 3) 완료 조건(DoD)
- `npm run build` 성공
- 변경 범위에 맞는 최소 검증(유닛/스모크/E2E 중 적절한 것) 통과
- 문서/가이드가 있으면 요구사항 대비 “누락 0” 체크리스트로 확인
- 사용자 관점의 수동 QA 시나리오 3~5개 제시

## 출력 형식(권장)
- “변경 요약 / 변경 파일 목록 / 테스트 커맨드 / 수동 QA / 위험요소”를 마지막에 고정 섹션으로 출력한다.
