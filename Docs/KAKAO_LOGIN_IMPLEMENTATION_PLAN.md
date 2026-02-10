# 카카오 로그인 통합 계획서

## 📊 현재 시스템 분석

### 1. 현재 인증 구조

#### auth.users (Supabase Auth 테이블)
```sql
- id: UUID (Primary Key) ← 모든 사용자의 고유 식별자
- email: string (이메일)
- encrypted_password: string (암호화된 비밀번호)
- raw_user_meta_data: jsonb (닉네임 등 메타데이터)
- provider: string (기본값: 'email') ← 인증 공급자
- provider_id: string ← 공급자별 고유 ID
```

#### profiles 테이블 (사용자 정보)
```sql
- id: UUID references auth.users(id) ← Primary Key
- nickname: text NOT NULL
- full_name: text (현재는 선택)
- is_admin: boolean
- is_approved: boolean
- created_at, updated_at
```

### 2. 현재 사용자 등록 플로우

```
회원가입 (이메일/비밀번호)
  ↓
auth.users 레코드 생성
  - provider: 'email'
  - email: 사용자 입력
  - password: 암호화 저장
  ↓
Trigger: handle_new_user()
  ↓
profiles 테이블 자동 생성
  - nickname: metadata에서 추출 또는 '익명'
  - is_approved: false (관리자 승인 대기)
  ↓
관리자 승인 후 로그인 가능
```

---

## 🎯 카카오 로그인 통합 요구사항

### 필수 요구사항
1. ✅ 카카오 로그인 추가
2. ✅ 신규 사용자: 이메일, 닉네임 필수 입력
3. ✅ 카카오 로그인 정보를 사용자 구분 키로 활용
4. ✅ 프로필에 이름, 전화번호 추가 (선택 항목)
5. ✅ 이름, 전화번호는 관리자만 확인

### 핵심 질문 답변

#### Q1: 카카오 로그인 시 사용자 구분 키는?
**답변:** `auth.users.id` (UUID) - 동일한 구조 유지

```
이메일/비밀번호 사용자:
  auth.users.id = uuid-1234-5678
  provider = 'email'
  provider_id = NULL

카카오 로그인 사용자:
  auth.users.id = uuid-abcd-efgh  ← 여전히 Primary Key
  provider = 'kakao'
  provider_id = '카카오_고유_ID_1234567890'  ← 카카오 측 사용자 ID
```

✅ **장점:**
- 모든 테이블이 `user_id: UUID`로 통일
- 로그인 방법 변경 시에도 데이터 유지
- Supabase의 표준 구조 사용

#### Q2: 비밀번호 관리는?
**답변:** 로그인 방법에 따라 자동 처리

| 로그인 방법 | 비밀번호 | provider | 비밀번호 재설정 |
|------------|---------|----------|----------------|
| 이메일/비밀번호 | ✅ 필요 | `email` | ✅ 필요 |
| 카카오 로그인 | ❌ 불필요 | `kakao` | ❌ 불필요 (카카오 계정으로 관리) |
| 이메일 + 카카오 | ⚠️ 선택 | `email`, `kakao` | ✅ 이메일 로그인 시만 |

✅ **Supabase OAuth 기능:**
- 카카오 로그인 시 비밀번호 NULL
- 카카오 토큰으로 인증 처리
- 세션 관리 자동화

#### Q3: 한 사용자가 이메일과 카카오 둘 다 사용 가능?
**답변:** 가능 (Supabase Identity Linking)

```
사용자 A (prodigy@gmail.com):
  - 처음에는 이메일/비밀번호로 가입
  - 나중에 카카오 계정 연결
  - 동일한 auth.users.id 유지
  - 두 방법 모두로 로그인 가능
```

---

## 🏗️ 구현 계획

### Phase 1: 데이터베이스 스키마 확장

#### 1.1. profiles 테이블 확장
```sql
-- Migration: 008_add_profile_fields.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,           -- 전화번호 (선택)
  ADD COLUMN IF NOT EXISTS real_name text;       -- 실명 (선택, full_name과 분리)

-- full_name은 기존 컬럼 유지 (기존 데이터 보존)
COMMENT ON COLUMN public.profiles.phone IS '전화번호 (관리자만 조회 가능)';
COMMENT ON COLUMN public.profiles.real_name IS '실명 (관리자만 조회 가능)';
```

