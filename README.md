# Golf Tour Web Service (WEB_JustGolf)

월례 골프 대회 운영을 웹으로 표준화하기 위한 서비스입니다. 대회 목록 공개, 참가 신청/취소, 라이브 조편성, 실시간 채팅, 결과/갤러리 공유, 관리자 운영까지 하나의 플랫폼에서 다룹니다.

## 핵심 목표

- 비로그인 방문자에게도 대회 현황 공개 (닉네임 + 상태)
- 로그인 사용자의 신청/취소, 라운드·식사·활동 선택, 결과 조회
- 관리자/대회 매니저의 대회 CRUD, 승인, 조편성, 결과 입력, 갤러리 운영
- 라이브 조편성 이벤트 중 참가자와의 실시간 상호작용 (채팅·전광판 애니메이션)

## 기술 스택

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Backend/DB**: Supabase (Postgres · Auth · RLS · Realtime), `@supabase/ssr`
- **Auth**: 카카오 OIDC 로그인 + 관리자 승인 기반 활성화
- **UI**: Tailwind CSS v4, shadcn/ui, Radix UI, Lucide
- **Media**: Cloudinary (갤러리 사진·영상)
- **Animation**: Pixi.js + Matter.js (라이브 조편성 전광판/물리 연출)
- **Export**: xlsx (엑셀 다운로드)
- **Test**: Vitest (+ @testing-library/react), Playwright
- **Deploy**: Vercel (dev/prod Supabase 프로젝트 분리)

## 실행 방법

```bash
npm install
npm run dev          # 포트 3001
npm run build        # 프로덕션 빌드 (Vercel 배포 검증용)
npm run start
npm run lint
npm run test         # Vitest
npm run test:e2e     # Playwright
```

## 환경 변수

| 변수 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 공개 Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 anon 키 (RLS로 보호) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용. 클라이언트 노출 금지 |
| (Cloudinary 관련) | 갤러리 미디어 업로드·변환 |

환경 파일 분리:
- 개발: `.env.local`
- 운영: `.env.production.local`

상세 배포 가이드는 [`Docs/VERCEL_DEPLOYMENT.md`](./Docs/VERCEL_DEPLOYMENT.md) 참조.

## 주요 기능

### 비로그인/일반 사용자

- **대회 목록·상세**: `/tournaments`, `/t/[id]`
- **참가 신청/취소**: 라운드(사이드 이벤트)·식사·숙박·활동 선택 포함
- **참가 상태 조회**: `/t/[id]/status` — 승인 현황, 선택 옵션 요약
- **조편성 조회/라이브 참여**: `/t/[id]/groups`, `/t/[id]/draw`
  - 관리자 개시 시 Pixi.js 전광판 애니메이션으로 실시간 관람
- **라이브 조편성 채팅**: `/t/[id]/draw/chat` — 세션 기간만 활성화, 종료 후 비영속화
- **대회 결과 조회**: `/t/[id]/results` — 구조화 점수표, 대표 미디어·회칙 팝업
- **갤러리**: `/t/[id]/gallery` — Cloudinary 기반 사진/영상, 댓글·좋아요
- **프로필/온보딩**: 카카오 로그인 → 닉네임 확정 → 관리자 승인 대기
- **사용 설명서·시작 가이드**: `/guide`, `/start`
- **피드백 보드**: `/board`

### 관리자 / 대회 매니저

- **전역 관리자**: `/admin` — 사용자 관리, 대회 전역 운영
- **대회 범위 관리자 권한**: `tournament_scoped_admin_permissions` — 특정 대회에 한정된 위임 관리자
- **대회 운영**: `/admin/tournaments/[id]/...`
  - 대시보드, 편집, 참가 등록 관리, 파일, 조편성, 사이드 이벤트,
    식사 옵션, 매니저 설정, 엑스트라(활동)
- **승인 시스템**: 신청자 승인/거절, 사용자 가입 승인
- **엑셀 다운로드**: 확정 신청자 명단 export
- **결과 입력**: 종료된 대회의 결과/갈무리 관리
- **갤러리 운영**: 사진/영상 업로드, Cloudinary URL 재사용

## DB 정책

