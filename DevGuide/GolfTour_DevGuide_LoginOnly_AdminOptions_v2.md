# Golf Tour — 개발 가이드 (로그인 전용 + 관리자 옵션 제공형 + 조편성 웹페이지)

작성일: 2026-02-08  
스택: Next.js(App Router) + Supabase(Auth/DB/RLS) + Vercel(배포)  
목표: 매월 골프 대회 운영을 **로그인 사용자 전용 웹 서비스**로 구축하고, **관리자 페이지에서 조편성을 편집/공개(publish)** 한다.

> 이 문서는 **코드를 직접 제공하지 않고**, “무엇을 어떤 순서로 만들지”를 정리한 개발 가이드입니다.  
> 실제 구현은 VS Code의 AI Agent로 진행하고, Supabase에서 사람이 직접 해야 하는 작업만 구체적으로 적었습니다.

---

## 0) 핵심 정책(이번 가이드 기준)

### 0.1 접근 정책
- **비로그인(Anonymous) 사용자**: 서비스 접근 불가 (목록/상세/현황/조편성 모두 차단)
- **로그인 일반 사용자(비관리자)**: 대회 정보/현황 열람 + 신청/수정 + (공개된) 조편성 열람
- **관리자**: 대회 생성/수정/오픈/마감 + 옵션(식사메뉴 등) 관리 + 조편성 편집/공개 + 참가자 상태 변경

> 용어 정리: “공개”란 **비관리자(일반 사용자)에게 공개**라는 뜻이며, *비로그인에게 공개*가 아닙니다.  
> 조편성은 “첨부파일”이 아니라 **웹페이지에서 편집/공개**합니다.

### 0.2 입력 정책(엑셀 기반)
- 개인정보(이름/전화/성별 등)는 MVP에서 저장하지 않음(추후 분리 테이블/권한으로 확장)
- 식사 메뉴는 참가자가 자유 입력하지 않음  
  → **관리자가 ‘대회별 메뉴 옵션 리스트’를 만들고**, 참가자는 그중 **선택**만 함
- 카풀/이동/출발지/비고 등은 “추가정보”로 분리 저장(권한 정책 중요)

---

## 1) 기능 범위(Phase)

### Phase 1 — 로그인 전용 서비스 + 기본 신청 흐름
**목표**
- 로그인한 사용자만 대회 목록/상세/현황 접근
- 로그인한 사용자는 신청/취소(또는 status=canceled) 가능
- 관리자/일반 사용자 구분 기반(관리자만 관리 기능 접근)

**완료 기준**
- 비로그인 접속 시 `/login`으로 이동
- 로그인 후 `/` 목록, `/t/[id]` 상세 열람 가능
- 신청 후 현황 반영

---

### Phase 2 — 관리자 대회 운영(반복 업무 제거)
**목표**
- 관리자만 `/admin` 접근
- 대회 생성/수정/복제
- 오픈/마감(상태 관리)
- 참가자 상태 변경(확정/대기/취소)

---

### Phase 3 — “식사 메뉴 옵션” + “추가 정보(카풀/이동/출발지/비고)”
**목표**
- 관리자: 대회별 식사 메뉴 옵션 리스트 관리(추가/비활성/정렬)
- 참가자: 신청 시 식사 메뉴 선택 + 카풀 등 추가정보 입력/수정
- 데이터는 **로그인 사용자에게만 공개**(비로그인 차단)
- 추가정보 공개 범위는 아래 중 택1:
  - (권장) 참가자 본인 + 관리자만 조회
  - (카풀 매칭 필요 시) 로그인 사용자 전체에 일부 필드(카풀 가능/좌석) 공개

---

### Phase 4 — 조편성(웹페이지 편집 + publish 공개)
**목표**
- 관리자가 웹페이지에서 조편성(조/멤버/티오프 등)을 편집한다.
- 편성이 완료되면 **Publish**하여 로그인 일반 사용자에게 공개한다.
- 비로그인 사용자는 조편성을 포함해 서비스 접근 불가.

**완료 기준**
- 관리자 화면에서 조 생성/편집/멤버 배정/순서 변경 가능
- “Publish” 이후 일반 사용자가 `/t/[id]/groups`에서 조편성 확인 가능
- Publish 전에는 일반 사용자에게 노출되지 않음

---

## 2) 데이터/권한 설계 가이드(중요)