#### 1.2. RLS 정책 업데이트
```sql
-- 전화번호, 실명은 관리자와 본인만 조회 가능
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id OR public.is_admin(auth.uid())
);

-- 본인은 자신의 프로필 수정 가능 (전화번호, 실명 포함)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  -- 관리자 권한은 수정 불가
  is_admin = (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
);
```

#### 1.3. Supabase 함수 추가
```sql
-- 사용자의 인증 공급자 확인
CREATE OR REPLACE FUNCTION public.get_auth_provider(uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    COALESCE(
      (SELECT raw_app_meta_data->>'provider' FROM auth.users WHERE id = uid),
      'email'
    )::text;
$$;

-- 카카오 로그인 여부 확인
CREATE OR REPLACE FUNCTION public.is_kakao_user(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.get_auth_provider(uid) = 'kakao';
$$;
```

---

### Phase 2: Supabase 카카오 OAuth 설정

#### 2.1. Kakao Developers 설정
1. https://developers.kakao.com/ 접속
2. 애플리케이션 생성
3. **Web 플랫폼 추가**:
   - 사이트 도메인: `http://localhost:3000` (개발)
   - 사이트 도메인: `https://your-app.vercel.app` (프로덕션)
4. **Redirect URI 설정**:
   ```
   https://[SUPABASE_PROJECT_REF].supabase.co/auth/v1/callback
   ```
5. **동의 항목 설정**:
   - 필수: 카카오 계정(이메일), 닉네임
   - 선택: 프로필 사진
6. **키 복사**:
   - REST API 키 → Supabase에 사용
   - Client Secret (고급 설정에서 활성화)

#### 2.2. Supabase Dashboard 설정
```bash
# Supabase Dashboard → Authentication → Providers → Kakao

1. Enable Kakao Provider: ON
2. Kakao Client ID: [REST API 키]
3. Kakao Client Secret: [클라이언트 시크릿]
4. Redirect URL: (자동 생성됨)
   https://[PROJECT_REF].supabase.co/auth/v1/callback
```

#### 2.3. 환경변수 (.env.local)
```bash
# 기존 환경변수는 유지
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# 카카오 관련 추가 필요 없음 (Supabase가 관리)
# 프론트엔드에서는 supabase.auth.signInWithOAuth() 사용
```

---

### Phase 3: 프론트엔드 구현

#### 3.1. 카카오 로그인 UI 추가 (app/login/page.tsx)

```tsx
// 카카오 로그인 버튼 추가
const signInWithKakao = async () => {
  setMsg("카카오 로그인 중...");
  setLoading(true);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        // 추가 정보 요청 (선택)
      }
    }
  });

  if (error) {
    setMsg(`카카오 로그인 실패: ${error.message}`);
    setLoading(false);
    return;
  }

  // OAuth 리다이렉트로 이동 (자동)
};
```

**UI 구조:**
```
┌─────────────────────────────┐
│  이메일로 로그인            │
│  [email input]              │
│  [password input]           │
│  [로그인] [회원가입]        │
│                             │
│  ─────── 또는 ───────      │
│                             │
│  [🟡 카카오로 시작하기]    │
└─────────────────────────────┘
```

#### 3.2. OAuth 콜백 처리 (app/auth/callback/route.ts)

```typescript
// app/auth/callback/route.ts (새로 생성)
import { createClient } from '@/lib/supabaseClient';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // 신규 사용자인지 확인
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // 프로필 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname, is_approved')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.nickname || profile.nickname === '익명') {
      // 신규 카카오 사용자 → 추가 정보 입력 페이지로
      return NextResponse.redirect(`${requestUrl.origin}/auth/complete-profile`);
    }

    if (!profile.is_approved) {
      // 승인 대기 중
      return NextResponse.redirect(`${requestUrl.origin}/login?message=관리자 승인 대기 중`);
    }
  }

  // 기존 사용자 → 메인으로
  return NextResponse.redirect(`${requestUrl.origin}/start`);
}
```

#### 3.3. 추가 정보 입력 페이지 (app/auth/complete-profile/page.tsx)

