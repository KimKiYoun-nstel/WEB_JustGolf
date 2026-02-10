"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

type Tournament = {
  id: number;
  title: string;
  event_date: string;
  course_name: string | null;
  location: string | null;
  status: string;
};

export default function TournamentsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Tournament[]>([]);
  const [error, setError] = useState("");
  const [myStatuses, setMyStatuses] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const formatStatus = (status: string) => {
    if (status === "undecided") return "미정";
    if (status === "applied") return "신청";
    if (status === "approved") return "확정";
    if (status === "waitlisted") return "대기";
    if (status === "canceled") return "취소";
    return status;
  };

  useEffect(() => {
    let active = true;

    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tournaments")
        .select("id,title,event_date,course_name,location,status")
        .order("event_date", { ascending: false });

      if (!active) return;

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      setRows((data ?? []) as Tournament[]);

      if (!user?.id) {
        setMyStatuses({});
        setIsLoading(false);
        return;
      }

      const { data: regData, error: regError } = await supabase
        .from("registrations")
        .select("tournament_id,status,relation")
        .eq("user_id", user.id)
        .eq("relation", "본인");

      if (!active) return;

      if (regError) {
        setMyStatuses({});
        setIsLoading(false);
        return;
      }

      const nextStatuses: Record<number, string> = {};
      (regData ?? []).forEach((row: any) => {
        nextStatuses[row.tournament_id] = row.status;
      });
      setMyStatuses(nextStatuses);
      setIsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Tournaments
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            대회 목록
          </h1>
          <p className="text-sm text-slate-500">
            진행 중인 대회를 확인하고 참가 신청하세요.
          </p>
        </header>

        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        <section className="grid gap-4">
          {isLoading ? (
            <Card className="border-slate-200/70">
              <CardContent className="py-10 text-center text-slate-500">
                로딩 중...
              </CardContent>
            </Card>
          ) : rows.length === 0 ? (
            <Card className="border-slate-200/70">
              <CardContent className="py-10 text-center text-slate-500">
                등록된 대회가 없습니다.
              </CardContent>
            </Card>
          ) : (
            rows.map((t) => (
              <Card key={t.id} className="border-slate-200/70">
                <CardHeader>
                  <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                    <CardTitle className="truncate text-base sm:text-lg">{t.title}</CardTitle>
                    <Badge variant="secondary" className="capitalize">
                      {t.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {t.event_date} · {t.course_name ?? "-"}
                  </CardDescription>
                  {user && (
                    <div className="mt-2 text-xs text-slate-500">
                      내 참가 상태: {myStatuses[t.id] ? formatStatus(myStatuses[t.id]) : "미신청"}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex flex-row items-center justify-between gap-3">
                  <span className="inline-block text-sm text-slate-500">
                    {t.location ?? "-"}
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/t/${t.id}/participants`}>상세 보기</Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
