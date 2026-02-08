import Link from "next/link";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function AdminHomePage() {
  return (
    <main>
      <Card className="border-slate-200/70">
        <CardHeader>
          <CardTitle>관리자 대시보드</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/admin/tournaments">대회 관리</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
