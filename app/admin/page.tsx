import Link from "next/link";

export default function AdminHomePage() {
  return (
    <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 md:px-6">
        {/* 헤더 */}
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">
            👨‍💼 관리자 대시보드
          </h1>
          <p className="text-sm text-slate-500">
            대회, 신청자, 파일, 라운드을 한곳에서 관리합니다.
          </p>
        </header>

        {/* 주요 기능 — compact 카드 그리드 */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Link
            href="/admin/tournaments/new"
            className="flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="text-xl">➕</span>
            <span className="text-sm font-semibold text-slate-800">새 대회 만들기</span>
          </Link>
          <Link
            href="/admin/tournaments"
            className="flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="text-xl">📅</span>
            <span className="text-sm font-semibold text-slate-800">대회 관리</span>
            <span className="text-xs text-slate-500">목록 · 수정 · 신청자</span>
          </Link>
          <Link
            href="/admin/users"
            className="flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="text-xl">✅</span>
            <span className="text-sm font-semibold text-slate-800">회원 관리</span>
            <span className="text-xs text-slate-500">승인 · 권한</span>
          </Link>
          <Link
            href="/admin/help"
            className="flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="text-xl">📘</span>
            <span className="text-sm font-semibold text-slate-800">관리자 도움말</span>
            <span className="text-xs text-slate-500">기능 안내 문서</span>
          </Link>
          <Link
            href="/admin/tournaments"
            className="flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="text-xl">📍</span>
            <span className="text-sm font-semibold text-slate-800">라운드 관리</span>
            <span className="text-xs text-slate-500">대회 선택 후 진행</span>
          </Link>
          <Link
            href="/admin/tournaments"
            className="flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="text-xl">🧩</span>
            <span className="text-sm font-semibold text-slate-800">조편성 관리</span>
            <span className="text-xs text-slate-500">대회 선택 후 진행</span>
          </Link>
          <Link
            href="/start"
            className="flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="text-xl">🌍</span>
            <span className="text-sm font-semibold text-slate-800">공개 페이지</span>
            <span className="text-xs text-slate-500">사용자 화면 확인</span>
          </Link>
        </section>

        {/* 워크플로우 — compact */}
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">🚀 일반적인 워크플로우</p>
          <ol className="space-y-1 text-sm text-slate-700">
            <li><span className="font-semibold">1.</span> 대회 관리 → 새 대회 만들기 → 필수정보 입력</li>
            <li><span className="font-semibold">2.</span> 대회 수정 → 상태 &apos;모집중&apos; 변경 → 신청 받기</li>
            <li><span className="font-semibold">3.</span> 회원 관리 → 승인/권한/초기화 작업</li>
            <li><span className="font-semibold">4.</span> 세부 대회 → 신청자 관리 → 상태 변경 (확정/대기)</li>
            <li><span className="font-semibold">5.</span> (선택) 라운드 관리 → 사전/사후 라운드 생성</li>
            <li><span className="font-semibold">6.</span> (선택) 조편성 → 멤버 배정 → 공개</li>
            <li><span className="font-semibold">7.</span> (선택) 파일 관리 → 조편성/안내문 업로드</li>
          </ol>
        </section>
      </div>
    </main>
  );
}