```tsx
// 카카오 로그인 후 닉네임 필수 입력
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function CompleteProfilePage() {
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadKakaoInfo();
  }, []);

  const loadKakaoInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
      return;
    }

    // 카카오에서 받은 이메일 자동 입력
    const kakaoEmail = user.user_metadata?.email || user.email;
    const kakaoNickname = user.user_metadata?.name || user.user_metadata?.nickname;
    
    setEmail(kakaoEmail || '');
    
    // 카카오 닉네임을 기본값으로 제안 (수정 가능)
    if (kakaoNickname) {
      setNickname(kakaoNickname);
    }
  };

  const completeProfile = async () => {
    if (!nickname.trim()) {
      setMsg("닉네임을 입력해주세요");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 프로필 업데이트
    const { error } = await supabase
      .from('profiles')
      .update({ 
        nickname: nickname.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) {
      setMsg(`프로필 업데이트 실패: ${error.message}`);
      return;
    }

    setMsg("프로필 설정 완료! 관리자 승인 후 이용 가능합니다.");
    
    setTimeout(() => {
      router.push('/login?message=관리자 승인 대기 중입니다.');
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>추가 정보 입력</CardTitle>
          <CardDescription>
            카카오 로그인이 완료되었습니다.<br/>
            서비스 이용을 위해 닉네임을 설정해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm mb-2">이메일 (카카오)</label>
            <Input value={email} disabled />
          </div>
          
          <div>
            <label className="block text-sm mb-2">닉네임 *</label>
            <Input 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요"
            />
          </div>

          {msg && (
            <div className={`text-sm ${msg.includes('실패') ? 'text-red-500' : 'text-blue-500'}`}>
              {msg}
            </div>
          )}

          <Button onClick={completeProfile} className="w-full">
            완료
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### 3.4. 프로필 페이지 확장 (app/profile/page.tsx)

```tsx
// 기존 코드에 추가
const [phone, setPhone] = useState("");
const [realName, setRealName] = useState("");
const [authProvider, setAuthProvider] = useState<string>("email");

// loadProfile 함수 확장
const loadProfile = async () => {
  if (!user) return;

  setEmail(user.email ?? "");
  
  // 인증 공급자 확인
  const provider = user.app_metadata?.provider || 'email';
  setAuthProvider(provider);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("nickname, phone, real_name")  // 추가 필드
    .eq("id", user.id)
    .single();

  if (error) {
    setMsg(`프로필 조회 실패: ${error.message}`);
  } else if (data) {
    setNickname(data.nickname ?? "");
    setPhone(data.phone ?? "");
    setRealName(data.real_name ?? "");
  }

  setIsLoadingData(false);
};

// 프로필 업데이트 함수 확장
const updateProfile = async () => {
  setMsg("");
  if (!user) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      nickname: nickname.trim(),
      phone: phone.trim() || null,
      real_name: realName.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    setMsg(`프로필 업데이트 실패: ${error.message}`);
  } else {
    setMsg("프로필이 업데이트되었습니다!");
  }
};
```

**UI 구조:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>내 프로필</CardTitle>
    <CardDescription>
      {authProvider === 'kakao' 
        ? '🟡 카카오 계정으로 로그인 중' 
        : '📧 이메일 계정으로 로그인 중'}
    </CardDescription>
  </CardHeader>
  
  <CardContent className="space-y-4">
    {/* 이메일 (읽기 전용) */}
    <Input value={email} disabled />
    
    {/* 닉네임 (필수) */}
    <Input value={nickname} onChange={...} placeholder="닉네임 *" />
    
    {/* 이름 (선택) */}
    <Input value={realName} onChange={...} placeholder="이름 (선택)" />
    
    {/* 전화번호 (선택) */}
    <Input value={phone} onChange={...} placeholder="전화번호 (선택)" />
    
    <Button onClick={updateProfile}>프로필 수정</Button>
    
    {/* 비밀번호 변경은 이메일 로그인만 */}
    {authProvider === 'email' && (
      <div className="mt-4 border-t pt-4">
        <h3>비밀번호 변경</h3>
        {/* 기존 비밀번호 변경 UI */}
      </div>
    )}
  </CardContent>
</Card>
```

---

### Phase 4: 관리자 페이지 확장

#### 4.1. 관리자 유저 목록 (app/admin/users/page.tsx)

```tsx
// 기존 코드 확장: 이름, 전화번호 컬럼 추가

const columns = [
  { key: 'email', label: '이메일' },
  { key: 'nickname', label: '닉네임' },
  { key: 'real_name', label: '이름' },      // 추가
  { key: 'phone', label: '전화번호' },       // 추가
  { key: 'provider', label: '로그인 방법' }, // 추가
  { key: 'is_approved', label: '승인' },
  { key: 'is_admin', label: '관리자' },
];

// 로그인 방법 표시
const getProviderBadge = (provider: string) => {
  switch (provider) {
    case 'kakao':
      return <Badge className="bg-yellow-400">🟡 카카오</Badge>;
    case 'email':
      return <Badge>📧 이메일</Badge>;
    default:
      return <Badge variant="outline">{provider}</Badge>;
  }
};
```

