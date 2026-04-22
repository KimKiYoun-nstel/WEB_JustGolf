# 카카오 로그인 구현 계획서 (현재 코드 기준)

## 1. 문서 목적
이 문서는 2026-02-12 기준 현재 프로젝트 코드 상태를 기준으로,  
카카오 OAuth 로그인/회원가입 기능을 안전하게 도입하기 위한 설계와 구현 계획을 정의한다.

핵심 목표는 다음 3가지다.
- 기존 이메일 로그인 기능과 충돌 없이 공존
- 승인 정책(`approval_required`)과 동일한 접근 제어 유지
- 신규 카카오 사용자의 프로필 완성(닉네임 보완) 플로우 제공

---

## 2. 현재 시스템 기준선

### 2.1 인증/승인 구조
- 인증: Supabase Auth (`email/password`) 사용
- 보호 페이지 접근 제어: `middleware.ts`에서 세션 + 승인 상태 확인
- 승인 상태 판정: `is_approved_user` RPC + `app_settings.approval_required`

### 2.2 로그인 UX
- 로그인 실패 시 `/api/auth/check-email`로 이메일 존재 여부 확인
- 오류 메시지 분기: 계정 없음 / 비밀번호 오류 / 인증 필요

### 2.3 관리자 기능
- `/admin/users`: 회원 승인/권한/비밀번호 강제설정/상세보기
- 비밀번호 강제설정 API: `/api/admin/users/[id]/reset-password`

---

## 3. 구현 범위

## 3.1 이번 단계 포함
- 로그인 페이지 카카오 로그인 버튼 추가
- OAuth 콜백 라우트 구현
- 신규 카카오 사용자 닉네임 보완 페이지 구현
- 프로필 페이지에서 로그인 공급자별(이메일/카카오) UI 분기
- 기존 승인 정책과 동일하게 연동

## 3.2 이번 단계 제외
- 이메일 계정과 카카오 계정 연결(Identity Linking)
- 카카오 친구 초대/공유
- 프로필 이미지 저장(Storage)
- 타 소셜 로그인(Apple/Naver 등)

---

## 4. 아키텍처 설계

### 4.1 외부 설정 (수동 필수)
코드만으로 완료할 수 없고, 반드시 콘솔에서 설정해야 한다.