### 2.1 테이블 설계 원칙
- 공개(열람 범위 넓음) 테이블과 민감(열람 제한) 테이블은 **분리**
- “대회/신청/조편성”은 핵심 테이블, “추가정보/옵션”은 확장 테이블

권장 테이블:
- `tournaments` : 대회 기본 정보
- `registrations` : 신청 기본(닉네임/상태/메모)
- `tournament_meal_options` : 대회별 식사 메뉴 옵션(관리자 생성)
- `registration_extras` : 참가자의 선택/추가정보(식사 선택, 카풀 등)
- `tournament_groups` : 조(그룹) 메타(조번호/티오프/공개여부 등)
- `tournament_group_members` : 조 멤버 배정(누가 몇조 몇번 자리)
- `profiles` : 사용자 프로필/권한(관리자 여부)
- (선택) `audit_logs` : 변경 이력(운영 품질)

> 기존에 `tournament_files`/Storage를 고려했더라도, 본 가이드는 “조편성 파일 업로드”가 아니라  
> “조편성 페이지 편집/공개” 방식이므로 Storage는 필수가 아닙니다.

### 2.2 RLS(권한) 원칙
- **비로그인 차단**: `select` 정책에서 `auth.role() = 'authenticated'`를 기본으로
- 일반 사용자 열람:
  - 대회/신청 현황: 로그인 사용자 전체 열람(운영상 필요)
  - 추가정보(extras): 기본은 본인+관리자만 열람(민감도 고려)
  - 조편성: **publish된 데이터만** 열람
- 관리자 쓰기 권한: `profiles.is_admin = true`일 때만 insert/update/delete 허용

---

## 3) Supabase에서 “사람이 직접 해야 하는 일” (수동 작업 체크리스트)

### 3.1 Auth(카카오 로그인) 설정
1) Supabase → Authentication → Providers → **Kakao 활성화**
2) Kakao Developers에서 앱 생성 후 Redirect URI 설정(문서의 Supabase 콜백 URL 사용)
3) Vercel 배포 URL(예: `https://web-just-golf.vercel.app`)을 Supabase Auth Redirect 설정에 반영
4) (개발 편의) 로컬/프리뷰에서만 이메일 로그인도 허용할지 정책 결정  
   - 운영은 카카오만 노출, 개발은 이메일 UI를 숨겨두는 방식 권장

### 3.2 “비로그인 차단” RLS로 적용(전체 서비스 비공개)
- `tournaments`, `registrations` 등 주요 테이블의 `select` 정책을
  - 기존 `using(true)` 형태가 있다면 제거
  - `using(auth.role() = 'authenticated')` 형태로 변경
- 이 작업은 **SQL Editor**에서 수행 (마이그레이션 파일로 관리 권장)

### 3.3 관리자 지정(권한 부여)
- 본인 계정 가입 후 `profiles.is_admin = true`로 변경
- 운영자 계정 추가 시 동일 방식으로 부여

### 3.4 식사 메뉴 옵션 / 추가정보 테이블 생성(Phase 3)
- SQL Editor에서 아래 신규 테이블을 생성(마이그레이션으로 관리):
  - `tournament_meal_options`
  - `registration_extras`
- RLS 정책도 함께 생성:
  - meal options: 로그인 사용자 조회 + 관리자만 쓰기
  - extras: (기본) 본인+관리자 조회/수정  
    (카풀 매칭 필요 시) “일부 컬럼만 전체 공개”가 가능하도록 정책/뷰 설계 고려

### 3.5 조편성 테이블 생성(Phase 4) + RLS
조편성은 “파일”이 아니라 **DB + 웹 편집**입니다. 아래 테이블을 SQL Editor에서 생성하세요.

**필수 테이블**
- `tournament_groups`
  - `tournament_id`
  - `group_no` (1조,2조…)
  - `tee_time` (선택)
  - `is_published` 또는 `published_at` (공개 제어)
  - `notes` (선택)
- `tournament_group_members`
  - `group_id`
  - `registration_id` 또는 `user_id` (추천: registrations 기반이면 registration_id 참조)
  - `position` (1~4)
  - (선택) `role` (조장 등)

**RLS 정책 가이드**
- `tournament_groups` / `tournament_group_members`:
  - select: 로그인 사용자만 + (일반 사용자는 publish된 그룹만)
  - write: 관리자만

> 구현 팁: 일반 사용자 조회 성능/편의 위해 `view_tournament_groups_published` 같은 VIEW를 만들고  
> 거기에 select 정책을 단순화하는 것도 좋습니다.