#### 4.2. API 라우트 확장 (app/api/admin/users/route.ts)

```typescript
// GET /api/admin/users - 사용자 목록 조회
export async function GET(request: Request) {
  // ... 기존 인증 코드 ...

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      nickname,
      real_name,
      phone,
      is_admin,
      is_approved,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // auth.users에서 이메일, provider 정보 가져오기
  const usersWithAuth = await Promise.all(
    profiles.map(async (profile) => {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
        profile.id
      );

      return {
        ...profile,
        email: authUser?.user?.email || '',
        provider: authUser?.user?.app_metadata?.provider || 'email',
      };
    })
  );

  return NextResponse.json(usersWithAuth);
}
```

---

## 📋 구현 체크리스트

### Phase 1: 데이터베이스 (1일)
- [ ] Migration 파일 생성 (008_add_profile_fields.sql)
- [ ] profiles 테이블에 phone, real_name 컬럼 추가
- [ ] RLS 정책 업데이트 (관리자/본인만 조회)
- [ ] 헬퍼 함수 추가 (get_auth_provider, is_kakao_user)
- [ ] Supabase에서 Migration 실행

### Phase 2: Kakao OAuth 설정 (0.5일)
- [ ] Kakao Developers에서 애플리케이션 생성
- [ ] Redirect URI 설정
- [ ] 동의 항목 설정 (이메일, 닉네임)
- [ ] Supabase Dashboard에서 Kakao Provider 활성화
- [ ] REST API 키, Client Secret 등록

### Phase 3: 프론트엔드 구현 (2일)
- [ ] 로그인 페이지에 카카오 버튼 추가
- [ ] OAuth 콜백 라우트 생성 (app/auth/callback/route.ts)
- [ ] 추가 정보 입력 페이지 생성 (app/auth/complete-profile/page.tsx)
- [ ] 프로필 페이지 확장 (phone, real_name 필드)
- [ ] 로그인 방법별 UI 분기 (비밀번호 변경 여부)

### Phase 4: 관리자 기능 (1일)
- [ ] 관리자 유저 목록에 이름, 전화번호 컬럼 추가
- [ ] 로그인 방법 표시 (카카오/이메일)
- [ ] API 라우트 확장 (provider 정보 포함)
- [ ] 관리자 전용 필드 조회 권한 확인

### Phase 5: 테스트 (1일)
- [ ] 카카오 로그인 플로우 테스트
- [ ] 신규 사용자 닉네임 입력 테스트
- [ ] 프로필 수정 (이름, 전화번호) 테스트
- [ ] 관리자 페이지에서 정보 조회 테스트
- [ ] RLS 정책 테스트 (일반 사용자는 타인 정보 미조회)
- [ ] 이메일 로그인 + 카카오 로그인 혼합 테스트

---

## 🔐 보안 고려사항

### 1. 개인정보 보호
```sql
-- 전화번호, 실명은 관리자와 본인만 조회 가능
-- RLS 정책으로 강제
```

### 2. 카카오 토큰 관리
- Supabase가 자동으로 OAuth 토큰 관리
- 프론트엔드에서는 토큰 직접 다루지 않음
- 세션 갱신 자동화

### 3. 비밀번호 불필요
- 카카오 로그인 사용자는 비밀번호 NULL
- 카카오 계정 보안에 의존
- 비밀번호 재설정 UI는 이메일 로그인만 표시

---

## 📊 예상 사용자 플로우

### 시나리오 1: 신규 카카오 사용자
```
1. 로그인 페이지 접속
2. "카카오로 시작하기" 클릭
3. 카카오 로그인 페이지로 리다이렉트
4. 카카오 계정 로그인 + 동의
5. /auth/callback으로 복귀
   → auth.users 생성 (provider='kakao')
   → profiles 자동 생성 (nickname='익명')
6. /auth/complete-profile로 리다이렉트
7. 닉네임 입력 (카카오 닉네임 제안)
8. 프로필 업데이트
9. 관리자 승인 대기 메시지 표시
10. 관리자 승인 후 로그인 가능
```

### 시나리오 2: 기존 이메일 사용자가 카카오 연결
```
1. 이메일로 로그인
2. 프로필 페이지 접속
3. "카카오 계정 연결" 버튼 클릭 (향후 기능)
4. 카카오 로그인 + 동의
5. 동일한 auth.users.id에 카카오 provider 추가
6. 이후 이메일/카카오 둘 다 로그인 가능
```

