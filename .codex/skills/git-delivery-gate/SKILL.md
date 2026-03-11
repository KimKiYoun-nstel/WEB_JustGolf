---
name: git-delivery-gate
description: Manage WEB_JustGolf feature work with a repeatable Git quality gate. Use when starting, committing, and preparing to push implementation changes with branch hygiene, Conventional Commits, and build/test verification.
---

# Git Delivery Gate

기능 개발 단위의 Git 운영을 표준화한다.

## 핵심 출력물
- 정리된 커밋 히스토리
- push 전 검증 로그 요약

## 워크플로
1. 착수 전에 작업 트리를 확인한다.
- `git status --short`
- 의도하지 않은 변경이 있으면 범위를 분리한다.

2. 브랜치 전략을 적용한다.
- 기능별로 독립 브랜치에서 작업한다.
- 브랜치명은 작업 의도가 드러나게 짓는다.

3. 커밋을 기능 단위로 쪼갠다.
- 메시지는 Conventional Commits 형식을 유지한다.
- 예: `feat: 대회별 관리자 진입 버튼 추가`

4. push 전 품질 게이트를 통과한다.
- 필수: `npm run build`
- 변경 영향에 따라 `npm run lint`, `npm run test`, `npm run test:e2e`를 선택 실행한다.

5. 최종 점검 후 push한다.
- 변경 파일/테스트 범위/리스크를 요약한다.
- DB 변경이 있으면 마이그레이션 파일과 수동 실행 절차를 함께 명시한다.

## 레포 전용 규칙
- `npm run build` 실패 상태에서 push하지 않는다.
- Service Role Key, `.env*` 민감 정보가 추적되지 않게 확인한다.
- DB 정책/스키마 변경 SQL은 애플리케이션 런타임 실행 방식으로 넣지 않는다.

## 중복 방지 규칙
- 기간별 업무 리포트가 필요하면 `git-work-report` 스킬을 사용한다.
- 이 스킬은 "개발 진행 중 Git 운영"만 담당한다.
