# 라이브 조편성 구현 준비안 (프로젝트 맞춤)

## 1) 목표
- 기준 문서: `DevGuide/20260213/live_group_draw_design_guide.md`
- 목표: 현재 코드베이스에 맞게 라이브 조편성(룰렛 기반) 기능을 실제 구현 가능한 단위로 분해하고, 적용 범위를 확정한다.

## 2) 현재 프로젝트 현황 요약

### 라우팅/화면
- 관리자 조편성 페이지: `app/admin/tournaments/[id]/groups/page.tsx`
- 사용자 조편성 조회 페이지: `app/t/[id]/groups/page.tsx`
- 현재 조편성은 수동 CRUD + 공개 토글 구조이며, 라이브/실시간 진행 화면은 없음
- 현재 프로젝트의 대회 상세 라우팅 규칙은 `/t/[id]`, 관리자 규칙은 `/admin/tournaments/[id]`

### 데이터/DB
- 조편성 테이블 존재:
  - `tournament_groups`
  - `tournament_group_members`
  - 마이그레이션: `db/migrations/007_tournament_groups.sql`
- 라이브 추첨 전용 테이블(`draw_sessions`, `draw_events`)은 아직 없음

### 실시간
- Supabase Realtime 설정은 가능(`supabase/config.toml`에서 realtime enabled)
- 앱 코드에서 Realtime 구독/브로드캐스트 사용 흔적은 현재 없음

### 권한
- 기본 권한 모델: `profiles.is_admin`, RLS 중심
- API 권한 가드 유틸 존재: `lib/apiGuard.ts`
- 대회별 운영 권한 테이블 존재: `manager_permissions` (현재는 사이드이벤트 권한 위주)

## 3) 기준 문서 대비 갭 분석

### 이미 있는 것
- Next.js App Router + Supabase + Vercel 기반
- 조편성 결과 저장 테이블(정적 결과용)
- 관리자/사용자 분리된 화면 경로

### 없는 것 (신규 필요)
- 라이브 세션/이벤트 로그 모델
- 이벤트 리플레이 reducer
- 실시간 동기화 구독 흐름
- 진행자 전용 스텝 제어 UI
- 룰렛 Animator(플러그인 구조)
- 라이브 결과를 기존 조편성 테이블로 반영하는 동기화 단계

## 4) 프로젝트 맞춤 설계 제안

### 4.1 라우트 설계 (기존 규칙 준수)
- 진행자: `/admin/tournaments/[id]/draw`
- 시청자: `/t/[id]/draw`
- 참고: 기준 문서의 `/tournaments/:id/draw*`를 현재 프로젝트 규칙에 맞게 변환

### 4.2 데이터 모델 (신규)
- `draw_sessions`
  - `id`, `tournament_id`, `status`, `group_count`, `group_size`, `total_players`, `created_by`, `started_at`, `ended_at`
- `draw_events`
  - `id`, `session_id`, `step`, `event_type`, `payload(jsonb)`, `created_by`, `created_at`
  - 인덱스: `(session_id, id)`, `(session_id, step)`
- (선택) `draw_state_snapshots`
  - 초기에는 생략 가능 (이벤트 리플레이 우선)

### 4.3 이벤트 타입 (v1)
- `SESSION_STARTED`
- `STEP_CONFIGURED`
- `PICK_RESULT`
- `ASSIGN_UPDATED`
- `ASSIGN_CONFIRMED`

### 4.4 상태 계산 방식
- 클라이언트 최초 진입:
  - 세션 + 이벤트 목록 조회
  - reducer로 `remaining`, `groups`, `currentStep`, `phase` 계산
- 실시간 수신:
  - 새 이벤트를 동일 reducer에 누적 적용

### 4.5 실시간 전파 방식
- 1차 권장: `draw_events` INSERT 기반 `postgres_changes` 구독
  - 이유: 현재 코드/정책에 가장 자연스럽고 빠르게 적용 가능
- 2차 확장: Supabase Broadcast 채널로 전환 가능

