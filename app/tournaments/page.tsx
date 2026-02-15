"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";
import { formatRegistrationStatus, formatTournamentStatus } from "../../lib/statusLabels";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { useToast } from "../../components/ui/toast";

type Tournament = {
  id: number;
  title: string;
  event_date: string;
  course_name: string | null;
  location: string | null;
  tee_time: string | null;
  notes: string | null;
  status: string;
};

export default function TournamentsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Tournament[]>([]);
  const [error, setError] = useState("");
  const [myStatuses, setMyStatuses] = useState<Record<number, string>>({});
  const [applicantCounts, setApplicantCounts] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const formatStatus = (status: string) => formatRegistrationStatus(status);

  useEffect(() => {
    let active = true;

    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tournaments")
        .select("id,title,event_date,course_name,location,tee_time,notes,status")
        .order("event_date", { ascending: false });

      if (!active) return;

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      const tournamentRows = (data ?? []) as Tournament[];
      setRows(tournamentRows);

      const { data: countData, error: countError } = await supabase
        .from("registrations")
        .select("tournament_id,status")
        .eq("status", "applied");

      if (!countError) {
        const nextCounts: Record<number, number> = {};
        (countData ?? []).forEach((row: any) => {
          nextCounts[row.tournament_id] = (nextCounts[row.tournament_id] ?? 0) + 1;
        });
        setApplicantCounts(nextCounts);
      } else {
        setApplicantCounts({});
      }

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

  useEffect(() => {
    if (!error) return;

    toast({ variant: "error", title: "대회 조회 실패", description: error });
    setError("");
  }, [error, toast]);

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
                      {formatTournamentStatus(t.status)}
                    </Badge>
                  </div>
                  <CardDescription>
                    대회 정보 요약
                  </CardDescription>
                  {user && (
                    <div className="mt-2 text-xs text-slate-500">
                      내 참가 상태: {myStatuses[t.id] ? formatStatus(myStatuses[t.id]) : "미신청"}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex flex-row items-center justify-between gap-3">
                  <div className="grid gap-1 text-sm text-slate-600">
                    <div>일자: {t.event_date}</div>
                    <div>코스: {t.course_name ?? "-"}</div>
                    <div>지역: {t.location ?? "-"}</div>
                    <div>첫 티오프: {t.tee_time ?? "-"}</div>
                    <div>신청자 수: {applicantCounts[t.id] ?? 0}명</div>
                    <div>메모: {t.notes ?? "-"}</div>
                  </div>
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