#### Kakao Developers
- 앱 생성
- Web 플랫폼 도메인 등록
- Redirect URI 등록: `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
- 동의 항목: 이메일, 닉네임

#### Supabase Dashboard
- `Authentication > Providers > Kakao` 활성화
- Kakao Client ID/Secret 입력
- Redirect URL 일치 여부 확인

---

### 4.2 로그인 시작점

#### 대상 파일
- `app/login/page.tsx`

#### 구현
- 카카오 로그인 버튼 추가
- `supabase.auth.signInWithOAuth({ provider: "kakao" })` 호출
- `redirectTo`는 앱 콜백 경로로 지정
  - 예: `${window.location.origin}/auth/callback`

#### 주의
- 로딩 중 중복 클릭 방지
- OAuth 시작 실패 시 안내 메시지 처리
- 기존 이메일 로그인 버튼과 상태 충돌 방지

---

### 4.3 OAuth 콜백 라우트

#### 신규 파일
- `app/auth/callback/route.ts`

#### 처리 흐름
1. `code` 수신
2. 서버 클라이언트로 `exchangeCodeForSession(code)` 실행
3. 로그인 사용자 조회
4. `profiles` 조회 후 분기
   - 프로필 없음 또는 닉네임 미완성: `/auth/complete-profile`
   - 승인 필요 + 미승인: `/login?message=...`
   - 그 외: `/start`

#### 구현 원칙
- Route Handler에서 브라우저용 클라이언트(`lib/supabaseClient`) 사용 금지
- `cookies()` 기반 서버 클라이언트 사용
- 예외 발생 시 `/login`으로 안전 복귀

---

### 4.4 미들웨어 예외 경로

#### 대상 파일
- `middleware.ts`

#### 필요성
현재 미들웨어는 비로그인 사용자를 로그인으로 리다이렉트하므로,  
OAuth 왕복 경로를 예외 처리하지 않으면 콜백 루프가 발생할 수 있다.

#### 추가 예외 경로
- `/auth/callback`
- `/auth/complete-profile`

---

### 4.5 신규 사용자 프로필 보완

#### 신규 파일
- `app/auth/complete-profile/page.tsx`

#### 기능
- 현재 사용자 확인
- 카카오 메타데이터 기반 기본 닉네임 제안
- 닉네임 중복 검증(`is_nickname_available` RPC 재사용)
- `profiles.nickname` 저장 후 승인 정책에 따라 이동
  - 승인 필요 ON: 로그인 페이지 안내
  - 승인 필요 OFF: `/start`

---

### 4.6 프로필 페이지 공급자 분기

#### 대상 파일
- `app/profile/page.tsx`

#### 변경
- `user.app_metadata.provider` 기준으로 로그인 공급자 확인
- `provider === "kakao"`면 비밀번호 변경 UI 비노출
- `provider === "email"`면 기존 비밀번호 변경 UI 유지

참고: 비밀번호는 앱 DB 테이블이 아니라 Supabase Auth에서 관리한다.

---

### 4.7 관리자 화면 확장 (선택)

#### 대상 파일
- `app/api/admin/users/route.ts`
- `app/admin/users/page.tsx`

#### 확장 내용
- 회원 목록에 로그인 방식(provider) 표시
- 필요 시 `auth.admin.getUserById`로 provider 매핑

성능 이슈(N+1 조회)는 사용자 수 증가 시 별도 최적화 과제로 분리한다.

---

## 5. DB/마이그레이션 전략

## 5.1 카카오 로그인 코어
카카오 OAuth 도입 자체는 **필수 스키마 변경이 없다**.  
핵심은 Supabase Auth provider/session 처리 + 기존 `profiles` 연계다.

## 5.2 선택적 확장(프로필 고도화)
다음은 카카오 로그인 필수 항목이 아니라 프로필 확장 항목이다.
- `profiles.phone`
- `profiles.real_name`
- `get_auth_provider`, `is_kakao_user` 헬퍼 함수

해당 내용은 `db/migrations/009_kakao_login_support.sql` 초안이 있으므로,  
적용 여부를 확정한 뒤 현재 스키마 기준으로 정리하여 반영한다.

## 5.3 정책 점검
- `profiles` SELECT 정책이 과도하게 열려 있지 않은지 확인
- “이름/전화번호 관리자만 조회” 요구가 있다면 RLS + API 응답 필드 모두 검증

---

## 6. 구현 체크리스트

## Phase A. 외부 설정
- [ ] Kakao Developers 앱/도메인/Redirect URI 설정
- [ ] Supabase Kakao Provider 활성화
- [ ] 개발/운영 Redirect URL 일치 점검

## Phase B. 앱 코드
- [ ] `app/login/page.tsx` 카카오 로그인 버튼 + OAuth 시작 로직
- [ ] `app/auth/callback/route.ts` 생성
- [ ] `middleware.ts` OAuth 경로 예외 처리
- [ ] `app/auth/complete-profile/page.tsx` 생성
- [ ] `app/profile/page.tsx` provider 기반 비밀번호 UI 분기

## Phase C. 관리자 확장 (선택)
- [ ] `app/api/admin/users/route.ts` provider 반환 확장
- [ ] `app/admin/users/page.tsx` 로그인 방식 컬럼/배지 반영

## Phase D. 검증
- [ ] 이메일 로그인 회귀 확인
- [ ] 카카오 신규 가입 시 complete-profile 진입 확인
- [ ] 카카오 기존 사용자 로그인 후 `/start` 이동 확인
- [ ] 승인 필요 ON/OFF 각각 분기 확인
- [ ] 승인 대기 사용자 접근 제한 확인

---

## 7. 테스트 계획

### 7.1 수동 통합 테스트
1. 신규 카카오 사용자 로그인
2. 닉네임 입력/저장
3. 승인 필요 ON 상태에서 접근 제한 확인
4. 관리자 승인 후 로그인 성공 확인
5. 승인 필요 OFF 상태에서 즉시 진입 확인

### 7.2 자동 테스트(점진 도입)
- 로그인 페이지 단위 테스트에 카카오 버튼/에러 처리 케이스 추가
- 콜백 라우트는 통합 테스트 또는 라우트 핸들러 테스트로 분리
- 기존 Vitest 스위트 회귀 우선

---

## 8. 리스크와 대응
- Redirect URI mismatch: Kakao/Supabase URL 완전 일치 확인
- 미들웨어 루프: `/auth/callback`, `/auth/complete-profile` 예외 처리
- 프로필 미생성/지연: 콜백 예외 시 로그인으로 안전 복귀
- 닉네임 충돌: `is_nickname_available` RPC 재사용

---

## 9. 완료 기준 (Definition of Done)
- 카카오 로그인 버튼으로 OAuth 시작 가능
- 콜백에서 세션 교환 정상 동작
- 신규 카카오 사용자 닉네임 보완 플로우 정상 동작
- 승인 정책과 연동된 분기 동작 정상
- 기존 이메일 로그인/회원가입/관리자 기능 회귀 이상 없음
- `npm run build` 성공
