# 라이브 조추첨 채팅 성능 검증 결과

작성일: 2026-03-16  
검증 방식: Playwright E2E Self-Test (사용자 개입 없음)

## 1) 검증 목적
- 채팅 메시지 DB 비저장 전환 이후 성능이 실제로 개선/안정 동작하는지 수치로 검증
- 핵심 보장 항목 확인
  - 전송 API 지연 시간
  - 화면 반영(E2E) 지연 시간
  - 서버 rate limit(`1초 3회`) 강제 여부
  - DB 히스토리 미저장 여부 (`draw_chat_messages` 미삽입)

## 2) 실행 커맨드
```powershell
$env:PLAYWRIGHT_BASE_URL='http://localhost:3101'
$env:PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- -p 3101'
npx playwright test tests/e2e/live-draw-chat-performance.spec.ts --project=chromium
```

## 3) 테스트 시나리오
1. 서비스 롤로 테스트 관리자/대회/승인 참가자 fixture 자동 생성
2. 관리자 로그인 후 `start_session` 호출로 라이브 세션 + 채팅 세션 활성화
3. 송신/수신 페이지 2개를 열어 메시지 20건 전송
4. 각 메시지에 대해:
   - API 응답 시간(ms)
   - 수신 페이지 반영까지 E2E 시간(ms)
   - 전파 지연(ms = E2E - API)
   측정
5. 버스트 전송(동시 4건)으로 rate limit 동작 확인
6. `draw_chat_messages` 테이블의 해당 대회 row count 확인(0이어야 PASS)

## 4) 결과 요약
- 실행 상태: PASS
- 원본 리포트: [report.json](d:/CodeDev/WEB_JustGolf/artifacts/chat-performance/20260316_104846/report.json)
- 측정 건수: 20건

### API 지연
- 평균: **337.23ms**
- p95: **585.40ms**
- 최대: **1185.30ms** (1건, 워밍업 구간)

### 화면 반영(E2E) 지연
- 평균: **349.25ms**
- p95: **598.00ms**
- 최대: **1201.00ms** (동일 워밍업 구간)

### 전파 지연 (수신 반영 - API 응답)
- 평균: **12.02ms**
- p95: **20.50ms**
- 최대: **23.10ms**

### 정책 검증
- rate limit(1초 3회): **정상 동작**
  - 버스트 4건 중 1건 `429` 확인
- DB 히스토리 미저장: **정상 동작**
  - `draw_chat_messages` count = **0**

## 5) 결론
- 채팅 비영속(Broadcast) 전환 후, 실시간 전파 지연이 매우 낮게 측정되었고(평균 12ms), 기능 정책(rate limit/미저장)도 의도대로 동작함.
- 첫 메시지 1건에서 API/E2E 최대치가 높게 나왔으나, 이후 구간은 200~600ms 범위로 안정적임.
- 본 검증 기준에서 “DB 히스토리 제거를 통한 성능 개선 목적”은 충족된 것으로 판단함.
