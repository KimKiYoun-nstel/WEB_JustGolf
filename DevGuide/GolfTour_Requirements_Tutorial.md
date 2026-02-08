# Golf Tour Web Service (Next.js + Supabase) — 요구서 & 개발 튜토리얼 (MVP 로드맵)

작성일: 2026-02-08  
목표: 매월 반복되는 골프 대회 운영(참가 신청/현황 공개/조편성 파일/사전·사후 라운드/히스토리)을 **웹(PWA 가능) 서비스**로 구축한다.  
기술 스택: **Next.js(App Router)** + **Supabase(Postgres/Auth/Storage/RLS)**

---

## 0. 이 문서의 사용법 (중요)
이 문서는 “한 번에 다 만들기”가 아니라, **단계별(Phase)로 쌓아가는 튜토리얼**이다.

각 Phase마다 두 가지 작업이 섞여 있다:

- **[Agent-코드]**: VS Code에서 AI Agent가 프로젝트 폴더(`golf-tour`)에 코드를 생성/수정하는 작업
- **[수동-Supabase]**: Supabase 대시보드(SQL Editor, Auth, Storage 등)에서 사람이 직접 해야 하는 작업

> 원칙: **DB/정책은 SQL로 관리(파일로 남김)** → “대시보드 클릭 노가다” 최소화  
> 코드는 Agent가 만들고, 본인은 “검토/실행/수정”을 담당한다.

---

## 1. 요구사항 요약(초기 공유 기준)

### 1.1 사용자(참가자) 요구
- 대회가 “오픈”되면 참가자가 신청한다.
- 누구나(로그인 없이도) **현황을 확인**할 수 있다. (공개 범위 A: *닉네임 + 신청상태만*)
- 조편성/안내 등의 **첨부파일을 열람**할 수 있다.
- 사전/사후 라운드(별도 신청)도 받는다.
- 월별 대회가 반복되며 **히스토리(과거 기록)가 남아야** 한다.

### 1.2 관리자(운영자) 요구
- 매월 대회 생성 시 반복작업이 많으므로 **대회 템플릿/복제**가 필요하다.
- 신청 오픈/마감/확정/대기 관리가 필요하다.
- 조편성 파일 업로드 및 공개가 필요하다.
- 상태 변경 이력(누가/언제/무엇을)을 남긴다.

---

## 2. 현재까지 완료된 것(현 상태)
- Next.js 프로젝트 생성 (`golf-tour`)
- Supabase 프로젝트 생성 및 URL/ANON KEY 연결
- 초기 스키마(SQL) 실행 완료 (tournaments / registrations / profiles / tournament_files / audit_logs)
- 기본 조회 화면/상세 화면 일부 연결 확인

---

## 3. 데이터 모델(엑셀 구조 기반 개념 매핑)
엑셀/시트에서 보던 탭 구조를 서비스 엔티티로 분리한다.

- **대회(본 대회)**: `tournaments`
- **참가 신청**: `registrations` (공개 범위 A: 닉네임 + 상태만 포함)
- **첨부파일(조편성/안내)**: `tournament_files` + Supabase Storage
- **사전/사후 라운드**: `side_events` + `side_event_registrations` (Phase 3에서 추가)
- **히스토리/감사 로그**: `audit_logs`

---

## 4. Phase별 구현 시퀀스(권장)

### Phase 1 — “대회 목록/상세 + 공개 현황” 안정화 (배포 전 필수)
**목표**: 로그인 없이도 대회 목록/상세/현황을 볼 수 있고, 로그인한 사용자는 신청/취소할 수 있다.  
**완료 기준(AC)**  
- `/` 대회 목록이 뜬다(공개).
- `/t/[id]` 대회 상세에서 신청 현황이 닉네임/상태로 공개된다.
- 로그인한 사용자는 신청/취소가 가능하다(중복신청 방지).
- RLS로 인해 개인정보 노출이 없어야 한다.

#### [수동-Supabase] Phase 1 체크
1) **Auth 설정 확인**
   - Email provider 활성화
   - (개발 중) 이메일 인증이 너무 귀찮으면 Confirm email을 꺼도 됨(선택)
2) **관리자 지정**
   - `profiles.is_admin = true` 업데이트(본인 계정)

