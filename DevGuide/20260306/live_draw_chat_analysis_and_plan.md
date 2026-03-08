# 라이브 조편성 채팅 기능 분석 및 구현 계획

작성일: 2026-03-06  
대상 프로젝트: WEB_JustGolf (Next.js App Router + Supabase + Vercel)

## 1. 착수 전 요약 (요구사항 → 영향 파일 → 데이터/권한 영향 → 테스트 전략)
### 요구사항
- 라이브 조편성에서 채팅 기능 추가.
- **관리자가 조편성 세션 시작 시 채팅 세션도 함께 시작**.
- 사용자가 라이브 페이지에 진입하면 **프로필 닉네임으로 자동 입장**.
- PC: 입장 버튼 클릭 시 채팅 전용 별도 창(팝업/독립 페이지)에서 채팅.
- 모바일: 입장 버튼 클릭 시 라이브 페이지 하단 고정 오버레이(동시 표시 최대 4줄)로 채팅.

### 영향 파일(예상)
- 시청자 라이브 페이지: `app/t/[id]/draw/page.tsx`
- 관리자 라이브 페이지: `app/admin/tournaments/[id]/draw/page.tsx`
- 관리자 조편성 API: `app/api/admin/tournaments/[id]/draw/route.ts`
- 공통 권한 유틸: `lib/apiGuard.ts`
- DB 마이그레이션: `db/migrations/*_live_draw_chat*.sql` (신규)
- (필요 시) 채팅 API route: `app/api/tournaments/[id]/draw-chat/.../route.ts` (신규)

### 데이터/권한(RLS) 영향
- 현재 `draw_sessions`, `draw_events`는 인증 사용자 조회 + 관리자 쓰기 구조로 정리되어 있음.
- 채팅은 사용자 입력(write)이 필요하므로, 기존 draw 이벤트와 분리된 채팅 테이블 + RLS 설계가 필수.
- 닉네임은 `profiles.nickname`을 기준으로 입장명 고정.

### 테스트 전략
- 단위/통합: 메시지 insert 검증, 길이 제한/빈문자 처리, 세션 상태별 권한 검증.
- E2E: PC 팝업 플로우 + 모바일 하단 오버레이 플로우 + 관리자 시작/종료 연동.
- 품질 게이트: 최소 `npm run build` 성공, 가능하면 `npm run lint`와 변경 영역 테스트 수행.

---

## 2. 현재 구조 분석

## 2.1 라이브 조편성의 현재 세션 구조
- 관리자 시작점:
  - `app/admin/tournaments/[id]/draw/page.tsx`
  - `/api/admin/tournaments/[id]/draw`에 `start_session` 액션 POST
- 서버 생성 로직:
  - `app/api/admin/tournaments/[id]/draw/route.ts`
  - `draw_sessions` row 생성 + `draw_events`에 `SESSION_STARTED` append
- 시청자 표시:
  - `app/t/[id]/draw/page.tsx`
  - `draw_sessions` 최신 1건 + `draw_events` 리플레이
  - `postgres_changes` + polling 백업 혼합

### 판단
- 이미 “세션 시작/진행/완료” 이벤트 소싱 구조가 있으므로, 채팅도 **동일 세션 키(`draw_session_id`) 기반**으로 붙이는 것이 가장 단순/안전.

## 2.2 닉네임 소스 및 재사용 포인트
- 프로젝트 전반에서 사용자 표시명은 `profiles.nickname`이 표준.
- `app/t/[id]/page.tsx`에서 로그인 사용자의 `profiles.nickname` 조회 패턴이 이미 존재.

### 판단
- 라이브 채팅 입장명은 별도 입력창 없이 `profiles.nickname`을 읽어 자동 적용.
- 닉네임 미설정 시에는 “프로필에서 닉네임 설정 필요” 가드 메시지 필요.

## 2.3 반응형 UI 구성 여지
- 라이브 시청 페이지는 이미 `isCompactLayout`으로 PC/모바일 분기 처리 중.
- `components/ui/sheet.tsx`가 존재해 모바일 하단 오버레이 구현 재사용 가능.

### 판단
- 모바일은 새 UI 프리미티브를 만들지 않고 `Sheet`(bottom) + 채팅 리스트 컴포넌트 조합으로 구현 가능.
- PC는 `window.open('/t/[id]/draw/chat?...')` 방식의 독립 채팅 페이지가 요구사항과 가장 일치.

