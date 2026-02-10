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
