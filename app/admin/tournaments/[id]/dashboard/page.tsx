"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
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
  approval_status: string;
  approved_at: string | null;
  created_at: string;
};

type ApprovalStats = {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
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
  const [stats, setStats] = useState<ApprovalStats | null>(null);
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

    // 2. 신청자 목록 조회 (approval_status 포함)
    const rRes = await supabase
      .from("registrations")
      .select(
        "id,user_id,nickname,status,approval_status,approved_at,created_at"
      )
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false });

    if (rRes.error) {
      setMsg(`신청자 조회 실패: ${friendlyError(rRes.error)}`);
      setLoading(false);
      return;
    }

    const regsWithEmail = (rRes.data ?? []) as RegistrationWithProfile[];
    setRegistrations(regsWithEmail);

    // 4. 승인 통계 계산
    const stats: ApprovalStats = {
      pending_count: regsWithEmail.filter((r) => r.approval_status === "pending")
        .length,
      approved_count: regsWithEmail.filter(
        (r) => r.approval_status === "approved"
      ).length,
      rejected_count: regsWithEmail.filter(
        (r) => r.approval_status === "rejected"
      ).length,
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

  const approve = async (registrationId: number) => {
    setProcessingId(registrationId);
    setMsg("");

    const uid = user?.id;
    if (!uid) {
      setMsg("로그인이 필요합니다");
      setProcessingId(null);
      return;
    }

    const { error } = await supabase
      .from("registrations")
      .update({
        approval_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: uid,
      })
      .eq("id", registrationId);

    if (error) {
      setMsg(`승인 실패: ${friendlyError(error)}`);
    } else {
      setMsg("승인되었습니다");
      await fetchData();
    }

    setProcessingId(null);
  };

  const reject = async (registrationId: number) => {
    setProcessingId(registrationId);
    setMsg("");

    const uid = user?.id;
    if (!uid) {
      setMsg("로그인이 필요합니다");
      setProcessingId(null);
      return;
    }

    const { error } = await supabase
      .from("registrations")
      .update({
        approval_status: "rejected",
        approved_at: new Date().toISOString(),
        approved_by: uid,
      })
      .eq("id", registrationId);

    if (error) {
      setMsg(`거절 실패: ${friendlyError(error)}`);
    } else {
      setMsg("거절되었습니다");
      await fetchData();
    }

    setProcessingId(null);
  };

  const approveAll = async () => {
    setMsg("");
    const pendingRegs = registrations.filter(
      (r) => r.approval_status === "pending"
    );

    if (pendingRegs.length === 0) {
      setMsg("승인 대기 중인 신청이 없습니다");
      return;
    }

    const uid = user?.id;
    if (!uid) {
      setMsg("로그인이 필요합니다");
      return;
    }

    const now = new Date().toISOString();

    for (const reg of pendingRegs) {
      await supabase
        .from("registrations")
        .update({
          approval_status: "approved",
          approved_at: now,
          approved_by: uid,
        })
        .eq("id", reg.id);
    }

    setMsg(`${pendingRegs.length}명이 일괄 승인되었습니다`);
    await fetchData();
  };

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

  const pendingRegs = registrations.filter(
    (r) => r.approval_status === "pending"
  );

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
              {t.status}
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

            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-amber-900">
                  승인 대기
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-900">
                  {stats.pending_count}명
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-green-900">
                  승인 완료
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-900">
                  {stats.approved_count}명
                </p>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-red-900">
                  거절
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-900">
                  {stats.rejected_count}명
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

        {/* 승인 대기 섹션 */}
        <Card className="border-slate-200/70">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>승인 대기 ({pendingRegs.length}명)</CardTitle>
                <CardDescription>
                  신청한 사용자를 승인 또는 거절합니다.
                </CardDescription>
              </div>
              {pendingRegs.length > 0 && (
                <Button onClick={approveAll} className="whitespace-nowrap">
                  모두 승인
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pendingRegs.length === 0 ? (
              <p className="text-sm text-slate-500">
                승인 대기 중인 신청이 없습니다.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>닉네임</TableHead>
                      <TableHead>신청일시</TableHead>
                      <TableHead className="text-right">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRegs.map((reg) => (
                      <TableRow key={reg.id}>
                        <TableCell>
                          <span className="font-medium">{reg.nickname}</span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {new Date(reg.created_at).toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={() => approve(reg.id)}
                              size="sm"
                              disabled={processingId === reg.id}
                            >
                              {processingId === reg.id ? "처리중..." : "승인"}
                            </Button>
                            <Button
                              onClick={() => reject(reg.id)}
                              size="sm"
                              variant="destructive"
                              disabled={processingId === reg.id}
                            >
                              {processingId === reg.id ? "처리중..." : "거절"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
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
                    <TableHead>승인 상태</TableHead>
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
                          {reg.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {reg.approval_status === "pending" && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800">
                            승인 대기
                          </Badge>
                        )}
                        {reg.approval_status === "approved" && (
                          <Badge className="bg-green-600">승인</Badge>
                        )}
                        {reg.approval_status === "rejected" && (
                          <Badge variant="destructive">거절</Badge>
                        )}
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
