# WEB_JustGolf_1 Template UI Migration Plan

## 0. 문서 목적
이 문서는 `WEB_JustGolf_1`의 기존 기능(백엔드, Supabase 연동, 인증/권한, URL 구조)은 유지하고, 핵심 화면의 UI를 템플릿 스타일로 업그레이드하기 위한 실행 설계서다.

## 1. 배경 및 분석 요약

### 1.1 워크스페이스 구조
- 실제 서비스 프로젝트: `WEB_JustGolf_1` (Next.js App Router + Supabase)
- 템플릿 UI 프로젝트: 루트의 `components/`, `App.tsx` 중심 (Vite/React 단일 상태 전환 구조)

### 1.2 기술 스택 차이(핵심 리스크)
| 항목 | WEB_JustGolf_1 | 템플릿 |
|---|---|---|
| 프레임워크 | Next.js App Router | Vite React |
| 라우팅 | 파일 기반 URL 라우팅 | `useState` 기반 뷰 전환 |
| 데이터 | Supabase 실데이터 CRUD | 목업 배열/정적 상태 |
| 인증/권한 | middleware + profile/is_admin/is_approved 체크 | 없음 |
| 헤더 | 전역 `RootLayout`에서 `Header` 렌더 | 페이지별 자체 헤더 |

결론: 템플릿 코드 직접 복붙이 아니라, **기존 페이지 로직 위에 UI 레이어를 덮는 방식**으로 진행해야 한다.

### 1.3 템플릿 코드 점검 결과
- 다수 화면이 정적 배열(`const tournaments = [...]`, `const adminTournaments = [...]`) 기반이다.
- 일부 버튼은 동작 미구현(`onClick: () => {}`)이다.
- `components/TournamentDetailPage.tsx`는 `map` 내부 `useState` 사용으로 React Hook Rule 위반 상태다.
- 따라서 템플릿은 "디자인 레퍼런스"로 사용하고, 로직은 `WEB_JustGolf_1` 기준으로 유지한다.

### 1.4 기존 서비스의 대상 화면 복잡도(핵심 8화면)
| 라우트 | 파일 | 특징 |
|---|---|---|
| `/login` | `app/login/page.tsx` | 로그인/회원가입/카카오/에러로그/승인정책 연동 |
| `/start` | `app/start/page.tsx` | 빠른 이동 카드 |
| `/tournaments` | `app/tournaments/page.tsx` | 대회 목록 + 내 신청상태 + 지원자 수 |
| `/t/[id]/participants` | `app/t/[id]/participants/page.tsx` | 대회 상세 공개 정보/섹션형 페이지 |
| `/t/[id]` | `app/t/[id]/page.tsx` | 참가 신청/수정/제3자 등록/활동/라운드/경품/파일 |
| `/admin/tournaments` | `app/admin/tournaments/page.tsx` | 관리자 대회 액션 허브 |
| `/admin/tournaments/[id]/registrations` | `app/admin/tournaments/[id]/registrations/page.tsx` | 신청자 상태관리/일괄처리 |
| `/admin/tournaments/[id]/side-events` | `app/admin/tournaments/[id]/side-events/page.tsx` | 라운드 CRUD + 라운드신청자 조회 |

참고: `/t/[id]/page.tsx`는 2,000+ 라인의 가장 복잡한 화면이다.

## 2. 확정 의사결정
1. 1차 범위는 핵심 8화면으로 제한한다.
2. 기존 URL/라우트 구조는 변경하지 않는다.
3. 반영 강도는 "기능우선 유사도"로 한다.
4. 구현 순서는 사용자 화면 먼저, 관리자 화면 나중으로 한다.
5. 핵심 8화면은 페이지별 Header를 사용하고, 전역 Header는 숨긴다.
6. 상세/수정 매핑은 다음으로 확정한다.
- 상세 UI: `/t/[id]/participants`
- 수정 UI: `/t/[id]`

## 3. 비범위(Out of Scope)
- DB 스키마 변경, migration, API contract 변경
- 비핵심 화면 UI 일괄 개편 (`/board`, `/profile`, `/admin/users`, `/admin/help` 등)
- 인증/승인 로직 정책 변경
- 신규 대규모 기능 추가

## 4. 핵심 설계 원칙

### 4.1 로직 보존 원칙
- 기존 `useEffect`, Supabase 쿼리, mutation 함수는 가능한 이름/구조 유지
- UI 리팩터링 중에도 business rule 변경 금지

