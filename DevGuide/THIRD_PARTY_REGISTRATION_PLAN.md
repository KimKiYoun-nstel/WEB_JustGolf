# 제3자 대리 신청 시스템 구현 계획

**작성일**: 2026-02-12  
**버전**: 1.0  
**상태**: 설계 완료 / 구현 대기

---

## 1. 요구사항 정리

### 1.1 핵심 요구사항

**사용자 요청 원문**:
> "지금 참가 신청 페이지에서 자신이 아닌 제3자를 신청할 수 있도록 해야 한다. 로그인한 사용자가 서비스 회원이 아닌 사람들을 대회에 참가 신청할 수 있어야 한다. 이를 위해 회원과 회원이 아닌 참가자를 DB에 구분할 수 있어야 하고, 나중에 취소도 가능해야 한다."

### 1.2 상세 요구사항 분석

1. **대리 신청 가능**: 로그인한 회원이 본인 외 제3자(비회원)를 대회에 등록
2. **신원 구분**: DB 상에서 회원(`auth.users`) vs 제3자 참가자를 명확히 구분
3. **취소 권한**: 제3자 신청을 등록한 회원 또는 관리자가 취소 가능
4. **DB 무결성**: 중복 등록 방지, 데이터 일관성 유지
5. **사용자 관리 표준**: 명확한 식별 체계와 RLS 정책

---

## 2. 현재 구조 분석

### 2.1 `registrations` 테이블 현황

```sql
CREATE TABLE public.registrations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tournament_id bigint NOT NULL,
  user_id uuid NOT NULL,                          -- FK to auth.users (필수)
  nickname text NOT NULL,                         -- 참가자 표시 이름
  status text NOT NULL DEFAULT 'applied',
  memo text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  meal_option_id bigint,
  approval_status character varying DEFAULT 'approved',
  approved_at timestamp without time zone DEFAULT now(),
  approved_by uuid,
  relation text,                                   -- 기존: "본인", "가족", "지인" 등
  CONSTRAINT registrations_pkey PRIMARY KEY (id),
  CONSTRAINT registrations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT registrations_meal_option_id_fkey FOREIGN KEY (meal_option_id) REFERENCES public.tournament_meal_options(id),
  CONSTRAINT registrations_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id)
);

-- 제약 조건 (db/schema.sql 참조)
unique (tournament_id, user_id)  -- ⚠️ 문제: 동일 user_id로 한 대회에 1건만 가능
```

### 2.2 현재 제약사항

1. **UNIQUE 제약**: `(tournament_id, user_id)` 조합이 유일해야 함
   - 한 회원이 동일 대회에 여러 명 등록 불가
   - **해결 필요**: 본인 + 제3자 여러 명 등록 시 충돌

2. **FK 제약**: `user_id uuid NOT NULL REFERENCES auth.users(id)`
   - 모든 등록이 인증된 사용자 계정에 연결되어야 함
   - **해결 필요**: 제3자는 `auth.users`에 없음

3. **RLS 정책** (migrations/004_enforce_authentication.sql):
   ```sql
   -- SELECT: 인증된 사용자면 누구나 조회 가능
   create policy "Authenticated users can view registrations"
   on public.registrations for select
   using (auth.role() = 'authenticated');

   -- INSERT: 본인만 가능
   create policy "Users can insert own registration"
   on public.registrations for insert
   with check (auth.uid() = user_id);

   -- UPDATE/DELETE: 본인 또는 관리자
   create policy "Users can update own registration"
   on public.registrations for update
   using (
     auth.uid() = user_id
     or exists (
       select 1 from public.profiles
       where profiles.id = auth.uid() and profiles.is_admin = true
     )
   );
   ```

   **문제**: 
   - INSERT 정책이 `auth.uid() = user_id`만 허용 → 제3자 등록 시 `registering_user_id ≠ user_id`
   - UPDATE/DELETE도 `user_id` 기준이라 대리 등록자의 관리 권한 없음

### 2.3 현재 코드 동작 (app/t/[id]/page.tsx)

