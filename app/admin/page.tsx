import Link from "next/link";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function AdminHomePage() {
  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
        {/* 헤더 */}
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">
            👨‍💼 관리자 대시보드
          </h1>
          <p className="text-sm text-slate-500">
            대회, 신청자, 파일, 라운드을 한곳에서 관리합니다.
          </p>
        </header>

        {/* 주요 기능 */}
        <section className="grid gap-4 md:grid-cols-2">
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle className="text-lg">📅 대회 관리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                대회를 생성, 수정, 삭제하고 신청자를 관리합니다.
              </p>
              <Button asChild className="w-full">
                <Link href="/admin/tournaments">대회 목록으로</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle className="text-lg">✅ 회원 관리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                회원 승인, 권한, 비밀번호 초기화 등을 관리합니다.
              </p>
              <Button asChild className="w-full" variant="outline">
                <Link href="/admin/users">회원 관리하기</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle className="text-lg">📍 라운드 관리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                사전/사후 라운드를 만들고 신청자를 관리합니다.
              </p>
              <p className="text-xs text-slate-500">
                (대회 선택 후 라운드 관리 버튼 클릭)
              </p>
              <Button asChild className="w-full" variant="outline">
                <Link href="/admin/tournaments">대회 선택하기</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle className="text-lg">🧩 조편성 관리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                확정 참가자를 조에 배정하고 공개 여부를 설정합니다.
              </p>
              <p className="text-xs text-slate-500">
                (대회 선택 후 조편성 버튼 클릭)
              </p>
              <Button asChild className="w-full" variant="outline">
                <Link href="/admin/tournaments">대회 선택하기</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* 워크플로우 */}
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-lg">🚀 일반적인 워크플로우</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div>
              <p className="font-semibold">1️⃣ 새 대회 생성</p>
              <p className="ml-4 text-slate-600">
                대회 管리 → "새 대회 만들기" 클릭 → 필수정보 입력
              </p>
            </div>
            <div>
              <p className="font-semibold">2️⃣ 대회 상태 변경</p>
              <p className="ml-4 text-slate-600">
                대회 수정 → 상태를 '모집중'으로 변경 → 신청 받기 시작
              </p>
            </div>
            <div>
              <p className="font-semibold">3️⃣ 회원 관리</p>
              <p className="ml-4 text-slate-600">
                승인/권한/비밀번호 초기화 등 계정 관리 작업 수행
              </p>
            </div>
            <div>
              <p className="font-semibold">4️⃣ 참가자 관리</p>
              <p className="ml-4 text-slate-600">
                세부 대회 → "신청자 관리" → 상태 변경 (확정/대기)
              </p>
            </div>
            <div>
              <p className="font-semibold">5️⃣ 라운드 추가 (선택)</p>
              <p className="ml-4 text-slate-600">
                세부 대회 → "라운드 관리" → 사전/사후 라운드 생성
              </p>
            </div>
            <div>
              <p className="font-semibold">6️⃣ 조편성 공개 (선택)</p>
              <p className="ml-4 text-slate-600">
                세부 대회 → "조편성" → 멤버 배정 → 공개
              </p>
            </div>
            <div>
              <p className="font-semibold">7️⃣ 파일 업로드 (선택)</p>
              <p className="ml-4 text-slate-600">
                세부 대회 → "파일 관리" → 조편성/안내문 업로드
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 빠른 링크 */}
        <div className="grid gap-3 md:grid-cols-3">
          <Button asChild variant="secondary" className="h-auto flex-col">
            <Link href="/admin/tournaments/new">
              <span className="text-lg">➕</span>
              <span>새 대회 만들기</span>
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-auto flex-col">
            <Link href="/admin/tournaments">
              <span className="text-lg">📋</span>
              <span>대회 목록</span>
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-auto flex-col">
            <Link href="/start">
              <span className="text-lg">🌍</span>
              <span>공개 페이지</span>
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
