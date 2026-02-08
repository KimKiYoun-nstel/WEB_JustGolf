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
