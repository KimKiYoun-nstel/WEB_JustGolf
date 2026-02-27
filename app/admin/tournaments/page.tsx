"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabaseClient";
import { formatTournamentStatus } from "../../../lib/statusLabels";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { useToast } from "../../../components/ui/toast";

type TournamentRow = {
  id: number;
  title: string;
  event_date: string;
  status: string;
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-700",
  draft: "bg-blue-100 text-blue-700",
  closed: "bg-amber-100 text-amber-700",
  done: "bg-slate-200 text-slate-600",
  deleted: "bg-rose-100 text-rose-700",
};

export default function AdminTournamentsPage() {
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [msg, setMsg] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setMsg("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tournaments")
      .select("id,title,event_date,status")
      .order("event_date", { ascending: false });

    if (error) {
      setMsg(`조회 실패: ${error.message}`);
      return;
    }

    setRows((data ?? []) as TournamentRow[]);
  };

  const deleteTournament = async (tournamentId: number, title: string, status: string) => {
    if (status === "deleted") {
      setMsg("이미 삭제된 대회입니다.");
      return;
    }

    const supabase = createClient();
    const { count: registrationCount, error: countError } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId);

    if (countError) {
      setMsg(`삭제 전 확인 실패: ${countError.message}`);
      return;
    }

    const confirmMessage =
      `"${title}" 대회를 삭제하시겠습니까?\n\n` +
      `현재 신청자 ${registrationCount ?? 0}명\n` +
      "삭제하면 상태가 deleted로 변경되며 목록에서 제외됩니다.";

    if (!confirm(confirmMessage)) return;

    const { error } = await supabase
      .from("tournaments")
      .update({ status: "deleted" })
      .eq("id", tournamentId);

    if (error) {
      setMsg(`삭제 실패: ${error.message}`);
      return;
    }

    setMsg("대회가 삭제되었습니다.");
    await load();
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!msg) return;

    const isSuccess = /완료|성공|삭제되었습니다/.test(msg);
    const isError = /실패|오류|없습니다|필요/.test(msg);

    toast({
      variant: isSuccess ? "success" : isError ? "error" : "default",
      title: msg,
    });
    setMsg("");
  }, [msg, toast]);

  const statusCounts = useMemo(() => {
    return {
      total: rows.length,
      open: rows.filter((row) => row.status === "open").length,
      draft: rows.filter((row) => row.status === "draft").length,
      deleted: rows.filter((row) => row.status === "deleted").length,
    };
  }, [rows]);

  return (
    <main className="min-h-screen bg-[#F2F4F7] px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <section className="rounded-[30px] border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">ADMIN TOURNAMENTS</p>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">대회 목록</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={load} variant="secondary">
                새로고침
              </Button>
              <Button asChild>
                <Link href="/admin/tournaments/new">새 대회 만들기</Link>
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">전체</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{statusCounts.total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-medium text-emerald-700">모집중</p>
              <p className="mt-1 text-xl font-bold text-emerald-900">{statusCounts.open}</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-medium text-blue-700">작성중</p>
              <p className="mt-1 text-xl font-bold text-blue-900">{statusCounts.draft}</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs font-medium text-rose-700">삭제</p>
              <p className="mt-1 text-xl font-bold text-rose-900">{statusCounts.deleted}</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {rows.map((row) => (
            <Card
              key={row.id}
              className="rounded-[30px] border border-slate-100 bg-white shadow-sm"
            >
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-lg text-slate-900">{row.title}</CardTitle>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[row.status] ?? "bg-slate-100 text-slate-700"}`}
                  >
                    {formatTournamentStatus(row.status)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{row.event_date}</span>
                  <Badge variant="outline">ID {row.id}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/tournaments/${row.id}/edit`}>수정</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/tournaments/${row.id}/dashboard`}>대회 현황</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/tournaments/${row.id}/registrations`}>신청자 관리</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/tournaments/${row.id}/side-events`}>라운드 관리</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/tournaments/${row.id}/files`}>파일 관리</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/tournaments/${row.id}/meal-options`}>메뉴 관리</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/tournaments/${row.id}/extras`}>활동 관리</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/tournaments/${row.id}/groups`}>조편성표</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/tournaments/${row.id}/draw`}>라이브 조편성</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/t/${row.id}/participants`}>참가자 현황</Link>
                  </Button>
                  {row.status !== "deleted" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteTournament(row.id, row.title, row.status)}
                    >
                      삭제
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