### 4.2 라우팅/권한 보존 원칙
- `middleware.ts` 동작 유지
- 페이지별 admin check, approval check 흐름 유지
- 링크 경로 유지

### 4.3 Header 전략
- `app/layout.tsx`는 그대로 두고, `components/Header.tsx`에서 path 기준 early return(`null`) 처리
- 숨김 대상:
`/login`, `/start`, `/tournaments`, `/t/[id]`, `/t/[id]/participants`, `/admin/tournaments`, `/admin/tournaments/[id]/registrations`, `/admin/tournaments/[id]/side-events`

### 4.4 스타일 전략
- `app/globals.css`와 Tailwind 유틸리티를 활용
- 템플릿 톤(카드 반경, 배경, 색상, 섹션 간격, sticky 섹션)을 페이지별 className으로 이식
- 공용 스타일 중복이 커지면 작은 프레젠테이션 컴포넌트로 추출

## 5. 화면 매핑 및 상세 설계

## 5.1 `/login` (템플릿 AuthPage 반영)
### UI 목표
- 템플릿 로그인/회원가입 카드 레이아웃 반영
- 카카오 버튼 강조 영역 유지

### 유지해야 할 기능
- `signIn`, `signUp`, `signInWithKakao`
- 이메일 중복/닉네임 체크, 승인정책 동기화, 에러 로그 API 호출
- 로그인 후 온보딩 분기 라우팅

### 데이터 접근
- `app_settings`
- `profiles`
- auth endpoint via Supabase Auth
- `/api/auth/*` 내부 API

## 5.2 `/start` (템플릿 StartPage 반영)
### UI 목표
- 사용자 카드 영역 + 관리자 카드 영역의 분리 배치

### 유지해야 할 기능
- 빠른 이동 링크:
`/tournaments`, `/jeju`, `/board`, `/admin/help`
- 관리자 메뉴 링크 노출 조건(기존 정책 기반)

## 5.3 `/tournaments` (템플릿 TournamentListPage 반영)
### UI 목표
- 카드형 리스트 + 상태 배지 + CTA 버튼

### 유지해야 할 기능
- 대회 목록 조회
- 신청자 수 계산
- 로그인 사용자의 내 상태 표기
- 상세 이동 `/t/[id]/participants`

### 데이터 접근
- `tournaments`
- `registrations`

## 5.4 `/t/[id]/participants` (템플릿 TournamentDetailPage 반영)
### UI 목표
- 상단 요약 + sticky 탭/섹션 이동 + 카드형 섹션 구성

### 유지해야 할 기능
- 참가자 공개 현황
- 라운드별 현황
- 경품 현황
- 조편성 링크
- 본인 신청 유무에 따라 CTA 분기

### 데이터 접근
- `tournaments`
- `registrations`
- `side_events`
- `side_event_registrations`
- `tournament_prize_supports`

## 5.5 `/t/[id]` (템플릿 TournamentEditPage 반영)
### UI 목표
- "참가 수정" 중심 폼 UX로 개편
- 길이가 긴 기능을 섹션 카드로 분리

### 유지해야 할 기능(핵심)
- 본인 참가 신청/수정/취소
- 제3자 참가자 추가/수정/삭제
- 식사/활동/카풀/이동정보/메모 저장
- 라운드별 신청/취소 및 식사/숙박 선택
- 경품 지원 CRUD
- 첨부파일 목록/열기

### 데이터 접근
- `profiles`
- `tournaments`
- `registrations`
- `registration_extras`
- `tournament_files`
- `side_events`
- `side_event_registrations`
- `tournament_meal_options`
- `tournament_extras`
- `registration_activity_selections`
- `tournament_prize_supports`

## 5.6 `/admin/tournaments` (템플릿 AdminTournamentListPage 반영)
### UI 목표
- 대회 카드 리스트 + 상태/통계 요약 + 액션 메뉴 배치

### 유지해야 할 기능
- 대회 조회
- soft delete(`status=deleted`)
- 각 하위 관리 화면으로 이동

### 데이터 접근
- `tournaments`
- `registrations` (삭제 전 카운트 확인)

## 5.7 `/admin/tournaments/[id]/registrations` (템플릿 AdminApplicantListPage 반영)
### UI 목표
- 신청자 관리 대시보드형 UI(필터/검색/일괄처리)

### 유지해야 할 기능
- 상태별 그룹/카운트
- 개별 상태변경
- 일괄 상태변경
- 식사/활동/등록자 정보 표시

### 데이터 접근
- `registrations`
- `profiles`

