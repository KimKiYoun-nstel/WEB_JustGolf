# GEMINI.md — 개발 지침서 (WEB_JustGolf)

## 프로젝트 개요
- 웹서비스 프로젝트
- 기술 스택: **Next.js(App Router) + Supabase + Vercel**
- UI: shadcn/ui + Tailwind 기반 구성(컴포넌트/유틸 경로 별칭 사용)

## 언어 규칙
- 답변/설명/주석은 **한국어(한글)** 기본.

## 환경 분리 (중요)
- Supabase는 개발/운영 프로젝트가 분리되어 있다.
  - 개발용: `env.local` 또는 `.env.local`
  - 운영용: `env.production.local`
- 주요 환경변수:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (서버 전용)

## 품질 게이트 (Push 전 필수)
- **반드시 `npm run build` 성공 후 push**
- 권장:
  - `npm run lint`
  - 변경 범위에 따라 `npm run test` 또는 `npm run test:e2e`

## DB 변경 규칙
- DB 스키마/RLS/트리거/함수 변경은 `db/migrations/*.sql`로 작성한다.
- 실제 적용은 **Supabase SQL Editor에서 수동 실행**이 기본 프로세스다.
- 코드에서 정책/스키마 변경 SQL을 임의로 실행하지 않는다.

## 구현 가이드 우선순위
- 사용자가 특정 구현가이드(DevGuide/Docs)를 지정하면:
  1) 해당 문서 요구사항
  2) 본 지침서
  3) 일반 모범사례
  순으로 우선한다.
- 문서가 체크리스트/검증항목을 제공하면 그대로 준수한다(누락 0).

## 작업 출력 포맷(요구)
- 작업 시작 시: “목표 / 영향 파일 / 데이터(RLS) 영향 / 테스트 계획”
- 작업 완료 시: “변경 요약 / 실행 방법 / 테스트 커맨드 / 수동 QA 시나리오 / 리스크”