#### 본인 신청 로직
```typescript
const applyTournament = async () => {
  const uid = user?.id;
  if (!uid) return;

  const { error } = await supabase.from("registrations").insert({
    tournament_id: tournamentId,
    user_id: uid,              // 자기 자신의 ID
    nickname: profileNickname,
    status: mainStatus,
    memo: memo.trim(),
    relation: relation,         // "본인"
    meal_option_id: selectedMealId,
  });
  // ...
};
```

#### 추가 참가자 등록 (미완성 UI 코드 존재 추정)
```typescript
// 현재 코드에서 extraName, extraRelation 변수는 선언되었으나
// 실제 제3자 등록 기능은 구현되지 않음
const [extraName, setExtraName] = useState("");
const [extraRelation, setExtraRelation] = useState("");
```

---

## 3. 설계 방안

### 3.1 DB 스키마 변경

#### Option A: `registering_user_id` 추가 (권장)

**장점**:
- 명확한 등록자 추적
- 기존 `user_id` FK 유지 가능 (NULL 허용 시)
- 취소 권한 관리 용이

**변경 사항**:
```sql
-- registrations 테이블 수정
ALTER TABLE public.registrations 
  ADD COLUMN registering_user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.registrations 
  ALTER COLUMN user_id DROP NOT NULL;

-- user_id가 NULL이면 제3자, NOT NULL이면 회원 본인 또는 회원의 대리 신청
-- registering_user_id: 실제 신청을 수행한 회원 ID

-- 기존 UNIQUE 제약 제거
ALTER TABLE public.registrations 
  DROP CONSTRAINT IF EXISTS registrations_tournament_id_user_id_key;

-- 새 제약: 제3자는 (대회 + 신청자 + 닉네임) 조합으로 중복 방지
CREATE UNIQUE INDEX registrations_unique_member_per_tournament 
  ON public.registrations (tournament_id, user_id)
  WHERE user_id IS NOT NULL;

-- 제3자 중복 방지: 동일 대회에서 같은 등록자가 같은 닉네임으로 중복 등록 불가
CREATE UNIQUE INDEX registrations_unique_third_party_per_registering_user 
  ON public.registrations (tournament_id, registering_user_id, nickname)
  WHERE user_id IS NULL;
```

**데이터 구조 예시**:
| id | tournament_id | user_id (회원ID) | registering_user_id (등록자ID) | nickname | relation | 의미 |
|----|---------------|------------------|--------------------------------|----------|----------|------|
| 1  | 100           | `user-A`         | `user-A`                       | Alice    | 본인     | Alice가 본인 등록 |
| 2  | 100           | NULL             | `user-A`                       | Bob      | 친구     | Alice가 비회원 Bob 대리 등록 |
| 3  | 100           | NULL             | `user-A`                       | Carol    | 가족     | Alice가 비회원 Carol 대리 등록 |
| 4  | 100           | `user-B`         | `user-B`                       | Dave     | 본인     | Dave가 본인 등록 |

#### Option B: 별도 테이블 분리 (대안)

**구조**:
- `registrations` (회원 전용)
- `third_party_registrations` (비회원 전용, `registering_user_id` 포함)

**장점**: 
- 기존 구조 유지
- 회원/비회원 명확히 분리

**단점**:
- 쿼리 복잡도 증가 (UNION 필요)
- 참가자 목록 통합 관리 어려움
- 관련 테이블들(registration_extras, registration_activity_selections 등) 처리 복잡

**결론**: Option A 선택 (단일 테이블 유지가 현재 구조에 적합)

### 3.2 RLS 정책 변경

