"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../lib/auth";
import { createClient } from "../../../lib/supabaseClient";
import {
  getTournamentAdminAccess,
  listManagedTournamentIds,
} from "../../../lib/tournamentAdminAccess";
import { formatTournamentStatus } from "../../../lib/statusLabels";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
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
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (authLoading) return;

    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    setMsg("");
    setLoading(true);
    const supabase = createClient();

    const access = await getTournamentAdminAccess(supabase, user.id);
    setIsAdmin(access.isAdmin);

    let scopedIds: number[] | null = null;
    if (!access.isAdmin) {
      scopedIds = await listManagedTournamentIds(supabase, user.id);
      if (scopedIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
    }

    let query = supabase
      .from("tournaments")
      .select("id,title,event_date,status")
      .order("event_date", { ascending: false });

    if (scopedIds) {
      query = query.in("id", scopedIds);
    }

    const { data, error } = await query;
    if (error) {
      setMsg(`조회 실패: ${error.message}`);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as TournamentRow[]);
    setLoading(false);
  }, [authLoading, user]);

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
      `현재 신청자: ${registrationCount ?? 0}명\n` +
      "삭제하면 상태가 deleted로 변경되어 목록에서 제외됩니다.";

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
    void load();
  }, [load]);

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
    <main className="min-h-screen bg-slate-50 px-4 pt-6 pb-12 md:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">ADMIN TOURNAMENTS</p>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                {isAdmin ? "대회 목록" : "내 담당 대회"}
              </h1>
              {!isAdmin ? (
                <p className="text-sm text-slate-500">
                  권한이 부여된 대회만 표시됩니다.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void load()} variant="secondary" disabled={loading}>
                새로고침
              </Button>
              {isAdmin ? (
                <Button asChild>
                  <Link href="/admin/tournaments/new">새 대회 만들기</Link>
                </Button>
              ) : null}
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

        {loading ? (
          <div className="rounded-2xl border border-slate-100 bg-white py-10 text-center shadow-sm">
            <p className="text-sm text-slate-500">로딩 중...</p>
          </div>
        ) : null}

        {!loading && rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white py-10 text-center shadow-sm">
            <p className="text-sm text-slate-500">
              표시할 대회가 없습니다. 권한 부여 상태를 확인해 주세요.
            </p>
          </div>
        ) : null}

        <section className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-slate-900">{row.title}</span>
                  <span className="text-xs text-slate-500">{row.event_date}</span>
                  <Badge variant="outline" className="text-xs">ID {row.id}</Badge>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[row.status] ?? "bg-slate-100 text-slate-700"}`}
                >
                  {formatTournamentStatus(row.status)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
                  {isAdmin ? (
                    <>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/tournaments/${row.id}/edit`}>수정</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/tournaments/${row.id}/dashboard`}>대회 현황</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/tournaments/${row.id}/registrations`}>신청자 관리</Link>
                      </Button>
                    </>
                  ) : null}
                  {row.status === "done" ? (
                    <Button size="sm" variant="outline" disabled>
                      라운드 관리 종료
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/tournaments/${row.id}/side-events`}>라운드 관리</Link>
                    </Button>
                  )}
                  {isAdmin ? (
                    <>
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
                      {row.status === "done" ? (
                        <Button size="sm" variant="outline" disabled>
                          라이브 조편성 종료
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/tournaments/${row.id}/draw`}>라이브 조편성</Link>
                        </Button>
                      )}
                    </>
                  ) : (
                    row.status === "done" ? (
                      <Button size="sm" variant="outline" disabled>
                        라이브 조편성 종료
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/t/${row.id}/draw`}>라이브 조편성 시청</Link>
                      </Button>
                    )
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/t/${row.id}/participants`}>참가자 현황</Link>
                  </Button>
                  {row.status === "done" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/t/${row.id}/results`}>결과 보기</Link>
                    </Button>
                  ) : null}
                  {isAdmin && row.status !== "deleted" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void deleteTournament(row.id, row.title, row.status)}
                    >
                      삭제
                    </Button>
                  ) : null}
                </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
