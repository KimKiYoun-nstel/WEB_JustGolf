"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
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
  const [rows, setRows] = useState<Tournament[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id,title,event_date,course_name,location,status")
        .order("event_date", { ascending: false });

      if (error) setError(error.message);
      else setRows((data ?? []) as Tournament[]);
    })();
  }, []);

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
          {rows.length === 0 ? (
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
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-slate-500">
                    {t.location ?? "-"}
                  </span>
                  <Button asChild className="w-full sm:w-auto">
                    <Link href={`/t/${t.id}`}>상세 보기</Link>
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
