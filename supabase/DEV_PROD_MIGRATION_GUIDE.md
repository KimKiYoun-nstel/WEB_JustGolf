# Supabase 개발/운용 분리 가이드

이 문서는 Supabase 프로젝트를 개발/운용으로 분리하고, 운영 DB 스키마를 개발 프로젝트로 동기화하는 방법을 요약합니다.

## 핵심 개념

- `supabase db pull/push`는 **데이터를 제외한 스키마**(테이블, 함수, 트리거, RLS, 정책, 인덱스 등)를 동기화합니다.
- `auth` 스키마에 존재하는 객체(예: `auth.users` 트리거)는 **스키마에 포함해야** 같이 동기화됩니다.

## 윈도우 필수 조건

- Docker Desktop 설치 필요
- WSL 2 필요
  - 관리자 PowerShell에서 `wsl --install` 실행
  - 재부팅 후 Docker Desktop에서 WSL 2 엔진 사용 설정

## 운영 -> 개발 스키마 동기화 절차

1) 운영 프로젝트 링크

```bash
npx supabase link --project-ref <운용_ref>
```

2) 스키마 pull (public + auth + storage)

```bash
npx supabase db pull --schema public,auth,storage
```

- `supabase/migrations/`에 새 마이그레이션 파일이 생성됩니다.

3) 개발 프로젝트 링크

```bash
npx supabase link --project-ref <개발_ref>
```

4) 개발 DB에 적용

```bash
npx supabase db push
```

## 환경 변수 분리 권장

- `.env.local`: 개발용 Supabase URL/KEY
- `.env.production.local`: 운영용 Supabase URL/KEY

`npm run dev`는 `.env.local`을 우선 읽습니다.

## 확인 SQL (auth.users 트리거)

```sql
select tgname, tgrelid::regclass, pg_get_triggerdef(oid)
from pg_trigger
where tgrelid = 'auth.users'::regclass
  and not tgisinternal;
```

## 주의 사항

- `supabase/migrations`는 Git에 포함하는 것이 일반적입니다.
- `supabase/.temp`는 로컬 캐시이므로 Git에 포함하지 않습니다.
