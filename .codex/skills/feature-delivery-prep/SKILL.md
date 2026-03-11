---
name: feature-delivery-prep
description: Analyze WEB_JustGolf before implementing a new feature and produce a review-ready preparation document. Use when a feature request needs requirement breakdown, affected files, RLS/auth impact, phased plan, risk review, and test strategy before coding starts.
---

# Feature Delivery Prep

신규 기능 구현 착수 전에 "분석-설계-계획 문서"를 완성한다.

## 핵심 출력물
- `DevGuide/YYYYMMDD/<feature>_analysis_plan.md` 문서 1개
- 사용자가 바로 리뷰 가능한 단계별 구현 계획

## 워크플로
1. 요구사항을 기능 단위로 분해한다.
- 사용자 목표, 관리자 목표, 실패 시나리오를 분리한다.

2. 영향 파일을 식별한다.
- `app/`, `lib/`, `components/`, `db/migrations/`, `e2e/`에서 후보를 찾는다.
- 기존 유사 구현이 있는 `DevGuide/` 문서를 우선 참고한다.

3. 데이터/권한 영향을 작성한다.
- RLS 영향 여부를 명시한다.
- 관리자/일반 사용자/비로그인 플로우를 각각 기술한다.
- Service Role이 필요한 지점은 API 서버 경계에서만 허용한다.

4. 테스트 전략을 정의한다.
- 단위 테스트 필요 여부
- 스모크/회귀 E2E 범위
- 최소 수동 QA 시나리오(3~5개)

5. 구현 단계를 Phase로 쪼갠다.
- DB/RLS -> API/권한 -> UI -> 테스트/문서 순으로 설계한다.
- 각 단계별 완료 조건(DoD)을 쓴다.

6. 사용자 피드백 루프를 문서에 반영한다.
- 피드백 받은 항목을 체크리스트로 전환한다.
- 코드 구현 시작 전 "누락 0" 상태를 확인한다.

## 문서 필수 섹션
- 요구사항 요약
- 영향 파일
- 데이터/권한(RLS) 영향
- 테스트 전략
- 단계별 구현 계획
- 오픈 이슈/결정 필요 항목
- 구현 시작 승인 체크리스트

## 레포 전용 규칙
- DB 정책/스키마 변경은 `db/migrations/*.sql`로만 제안한다.
- SQL 정책 변경은 코드에서 실행하지 않고 Supabase SQL Editor 수동 실행을 전제로 한다.
- 빌드 게이트(`npm run build`)를 계획의 최종 조건에 포함한다.

## 간단 템플릿
```md
# <기능명> 분석 및 구현 계획

## 1) 요구사항
## 2) 영향 파일
## 3) 데이터/권한(RLS) 영향
## 4) 테스트 전략
## 5) 단계별 구현 계획
## 6) 수동 QA 시나리오
## 7) 오픈 이슈
## 8) 구현 착수 체크리스트
```
