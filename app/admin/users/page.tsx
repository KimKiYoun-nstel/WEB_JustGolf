"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/auth";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { useToast } from "../../../components/ui/toast";

type ProfileRow = {
  id: string;
  nickname: string;
  email: string | null;
  is_admin: boolean;
  is_approved: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [msg, setMsg] = useState("");
  const [approvalRequired, setApprovalRequired] = useState<boolean | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const { toast } = useToast();

  const userSummary = useMemo(() => {
    const total = rows.length;
    const approved = rows.filter((row) => row.is_approved).length;
    const pending = rows.filter((row) => !row.is_approved).length;
    const admins = rows.filter((row) => row.is_admin).length;
    const emailMissing = rows.filter((row) => !row.email).length;

    return {
      total,
      approved,
      pending,
      admins,
      emailMissing,
    };
  }, [rows]);

  const load = async () => {
    setMsg("");
    setLoading(true);

    const response = await fetch("/api/admin/users");
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        setUnauthorized(true);
      }

      setMsg(`조회 실패: ${data?.error ?? response.statusText}`);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as ProfileRow[]);
    setLoading(false);
  };

  const loadSettings = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "approval_required")
      .single();

    if (error) {
      setApprovalRequired(true);
      setSettingsLoading(false);
      return;
    }

    setApprovalRequired(data?.value ?? true);
    setSettingsLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const checkAdmin = async () => {
      const supabase = createClient();
      const pRes = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!pRes.data?.is_admin) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      await loadSettings();
      await load();
    };

    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  useEffect(() => {
    if (!msg) return;

    const isSuccess = /변경되었습니다|완료|성공/.test(msg);
    const isError = /실패|오류|없습니다|필요/.test(msg);

    toast({
      variant: isSuccess ? "success" : isError ? "error" : "default",
      title: msg,
    });
    setMsg("");
  }, [msg, toast]);

  const updateApproval = async (id: string, approved: boolean) => {
    setMsg("");
    const response = await fetch(`/api/admin/users/${id}/approve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMsg(`승인 변경 실패: ${data?.error ?? response.statusText}`);
      return;
    }

    setMsg(approved ? "승인 완료" : "승인 해제 완료");
    await load();
  };

  const updateAdmin = async (id: string, isAdmin: boolean) => {
    setMsg("");
    const response = await fetch(`/api/admin/users/${id}/set-admin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_admin: isAdmin }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMsg(`권한 변경 실패: ${data?.error ?? response.statusText}`);
      return;
    }

    setMsg(isAdmin ? "관리자로 승격 완료" : "관리자 권한 해제 완료");
    await load();
  };

  const resetPassword = async (id: string, nickname: string) => {
    const nextPassword = window.prompt("새 비밀번호를 입력하세요.");
    if (!nextPassword) return;

    const confirmed = window.confirm(
      `${nickname || "해당 사용자"}의 비밀번호를 변경하시겠습니까?`
    );
    if (!confirmed) return;

    setMsg("");
    const response = await fetch(`/api/admin/users/${id}/reset-password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: nextPassword }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMsg(`비밀번호 초기화 실패: ${data?.error ?? response.statusText}`);
      return;
    }

    setMsg("비밀번호가 초기화되었습니다.");
  };

  const toggleApprovalRequired = async () => {
    if (approvalRequired === null) return;
    const nextValue = !approvalRequired;
    setMsg("");

    const supabase = createClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "approval_required", value: nextValue }, { onConflict: "key" });

    if (error) {
      setMsg(`설정 변경 실패: ${error.message}`);
      return;
    }

    if (nextValue === false) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ is_approved: true })
        .eq("is_approved", false);

      if (updateError) {
        setMsg(`자동 승인 처리 실패: ${updateError.message}`);
        return;
      }
    }

    setApprovalRequired(nextValue);
    setMsg(nextValue ? "승인 기능이 ON으로 변경되었습니다." : "승인 기능이 OFF로 변경되었습니다.");
    await load();
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
        <header className="mb-5 space-y-2">
          <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">ADMIN USERS</p>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">회원 관리</h1>
        </header>
        {loading && (
          <div className="rounded-2xl border border-slate-100 bg-white py-10 text-center shadow-sm">
            <p className="text-sm text-slate-500">로딩중...</p>
          </div>
        )}

        {unauthorized && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6">
            <p className="text-red-700">관리자만 접근할 수 있습니다.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/admin">관리자 대시보드로</Link>
            </Button>
          </div>
        )}

        {!loading && !unauthorized && (
          <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">현재 회원수</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{userSummary.total}명</p>
                </div>
                <div className="rounded-2xl border border-green-200 bg-green-50 p-3">
                  <p className="text-xs font-medium text-green-700">승인 완료</p>
                  <p className="mt-1 text-xl font-bold text-green-900">{userSummary.approved}명</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-700">승인 대기</p>
                  <p className="mt-1 text-xl font-bold text-amber-900">{userSummary.pending}명</p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                  <p className="text-xs font-medium text-indigo-700">관리자</p>
                  <p className="mt-1 text-xl font-bold text-indigo-900">{userSummary.admins}명</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                  <p className="text-xs font-medium text-rose-700">이메일 미기입</p>
                  <p className="mt-1 text-xl font-bold text-rose-900">{userSummary.emailMissing}명</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-800">가입 승인</p>
                  <p className="text-xs text-slate-500">
                    {approvalRequired ? "승인 필요: ON" : "승인 필요: OFF (자동 승인)"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={approvalRequired ? "outline" : "default"}
                  onClick={toggleApprovalRequired}
                  disabled={settingsLoading}
                >
                  {approvalRequired ? "자동 승인 켜기" : "자동 승인 끄기"}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>닉네임</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>권한</TableHead>
                    <TableHead>승인 상태</TableHead>
                    <TableHead>가입일</TableHead>
                    <TableHead className="text-center">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.nickname}
                      </TableCell>
                      <TableCell className="break-all text-sm text-slate-600">
                        {row.email ?? "-"}
                      </TableCell>
                      <TableCell>
                        {row.is_admin ? (
                          <Badge className="bg-slate-900">관리자</Badge>
                        ) : (
                          <Badge variant="outline">일반</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.is_approved ? (
                          <Badge className="bg-green-600">승인됨</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800">
                            승인 대기
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {new Date(row.created_at).toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/users/${row.id}`}>상세보기</Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resetPassword(row.id, row.nickname)}
                          >
                            비밀번호 초기화
                          </Button>
                          {row.is_approved ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateApproval(row.id, false)}
                              disabled={row.is_admin}
                            >
                              승인 해제
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => updateApproval(row.id, true)}
                            >
                              승인
                            </Button>
                          )}
                          
                          {row.is_admin ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateAdmin(row.id, false)}
                            >
                              관리자 해제
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateAdmin(row.id, true)}
                              disabled={!row.is_approved}
                            >
                              관리자 승격
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
          </div>
        )}
      </div>
    </main>
  );
}
