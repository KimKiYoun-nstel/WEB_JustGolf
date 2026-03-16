# 라이브 조추첨 채팅 분리/성능/종료 플로우 분석 및 구현 계획

작성일: 2026-03-16  
작업 브랜치: `feature/live-draw-chat-decouple-and-endflow`

## 1) 요구사항
- 채팅 세션은 라이브 조추첨 액션과 분리해 운영한다.
- 관리자 명시 `close` 전까지 채팅은 유지/오픈 상태를 기본으로 한다.
- `reset_draw` 수행 시 채팅이 리셋/삭제되지 않아야 한다.
- 채팅 입력 지연을 제거하고, 최소 도배 방지(사용자당 초당 N회 제한)를 적용한다.
- 라이브 조추첨의 명시 종료 액션을 추가하고, 종료 이후 조편성 공개 플로우(자동/수동)를 점검한다.

## 2) 현재 구조 분석 (As-Is)
### 2-1. 채팅 세션-조추첨 세션 결합
- `draw_chat_sessions.draw_session_id`가 `draw_sessions.id` FK `on delete cascade`로 연결되어 있다.
  - 근거: `db/migrations/035_live_draw_chat_sessions_and_messages.sql`
- `reset_draw` 액션에서 `draw_sessions` 전체 삭제를 수행한다.
  - 근거: `app/api/admin/tournaments/[id]/draw/route.ts` `reset_draw` 분기
- 결과적으로 조추첨 세션 삭제 시 채팅 세션/메시지가 연쇄 삭제된다.

### 2-2. 채팅 open/close 트리거가 조추첨 상태에 종속
- `start_session`/`reset_draw` 시 `activateDrawChatSession(...)` 호출
- `assign_confirm`의 마지막 멤버 확정(`willFinish`) 시 `closeDrawChatSession(...)` 자동 호출
- `undo_last` 시 채팅 세션 자동 재오픈
  - 근거: `app/api/admin/tournaments/[id]/draw/route.ts`

### 2-3. 채팅 성능 저하 가능 지점
- 메시지 전송은 현재 **건별 DB insert**가 맞다.
  - 근거: `app/api/tournaments/[id]/draw-chat/messages/route.ts`
- 메시지 POST 1회당 서버에서 최소 3단계 쿼리 수행
  - `profiles` 닉네임 조회
  - `draw_chat_sessions` live 상태 조회
  - `draw_chat_messages` insert
- 시청자 페이지에서 고비용 polling이 중복된다.
  - draw snapshot 전체 polling: 1초 주기 (`draw_sessions`, `draw_events` 재조회)
  - chat session polling: 5초 주기 + 세션 확인 시 메시지 전체 재조회
  - 근거: `app/t/[id]/draw/page.tsx`

### 2-4. 라이브 종료 및 공개 플로우
- 명시적 `end_session` 액션/버튼이 없다.
- 현재는 마지막 배정 확정 시 자동 `status=finished` 처리된다.
- 조편성 공개(`tournament_groups.is_published`)는 자동이 아니라 관리자 수동 토글이다.
  - 근거: `app/admin/tournaments/[id]/groups/page.tsx`, `app/t/[id]/groups/page.tsx`

## 3) 영향 파일
- API
  - `app/api/admin/tournaments/[id]/draw/route.ts`
  - `app/api/tournaments/[id]/draw-chat/session/route.ts`
  - `app/api/tournaments/[id]/draw-chat/messages/route.ts`
- UI
  - `app/admin/tournaments/[id]/draw/page.tsx`
  - `app/t/[id]/draw/page.tsx`
  - `app/t/[id]/draw/chat/page.tsx`
- DB
  - `db/migrations/*_draw_chat_*.sql` (신규)
  - `db/migrations/*_live_draw_*.sql` (신규)
- 테스트
  - `tests/unit/**`
  - `tests/integration/**`
  - `tests/e2e/live-draw-verify.spec.ts` (및 관련 시나리오)

## 4) 데이터/권한(RLS) 영향
### 관리자
- 채팅 세션 생성/종료/재오픈 권한
- 라이브 세션 명시 종료 권한

### 일반 로그인 사용자
- 채팅 읽기/쓰기 권한 유지
- 도배 방지 정책(초당 N회) 적용 대상

### 비로그인 사용자
- 현행과 동일하게 채팅 입장/쓰기 불가

### Service Role/경계
- Service Role은 관리자 API(Route Handler)에서만 사용
- 클라이언트 키 노출 금지 유지

## 5) 개선 설계
### 5-1. 채팅 세션 독립 모델
핵심 원칙: "채팅은 대회 라이브 운영 단위, 조추첨 액션과 분리"

- `draw_chat_sessions`를 `tournament_id` 기준 1:1 활성 세션 모델로 전환
- `draw_session_id` 강결합 제거(또는 nullable + `on delete set null`로 완화)
- 활성 세션 고유성 제약 추가
  - 예: `unique (tournament_id) where status = 'live'`
- `reset_draw`에서 채팅 테이블 삭제/종료 처리 금지
- 채팅 종료는 `chat_close` 명시 액션에서만 수행

권장 DB 변경(초안)
1. `draw_chat_sessions`의 `draw_session_id` FK cascade 제거
2. `draw_chat_sessions`에 `linked_draw_session_id`(nullable, `on delete set null`) 도입
3. 활성 세션 유니크 제약 추가 (`tournament_id + status='live'`)
4. 조회 API를 "최신 live draw_session"이 아니라 "대회 active chat session" 기준으로 변경

### 5-2. 채팅 성능 개선 모델
핵심 정책(확정):
- 채팅 메시지 히스토리는 DB에 저장하지 않는다.
- 이미 접속한 사용자끼리만 실시간 메시지를 공유한다.
- 새로 접속한 사용자는 접속 시점 이후 메시지만 본다.

