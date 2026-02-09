import Link from "next/link";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

export default function JejuPage() {
  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>제주달콧</CardTitle>
            <CardDescription>준비 중인 페이지입니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              콘텐츠를 준비하고 있습니다. 조금만 기다려 주세요.
            </p>
            <Button asChild variant="outline">
              <Link href="/start">메인화면으로 돌아가기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