---

## 4) Next.js(프로젝트 폴더)에서 Agent에게 맡길 개발 범위 (가이드)

### 4.1 전역 로그인 강제(비로그인 차단)
- 목표: `/login` 외 모든 페이지는 로그인 세션 없으면 `/login`으로 리다이렉트
- 방법 예:
  - Next.js middleware로 라우트 보호
  - 혹은 레이아웃에서 세션 체크 후 라우팅
- 주의: DB(RLS)만으로 막으면 UX가 나빠지므로 프론트에서도 가드 권장

### 4.2 사용자 기능(Phase 1)
- `/` 대회 목록(로그인 사용자)
- `/t/[id]` 대회 상세 + 신청 현황
- 신청/취소/상태 변경 흐름
- 닉네임 기본값: `profiles.nickname`를 기본으로 사용(사용자가 수정 가능)

### 4.3 관리자 기능(Phase 2)
- `/admin` 접근 가드(관리자만)
- 대회 CRUD(생성/수정/복제)
- 상태 관리(draft/open/closed/done)
- 참가자 상태 변경(applied/confirmed/waitlisted/canceled)

### 4.4 식사 메뉴 옵션(Phase 3)
- 관리자 화면에서 대회별 메뉴 옵션 관리:
  - 옵션 추가/비활성화/정렬
- 참가자 신청 화면에서:
  - 메뉴 옵션을 select(dropdown)으로 보여주고 선택 저장

### 4.5 추가정보(카풀/이동/출발지/비고)(Phase 3)
- 입력은 `registration_extras`에 저장(upsert)
- 공개 범위 정책에 따라 화면 노출 결정:
  - 기본: 본인 입력은 본인만 보이고, 관리자는 전체 조회 가능
  - 필요 시: 카풀 관련 일부 필드만 로그인 사용자 전체에 공개(정책 변경 필요)

### 4.6 조편성 UI(Phase 4)
**관리자 편집**
- `/admin/tournaments/[id]/groups`
  - 조 생성/삭제
  - 신청자 목록( registrations )에서 멤버 선택/배정
  - 자리(position 1~4) 변경(버튼 또는 드래그앤드롭)
  - tee_time 입력(선택)
  - Publish 버튼: `is_published=true` 또는 `published_at=now()`

**일반 사용자 열람**
- `/t/[id]/groups`
  - publish된 조만 보여줌
  - 1조/2조… 단위로 닉네임 목록 + 티오프 시간 표시
  - Publish 전이면 “아직 조편성이 공개되지 않았습니다” 표시

---

## 5) UI(템플릿/컴포넌트) 가이드(빠르게 앱처럼)

### 5.1 권장 조합
- Tailwind + shadcn/ui

### 5.2 적용 순서(권장)
1) `/`, `/t/[id]`, `/login`을 Card/Table/Badge/Input/Button으로 정리
2) 관리자 페이지는 Table + Form + Dialog 패턴으로 확장
3) 조편성 화면은 “카드형 조 목록 + 멤버 슬롯(1~4)” UI로 구성
4) 스타일은 “기능 흐름 안정화 후” 점진 개선

---

## 6) AI Agent에게 주는 요구사항 템플릿(복붙용)

### 6.1 공통 규칙
- 서비스는 **비로그인 차단**
- “공개”는 **로그인 일반 사용자에게 공개**
- DB 변경이 필요하면:
  - 코드에서 직접 SQL 실행하지 말고
  - `db/migrations/xxx.sql` 파일로 작성하도록(사람이 Supabase SQL Editor에서 실행)

### 6.2 Phase별 지시 예시
- Phase 1: 로그인 강제 + 목록/상세/신청/취소 안정화
- Phase 2: /admin 가드 + 대회 CRUD + 참가자 상태 변경
- Phase 3: meal options 관리 + extras upsert + 표시 범위 준수
- Phase 4: 조편성 편집/공개 + publish 기반 사용자 열람

---

## 7) 운영/테스트 팁(혼자 개발 시)
- 테스트 계정(여러 명)이 없어도 기능 테스트가 가능하도록:
  - “참가자 다수”는 더미 신청 데이터를 SQL로 넣어 UI 검증
  - 역할(admin/user)은 `profiles.is_admin` 토글로 빠르게 전환
- Vercel은 병렬로 사용:
  - GitHub push → 자동 배포(Preview/Production)
  - 운영 전에는 Preview로 사용자 피드백 받기