```sql
-- INSERT 정책: 본인은 본인만, 제3자는 로그인한 회원이 등록자로서 등록 가능
DROP POLICY IF EXISTS "Users can insert own registration" ON public.registrations;

CREATE POLICY "Users can insert registrations"
ON public.registrations
FOR INSERT
WITH CHECK (
  -- 본인 등록: user_id = auth.uid()
  (user_id = auth.uid() AND registering_user_id = auth.uid())
  OR
  -- 제3자 등록: user_id NULL, registering_user_id = auth.uid()
  (user_id IS NULL AND registering_user_id = auth.uid())
);

-- UPDATE 정책: 본인, 등록자, 관리자만 수정 가능
DROP POLICY IF EXISTS "Users can update own registration" ON public.registrations;

CREATE POLICY "Users can update registrations"
ON public.registrations
FOR UPDATE
USING (
  auth.uid() = user_id                          -- 본인
  OR auth.uid() = registering_user_id           -- 등록자
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )                                              -- 관리자
);

-- DELETE 정책: 등록자 또는 관리자만 삭제 가능
DROP POLICY IF EXISTS "Users can delete own registration" ON public.registrations;

CREATE POLICY "Users can delete registrations"
ON public.registrations
FOR DELETE
USING (
  auth.uid() = registering_user_id              -- 등록자
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )                                              -- 관리자
);
```

### 3.3 Frontend 변경

#### 3.3.1 제3자 등록 UI (app/t/[id]/page.tsx)

**추가할 폼 섹션**:
```tsx
{mainRegId && (
  <Card>
    <CardHeader>
      <CardTitle>추가 참가자 등록 (제3자 대리 신청)</CardTitle>
      <CardDescription>
        본인이 아닌 다른 분들을 대신 등록할 수 있습니다 (비회원 가능)
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">닉네임</label>
          <Input
            value={extraName}
            onChange={(e) => setExtraName(e.target.value)}
            placeholder="예: 홍길동"
          />
          <p className="text-xs text-slate-500 mt-1">
            제3자 참가자의 닉네임 (실명이 아닌 별칭도 가능)
          </p>
        </div>
        <div>
          <label className="text-sm font-medium">관계</label>
          <select
            value={extraRelation}
            onChange={(e) => setExtraRelation(e.target.value)}
            className="w-full rounded-md border p-2"
          >
            <option value="가족">가족</option>
            <option value="친구">친구</option>
            <option value="지인">지인</option>
            <option value="기타">기타</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">메모 (선택)</label>
          <Input
            value={extraMemo}
            onChange={(e) => setExtraMemo(e.target.value)}
            placeholder="특이사항 등"
          />
        </div>
        <Button onClick={addThirdPartyParticipant}>추가 참가자 등록</Button>
      </div>
    </CardContent>
  </Card>
)}
```

**등록 로직**:
```typescript
const addThirdPartyParticipant = async () => {
  const supabase = createClient();
  const uid = user?.id;
  if (!uid) {
    setMsg("로그인이 필요합니다.");
    return;
  }

  const name = extraName.trim();
  if (!name) {
    setMsg("닉네임을 입력해주세요.");
    return;
  }

  // 제3자 등록: user_id는 NULL, registering_user_id에 현재 로그인 사용자
  const { error } = await supabase.from("registrations").insert({
    tournament_id: tournamentId,
    user_id: null,                    // 제3자는 NULL
    registering_user_id: uid,         // 등록자 = 로그인 사용자
    nickname: name,
    relation: extraRelation,
    status: "applied",
    memo: extraMemo.trim() || null,
  });

  if (error) {
    setMsg(`등록 실패: ${friendlyError(error)}`);
    return;
  }

  setExtraName("");
  setExtraRelation("가족");
  setExtraMemo("");
  setMsg("추가 참가자가 등록되었습니다.");
  await refresh();
};
```

#### 3.3.2 내가 등록한 참가자 목록 표시

**본인 신청 + 제3자 신청 구분 표시**:
```typescript
const myRegistrations = regs.filter(
  (r) => r.registering_user_id === user?.id
);

const myOwnReg = myRegistrations.find((r) => r.user_id === user?.id);
const myThirdPartyRegs = myRegistrations.filter((r) => r.user_id === null);
```