적용 설계:
- `draw_chat_messages` write/read 경로를 제거한다.
- 실시간 메시지는 Supabase Realtime Broadcast 채널로 송수신한다.
  - 채널 키 예: `draw-chat:tournament:{tournamentId}`
- `draw_chat_sessions`는 메시지 저장 용도가 아니라,
  - 채팅 open/close 상태 관리
  - 대회 단위 활성 채팅 세션 식별
  에만 사용한다.
- 시청자 페이지의 고빈도 polling(1초 draw snapshot + 5초 chat session)을 축소한다.
  - Realtime 정상 연결 시 polling 비활성
  - 연결 장애 시 백오프 polling만 유지

#### 도배 방지 (확정)
- 서버 강제 rate limit: 사용자당 `1초에 최대 3회` 전송 허용
- 4번째 이상은 `429`로 차단
- 클라이언트는 보조 제한(버튼 disable/남은 시간 표시)만 적용

### 5-3. 라이브 세션 명시 종료
- 관리자 액션 `end_session` 추가
- 동작
  - 현재 `live` 세션을 `finished`로 전환
  - `ended_at` 기록
  - 채팅은 기본 유지(자동 close 금지)
- 예외 처리
  - 이미 `finished/canceled`면 409
  - 미배정 인원 존재 시 종료 불허(확정)

### 5-4. 조편성 공개 플로우 정리
현행은 수동 플로우:
1. 라이브 조추첨으로 `tournament_groups`, `tournament_group_members` 반영
2. `is_published`는 기본 false
3. 관리자가 `/admin/tournaments/[id]/groups`에서 개별/전체 공개

개선 제안
- `end_session` 성공 후 안내 토스트/배너로 "조편성 공개 페이지로 이동" CTA 제공
- 자동 공개는 기본 비활성(운영 안전성), 필요 시 옵션 플래그로 추후 제공

## 6) 단계별 구현 계획 (Phase)
### Phase 1: DB/RLS 마이그레이션
- 채팅 세션 결합 완화 스키마 변경
- 활성 채팅 세션 제약/인덱스 추가
- rate limit용 테이블/정책(선택) 추가
- 산출물: `db/migrations/0xx_*.sql`

### Phase 2: 관리자 Draw API 리팩터링
- `reset_draw`에서 채팅 영향 제거
- `assign_confirm` 마지막 확정 시 자동 chat close 제거
- `undo_last` 자동 chat open 제거
- `end_session` 액션 추가

### Phase 3: 채팅 API 리팩터링
- session 조회 기준을 tournament active chat으로 전환
- DB 메시지 저장/조회 route 제거, broadcast publish/subscribe 경로로 전환
- rate limit 적용

### Phase 4: UI/UX 반영
- 관리자 페이지: `세션 종료` 버튼 추가, 채팅 토글 semantics 정리
- 시청자 페이지: 과도 polling 제거, 초기 로드 최적화, 전송 반응 개선
- PC 채팅 전용 페이지 동일한 최적화 반영

### Phase 5: 테스트/검증/문서
- 단위/통합/E2E 보강
- `npm run build` 필수 통과
- 운영 체크리스트/수동 QA 문서화

## 7) 테스트 전략
### 단위/통합
- `end_session` 상태 전이 테스트
- `reset_draw` 이후 채팅 세션 보존 + 메시지 비영속 정책 테스트
- rate limit 경계값 테스트
- chat session 조회 기준 변경 테스트

### E2E
- 관리자: 세션 시작 -> 진행 -> 명시 종료 -> groups 공개 페이지 이동
- 사용자: 채팅 송수신 지연 없이 입력 가능
- 후입 사용자: 입장 이전 메시지는 보이지 않고, 입장 시점 이후 메시지만 수신
- reset_draw 수행 후 채팅 지속 확인

### 품질 게이트
- `npm run build` (필수)
- `npm run lint`
- `npm run test`
- 필요 시 `npm run test:e2e`

## 8) 수동 QA 시나리오 (3~5)
1. 라이브 진행 중 `reset_draw` 실행 후, 기존 채팅 세션이 유지되는지 확인.
2. 조추첨이 자동 완료된 직후에도 채팅이 닫히지 않고 지속되는지 확인.
3. 관리자 `세션 종료` 클릭 시 draw 상태만 종료되고 채팅은 유지되는지 확인.
4. 연속 전송(도배) 시 rate limit이 동작하고 일반 입력 지연은 없는지 확인.
5. 늦게 입장한 사용자는 기존 히스토리 없이 새 메시지부터만 수신하는지 확인.

## 9) 오픈 이슈/결정 필요
1. 채팅 히스토리 저장 정책: **미저장(확정)**
2. rate limit 기준값: **사용자당 1초 3회(확정)**
3. `end_session` 시 미배정 인원 존재 허용 여부: **불허(확정)**
4. 기존 오픈이슈 `중기안(Broadcast+분리 저장) 채택 시 추가 인프라 도입 여부`
   - 현재 정책(히스토리 미저장)으로는 **고려 대상 제외(Closed)**
   - 사유: 분리 저장 아키텍처 자체가 히스토리 보관을 전제로 한 안이므로, 비저장 정책과 충돌

## 10) 구현 착수 체크리스트
- [x] 요구사항 분해 완료
- [x] 영향 파일 식별 완료
- [x] 데이터/권한(RLS) 영향 정리 완료
- [x] 테스트 전략 수립 완료
- [x] 별도 브랜치 생성 완료
- [x] 오픈 이슈 3/4 의사결정 확정
- [ ] Phase 1 마이그레이션 작성 시작