- 스키마·정책 변경은 `db/migrations/*.sql` 파일로 관리하고 **Supabase SQL Editor에서 수동 실행**합니다.
- 2026-04 기준 마이그레이션 001~049까지 누적 반영. 대표 영역:
  - 대회/참가/라운드: `tournaments`, `registrations`, `side_events`, `meal_options`, `tournament_extras`
  - 승인/권한: `account_approval`, `manager_permissions`, `tournament_scoped_admin_permissions`
  - 조편성/실시간: `tournament_groups`, `live_group_draw_sessions`, `draw_chat_sessions`, `draw_chat_messages`, realtime publication
  - 결과/미디어: `tournament_results` + 구조화 점수, `tournament_gallery`
  - 로그/피드백: `feedbacks`, `error_logs`, `kakao_oidc_state_store`
- 코드에서 임의 SQL로 스키마/정책을 변경하지 않습니다.

## 개발·운영 원칙

- `git push` 전 **`npm run build` 성공 필수** (AGENTS.md / copilot-instructions.md 공통 게이트).
- 커밋 메시지는 **Conventional Commits** 규칙(`feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`, `perf:`).
- Service Role Key는 절대 클라이언트 번들에 포함시키지 않습니다.
- 접근성·반응형·RLS 이중 체크를 품질 기준으로 유지합니다.

## 테스트 전략

| 레이어 | 도구 | 위치 |
|---|---|---|
| Unit | Vitest + @testing-library/react | `tests/unit/**` |
| Integration | Vitest (+ Supabase mock) | `tests/integration/**` |
| E2E | Playwright | `tests/e2e/**` |
| 수동/로컬 스크립트 | 수기 | `tests/manual/**` (git ignored) |

상세 가이드: [`Docs/PLAYWRIGHT_E2E_TEST_GUIDE.md`](./Docs/PLAYWRIGHT_E2E_TEST_GUIDE.md), [`TEST_FILES_CLASSIFICATION.md`](./TEST_FILES_CLASSIFICATION.md).

## 디렉토리 개요

```
app/           Next.js App Router (public / auth / admin / api)
components/    공용 UI (Header, shadcn ui/ 등)
lib/           Supabase 클라이언트, 도메인 서비스 (draw / gallery / results / auth)
db/
  schema.sql
  migrations/  수동 실행용 SQL (누적 버전 관리)
scripts/       시드 / 유틸 스크립트
tests/         Vitest + Playwright
Docs/          현행 운영 문서 (+ archive/ 과거 스냅샷)
DevGuide/      날짜별 기능 분석·구현 계획 (개발 로그)
public/        정적 자산
```

자세한 정책: [`REPO_STRUCTURE.md`](./REPO_STRUCTURE.md).

## 문서 인덱스

- **AI 에이전트 작업 규칙**: [`AGENTS.md`](./AGENTS.md), [`CLAUDE.md`](./CLAUDE.md), [`GEMINI.md`](./GEMINI.md), [`.github/copilot-instructions.md`](./.github/copilot-instructions.md)
- **운영/배포 가이드**: [`Docs/`](./Docs/)
- **기능별 분석·구현 계획 (개발 로그)**: [`DevGuide/`](./DevGuide/)
- **과거 스냅샷 / 일회성 기획서**: [`Docs/archive/`](./Docs/archive/)

## 진행 이력 요약

- **Phase 1~4** (초기 구축): 공개 목록/상세, 신청·취소, 관리자 기본 운영, 라운드·식사·활동 선택, 승인 시스템, 프로필.
- **확장 1 — 인증**: 카카오 OIDC 로그인, 온보딩/닉네임 확인, 관리자 승인 기반 활성화.
- **확장 2 — 라이브 조편성**: Pixi.js 전광판 애니메이션, 그룹 드로우 세션, 완료 계약 플로우.
- **확장 3 — 실시간 채팅**: 조편성 전용 채팅 세션(비영속화, 종료 플로우 개선).
- **확장 4 — 결과·미디어**: 구조화 결과 점수, 결과 페이지 선로딩/캐시, 대표 미디어·회칙 팝업, 대회 갤러리(Cloudinary).
- **확장 5 — 운영 고도화**: 대회 범위 관리자 권한, 사이드 이벤트 상태 워크플로우, 확정 신청자 엑셀 다운로드, 요약 카운팅 성능 개선, UI 레이아웃 통일.
- **확장 6 — UX/문서**: `/guide`, `/start` 페이지, 참가자/조편성 목록 가독성 개선, 온보딩 닉네임 확인 팝업.

날짜별 상세 로그는 [`DevGuide/`](./DevGuide/) 날짜 폴더에서 확인하세요.