## 5.8 `/admin/tournaments/[id]/side-events` (템플릿 AdminTournamentSettingsPage 반영)
### UI 목표
- 설정 허브 스타일 상단 탭 느낌 반영
- 본문은 라운드 CRUD와 신청자 현황 유지

### 유지해야 할 기능
- 라운드 생성/수정/삭제
- 라운드 상태관리
- 라운드별 신청자 조회
- 권한 검사(관리자/매니저)

### 데이터 접근
- `side_events`
- `side_event_registrations`
- `meal_options`(현재 코드 기준)
- `profiles`
- `manager_permissions`

## 6. 컴포넌트/코드 구조 설계

### 6.1 권장 리팩터링(기능 불변)
- 페이지당 JSX가 너무 길 경우 아래 단위로 분리
1. `PageHeader` 계열
2. `StatCard` 계열
3. `ActionBar` 계열
4. `FilterBar` 계열
5. `SectionCard` 계열

### 6.2 금지 사항
- 쿼리 파라미터/상태 값 의미 변경
- DB 컬럼명 변경
- 권한 체크 제거
- 기존 에러 메시지 흐름 제거

## 7. 구현 단계(실행 순서)
1. 전역 Header 숨김 정책 적용 (`Header.tsx`)
2. 사용자 5화면 UI 이식
3. 관리자 3화면 UI 이식
4. 공통 정리(중복 UI 조각 추출)
5. 테스트 보정 및 스모크 검증

## 8. 테스트 설계

### 8.1 단위/통합
- `__tests__/components/Header.test.tsx`
- `app/__tests__/routes.integration.test.tsx`
- 로그인 관련 테스트(`app/login/login.test.tsx`)의 selector 안정성 유지

### 8.2 E2E 스모크
1. 로그인 성공 후 `/start` 진입
2. `/tournaments` 조회 및 상세 이동
3. `/t/[id]/participants` 섹션 네비게이션 확인
4. `/t/[id]`에서 수정/저장 액션 동작 확인
5. `/admin/tournaments` 진입 및 액션 링크 확인
6. `/admin/tournaments/[id]/registrations` 상태 변경 확인
7. `/admin/tournaments/[id]/side-events` CRUD 기본 동작 확인

### 8.3 반응형 확인
- 모바일 기준 viewport(390x844)에서 sticky/fixed 충돌 점검
- 데스크톱 기준 주요 CTA 가시성 점검

## 9. 수용 기준(Acceptance Criteria)
1. 핵심 8화면 UI가 템플릿 톤으로 변경되어야 한다.
2. 기존 URL, 데이터, 권한, 상태변경 기능이 동일하게 동작해야 한다.
3. 주요 테스트와 빌드가 통과해야 한다.
4. 콘솔 에러 및 Hook Rule 위반이 없어야 한다.
5. 비핵심 화면에는 회귀가 없어야 한다.

## 10. 리스크 및 완화
| 리스크 | 설명 | 완화 |
|---|---|---|
| Hook 규칙 위반 | 템플릿 코드 일부가 React 규칙 미준수 | 페이지별 구조화, map 내부 훅 제거 |
| 기능 누락 | 정적 템플릿으로 교체 시 기존 로직 소실 | 로직 우선 유지, UI만 교체 |
| 헤더 충돌 | 전역 Header + 페이지 Header 중복 | 핵심 경로에서 전역 Header 숨김 |
| 모바일 레이아웃 충돌 | sticky/fixed 영역 겹침 | 화면별 top offset 조정 및 E2E 캡처 검증 |
| 테스트 깨짐 | 텍스트/구조 변경으로 selector 깨짐 | role/label 기반 selector로 보강 |

## 11. 롤아웃 전략
1. PR-1: Header 정책 + 사용자 5화면
2. PR-2: 관리자 3화면 + 설정 허브 스타일
3. PR-3: 테스트/반응형 보정

## 12. 구현 전 체크리스트
- `npm install` 후 빌드/테스트 실행 환경 준비
- Supabase 환경변수 확인
- 테스트 계정/관리자 계정 준비
- 모바일/데스크톱 검증 시나리오 준비

## 13. 구현 후 체크리스트
- 핵심 8화면 시각 검수
- 사용자 신청/수정/취소 end-to-end 확인
- 관리자 신청자 상태변경 end-to-end 확인
- 라운드 설정 CRUD 확인
- 회귀 점검(비핵심 화면)

---

본 문서는 UI 이식 실행 기준 문서이며, 구현 단계에서 발견되는 예외는 "기능 불변" 원칙 하에 문서에 지속 반영한다.