```tsx
<Card>
  <CardHeader>
    <CardTitle>내가 등록한 참가자</CardTitle>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead>관계</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>취소</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {myOwnReg && (
          <TableRow>
            <TableCell>{myOwnReg.nickname}</TableCell>
            <TableCell>본인</TableCell>
            <TableCell>
              <Badge>{formatRegistrationStatus(myOwnReg.status)}</Badge>
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                onClick={() => cancelParticipant(myOwnReg.id)}
                disabled={myOwnReg.status === "canceled"}
              >
                취소
              </Button>
            </TableCell>
          </TableRow>
        )}
        {myThirdPartyRegs.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{r.nickname}</TableCell>
            <TableCell>{r.relation}</TableCell>
            <TableCell>
              <Badge>{formatRegistrationStatus(r.status)}</Badge>
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                onClick={() => cancelParticipant(r.id)}
                disabled={r.status === "canceled"}
              >
                취소
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

#### 3.3.3 취소 로직 수정

**기존 코드**:
```typescript
const cancelParticipant = async (registrationId: number) => {
  const target = regs.find((r) => r.id === registrationId && r.user_id === uid);
  // ⚠️ user_id 기준이라 제3자 등록 취소 불가
};
```

**수정 후**:
```typescript
const cancelParticipant = async (registrationId: number) => {
  const uid = user?.id;
  if (!uid) {
    setMsg("로그인 필요");
    return;
  }

  // 본인 또는 내가 등록한 제3자인지 확인
  const target = regs.find(
    (r) => r.id === registrationId && r.registering_user_id === uid
  );

  if (!target) {
    setMsg("취소 권한이 없습니다.");
    return;
  }

  const { error } = await supabase
    .from("registrations")
    .update({ status: "canceled" })
    .eq("id", target.id);

  if (error) {
    setMsg(`취소 실패: ${friendlyError(error)}`);
  } else {
    setMsg("참가 취소 완료");
    await refresh();
  }
};
```

### 3.4 참가자 목록 페이지 (app/t/[id]/participants/page.tsx)

**회원/제3자 구분 표시**:
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>참가자</TableHead>
      <TableHead>구분</TableHead>
      <TableHead>상태</TableHead>
      {/* 기타 컬럼 */}
    </TableRow>
  </TableHeader>
  <TableBody>
    {registrations.map((reg) => (
      <TableRow key={reg.id}>
        <TableCell>{reg.nickname}</TableCell>
        <TableCell>
          {reg.user_id ? (
            <Badge variant="outline">회원</Badge>
          ) : (
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              제3자
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <Badge>{formatRegistrationStatus(reg.status)}</Badge>
        </TableCell>
        {/* 기타 필드 */}
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

## 4. 구현 단계

### Phase 1: DB 마이그레이션 (필수 선행)

1. **마이그레이션 파일 생성**: `db/migrations/009_third_party_registrations.sql`
2. **내용**:
   - `registering_user_id` 컬럼 추가
   - `user_id` NULL 허용
   - 기존 데이터에 `registering_user_id = user_id` 업데이트 (백필)
   - UNIQUE 제약 재구성
   - RLS 정책 업데이트

3. **실행**:
   ```bash
   # Local dev
   supabase db reset
   
   # Production
   supabase db push
   ```

### Phase 2: Backend 로직 구현

1. **Types 업데이트**:
   ```typescript
   type Registration = {
     id: number;
     tournament_id: number;
     user_id: string | null;              // NULL이면 제3자
     registering_user_id: string;         // 등록한 회원
     nickname: string;
     relation: string | null;
     status: "applied" | "approved" | "waitlisted" | "canceled" | "undecided";
     // ...
   };
   ```

2. **app/t/[id]/page.tsx 수정**:
   - `addThirdPartyParticipant` 함수 구현
   - `cancelParticipant` 로직 수정 (`registering_user_id` 기준)
   - 제3자 등록 UI 추가

3. **app/t/[id]/participants/page.tsx 수정**:
   - 회원/제3자 구분 표시
   - `user_id IS NULL` 처리

### Phase 3: 관리자 페이지 (app/admin/tournaments/[id]/page.tsx)

1. **참가자 관리 화면에 등록자 정보 표시**:
   ```tsx
   <TableCell>
     {reg.user_id ? (
       <span>{reg.nickname} (회원)</span>
     ) : (
       <span>
         {reg.nickname} (제3자)
         <br />
         <small className="text-slate-500">
           등록자: {reg.registering_user_nickname}
         </small>
       </span>
     )}
   </TableCell>
   ```

2. **등록자 닉네임 조회**:
   ```typescript
   const { data: regs } = await supabase
     .from("registrations")
     .select("*, registering_user:registering_user_id(nickname)")
     .eq("tournament_id", tournamentId);
   ```

### Phase 4: 테스트

1. **Unit Tests** (vitest):
   - 제3자 등록 로직 테스트
   - 중복 방지 제약 테스트
   - NULL handling 테스트

2. **E2E Tests** (Playwright):
   ```typescript
   test("User can register third-party participants", async ({ page }) => {
     // 로그인
     await page.goto("/login");
     await login(page, testUser);
     
     // 대회 신청 페이지 이동
     await page.goto("/t/1");
     
     // 본인 신청
     await page.fill("#nickname", "Alice");
     await page.click("#apply-button");
     
     // 제3자 추가
     await page.fill("#extra-name", "Bob");
     await page.selectOption("#extra-relation", "친구");
     await page.click("#add-third-party-button");
     
     // 확인
     await expect(page.locator("text=Bob")).toBeVisible();
   });
   ```

---

## 5. 예상 이슈 및 해결 방안

### 5.1 기존 데이터 마이그레이션

**문제**: 기존 `registrations` 레코드는 `registering_user_id`가 없음

**해결**:
```sql
-- 마이그레이션 스크립트에 포함
UPDATE public.registrations
SET registering_user_id = user_id
WHERE registering_user_id IS NULL;

