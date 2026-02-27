# UI 마이그레이션 진행 현황 (인수인계용)

- 문서 위치: `DevGuide/ui_upgrade/UI_MIGRATION_PROGRESS.md`
- 마지막 업데이트: 2026-02-27
- 기준 브랜치: `ui_upgrade`

## 1) 작업 목표
- 기존 스택(`Next.js App Router + Supabase + Vercel`)을 유지한 채,
- `UI_MIG_TEMPLET`의 화면 톤/레이아웃을 기존 페이지에 이식한다.
- 기능/권한/데이터 로직은 보존하고 UI만 교체한다.

## 2) 현재 진행 상태

### 완료
- 빌드에서 `UI_MIG_TEMPLET` 제외 설정
  - `tsconfig.json`에 `UI_MIG_TEMPLET/**` 제외 반영
- Header 정책 적용
  - 이식 대상 라우트에서 전역 Header 비노출 처리
- 사용자 영역 1차 이식
  - `/login`
  - `/start`
  - `/tournaments`
  - `/t/[id]/participants`
  - `/t/[id]` (대규모 페이지로, 로직 유지 + 상단/카드 스타일 중심 1차 이식)
- 관리자 영역 1차 이식
  - `/admin/tournaments` (실질 이식 완료)
  - `/admin/tournaments/[id]/registrations` (안전 범위 스타일 이식)
  - `/admin/tournaments/[id]/side-events` (안전 범위 스타일 이식)

### 미완료(다음 세션 우선)
- `/admin/tournaments/[id]/registrations` 전면 레이아웃 이식
  - 상단 요약/탭 네비/리스트 상호작용 UX를 템플릿형으로 재구성
- `/admin/tournaments/[id]/side-events` 전면 레이아웃 이식
  - 생성/수정 폼과 라운드 목록/신청자 테이블을 템플릿형으로 재구성
- 관리자 화면 전용 자동화 테스트 보강(E2E 또는 최소 통합 스모크)

## 3) 이번 턴 핵심 변경 파일
- `components/Header.tsx`
- `app/login/page.tsx`
- `app/start/page.tsx`
- `app/tournaments/page.tsx`
- `app/t/[id]/participants/page.tsx`
- `app/t/[id]/page.tsx`
- `app/admin/tournaments/page.tsx`
- `app/admin/tournaments/[id]/registrations/page.tsx`
- `app/admin/tournaments/[id]/side-events/page.tsx`
- `tsconfig.json`

## 4) 검증 결과
아래 커맨드는 최신 변경 기준 통과했다.

1. `npm run build`  
2. `npm run test -- app/login/login.test.tsx __tests__/components/Header.test.tsx`

## 5) 다음 세션 작업 가이드 (권장 순서)
1. `app/admin/tournaments/[id]/registrations/page.tsx`
   - 로직 유지, 레이아웃만 단계적으로 교체
   - 한 번에 대규모 치환하지 말고 섹션 단위(`통계 카드 -> 상태 섹션 카드`)로 `apply_patch` 적용
2. `app/admin/tournaments/[id]/side-events/page.tsx`
   - 상단/폼/목록 블록을 분할 적용
   - 텍스트 인코딩 이슈 방지를 위해 자동 문자열 치환 스크립트 사용 지양
3. 각 단계마다 `npm run build` 즉시 확인
4. 마지막에 회귀 스모크 테스트 실행

## 6) 주의사항
- 이 브랜치에는 사용자 선행 변경(`.gitignore`, `DevGuide/ui_upgrade/*`)이 포함되어 있다.
- 대형 파일(`app/t/[id]/page.tsx`, 관리자 페이지들)은 인코딩/문자열 손상 리스크가 있으므로,
  자동 대량 치환보다 `apply_patch` 기반의 소단위 수정이 안전하다.
- push 전 게이트: 반드시 `npm run build` 성공 상태 유지.
