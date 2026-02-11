"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/auth";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

type ProfileRow = {
  id: string;
  nickname: string;
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

  const load = async () => {
    setMsg("");
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id,nickname,is_admin,is_approved,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMsg(`조회 실패: ${error.message}`);
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

  const updateApproval = async (id: string, approved: boolean) => {
    setMsg("");
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: approved })
      .eq("id", id);

    if (error) {
      setMsg(`승인 변경 실패: ${error.message}`);
      return;
    }

    setMsg(approved ? "승인 완료" : "승인 해제 완료");
    await load();
  };

  const updateAdmin = async (id: string, isAdmin: boolean) => {
    setMsg("");
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ is_admin: isAdmin })
      .eq("id", id);

    if (error) {
      setMsg(`권한 변경 실패: ${error.message}`);
      return;
    }

    setMsg(isAdmin ? "관리자로 승격 완료" : "관리자 권한 해제 완료");
    await load();
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
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {loading && (
          <Card className="border-slate-200/70">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        )}

        {unauthorized && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-6 text-red-700">
              <p>관리자만 접근할 수 있습니다.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/admin">관리자 대시보드로</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !unauthorized && (
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>회원 승인 관리</CardTitle>
              <CardDescription>
                신규 가입자의 계정을 승인하거나 보류합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
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
              {msg && <p className="text-sm text-red-600">{msg}</p>}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>닉네임</TableHead>
                    <TableHead>권한</TableHead>
                    <TableHead>승인 상태</TableHead>
                    <TableHead>가입일</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.nickname}
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
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
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
