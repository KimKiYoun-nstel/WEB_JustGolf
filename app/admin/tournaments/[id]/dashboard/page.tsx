"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
import { formatRegistrationStatus, formatTournamentStatus } from "../../../../../lib/statusLabels";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../components/ui/table";

type Tournament = {
  id: number;
  title: string;
  event_date: string;
  status: string;
};

type RegistrationWithProfile = {
  id: number;
  user_id: string;
  nickname: string;
  status: string;
  created_at: string;
};

type StatusStats = {
  applied_count: number;
  confirmed_count: number;
  waitlisted_count: number;
  canceled_count: number;
  total_count: number;
};

export default function TournamentDashboardPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const { user, loading } = useAuth();
  const [t, setT] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<
    RegistrationWithProfile[]
  >([]);
  const [stats, setStats] = useState<StatusStats | null>(null);
  const [loading_, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  const friendlyError = (error: { code?: string; message: string }) => {
    if (error.code === "FORBIDDEN")
      return "권한이 없습니다. 관리자만 접근 가능합니다.";
    if (error.message.toLowerCase().includes("permission")) {
      return "권한이 없습니다.";
    }
    return error.message;
  };

  const fetchData = async () => {
    const supabase = createClient();
    setLoading(true);
    setMsg("");

    // 1. 토너먼트 정보 조회
    const tRes = await supabase
      .from("tournaments")
      .select("id,title,event_date,status")
      .eq("id", tournamentId)
      .single();

    if (tRes.error) {
      setMsg(`대회 조회 실패: ${friendlyError(tRes.error)}`);
      setLoading(false);
      return;
    }
    setT(tRes.data as Tournament);

    // 2. 신청자 목록 조회
    const rRes = await supabase
      .from("registrations")
      .select("id,user_id,nickname,status,created_at")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false });

    if (rRes.error) {
      setMsg(`신청자 조회 실패: ${friendlyError(rRes.error)}`);
      setLoading(false);
      return;
    }

    const regsWithEmail = (rRes.data ?? []) as RegistrationWithProfile[];
    setRegistrations(regsWithEmail);

    // 3. 신청 상태 통계
    const stats: StatusStats = {
      applied_count: regsWithEmail.filter((r) => r.status === "applied").length,
      confirmed_count: regsWithEmail.filter((r) => r.status === "approved")
        .length,
      waitlisted_count: regsWithEmail.filter((r) => r.status === "waitlisted")
        .length,
      canceled_count: regsWithEmail.filter((r) => r.status === "canceled")
        .length,
      total_count: regsWithEmail.length,
    };
    setStats(stats);
    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    if (loading) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, loading]);


  if (loading_) {
    return (
      <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 md:px-6">
          <div className="rounded-2xl border border-slate-100 bg-white py-10 text-center shadow-sm">
            <p className="text-sm text-slate-500">로딩중...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!t) {
    return (
      <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 md:px-6">
          <div className="rounded-2xl border border-slate-100 bg-white py-10 text-center shadow-sm">
            <p className="text-sm text-slate-500">대회를 찾을 수 없습니다</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 md:px-6">
        {/* 헤더 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
              {t.title}
            </h1>
            <Badge variant="secondary" className="capitalize">
              {formatTournamentStatus(t.status)}
            </Badge>
          </div>
          <p className="text-sm text-slate-500">{t.event_date} · 가입 현황</p>
        </div>

        {/* 통계 — flat compact 카드 */}
        {stats && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-medium text-slate-500">전체 신청</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total_count}명</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-medium text-blue-700">신청</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{stats.applied_count}명</p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-medium text-green-700">확정</p>
              <p className="mt-1 text-2xl font-bold text-green-900">{stats.confirmed_count}명</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-700">대기</p>
              <p className="mt-1 text-2xl font-bold text-amber-900">{stats.waitlisted_count}명</p>
            </div>
          </div>
        )}

        {/* 메시지 */}
        {msg && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {msg}
          </div>
        )}

        {/* 상태 요약 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">신청 상태 요약</p>
              <p className="mt-0.5 text-xs text-slate-500">승인 단계 없이 상태(신청/확정/대기/취소)만 관리합니다.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/tournaments/${tournamentId}/registrations`}>
                신청자 관리로 이동
              </Link>
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            상태 변경은 신청자 관리 화면에서 처리할 수 있습니다.
          </p>
        </div>

        {/* 전체 신청 목록 */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">전체 신청 현황</p>
            <p className="text-xs text-slate-500">모든 신청자를 확인할 수 있습니다.</p>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[480px]">
              <TableHeader>
                <TableRow>
                  <TableHead>닉네임</TableHead>
                  <TableHead>참가 상태</TableHead>
                  <TableHead>신청일시</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium">
                      {reg.nickname}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {formatRegistrationStatus(reg.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {new Date(reg.created_at).toLocaleString("ko-KR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 돌아가기 */}
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/tournaments/${tournamentId}/registrations`}>
              신청자 관리 (상태 변경)
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/tournaments">대회 목록</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
