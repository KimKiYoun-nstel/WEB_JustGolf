# Golf Tour TODO

## 완료 (Phase 2까지)
- [x] 대회 목록/상세 공개 및 신청 현황 공개 (닉네임 + 상태)
- [x] 로그인 사용자 신청/취소 처리 및 중복 신청 메시지
- [x] 관리자 가드 및 대시보드 구성
- [x] 관리자 대회 CRUD (생성/수정/복제)
- [x] 관리자 신청 상태 변경 (confirmed/waitlisted/canceled)
- [x] 파일 업로드 및 공개 링크 노출 (Public 버킷)
- [x] shadcn/ui 기반 UI 적용

## 남은 작업 (Phase 3 이후)
- [ ] 사전/사후 라운드 테이블 추가 및 신청 분리 UI 구현
- [ ] 대회 상세에서 사전/사후 라운드 현황 공개
- [ ] 관리자 화면에서 사전/사후 라운드 관리
- [ ] Storage Private 전환 + Signed URL 발급 로직
- [ ] 알림/히스토리 강화 (Edge Function, 운영 리포트)

## 운영 확인 체크
- [ ] Storage 정책: 관리자 업로드/삭제 정책 적용
- [ ] 관리자 계정 profiles.is_admin = true 확인
- [ ] 공개 페이지에서 개인정보 미노출 확인
- [ ] 파일 업로드/다운로드 실제 동작 확인
