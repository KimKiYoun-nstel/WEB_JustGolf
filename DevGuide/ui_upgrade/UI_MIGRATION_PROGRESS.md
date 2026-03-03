# UI 마이그레이션 진행 현황 (인수인계용)

- 문서 위치: `DevGuide/ui_upgrade/UI_MIGRATION_PROGRESS.md`
- 마지막 업데이트: 2026-03-03
- 작업 브랜치: `ui_upgrade`
- 관리자 세부 계획: `DevGuide/ui_upgrade/ADMIN_UI_REMAINING_PLAN.md`

## 1) 작업 원칙
1. 기술 스택 고정: `Next.js App Router + Supabase + Vercel`
2. 템플릿(`UI_MIG_TEMPLET`)은 레퍼런스 용도로만 사용하고, 실제 구현은 현재 프로젝트 구조에 맞게 이식
3. 권한/데이터/비즈니스 로직은 유지하고 UI 계층만 교체

## 2) 완료된 작업
### 2.1 빌드/구성
- `UI_MIG_TEMPLET` 제외 상태에서 빌드 가능하도록 구성 정리
- 현재 기준 `npm run build` 성공

### 2.2 사용자 영역
- `/login`
- `/start`
- `/tournaments`
- `/t/[id]`
- `/t/[id]/participants`

### 2.3 관리자 영역
- 공통/목록: `/admin`, `/admin/help`, `/admin/users`, `/admin/users/[id]`, `/admin/tournaments`, `/admin/tournaments/new`
- 대회 상세 탭:
  - `/admin/tournaments/[id]/dashboard`
  - `/admin/tournaments/[id]/edit`
  - `/admin/tournaments/[id]/registrations`
  - `/admin/tournaments/[id]/side-events`
  - `/admin/tournaments/[id]/groups`
  - `/admin/tournaments/[id]/extras`
  - `/admin/tournaments/[id]/meal-options`
  - `/admin/tournaments/[id]/files`
  - `/admin/tournaments/[id]/manager-setup`
  - `/admin/tournaments/[id]/draw`
- 관리자 헤더 내비게이션 복구:
  - `components/Header.tsx`의 과도한 관리자 경로 숨김 규칙 제거

### 2.4 복구 이슈
- 일부 페이지(`extras`, `meal-options`, `manager-setup`, `groups`)의 깨진 인코딩/태그/문구를 복구
- 컴파일 에러 해소 후 빌드 재검증 완료

## 3) 아직 남은 작업
1. 관리자 주요 시나리오 수동 QA 일괄 점검
2. 관리자 플로우 중심 스모크/E2E 보강
3. 반복되는 UI 블록의 공통 컴포넌트 추출 여부 결정

## 4) 이번 기준 검증 결과
- 실행 커맨드: `npm run build`
- 결과: 성공 (Next.js production build + TypeScript 체크 통과)
- 참고: Next.js 경고 1건(`middleware` -> `proxy` 권장) 존재, 기능 차단 이슈는 아님

## 5) 다음 세션 권장 시작 순서
1. `admin` 전 구간 수동 QA 체크리스트 실행
2. 실패/어색한 UX 지점 보완
3. 최소 E2E 시나리오 추가 후 재빌드
