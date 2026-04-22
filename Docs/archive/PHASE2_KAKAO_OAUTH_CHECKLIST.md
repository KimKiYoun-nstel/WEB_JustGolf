# Phase 2: Kakao OAuth 설정 확인 체크리스트

> 이미 완료하신 작업에 대한 확인 항목입니다.

## ✅ Kakao Developers 설정 확인

### 1. 애플리케이션 정보
- [ ] **애플리케이션 생성 완료**
  - Kakao Developers (https://developers.kakao.com/) 접속
  - 내 애플리케이션 메뉴에서 생성 확인

- [ ] **앱 키 확인**
  - 내 애플리케이션 → [앱 이름] → 앱 키
  - **REST API 키**: `[복사 완료]`
  - **JavaScript 키**: `[복사 완료]` (선택)

### 2. 플랫폼 설정
- [ ] **Web 플랫폼 등록 완료**
  - 내 애플리케이션 → [앱 이름] → 플랫폼 → Web
  - **개발 환경**:
    ```
    사이트 도메인: http://localhost:3000
    ```
  - **프로덕션 환경**:
    ```
    사이트 도메인: https://[your-app].vercel.app
    ```

### 3. Redirect URI 설정
- [ ] **Redirect URI 등록 완료**
  - 내 애플리케이션 → [앱 이름] → 제품 설정 → 카카오 로그인
  - **Redirect URI 활성화**: ON
  - **등록된 Redirect URI** (아래 형식 확인):
    ```
    https://[SUPABASE_PROJECT_REF].supabase.co/auth/v1/callback
    ```
  
  **확인 방법:**
  ```bash
  # .env.local에서 SUPABASE_URL 확인
  NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
  
  # Redirect URI = SUPABASE_URL + /auth/v1/callback
  ```

### 4. 동의 항목 설정
- [ ] **필수 동의 항목 설정 완료**
  - 내 애플리케이션 → [앱 이름] → 제품 설정 → 카카오 로그인 → 동의 항목
  
  | 동의 항목 | 필수 여부 | 용도 |
  |----------|----------|------|
  | **카카오 계정(이메일)** | ✅ 필수 | 사용자 이메일 (auth.users.email) |
  | **닉네임** | ✅ 필수 | 기본 닉네임 제안 (profiles.nickname) |
  | 프로필 사진 | ⚪ 선택 | 프로필 이미지 (향후 구현) |

  **설정 확인:**
  - 이메일: 수집 목적 "회원 식별 및 서비스 이용"
  - 닉네임: 수집 목적 "서비스 내 사용자 표시"

### 5. 보안 설정 (선택)
- [ ] **Client Secret 활성화 확인** (권장)
  - 내 애플리케이션 → [앱 이름] → 보안 → Client Secret
  - **코드 생성**: 활성화
  - **Client Secret**: `[복사 완료]`
  
  > ⚠️ Supabase에서 Kakao Provider 설정 시 사용

### 6. 비즈 앱 전환 (선택)
- [ ] **비즈 앱 전환 여부 확인**
  - 일반 앱: 최대 100명 사용 가능
  - 비즈 앱: 사용자 수 제한 없음 (심사 필요)
  
  **현재 상태**: [ ] 일반 앱 / [ ] 비즈 앱

---

## ✅ Supabase Dashboard 설정 확인

### 1. Kakao Provider 활성화
- [ ] **Supabase Dashboard 접속**
  ```
  https://supabase.com/dashboard/project/[PROJECT_ID]
  ```

- [ ] **Authentication → Providers → Kakao 활성화**
  - Supabase Dashboard → Authentication → Providers
  - Kakao 찾기 → **Enable** 스위치 ON

- [ ] **Kakao 설정 입력**
  ```
  Kakao Client ID: [Kakao REST API 키 입력]
  Kakao Client Secret: [Kakao Client Secret 입력]
  ```

- [ ] **Redirect URL 확인** (자동 생성됨)
  ```
  https://[PROJECT_REF].supabase.co/auth/v1/callback
  ```
  
  > ⚠️ 이 URL이 Kakao Developers의 Redirect URI와 정확히 일치해야 합니다!

### 2. 추가 설정 (선택)
- [ ] **Skip nonce check** (선택)
  - 일반적으로 OFF (보안 강화)
  
- [ ] **Additional Scopes** (선택)
  - 기본값 유지 (profile_nickname, account_email)

---

## ✅ 환경변수 확인

### .env.local 파일
```bash
# 기존 환경변수 (변경 없음)
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI...

# 카카오 관련 환경변수는 불필요
# (Supabase Dashboard에서 관리)
```

**확인 사항:**
- [ ] NEXT_PUBLIC_SUPABASE_URL 값과 Redirect URI의 도메인이 일치
- [ ] SUPABASE_SERVICE_ROLE_KEY 존재 (DB Migration 자동화용)

---

## ✅ 연동 테스트 (Phase 2 완료 후)

### 간단한 연동 테스트
Supabase Dashboard에서 카카오 로그인 테스트:

1. **Authentication → Users 페이지**
2. **"Invite user" 버튼 옆 ⋮ 메뉴**
3. **"Test OAuth flow"** (있는 경우)
4. 카카오 선택 → 로그인 테스트

또는 프론트엔드에서 테스트:
```typescript
// 임시 테스트 코드
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'kakao',
});

console.log('OAuth URL:', data?.url);
console.log('Error:', error);
```

---

## 🚫 수작업이 필요한 부분

### 불가피한 수작업
1. **Kakao Developers 웹 콘솔**
   - 앱 생성, 키 발급
   - Redirect URI 등록
   - 동의 항목 설정
   
   **자동화 불가 이유**: 카카오 API 제한, 2FA 필요

2. **Supabase Dashboard → Kakao Provider 활성화**
   - REST API 키, Client Secret 입력
   
   **자동화 불가 이유**: Supabase Management API가 있지만 복잡하고 토큰 관리 필요

### 자동화 가능한 부분
1. ✅ **DB Migration 실행**
   ```bash
   node scripts/run-migration.mjs db/migrations/009_kakao_login_support.sql
   ```
   
   **단, Supabase 제한으로 인해 최종적으로는 Dashboard에서 수동 실행 필요**

2. ✅ **프론트엔드 코드 구현** (Phase 3-5)
   - 모두 코드로 자동화 가능

---

## 📋 Phase 2 완료 확인

모든 체크리스트 항목이 완료되었다면:

- [x] Kakao Developers 설정 완료
- [x] Supabase Kakao Provider 활성화 완료
- [x] Redirect URI 일치 확인
- [x] 동의 항목 설정 완료
- [x] 환경변수 확인 완료

**✅ Phase 2 완료! → Phase 1 (DB Migration) 진행 가능**

---

## 🔍 트러블슈팅

### 문제 1: Redirect URI mismatch
```
에러: redirect_uri_mismatch
```
**해결:**
- Kakao Developers의 Redirect URI와 Supabase의 URL이 정확히 일치하는지 확인
- 슬래시(/) 유무, http/https 확인

### 문제 2: 동의 항목 오류
```
에러: required_scope_not_granted
```
**해결:**
- Kakao Developers → 동의 항목에서 이메일, 닉네임을 "필수"로 설정
- "선택 동의 후 수집" 옵션 비활성화

### 문제 3: Supabase에서 Kakao 버튼이 안 보임
**해결:**
- Supabase Dashboard → Authentication → Providers 
- Kakao의 Enable 스위치가 ON인지 확인
- 페이지 새로고침

---

## 다음 단계

Phase 2 확인 완료 후:

1. **Phase 1 실행**: DB Migration (자동화 스크립트 사용)
   ```bash
   # Supabase Dashboard SQL Editor에서 실행
   # db/migrations/009_kakao_login_support.sql 내용 복사/붙여넣기
   ```

2. **Phase 3-5 진행**: 프론트엔드 구현
   - 카카오 로그인 버튼
   - OAuth 콜백 처리
   - 추가 정보 입력 페이지
   - 프로필/관리자 페이지 확장
