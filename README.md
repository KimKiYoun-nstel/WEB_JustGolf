# Golf Tour Web Service

월례 골프 대회 운영을 웹으로 표준화하기 위한 서비스입니다. 대회 목록/상세 공개, 참가 신청/취소, 파일 공유, 관리자 운영 기능을 단계적으로 구축합니다.

## 핵심 목표
- 로그인 없이 대회 현황 공개 (닉네임 + 상태만)
- 로그인 사용자 신청/취소 처리
- 관리자 전용 운영 기능 (대회 CRUD, 신청 상태 변경, 파일 업로드)

## 기술 스택
- Next.js (App Router)
- Supabase (Postgres/Auth/Storage/RLS)
- shadcn/ui + Tailwind

## 실행 방법
```bash
npm run dev
```

## 환경 변수
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

## 진행 상태
- Phase 1: 공개 목록/상세, 신청/취소, 에러 메시지 정리 완료
- Phase 2: 관리자 기능(대회/신청/파일 관리) 및 UI 개선 완료
- Phase 3: 라운드(사이드 이벤트), 식사옵션, 숙박 관리 완료
- Phase 4: 승인 시스템, 사용자 프로필, 활동 선택 기능 완료

## Phase 4 구현 사항
### 데이터베이스
- 3개 신규 테이블: `tournament_extras` (활동), `registration_activity_selections` (선택), `manager_permissions` (권한)
- 승인 시스템: `registrations` 테이블에 approval_status, approved_at, approved_by 추가
- RLS 정책 및 트리거로 감시 추적 기능 포함

### 운영자 기능
- **대회 승인 대시보드** (`/admin/tournaments/[id]/dashboard`) - 신청자 승인/거절, 통계
- **라운드 매니저 권한** (`/admin/tournaments/[id]/manager-setup`) - 라운드별 관리자 지정
- **활동 관리** (`/admin/tournaments/[id]/extras`) - 활동 CRUD, 최대 3개 선택지

### 사용자 기능
- **프로필 페이지** (`/profile`) - 비밀번호 변경, 닉네임 수정
- **참가 상태 페이지** (`/t/[id]/status`) - 승인 현황, 식사/숙박 선택 확인
- **라운드 등록** (`/t/[id]`) - 식사/숙박 옵션 선택, 최대 3개 활동 선택

## 테스트
- 프레임워크: **Vitest 4.0.18** + @testing-library/react
- 테스트 커버리지: **50개 테스트 (100% 통과)**
  - Unit Tests: 30개 (유틸리티, 에러 메시지, UI 컴포넌트)
  - Integration Tests: 20개 (승인 시스템, 라운드 등록)

### 테스트 실행
```bash
# 모든 테스트 실행
npm run test

# Watch 모드
npm run test:watch

# 커버리지 리포트
npm run test:coverage
```

### 테스트 파일 위치
- `lib/*.test.ts` - 비즈니스 로직 및 유틸리티 테스트
- `components/**/*.test.tsx` - UI 컴포넌트 테스트

## 빌드 및 배포
```bash
# 프로덕션 빌드 (Vercel 배포 검증)
npm run build

# 로컬에서 프로덕션 빌드 실행
npm run build
npm run start
```

모든 코드를 TypeScript로 작성하며, 빌드는 Vercel의 Next.js 최적화 설정을 따릅니다.
