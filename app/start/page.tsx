import Link from "next/link";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

export default function StartPage() {
  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Quick Start
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            바로가기
          </h1>
          <p className="text-sm text-slate-500">
            필요한 메뉴로 바로 이동하세요.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>대회 바로가기</CardTitle>
              <CardDescription>
                대회 목록을 확인하고 신청하세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/tournaments">대회 목록 보기</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>제주달콧 바로가기</CardTitle>
              <CardDescription>
                준비 중인 페이지입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/jeju">페이지 열기</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>게시판 바로가기</CardTitle>
              <CardDescription>
                피드백 요청, 버그 신고, 기능 제안 등을 남겨주세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/board">페이지 열기</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