#### [Agent-코드] Phase 1 작업 목록 (프로젝트 폴더)
1) 라우트 정리
   - `/` 대회 목록(공개)
   - `/t/[id]` 상세 + 현황 + 신청/취소
   - `/login` 로그인/회원가입
2) 인증 상태 공통 훅 추가
   - `lib/auth.ts` (getUser / onAuthStateChange)
3) 신청 UX 개선
   - 로그인 사용자면 `profiles.nickname` 자동 채움
   - 신청 시 닉네임을 직접 입력하는 대신 “내 프로필 닉네임” 기본값 사용(수정 가능)
4) 에러 처리 표준화
   - RLS/권한/중복신청(unique) 에러 메시지 사용자 친화적으로 표시

> Agent 프롬프트 예시  
> “Next.js App Router 기반으로 `useAuth` 훅을 만들고, `/t/[id]` 페이지에서 로그인한 사용자의 profiles.nickname을 불러와 신청 폼 기본값으로 사용하도록 리팩토링해줘. 중복신청 시 에러 메시지를 ‘이미 신청했습니다’로 바꿔줘.”

---

### Phase 2 — 관리자 기능(운영 자동화의 시작)
**목표**: 운영자가 대회를 만들고, 오픈/마감/상태변경, 참가자 상태(확정/대기) 변경, 파일 업로드까지 가능하게 만든다.  
**완료 기준(AC)**  
- 관리자만 `/admin` 접근 가능(일반 사용자는 차단/리다이렉트)
- 관리자 화면에서 대회 생성/수정/복제 가능
- 신청자 상태를 `confirmed/waitlisted/canceled`로 변경 가능
- 조편성 파일 업로드 후 공개 페이지에서 열람 가능

#### [수동-Supabase] Phase 2 작업 목록
1) **Storage 버킷 생성**
   - 버킷명 예: `tournament-files`
   - Public 여부:  
     - MVP는 공개 파일이 많으므로 **Public**로 시작 가능(운영 편의)  
     - 더 안전하게 하려면 Private + Signed URL 발급(Phase 4 이후)
2) **Storage 정책(선택)**
   - Public 버킷이면 최소 정책만
   - Private면 RLS/정책 추가 필요(Phase 4)

#### [Agent-코드] Phase 2 작업 목록
1) `/admin` 레이아웃/가드
   - 로그인 + `profiles.is_admin` 확인 후 접근 허용
2) 대회 CRUD
   - `admin/tournaments` 목록
   - `admin/tournaments/new` 생성
   - `admin/tournaments/[id]/edit` 수정
   - “지난달 복제” 버튼(복제는 insert로 처리)
3) 신청자 관리
   - `admin/tournaments/[id]/registrations` 페이지
   - 상태 변경 버튼: applied→confirmed / applied→waitlisted / …  
4) 파일 업로드
   - `admin/tournaments/[id]/files`
   - 업로드 → Storage 저장 → `tournament_files`에 기록
   - 공개 페이지(`/t/[id]`)에서 `tournament_files` 목록/링크 표시

> Agent 프롬프트 예시  
> “/admin 이하 라우트를 만들고, profiles.is_admin=true 인 사용자만 접근하도록 가드를 구현해줘. 관리자용 대회 생성/수정/복제 화면을 만들고, 각 대회 상세 관리자 화면에서 registrations 상태를 confirmed/waitlisted로 변경할 수 있게 해줘. Storage 버킷(tournament-files)에 파일 업로드 후 tournament_files 테이블에 기록하도록 구현해줘.”

---

### Phase 3 — 사전/사후 라운드(엑셀 탭 확장) + 신청 분리
**목표**: 본 대회 외에 **사전/사후 라운드**를 대회에 연결하고 별도 신청을 받는다.  
**완료 기준(AC)**
- 대회 상세에서 사전/사후 라운드가 보인다.
- 사전/사후 각각 신청/현황이 분리되어 관리된다.
- 공개 범위는 A(닉네임 + 상태) 유지

#### [수동-Supabase] Phase 3 작업
- 새 테이블 추가 SQL 실행(마이그레이션 파일 기반)

#### [Agent-코드] Phase 3 작업
- `side_events` / `side_event_registrations` CRUD UI
- 대회 상세에 섹션으로 노출

---

