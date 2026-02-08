"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

type Tournament = {
  id: number;
  title: string;
  event_date: string;
  course_name: string | null;
  location: string | null;
  status: string;
};

export default function Home() {
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
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Monthly Golf Tour
            </p>
            <h1 className="text-3xl font-semibold text-slate-900">
              월례 골프 대회
            </h1>
            <p className="text-sm text-slate-500">
              공개 일정과 참가 현황을 한곳에서 확인하세요.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/login">로그인</Link>
          </Button>
        </header>

        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        <section className="grid gap-4">
          {rows.map((t) => (
            <Card key={t.id} className="border-slate-200/70">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{t.title}</span>
                  <Badge variant="secondary" className="capitalize">
                    {t.status}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {t.event_date} · {t.course_name ?? "-"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  {t.location ?? "-"}
                </span>
                <Button asChild>
                  <Link href={`/t/${t.id}`}>상세 보기</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