-- NOT NULL 제약 추가
ALTER TABLE public.registrations
ALTER COLUMN registering_user_id SET NOT NULL;
```

### 5.2 제3자 등록의 Extra 정보

**문제**: `registration_extras`, `registration_activity_selections` 테이블은 `registration_id`로 연결  
→ 제3자도 동일하게 처리 가능하므로 **변경 불필요**

**확인**:
```sql
-- FK만 있고 user_id 제약은 없음
CREATE TABLE public.registration_extras (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  registration_id bigint NOT NULL UNIQUE,
  carpool_available boolean DEFAULT false,
  -- ...
  CONSTRAINT registration_extras_registration_id_fkey 
    FOREIGN KEY (registration_id) REFERENCES public.registrations(id)
);
```

### 5.3 경품 지원 (tournament_prize_supports)

**문제**: `user_id uuid NOT NULL REFERENCES auth.users(id)` → 제3자는 경품 지원 불가

**해결**: 
- **현재 요구사항 범위 밖** (제3자는 경품 지원 안 함)
- 필요 시 나중에 `registering_user_id` 방식으로 확장 가능

### 5.4 프로필 연동 로직

**중요: 제3자는 profiles에 없습니다**

제3자 참가자 특징:
- `user_id = NULL` → `auth.users`에 없음 → `profiles`에도 없음
- `registrations.nickname` 필드만 사용 (profiles 조회 불필요)

**영향 받는 코드**:
```typescript
// app/board/page.tsx - 피드백 작성자 조회 (회원만)
const profileIds = feedbacks.map((f) => f.user_id);
const { data: profiles } = await supabase
  .from("profiles")
  .select("id, nickname")
  .in("id", profileIds);
```

**제3자 참가자 처리**:
```typescript
// app/t/[id]/participants/page.tsx
const memberIds = registrations
  .filter((r) => r.user_id !== null)  // 회원만 프로필 조회
  .map((r) => r.user_id);

const { data: profiles } = await supabase
  .from("profiles")
  .select("id, nickname")
  .in("id", memberIds);

// 제3자는 registrations.nickname 직접 사용 (profiles 없음)
registrations.forEach((reg) => {
  const displayName = reg.user_id 
    ? profiles.find(p => p.id === reg.user_id)?.nickname 
    : reg.nickname;  // 제3자는 registrations.nickname 사용
});
```

### 5.5 사이드 이벤트 (side_event_registrations)

**현재 구조**:
```sql
CREATE TABLE public.side_event_registrations (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  -- ...
);닉네임: Alice (프로필 닉네임 자동)
   - 관계: 본인
   - → `user_id = Alice, registering_user_id = Alice`
