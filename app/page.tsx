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
        {/* 헤더 */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Monthly Golf Tour
            </p>
            <h1 className="text-3xl font-semibold text-slate-900">
              월례 골프 대회
            </h1>
            <p className="text-sm text-slate-500">
              공개 일정과 참가 현황을 한곳에서 확인하세요. 신청하려면 로그인이 필요합니다.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/login">로그인</Link>
          </Button>
        </header>

        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        {/* 안내 섹션 */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg">📍 이렇게 사용하세요</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>1️⃣ 아래 대회를 선택해서 <strong>상세보기</strong>를 클릭</p>
            <p>2️⃣ 신청하려면 우측 상단 <strong>로그인</strong> 클릭</p>
            <p>3️⃣ 대회 상세에서 신청/라운드 참가 가능</p>
          </CardContent>
        </Card>

        {/* 대회 목록 */}
        <section className="grid gap-4">
          <h2 className="text-lg font-semibold text-slate-900">대회 목록</h2>
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
            ))
          )}
        </section>
      </div>
    </main>
  );
}
