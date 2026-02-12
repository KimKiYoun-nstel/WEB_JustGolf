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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../../components/ui/card";
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
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
          <Card>
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!t) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
          <Card>
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">대회를 찾을 수 없습니다</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        {/* 헤더 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold text-slate-900">
              {t.title}
            </h1>
            <Badge variant="secondary" className="capitalize">
              {formatTournamentStatus(t.status)}
            </Badge>
          </div>
          <p className="text-sm text-slate-500">{t.event_date} · 가입 현황</p>
        </div>

        {/* 통계 */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-slate-200/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">
                  전체 신청
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">
                  {stats.total_count}명
                </p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-blue-900">
                  신청
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-900">
                  {stats.applied_count}명
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-green-900">
                  확정
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-900">
                  {stats.confirmed_count}명
                </p>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-amber-900">
                  대기
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-900">
                  {stats.waitlisted_count}명
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 메시지 */}
        {msg && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {msg}
          </div>
        )}

        {/* 상태 요약 */}
        <Card className="border-slate-200/70">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>신청 상태 요약</CardTitle>
                <CardDescription>
                  승인 단계 없이 상태(신청/확정/대기/취소)만 관리합니다.
                </CardDescription>
              </div>
              <Button asChild variant="outline">
                <Link href={`/admin/tournaments/${tournamentId}/registrations`}>
                  신청자 관리로 이동
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              상태 변경은 신청자 관리 화면에서 처리할 수 있습니다.
            </p>
          </CardContent>
        </Card>

        {/* 전체 신청 목록 */}
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>전체 신청 현황</CardTitle>
            <CardDescription>
              모든 신청자를 확인할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
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
          </CardContent>
        </Card>

        {/* 돌아가기 */}
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/tournaments/${tournamentId}/registrations`}>
              신청자 관리 (상태 변경)
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/tournaments">대회 목록</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
