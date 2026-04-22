# Docs

운영 중에도 계속 참조되는 **현행 문서**만 이 폴더에 둡니다. 특정 시점에 생성된 감사/감리/완료 보고서 등 과거 스냅샷은 `archive/`로 이동시킵니다.

## 현행 문서

| 문서 | 용도 |
|---|---|
| [`VERCEL_DEPLOYMENT.md`](./VERCEL_DEPLOYMENT.md) | Vercel 배포 환경변수 및 절차 |
| [`PLAYWRIGHT_E2E_TEST_GUIDE.md`](./PLAYWRIGHT_E2E_TEST_GUIDE.md) | E2E 테스트 전략 및 실행 가이드 |

## 관련 문서 위치

- **개발 과정 기록 / 기능별 분석·구현 계획**: [`../DevGuide/`](../DevGuide/)
  - 날짜 폴더(`YYYYMMDD/`)로 연대기 정리되어 있음
  - `old/`, `Completed_YYYYMMDD/` 하위는 완료된 작업의 히스토리
- **프로젝트 개요**: [`../README.md`](../README.md)
- **리포지토리 구조/테스트 정책**: [`../REPO_STRUCTURE.md`](../REPO_STRUCTURE.md), [`../TEST_FILES_CLASSIFICATION.md`](../TEST_FILES_CLASSIFICATION.md)
- **AI 에이전트 작업 규칙**: [`../AGENTS.md`](../AGENTS.md), [`../CLAUDE.md`](../CLAUDE.md), [`../GEMINI.md`](../GEMINI.md), [`../.github/copilot-instructions.md`](../.github/copilot-instructions.md)
- **DB 마이그레이션**: [`../db/migrations/`](../db/migrations/)
- **과거 스냅샷 / 일회성 기획서**: [`./archive/`](./archive/)

## 문서 정책

- 문서를 추가/갱신할 때 **현재 시점에도 유효한지** 판단.
- 특정 시점의 결정/감사 결과(`*_YYYY-MM-DD.md`, `*_AUDIT*.md`, `*_STATUS.md`, `*_COMPLETION.md`)는 바로 `archive/`에 둡니다.
- 운영에 계속 필요한 가이드(배포/테스트/운영 체크리스트 등)만 최상위에 유지합니다.
