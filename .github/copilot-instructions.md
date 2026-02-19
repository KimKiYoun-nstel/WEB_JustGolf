# Copilot Instructions (Korean-first) — WEB_JustGolf

## 0) 기본 원칙
- **모든 대화/설명/주석은 한국어(한글) 우선**으로 작성한다.
- 본 프로젝트는 **Next.js(App Router) + Supabase(Postgres/Auth/RLS/Realtime) + Vercel 배포** 스택이다.
- 목표는 “작동하는 코드”가 아니라 **운영 가능한 완성도(테스트/보안/RLS/문서/빌드 안정성 포함)**다.

## 1) 환경 구성 (Supabase: 개발/운영 분리)
- Supabase는 **개발/운영 프로젝트가 분리**되어 있으며, 환경파일을 다음처럼 구분한다:
  - 개발: `env.local` 또는 `.env.local`
  - 운영: `env.production.local`
- 절대 키/토큰을 커밋하지 않는다.
- 필요한 핵심 환경변수:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, 클라이언트 노출 금지)

## 2) Git push 전 필수 체크
- **푸시 전에 반드시 `npm run build`가 성공해야 한다.**
- 가능하면 아래도 함께 확인한다:
  - `npm run lint`
  - 변경 영향이 있으면 `npm run test` 또는 `npm run test:e2e`

## 3) 구현 가이드 문서 우선
- 사용자가 별도로 “구현가이드/설계문서(DevGuide/Docs 등)”를 지정하면 **해당 문서를 최우선**으로 따른다.
- 작업 중 스스로 완성도 기준을 세우고(체크리스트), **누락 0**을 목표로 구현/검증/정리까지 완료한다.

## 4) 코드베이스 규칙
- Next.js는 App Router 기반이며, 서버/클라이언트 경계를 명확히 한다.
- Supabase 접근 권장:
  - 브라우저: 브라우저 클라이언트
  - 서버/Route Handler: 요청 쿠키 기반 서버 클라이언트
  - 관리자/배치: Service Role 클라이언트(키 노출 금지)
- DB 변경:
  - DB 스키마/정책 변경은 **`db/migrations/*.sql` 파일로 관리**하고, **Supabase SQL Editor에서 수동 실행**되는 흐름을 따른다.
  - 코드에서 “임의 SQL 실행”으로 정책/스키마를 바꾸지 않는다.

## 5) 품질 기준 (웹서비스 공통)
- 접근성: aria, 키보드 포커스, 의미론적 마크업을 기본으로 한다.
- 반응형: 모바일/태블릿/데스크톱 깨짐 없이 동작해야 한다.
- 보안: RLS를 신뢰 경계의 핵심으로 두고, 프론트/서버에서 이중 체크한다.
- 관찰 가능성: 실패/예외 케이스에 대해 사용자 메시지/로그(필요시)를 정리한다.

## 6) Copilot 작업 방식 (출력 형식)
- 코드 작성 전:
  1) 변경 범위 요약
  2) 파일 단위 작업 계획
  3) 위험/테스트 포인트
- 코드 작성 후:
  - 실행/검증 방법(`npm run build` 포함)과 확인해야 할 화면/시나리오를 함께 제시한다.