### Phase 4 — 운영 품질(알림/보안/히스토리/배포)
**목표**: 운영 편의 및 안정성 강화(알림, 백업, Private 파일, Signed URL, 로그).  
**완료 기준(AC)**
- 조편성 파일을 Private로 바꾸고도 정상 열람(서명 URL)
- Edge Function으로 마감 알림(이메일/슬랙/카카오 등 선택)
- DB 변경은 마이그레이션으로만 관리

#### [수동-Supabase] Phase 4 작업
- Edge Functions 설정
- Storage Private + 정책
- 필요시 커스텀 도메인(선택)

#### [Agent-코드] Phase 4 작업
- signed URL 발급 로직
- 알림 트리거/함수 호출
- 관리자용 리포트/통계

---

## 5. “코드 vs Supabase 수동” 역할 분리(요약)

### 5.1 [Agent-코드]로 처리할 것(원칙적으로 전부 코드로)
- 화면/라우팅/UX
- supabase-js 호출 모듈화
- 관리자 기능 전반
- 업로드/다운로드 로직(연동)
- 에러 처리/권한 가드

### 5.2 [수동-Supabase]로 꼭 해야 하는 것(초기/운영)
- 프로젝트 생성/키 발급
- SQL Editor에서 스키마/마이그레이션 실행(또는 CLI 도입 전까지)
- Auth Provider 설정(이메일 인증 On/Off 등)
- Storage 버킷 생성(초기)
- 관리자 계정 `is_admin=true` 지정

---

## 6. 작업 파일 구조(권장)
프로젝트 폴더에서 아래처럼 정리하면 Agent가 작업하기 쉬움.

- `lib/`
  - `supabaseClient.ts`
  - `auth.ts` (useAuth / getUser 등)
  - `db.ts` (쿼리 모음)
- `app/`
  - `page.tsx` (대회 목록)
  - `login/page.tsx`
  - `t/[id]/page.tsx`
  - `admin/...` (Phase 2)
- `db/`
  - `schema.sql` (초기 스키마 백업)
  - `migrations/`
    - `001_init.sql`
    - `002_admin_pages.sql` (정책 변경 등)
    - `003_side_events.sql` ...

---

## 7. Agent에게 주는 “개발 지시서”(템플릿)
아래 템플릿을 복사해서 VS Code Agent에게 붙여넣고, **Phase 단위로** 요구하면 된다.

### 공통 지시 템플릿
- 프로젝트: Next.js(App Router) + Supabase
- 공개 범위: 현황 공개(A) = 닉네임 + 상태만
- 보안: 개인정보는 테이블에 넣지 말고(추후 분리), RLS 위반 없도록
- 코드는 `lib/`에 supabase 접근을 모듈화하고, 페이지는 UI 중심
- 변경된 파일 목록을 명확히 제시하고, 실행/검증 방법을 함께 제시

### Phase 1 Agent 지시 예시(그대로 사용 가능)
“Phase 1을 완성해줘.  
1) `/`에서 tournaments 목록을 공개로 보여주고, 각 항목 클릭 시 `/t/[id]`로 이동.  
2) `/t/[id]`에서 tournaments 상세 + registrations 목록(닉네임+상태)을 공개로 보여줘.  
3) 로그인한 사용자만 신청(insert) 가능. 신청 시 profiles.nickname을 기본값으로 넣고, 유저가 수정 가능.  
4) 내 신청 취소는 status를 canceled로 update.  
5) 에러 메시지는 사용자 친화적으로.  
변경 파일 목록과 실행 방법(npm run dev)을 같이 알려줘.”

---

## 8. 검증 체크리스트(Phase 1)
- [ ] 로그인 없이 `/` 접근 가능
- [ ] 로그인 없이 `/t/1` 등 상세 접근 가능
- [ ] 로그인 없이 신청 버튼 클릭 시 “로그인 필요” 안내
- [ ] 로그인 후 신청 성공
- [ ] 중복 신청 시 친화적 메시지
- [ ] 취소 시 status=canceled 반영
- [ ] 현황 공개는 닉네임/상태만 노출(개인정보 없음)

---

## 9. 다음 단계 안내
이 문서 기준으로는 **Phase 1 안정화 → Phase 2 관리자 기능** 순서로 가는 것이 가장 빠르게 “운영 편의”를 얻는 루트다.