---

## 3. 구현 설계 (권장안)

## 3.1 데이터 모델
### 신규 테이블 제안
1) `draw_chat_sessions`
- 목적: 조편성 세션과 1:1 또는 N:1 관계의 채팅 세션 메타
- 주요 컬럼(안):
  - `id` bigint PK
  - `draw_session_id` bigint not null references `draw_sessions(id)` on delete cascade
  - `tournament_id` bigint not null references `tournaments(id)` on delete cascade
  - `status` text not null check (`live`, `closed`)
  - `started_by` uuid references auth.users(id)
  - `started_at`, `closed_at`, `created_at`, `updated_at`
- 인덱스:
  - `(draw_session_id)` unique (동일 draw session에 채팅 세션 1개)
  - `(tournament_id, created_at desc)`

2) `draw_chat_messages`
- 목적: 채팅 메시지 append-only 로그
- 주요 컬럼(안):
  - `id` bigint PK
  - `chat_session_id` bigint not null references `draw_chat_sessions(id)` on delete cascade
  - `tournament_id` bigint not null references `tournaments(id)` on delete cascade
  - `user_id` uuid not null references auth.users(id)
  - `nickname` text not null
  - `message` text not null
  - `created_at` timestamptz not null default now()
- 제약:
  - message length (예: 1~300자)
  - 공백만 메시지 금지(trim 체크)
- 인덱스:
  - `(chat_session_id, id)`
  - `(tournament_id, created_at desc)`

## 3.2 RLS 정책
### 공통
- 두 테이블 모두 RLS enable.

### `draw_chat_sessions`
- select: authenticated 허용 + 대회 접근 범위 제한(최소안은 authenticated, 권장안은 tournament membership 기반).
- insert/update: 관리자만 허용 (`public.is_admin(auth.uid())`).

### `draw_chat_messages`
- select: authenticated 허용(또는 대회 접근 제한).
- insert: authenticated 사용자 본인만 (`user_id = auth.uid()`) + 해당 chat session이 `live` 상태일 때만 허용.
- update/delete: 원칙적으로 금지(append-only).

## 3.3 서버 API 설계
### A) 관리자 조편성 시작 연동 (기존 route 확장)
- 파일: `app/api/admin/tournaments/[id]/draw/route.ts`
- `start_session` 성공 직후:
  - `draw_chat_sessions`에 upsert/insert(`status='live'`) 수행
- `reset_draw`/종료 시점:
  - 기존 세션 상태 변경과 함께 채팅 세션 `closed` 처리

### B) 채팅 조회/입장/전송 API (신규)
- `GET /api/tournaments/[id]/draw-chat/session`
  - 현재 활성 draw/chat 세션 조회
  - 로그인 사용자 `profiles.nickname` 반환(입장명)
- `POST /api/tournaments/[id]/draw-chat/messages`
  - body: `chatSessionId`, `message`
  - 서버에서 nickname 재조회 후 insert(클라이언트 nickname 신뢰 금지)
- (선택) `GET /api/tournaments/[id]/draw-chat/messages?chatSessionId=...&cursor=...`
  - 초기 히스토리 페이징

> 참고: 실시간은 Supabase Realtime(`draw_chat_messages` postgres_changes) 우선, 폴링 백업은 draw 페이지 패턴 재사용.

## 3.4 클라이언트 UX 설계
### 공통 (라이브 페이지 상단/우측 액션)
- `채팅 입장` 버튼 추가.
- 입장 전 체크:
  - 로그인 여부
  - 활성 채팅 세션 여부
  - 프로필 닉네임 존재 여부

### PC UX
- 동작: `채팅 입장` 클릭 → `window.open`으로 채팅 전용 페이지 오픈
- 경로 제안: `/t/[id]/draw/chat?session={chatSessionId}`
- 별도 페이지 구성:
  - 상단: 세션 배지/닉네임
  - 중앙: 메시지 스크롤 영역
  - 하단: 입력창 + 전송

### 모바일 UX
- 동작: `채팅 입장` 클릭 → 하단 고정 오버레이 오픈
- 구현: `Sheet` (`side='bottom'`) 기반
- 규격:
  - 메시지 리스트 영역에서 **동시 노출 최대 4줄**
  - 하단 입력창 고정
  - 뒤 배경(라이브 애니메이션/현황)은 계속 관찰 가능
