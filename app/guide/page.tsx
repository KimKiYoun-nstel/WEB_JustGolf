import Link from "next/link";

/* ────────────────────────────────────────────
   데이터 정의
──────────────────────────────────────────── */

const USER_GUIDE = [
  {
    id: "join",
    icon: "🔑",
    title: "가입 및 로그인",
    steps: [
      "https://web-just-golf.vercel.app 접속 후 회원가입 (이메일 + 비밀번호)",
      "닉네임·연락처 입력 후 승인 대기 상태로 자동 전환",
      "관리자 승인 완료 알림 수신 후 서비스 이용 시작",
      "카카오 계정 연동 가능 (내 프로필 → 카카오 연결)",
    ],
    note: "승인 전에는 대회 신청이 제한될 수 있습니다.",
  },
  {
    id: "tournament",
    icon: "🏌️",
    title: "대회 신청",
    steps: [
      "'대회 목록' 메뉴에서 모집 중인 대회 확인",
      "대회 카드 클릭 → '참가 신청' 버튼 선택",
      "식사 옵션, 추가 활동 등 항목 선택 후 제출",
      "신청 후 상태는 '신청' → 관리자 확정 시 '확정'으로 변경",
      "확정 후 취소 시 위약금(그린피 100%)이 발생할 수 있음",
    ],
    note: "모집 마감 또는 대기 상태일 경우 추가 접수가 제한됩니다.",
  },
  {
    id: "draw",
    icon: "📋",
    title: "조편성 확인",
    steps: [
      "대회 페이지 → '조편성 보기' 클릭",
      "조별 티오프 시간, 동반 플레이어 확인",
      "관리자가 공개하기 전에는 미표시",
    ],
  },
  {
    id: "results",
    icon: "🏆",
    title: "대회 결과 보기",
    steps: [
      "대회 목록에서 '종료' 상태 대회 클릭 → '결과 보기'",
      "단체사진·하이라이트 영상이 등록된 경우 상단에 자동 표시",
      "'갈무리 보기'로 순위표 이미지 저장 가능",
      "'원본 PDF 열기'로 전체 성적표 확인",
    ],
  },
  {
    id: "gallery",
    icon: "📷",
    title: "갤러리 (사진/영상 공유)",
    steps: [
      "대회 페이지 → '사진/영상' 버튼 클릭",
      "사진 또는 영상 파일 선택 후 업로드 (최대 100MB)",
      "업로드 후 썸네일 자동 생성 (수초 이내)",
      "좋아요·댓글로 반응 남기기 가능",
      "본인이 올린 항목은 삭제 가능 (관리자는 전체 삭제 가능)",
    ],
    note: "저장 공간 절약을 위해 영상은 압축 후 업로드를 권장합니다.",
  },
  {
    id: "profile",
    icon: "👤",
    title: "내 프로필",
    steps: [
      "우측 상단 '내 프로필' 클릭",
      "닉네임 수정, 연락처 변경 가능",
      "카카오 계정 연결 및 해제",
      "비밀번호 변경 (이메일 인증 방식)",
    ],
  },
  {
    id: "board",
    icon: "💬",
    title: "게시판",
    steps: [
      "기능 제안, 버그 신고, 피드백 작성",
      "운영진 확인 후 답변 제공",
    ],
  },
];

const ADMIN_GUIDE = [
  {
    icon: "👥",
    title: "회원 관리",
    desc: "가입 승인·거절, 관리자 권한 부여/회수, 비밀번호 초기화",
    href: "/admin/users",
  },
  {
    icon: "🏅",
    title: "대회 운영",
    desc: "대회 생성·수정·삭제, 신청자 확정/취소, 대기 관리",
    href: "/admin/tournaments",
  },
  {
    icon: "🎯",
    title: "라이브 조편성",
    desc: "실시간 추첨 세션, 자동 배정, 조 공개 설정",
    href: "/admin/tournaments",
  },
  {
    icon: "📁",
    title: "파일·메뉴 관리",
    desc: "대회 파일 업로드, 식사 옵션, 추가 활동 관리",
    href: "/admin/tournaments",
  },
];