### 시나리오 3: 관리자가 사용자 정보 확인
```
1. /admin/users 접속
2. 사용자 목록 조회
   - 이름 (real_name) 표시
   - 전화번호 (phone) 표시
   - 로그인 방법 (🟡 카카오 / 📧 이메일)
3. 필요 시 승인 또는 관리자 권한 부여
```

---

## 🎨 UI/UX 개선 제안

### 로그인 페이지
```
┌───────────────────────────────┐
│  Golf Tour 로그인             │
├───────────────────────────────┤
│  이메일로 로그인              │
│  ┌─────────────────────────┐ │
│  │ 이메일                  │ │
│  └─────────────────────────┘ │
│  ┌─────────────────────────┐ │
│  │ 비밀번호                │ │
│  └─────────────────────────┘ │
│  [로그인] [회원가입]         │
│                               │
│  ──────── 또는 ────────      │
│                               │
│  [🟡 카카오로 3초만에 시작]  │
│                               │
│  간편하게 카카오 계정으로     │
│  시작하세요!                  │
└───────────────────────────────┘
```

### 프로필 페이지
```
┌───────────────────────────────┐
│  내 프로필                    │
│  🟡 카카오 계정으로 로그인 중 │
├───────────────────────────────┤
│  📧 이메일 (변경 불가)        │
│  [prodigy@gmail.com]          │
│                               │
│  👤 닉네임 *                  │
│  [프로골퍼123]                │
│                               │
│  🪪 이름 (선택)                │
│  [홍길동]                     │
│  ℹ️ 관리자만 확인 가능합니다   │
│                               │
│  📱 전화번호 (선택)           │
│  [010-1234-5678]              │
│  ℹ️ 관리자만 확인 가능합니다   │
│                               │
│  [프로필 수정]                │
│                               │
│  ⚠️ 카카오 로그인 사용자는    │
│     비밀번호 변경이 불필요합니다│
└───────────────────────────────┘
```

---

## 🚀 배포 전 확인사항

### Vercel 환경변수
```bash
# 기존 환경변수 (변경 없음)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# 카카오 관련 추가 불필요
# (Supabase Dashboard에서 관리)
```

### Kakao Developers 설정
- [ ] 프로덕션 도메인 추가 (your-app.vercel.app)
- [ ] Redirect URI에 프로덕션 URL 추가
- [ ] 비즈 앱 전환 (선택, 사용자 100명 이상 시)

### Supabase 설정
- [ ] Kakao Provider 프로덕션 키로 업데이트
- [ ] Redirect URL 화이트리스트 확인

---

## 💡 추가 고려사항

### 1. Apple 로그인도 추가?
- iOS 앱 배포 시 필수
- 동일한 구조로 쉽게 추가 가능

### 2. 계정 연결 (Identity Linking)
- 한 사용자가 여러 로그인 방법 사용
- Supabase 기본 지원
- Phase 2에서 구현 고려

### 3. 카카오 친구 초대
- 카카오 SDK 추가 필요
- 토너먼트 공유 기능과 연계

### 4. 프로필 사진
- 카카오 프로필 이미지 가져오기
- Supabase Storage에 저장
- profiles 테이블에 avatar_url 추가

---

## 📝 결론

### 핵심 답변 요약

| 질문 | 답변 |
|------|------|
| **사용자 구분 키는?** | `auth.users.id` (UUID) - 로그인 방법 무관 |
| **카카오 정보 활용?** | `provider='kakao'`, `provider_id='카카오ID'` 저장 |
| **비밀번호 필요?** | ❌ 카카오는 불필요, ✅ 이메일은 필요 |
| **혼합 사용?** | ✅ 가능 (Identity Linking) |
| **개인정보 보호?** | ✅ RLS로 관리자만 조회 |

### 구현 우선순위
1. **Phase 1 (필수)**: DB 스키마 확장 → 이름, 전화번호 추가
2. **Phase 2 (필수)**: Kakao OAuth 설정
3. **Phase 3 (필수)**: 카카오 로그인 UI + 추가 정보 입력
4. **Phase 4 (필수)**: 프로필/관리자 페이지 확장
5. **Phase 5 (선택)**: 계정 연결, 프로필 사진 등

### 예상 작업 기간
- **개발**: 3-4일
- **테스트**: 1일
- **배포**: 0.5일
- **총합**: 약 5일

이제 구현을 시작하시겠습니까?