3. **제3자 추가 1**:
   - 닉네임: Bob
   - 관계: 친구
   - → `user_id = NULL, registering_user_id = Alice, nickname = Bob`
   - **주의**: Bob은 profiles에 없음, registrations.nickname만 사용
4. **제3자 추가 2**:
   - 닉네임: Carol
   - 관계: 친구
   - → `user_id = NULL, registering_user_id = Alice, nickname = Carol`
   - **주의**: Carol도 profiles에 없음

### 시나리오 1: Alice가 본인 + 친구 2명 등록

1. Alice 로그인 → 대회 상세 페이지 이동
2. **본인 신청**: 
   - 이름: Alice (프로필 닉네임 자동)
   - 관계: 본인
   - → `user_id = Alice, registering_user_id = Alice`
3. **제3자 추가 1**:
   - 이름: Bob
   - 관계: 친구
   - → `user_id = NULL, registering_user_id = Alice, nickname = Bob`
4. **제3자 추가 2**:
   - 이름: Carol
   - 관계: 친구
   - → `user_id = NULL, registering_user_id = Alice, nickname = Carol`

**결과**: Alice는 3건의 등록을 볼 수 있으며, 모두 취소 가능

### 시나리오 2: 관리자가 참가자 목록 확인

| 참가자 | 구분   | 등록자 | 상태   |
|--------|--------|--------|--------|
| Alice  | 회원   | Alice  | 승인됨 |
| Bob    | 제3자  | Alice  | 승인됨 |
| Carol  | 제3자  | Alice  | 승인됨 |
| Dave   | 회원   | Dave   | 대기중 |

### 시나리오 3: Alice가 Bob 취소

1. Alice 로그인 → 대회 페이지
2. "내가 등록한 참가자" 목록에서 Bob 선택
3. "취소" 버튼 클릭
4. → `UPDATE registrations SET status='canceled' WHERE id=Bob.id`
5. RLS 정책 확인: `registering_user_id = Alice` → 허용

---

## 7. 데이터 무결성 검증

### 7.1 제약 조건 검증

- ✅ **회원 중복 방지**: `UNIQUE (tournament_id, user_id) WHERE user_id IS NOT NULL`
- ✅ **제3자 중복 방지**: `UNIQUE (tournament_id, registering_user_id, nickname) WHERE user_id IS NULL`
- ✅ **등록자 필수**: `registering_user_id NOT NULL`
- ✅ **FK 무결성**: `registering_user_id REFERENCES auth.users(id)`

### 7.2 엣지 케이스

| 케이스 | 제약 | 결과 |
|--------|------|------|
| Alice가 "Bob"을 2번 등록 | UNIQUE 제약 위반 | ❌ 에러 |
| Alice가 Bob(회원)을 본인 신청으로, Alice가 Bob을 제3자로 | 두 개의 다른 레코드 | ✅ 허용 (비정상이지만 제약 없음) |
| Alice가 로그아웃 후 제3자 등록 시도 | RLS 정책 위반 | ❌ 에러 |
| Bob(회원)이 Alice 등록한 제3자 "Carol" 취소 시도 | RLS DELETE 정책 위반 | ❌ 에러 |

**권장 개선**:
- UI 레벨에서 회원 닉네임과 제3자 이름 중복 경고
- 대회 신청 시 닉네임 존재 여부 체크 (선택)

---

## 8. 마이그레이션 체크리스트

### 8.1 DB 마이그레이션

- [ ] `db/migrations/009_third_party_registrations.sql` 생성
- [ ] 로컬 환경 테스트 (`supabase db reset`)
- [ ] 기존 데이터 백필 확인
- [ ] RLS 정책 동작 확인
- [ ] 프로덕션 배포 (`supabase db push`)

### 8.2 코드 변경