const RELEASE_NOTES = [
  {
    date: "2026년 3월 30일",
    version: "v1.5",
    items: [
      { type: "new", text: "대회 갤러리 기능 추가 — 사진·영상 업로드, 좋아요·댓글 지원" },
      { type: "new", text: "결과 페이지 단체사진·하이라이트 영상 팝업 추가" },
      { type: "new", text: "JUST GOLF 회칙 팝업 추가 (/start 페이지)" },
      { type: "new", text: "갤러리 썸네일 즉시 생성 (eager 변환 적용으로 첫 로딩 지연 제거)" },
      { type: "fix", text: "단체사진 contain 표시로 전체 인원이 잘리지 않게 개선" },
      { type: "fix", text: "영상 팝업 세로형(Shorts 스타일) 및 재생 컨트롤 정상화" },
    ],
  },
  {
    date: "2026년 3월 30일",
    version: "v1.4",
    items: [
      { type: "improve", text: "전체 페이지 레이아웃 통일 (compact 스타일 적용)" },
      { type: "fix", text: "온보딩 폰트 및 팝업 가독성 개선" },
    ],
  },
  {
    date: "2026년 3월 27일",
    version: "v1.3",
    items: [
      { type: "new", text: "종료 대회 결과 보기 및 갈무리(이미지 저장) 기능" },
      { type: "new", text: "온보딩 닉네임 확인 팝업 추가" },
      { type: "improve", text: "결과 페이지 선로딩 및 캐시 적용으로 응답 속도 개선" },
    ],
  },
  {
    date: "2026년 3월 17일",
    version: "v1.2",
    items: [
      { type: "improve", text: "참가자·조편성 목록 가독성 중심 UI 개선" },
    ],
  },
];

const typeBadge: Record<string, { label: string; cls: string }> = {
  new: { label: "신규", cls: "bg-green-100 text-green-700" },
  fix: { label: "수정", cls: "bg-orange-100 text-orange-700" },
  improve: { label: "개선", cls: "bg-blue-100 text-blue-700" },
};

/* ────────────────────────────────────────────
   컴포넌트
──────────────────────────────────────────── */

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">

        {/* 헤더 */}
        <header className="mb-10 space-y-3">
          <Link
            href="/start"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600"
          >
            ← 바로가기로 돌아가기
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-600">
            User Guide
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">사용 설명서</h1>
          <p className="text-base text-slate-500">
            JUST GOLF 웹 서비스의 주요 기능과 사용 방법을 안내합니다.
          </p>
        </header>

        {/* ── 일반 회원 가이드 ── */}
        <section className="mb-14">
          <h2 className="mb-5 text-xl font-bold text-slate-900">회원 기능 안내</h2>
          <div className="flex flex-col gap-4">
            {USER_GUIDE.map((section) => (
              <div
                key={section.id}
                className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-2xl">{section.icon}</span>
                  <h3 className="text-base font-bold text-slate-900">{section.title}</h3>
                </div>
                <ol className="space-y-1.5 pl-1">
                  {section.steps.map((step, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-50 text-xs font-bold text-green-600">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                {section.note && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    ⚠ {section.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── 관리자 기능 요약 ── */}
        <section className="mb-14">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">관리자 기능 요약</h2>
            <Link
              href="/admin/help"
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              상세 관리자 도움말 →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {ADMIN_GUIDE.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="mt-0.5 text-2xl">{item.icon}</span>
                <div>
                  <p className="font-bold text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 릴리즈 노트 ── */}
        <section>
          <h2 className="mb-5 text-xl font-bold text-slate-900">최근 업데이트</h2>
          <div className="flex flex-col gap-5">
            {RELEASE_NOTES.map((release) => (
              <div
                key={release.version}
                className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="rounded-xl bg-slate-900 px-3 py-1 text-sm font-bold text-white">
                    {release.version}
                  </span>
                  <span className="text-sm text-slate-400">{release.date}</span>
                </div>
                <ul className="space-y-2">
                  {release.items.map((item, i) => {
                    const badge = typeBadge[item.type];
                    return (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <span
                          className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        <span>{item.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