- 접근성:
  - 오버레이 open/close 버튼에 aria-label
  - 입력창 포커스 이동 보장

## 3.5 관찰가능성/운영
- 채팅 전송 실패 토스트 메시지 표준화.
- (선택) 악성 입력 대비 1차 클라이언트/서버 필터(길이 제한, 연속 전송 rate limit).
- 관리자에게 채팅 세션 상태(`live/closed`) 배지 노출.

---

## 4. 단계별 구현 계획

## Phase 1: DB & RLS 기반 구축
- 신규 마이그레이션 추가 (`draw_chat_sessions`, `draw_chat_messages`, 인덱스, RLS)
- Realtime publication 반영 확인(테이블이 실시간 대상인지)
- 산출물:
  - `db/migrations/*_live_draw_chat_sessions_and_messages.sql`

## Phase 2: 관리자 시작/종료 연동
- `start_session` 시 채팅 세션 생성
- draw reset/종료 플로우에서 채팅 세션 종료 처리
- 산출물:
  - `app/api/admin/tournaments/[id]/draw/route.ts` 업데이트

## Phase 3: 채팅 API + 공통 타입
- session 조회 API + message insert API 작성
- 서버에서 nickname 보정 삽입
- 산출물:
  - `app/api/tournaments/[id]/draw-chat/session/route.ts`
  - `app/api/tournaments/[id]/draw-chat/messages/route.ts`
  - `lib/draw/chat/*` (선택)

## Phase 4: 시청자 UI 통합
- `app/t/[id]/draw/page.tsx`에 채팅 입장 버튼 및 분기 로직 추가
- PC: 팝업 오픈
- 모바일: 하단 4줄 오버레이 + 입력
- 산출물:
  - `app/t/[id]/draw/page.tsx`
  - `app/t/[id]/draw/chat/page.tsx` (신규, PC 전용 채팅 창)
  - 필요 시 `components/draw/DrawChatPanel.tsx` (신규)

## Phase 5: 검증 및 문서화
- 단위/통합 테스트 보강(권한, 메시지 유효성)
- E2E 최소 2개 시나리오 추가(PC/모바일)
- `npm run build` 통과
- DevGuide에 완료 보고서 추가

---

## 5. 검증 시나리오 (수동 QA)
1. 관리자가 라이브 조편성 세션 시작 시 채팅 세션이 자동 생성되고 상태가 `live`인지 확인.
2. 일반 사용자가 `/t/[id]/draw` 진입 후 채팅 입장 버튼을 눌렀을 때 본인 `profiles.nickname`으로 입장되는지 확인.
3. PC에서 채팅 입장 버튼 클릭 시 별도 창(채팅 전용 페이지) 오픈 및 실시간 송수신 확인.
4. 모바일에서 채팅 입장 버튼 클릭 시 하단 오버레이가 뜨고, 라이브 화면이 백그라운드에서 계속 보이는지 확인.
5. 모바일 오버레이에서 동시 표시 메시지가 최대 4줄 수준으로 유지되는지 확인.
6. 채팅 세션 종료 후 메시지 전송 시 차단/안내가 정상 동작하는지 확인.

---

## 6. 리스크 및 결정 필요 항목
1. **대회 접근 범위 정책**: 채팅 read 권한을 전체 authenticated로 둘지, 대회 참여자/관리자로 제한할지 확정 필요.
2. **메시지 보관 정책**: 세션 종료 후 영구 보관 vs 일정 기간 후 정리(운영/개인정보 정책).
3. **PC 팝업 차단 이슈**: 브라우저 팝업 차단 시 fallback(같은 탭 이동) UX 필요.
4. **스팸/도배 방지**: MVP에서는 길이 제한만 적용하고, 추후 rate-limit(사용자당 n초 1회) 추가 권장.

---

## 7. 최종 제안
- 현재 코드베이스 구조(조편성 세션 + 이벤트 로그 + Realtime)와 잘 맞는 확장으로 구현 가능.
- 가장 안전한 경로는 **DB/RLS 선행 → 관리자 시작 연동 → 채팅 API → PC/모바일 UI 분기 통합** 순서.
- 본 계획 기준으로 진행하면 요구사항(자동 세션 시작, 닉네임 입장, PC 팝업, 모바일 하단 4줄)을 최소 리스크로 충족할 수 있음.