### 4.6 서버 권한 경계
- 당첨자 선정(`PICK_RESULT`)은 서버 측에서 수행
- 진행자 액션은 Next API Route를 통해 처리
- API는 `requireApiUser({ requireAdmin: true })` 패턴 재사용
- 클라이언트 직접 insert/update는 지양 (결과 무결성 목적)

### 4.7 기존 조편성 테이블과의 연계
- 라이브 세션 진행 중 상태는 `draw_events` 기준
- 세션 완료(또는 스텝 확정 시점 누적) 후
  - `tournament_groups`, `tournament_group_members`에 투영(upsert)
- 기존 `groups` 페이지는 결과 조회/백업 UI로 유지 가능

## 5) 기술스택 적용 범위

### 기존 스택 그대로 사용
- Next.js App Router
- Supabase (Auth/Postgres/RLS/Realtime)
- shadcn/ui + Tailwind
- Vitest + Playwright

### 신규 의존성 (최소)
- `react-custom-roulette` (룰렛 연출 v1)

### 신규 코드 모듈 제안
- `lib/draw/types.ts` (이벤트/상태 타입)
- `lib/draw/reducer.ts` (이벤트 리플레이 핵심)
- `lib/draw/animators/Animator.ts` (인터페이스)
- `lib/draw/animators/RouletteAnimator.tsx` (v1 구현)
- `app/api/admin/tournaments/[id]/draw/*` (진행 명령 API)

## 6) 단계별 구현 범위

### Phase A (필수, 기반)
- DB 마이그레이션: `draw_sessions`, `draw_events`, RLS
- reducer + 단위테스트
- 세션 조회/이벤트 조회 API

### Phase B (필수, 시청자 화면)
- `/t/[id]/draw` 페이지
- 이벤트 리플레이 + 실시간 구독
- 그룹 박스/remaining 렌더링

### Phase C (필수, 진행자 화면)
- `/admin/tournaments/[id]/draw` 페이지
- `STEP_CONFIGURED`, `PICK_RESULT`, `ASSIGN_CONFIRMED` 발행
- ROUND_ROBIN / TARGET_GROUP 모드

### Phase D (필수, 연출)
- 룰렛 컴포넌트 연결
- `startedAt`, `durationMs` 기반 동기화
- 카드 이동 애니메이션(CSS transform)

### Phase E (권장)
- 세션 종료 시 기존 `tournament_groups*` 테이블 반영
- `/admin/tournaments/[id]/groups`와 결과 일관성 정리

### Phase F (선택)
- `UNDO_LAST`, `MEMBER_MOVED`
- 저사양 모드
- Broadcast 전환

## 7) 사전 결정 필요사항
- 진행 권한을 v1에서 관리자만 허용할지, 대회별 매니저 권한까지 포함할지
- `PICK_RESULT`를 수동 버튼 방식으로 할지, 서버 타이머 자동 방식으로 할지
- 라이브 완료 시 자동 공개(`is_published=true`) 여부
- 기존 수동 조편성 페이지와 라이브 페이지 병행 운영 정책

## 8) 리스크 및 대응
- 리스크: 동시 클릭/중복 이벤트
  - 대응: 서버에서 step 순서 검증 + idempotency 체크
- 리스크: 늦게 접속한 시청자 상태 불일치
  - 대응: 진입 시 이벤트 전체 리플레이
- 리스크: 관리자 클라이언트 직접 DB 쓰기 우회
  - 대응: 핵심 상태 변경은 API만 허용
- 리스크: 대규모 렌더링 성능
  - 대응: memoization + 이벤트 단위 최소 상태 갱신

## 9) 완료 기준 (v1)
- 진행자/시청자가 동일 step 흐름을 본다
- 매 step마다 remaining이 감소한다
- ROUND_ROBIN/TARGET_GROUP 둘 다 동작한다
- 진행자가 확정/변경 가능하다
- 새로 접속한 시청자도 리플레이 후 현재 상태 복원 가능하다
- 최종 결과가 기존 조편성 테이블과 동기화된다
