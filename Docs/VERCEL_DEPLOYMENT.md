# Vercel 배포 가이드

## 1. 환경변수 설정

현재 프로젝트는 다음 환경변수가 필요합니다:

### 공개 환경변수 (NEXT_PUBLIC_*)
클라이언트에 노출되어도 안전 (Supabase RLS로 보호)

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase 익명 키

### 비공개 환경변수 (서버 전용)
**절대 클라이언트에 노출되면 안됨!**

- `SUPABASE_SERVICE_ROLE_KEY` - Supabase 서버 역할 키 (Admin 작업용)

## 2. Vercel Dashboard에서 설정하는 방법

### Step 1: Vercel에 로그인
https://vercel.com/dashboard

### Step 2: 프로젝트 선택
1. 프로젝트 이름 클릭
2. `Settings` 탭 클릭

### Step 3: Environment Variables 설정
1. `Settings` → `Environment Variables`로 이동
2. 다음 3개 변수를 추가 (자신의 `.env.local`에서 값 복사):

```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: [자신의 .env.local에서 복사]
Environments: Production, Preview, Development

Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: [자신의 .env.local에서 복사]
Environments: Production, Preview, Development

Name: SUPABASE_SERVICE_ROLE_KEY
Value: [자신의 .env.local에서 복사]
Environments: Production (⚠️ Production만 선택!)
```

**⚠️ 보안 안내:**
- 실제 키 값은 `.env.local` 파일에서만 확인
- 이 문서나 다른 곳에 키 값을 공개하지 마세요
- 한번 노출되면 Supabase에서 새로운 키를 발급해야 합니다

### Step 4: 배포 트리거
변수 저장 후:
1. `Deployments` 탭으로 이동
2. 최근 배포 우측의 `Redeploy` 버튼 클릭
3. 환경변수가 새로 주입되어 배포됨

## 3. 로컬 개발과 Vercel의 차이

| 항목 | 로컬 | Vercel |
|------|------|---------|
| 환경변수 파일 | `.env.local` | Vercel Dashboard |
| Git 추적 | ❌ (gitignore) | ✅ Dashboard에서 관리 |
| 자동 주입 | ✅ Next.js dev server | ✅ 빌드/런타임 시 |
| Service Role Key | ✅ 로컬 테스트용 | ✅ 프로덕션 API용 |

## 4. 보안 주의사항

⚠️ **절대 하지 말 것:**
- ❌ `.env.local`을 Git에 커밋하지 마세요
- ❌ 환경변수 실제 값을 문서, 슬랙, 이메일 등에 공유하지 마세요
- ❌ Service Role Key를 프론트엔드 코드나 공개 저장소에 노출하세요
- ❌ 이 가이드 문서에 실제 키 값을 작성하지 마세요
- ❌ 팀원과 직접 환경변수를 공유하지 마세요

✅ **안전한 방법:**
- ✅ `.env.example`에 템플릿만 저장 (실제 값 빼고)
- ✅ Vercel Dashboard에서만 환경변수 관리
- ✅ 팀원과는 Vercel 프로젝트 접근 권한으로 공유
- ✅ 로컬 `.env.local` 파일은 `.gitignore`에 등록

**키가 노출되었다면:**
```bash
# 즉시 새로운 키 발급 (Supabase Dashboard)
# 1. Supabase → 프로젝트 → Settings → API 섹션
# 2. Service Role Key 재발급
# 3. Vercel에서 새 값으로 업데이트
# 4. 다시 배포
```

## 5. 배포 후 확인

Vercel 배포 후:

1. **클라이언트 환경변수 확인**
   ```bash
   curl https://your-app.vercel.app
   # Network 탭에서 JavaScript 번들에 SUPABASE_URL이 포함되는지 확인
   ```

2. **서버 API 테스트**
   ```bash
   # /api/admin/users 등이 정상 작동하는지 확인
   # Service Role Key로 관리자 기능이 작동해야 함
   ```

3. **RLS 정책 확인**
   ```bash
   # 로그인하지 않은 상태에서 /admin 접근 시 리다이렉트 확인
   # 일반 사용자가 /admin 접근 시 거부되는지 확인
   ```

## 6. 문제 해결

### "Cannot find name 'SUPABASE_SERVICE_ROLE_KEY'" 에러
- Vercel Dashboard에서 환경변수가 제대로 설정되었는지 확인
- `Redeploy` 버튼으로 다시 배포

### 프로덕션에서 Service Role Key가 작동 안 함
- Vercel Dashboard의 환경변수 값이 정확한지 확인 (공백, 따옴표 없음)
- `SUPABASE_SERVICE_ROLE_KEY`의 값이 완전한지 확인

### 로컬에서는 되는데 Vercel에서 안 됨
- 로컬 `.env.local`과 Vercel Dashboard의 값이 같은지 확인
- 빌드 로그에서 환경변수가 제대로 주입되었는지 확인

## 7. 다음 단계

배포 후:

1. ✅ 모든 기능 테스트 (로그인, 회원가입, 관리자 기능)
2. ✅ 성능 모니터링
3. ✅ 에러 로깅 설정 (Vercel Analytics, Sentry 등)
4. ✅ Database 백업 정책 수립