- [ ] TypeScript types 업데이트 (`Registration` 타입)
- [ ] `app/t/[id]/page.tsx`: 제3자 등록 UI 추가
- [ ] `app/t/[id]/page.tsx`: `addThirdPartyParticipant` 함수 구현
- [ ] `app/t/[id]/page.tsx`: `cancelParticipant` 로직 수정
- [ ] `app/t/[id]/participants/page.tsx`: 회원/제3자 구분 표시
- [ ] `app/admin/tournaments/[id]/page.tsx`: 등록자 정보 표시

### 8.3 테스트

- [ ] Vitest 단위 테스트 작성
- [ ] Playwright E2E 테스트 작성
- [ ] 로컬 환경 수동 테스트
- [ ] 프로덕션 스모크 테스트

### 8.4 문서화

- [ ] README 업데이트 (제3자 등록 기능 설명)
- [ ] API 문서 업데이트 (Supabase 스키마 변경사항)
- [ ] 사용자 가이드 작성 (선택)

---

## 9. 비용 및 리스크 평가

### 9.1 개발 비용

| 단계 | 예상 시간 |
|------|-----------|
| DB 마이그레이션 설계 및 작성 | 2h |
| RLS 정책 업데이트 | 1h |
| Frontend UI 구현 | 4h |
| Backend 로직 수정 | 2h |
| 테스트 작성 및 실행 | 3h |
| 문서화 | 1h |
| **합계** | **13h** |

### 9.2 리스크

| 리스크 | 확률 | 영향 | 대응 방안 |
|--------|------|------|-----------|
| 기존 데이터 백필 오류 | 중 | 높음 | 마이그레이션 전 백업, 롤백 계획 수립 |
| RLS 정책 권한 오류 | 중 | 중 | 로컬 환경 충분한 테스트, 단계적 배포 |
| 성능 저하 (UNIQUE 제약 복잡화) | 낮 | 낮음 | 인덱스 최적화, 쿼리 성능 모니터링 |
| 사용자 혼란 (UI 복잡도 증가) | 중 | 중 | 명확한 UI/UX 설계, 도움말 제공 |

---

## 10. 결론 및 권고사항

### 10.1 권장 접근 방식

1. **Option A 채택**: `registering_user_id` 추가, 단일 테이블 유지
2. **단계적 배포**:
   - Phase 1: DB 마이그레이션 및 백필 (프로덕션 점검 시간 활용)
   - Phase 2: Frontend 구현 및 로컬 테스트
   - Phase 3: 스테이징 환경 배포 및 E2E 테스트
   - Phase 4: 프로덕션 배포

### 10.2 향후 확장 고려사항

1. **제3자 이메일/전화번호 수집**: 별도 컬럼 추가 또는 JSONB 필드 활용
2. **제3자 → 회원 전환**: 회원 가입 시 기존 제3자 등록과 연결하는 마이그레이션 UI
3. **사이드 이벤트 제3자 등록**: 동일한 패턴으로 `side_event_registrations` 확장
4. **알림 시스템**: 등록자(Alice)에게 제3자(Bob) 승인/취소 알림 전송
5. **카카오 인증 연동**: 
   - `profiles` 테이블에 `phone` 컬럼 추가 (전화번호, nullable)
   - 기존 `full_name`, `email` 활용
   - 카카오 first login 시 이름/전화번호 입력 UI 제공
   - 제3자 시스템과 독립적 (제3자는 profiles에 없음)

### 10.3 구현 시작 승인

이 문서를 검토 후 승인되면 다음 순서로 진행:

1. ✅ **이 문서 리뷰 및 승인**
2. 🔜 **마이그레이션 파일 생성** (`009_third_party_registrations.sql`)
3. 🔜 **로컬 환경 테스트 및 검증**
4. 🔜 **Frontend 구현**
5. 🔜 **E2E 테스트 작성**
6. 🔜 **프로덕션 배포**

---

**작성자**: GitHub Copilot  
**검토자**: _[프로젝트 담당자명]_  
**승인일**: _[YYYY-MM-DD]_
