# DB 마이그레이션 정리 필요

## 📋 현재 상황

### 문제점
1. **마이그레이션 파일 번호 중복**
   - `009_*.sql` 2개 (approval_and_extras_system, third_party_registrations)
   - `012_*.sql` 2개 (profiles_email, exclude_canceled_from_unique)
   - `013_*.sql` 2개 (feedback_board, public_activity_selections)

2. **마이그레이션 파일 ≠ 실제 DB 상태**
   - Supabase SQL Editor에서 직접 실행한 쿼리가 파일에 없을 수 있음
   - 개발 중 임시로 수정한 것들이 반영되지 않았을 가능성
   - 자동 생성된 인덱스, 트리거 등이 빠져있을 수 있음

3. **`supabase/` 폴더 구조**
   - Supabase 개발/운용 프로젝트 분리 작업 완료
   - 해당 폴더에 마이그레이션 관련 파일이 존재

---

## 🔧 해결 방법 (향후 작업)

### Phase 1: 현재 상태 스냅샷 생성
```bash
# Supabase CLI로 현재 DB 스키마 완전 추출
npx supabase db dump --db-url "postgres://..." > db/schema_snapshot_20260211.sql
```

### Phase 2: 마이그레이션 정리
1. 마이그레이션 파일 번호 재정렬
   - `009_approve...` → `014_approve...`
   - `012_exclude...` → `015_exclude...`
   - `013_public...` → `016_public...`

2. 마이그레이션 파일 통합 검토
   - 현재 스냅샷과 마이그레이션 파일 비교
   - 빠진 부분 추가

### Phase 3: 향후 운영
- 직접 SQL 실행 금지
- 모든 변경사항은 마이그레이션 파일로 관리
- 번호는 순차적으로 증가 (001, 002, 003...)

---

## 📝 관련 파일
- `db/migrations/` - 마이그레이션 파일들
- `supabase/` - 개발/운용 분리 설정
- 스냅샷: 추후 생성 예정

---

## ⚠️ 주의사항
- 마이그레이션 순서가 중요 (의존성)
- 새 환경에서 재구축 시 이 문제가 발생할 수 있음
- 정기적으로 스냅샷 업데이트 필요

---

**작성일**: 2026-02-11  
**상태**: 📌 TODO - 나중에 정리 필요
