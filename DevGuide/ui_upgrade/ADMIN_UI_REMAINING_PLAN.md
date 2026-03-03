# 관리자 UI 업그레이드 남은 작업 정리 (2026-03-03)

## 1) 현재 결론
- 관리자 기준 페이지 UI 업그레이드 반영은 **전 페이지 완료** 상태입니다.
- `UI_MIG_TEMPLET`을 직접 빌드 대상에 포함하지 않고, 현재 스택(Next.js App Router + Supabase + Vercel) 유지 방식으로 적용했습니다.
- 기능/권한 로직은 유지하고, 화면 구조/스타일 톤만 템플릿 방향으로 맞췄습니다.

## 2) 관리자 페이지 반영 현황
| 경로 | 상태 | 비고 |
|---|---|---|
| `/admin` | 완료 | 요약 카드/레이아웃 톤 정리 |
| `/admin/help` | 완료 | 카드형 안내 구조 통일 |
| `/admin/users` | 완료 | 목록/필터 영역 톤 통일 |
| `/admin/users/[id]` | 완료 | 상세 폼/액션 버튼 톤 통일 |
| `/admin/tournaments` | 완료 | 기존 반영 유지 |
| `/admin/tournaments/new` | 완료 | 생성 폼 카드 스타일 정리 |
| `/admin/tournaments/[id]/layout` | 완료 | 상단 탭/배경/간격 통일 |
| `/admin/tournaments/[id]/dashboard` | 완료 | 통계/요약 카드 톤 정리 |
| `/admin/tournaments/[id]/edit` | 완료 | 편집 섹션 카드 톤 정리 |
| `/admin/tournaments/[id]/registrations` | 완료 | 기존 반영 유지 |
| `/admin/tournaments/[id]/side-events` | 완료 | 기존 반영 유지 |
| `/admin/tournaments/[id]/groups` | 완료 | 조 편성 페이지 구조/문구 정리 |
| `/admin/tournaments/[id]/extras` | 완료 | 깨진 문자열/태그 복구 + UI 통일 |
| `/admin/tournaments/[id]/meal-options` | 완료 | 깨진 문자열/태그 복구 + UI 통일 |
| `/admin/tournaments/[id]/files` | 완료 | 업로드/목록 카드 톤 반영 |
| `/admin/tournaments/[id]/manager-setup` | 완료 | 권한 관리 UI/문구 정리 |
| `/admin/tournaments/[id]/draw` | 완료 | 라이브 패널 레이아웃/카드 톤 통일 |

## 3) 이번 작업에서 보완한 핵심 이슈
1. 관리자 상단 헤더(`components/Header.tsx`) 숨김 규칙 일부 제거로 네비게이션 복구.
2. `extras`, `meal-options`, `manager-setup`, `groups` 페이지의 문자열 깨짐/태그 깨짐 복구.
3. `draw` 페이지를 포함한 상세 탭 카드/배경/간격을 관리자 공통 톤으로 정렬.

## 4) 남은 고도화 범위 (기능 변경 없음)
1. 관리자 수동 QA 일괄 수행 (탭별 핵심 동작 확인).
2. E2E/스모크 테스트 보강 (최소 관리자 주요 플로우 기준).
3. 반복 스타일 블록 공통 컴포넌트 추출 여부 최종 결정 (`StatCard`, `SectionCard` 등).

## 5) 검증 기준
1. `npm run build` 성공 (git push 전 필수).
2. 관리자 주요 플로우 수동 확인:
   - 대회 생성/수정
   - 신청자 상태 변경
   - 라운드/조편성 생성 및 수정
   - 추첨 세션 진행/되돌리기/리셋
   - 파일 업로드 및 공개 확인
