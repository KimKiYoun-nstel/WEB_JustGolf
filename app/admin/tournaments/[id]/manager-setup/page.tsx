"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
import { Button } from "../../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../../components/ui/card";
import { Input } from "../../../../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../components/ui/table";
import { useToast } from "../../../../../components/ui/toast";

type Tournament = {
  id: number;
  title: string;
  event_date: string;
};

type ManagerPermission = {
  id: number;
  user_id: string;
  nickname: string;
  can_manage_side_events: boolean;
  granted_at: string;
  revoked_at: string | null;
};

type UserProfile = {
  id: string;
  nickname: string;
  email: string | null;
};

export default function ManagerSetupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const { user, loading } = useAuth();
  const [t, setT] = useState<Tournament | null>(null);
  const [managers, setManagers] = useState<ManagerPermission[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [msg, setMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  const friendlyError = (error: { code?: string; message: string }) => {
    if (error.code === "23505") return "이미 권한이 부여되었습니다.";
    if (error.code === "42501" || error.message.toLowerCase().includes("permission")) {
      return "권한이 없습니다. 관리자만 접근 가능합니다.";
    }
    return error.message;
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    if (loading) return;

    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, loading, user]);

  useEffect(() => {
    if (!msg) return;

    const isSuccess = /완료|저장|부여되었습니다|해제되었습니다/.test(msg);
    const isError = /실패|오류|없습니다|필요/.test(msg);

    toast({
      variant: isSuccess ? "success" : isError ? "error" : "default",
      title: msg,
    });
    setMsg("");
  }, [msg, toast]);

  const checkAdmin = async () => {
    const supabase = createClient();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!data?.is_admin) {
      setMsg("관리자만 접근할 수 있습니다.");
      return;
    }

    setIsAdmin(true);
    await fetchData();
  };

  const fetchData = async () => {
    const supabase = createClient();
    setMsg("");

    // 1. 토너먼트 정보
    const tRes = await supabase
      .from("tournaments")
      .select("id,title,event_date")
      .eq("id", tournamentId)
      .single();

    if (tRes.error) {
      setMsg(`대회 조회 실패: ${friendlyError(tRes.error)}`);
      return;
    }
    setT(tRes.data as Tournament);

    // 2. 라운드 관리자 목록
    const mgrRes = await supabase
      .from("manager_permissions")
      .select("id,user_id,can_manage_side_events,granted_at,revoked_at")
      .eq("tournament_id", tournamentId)
      .is("revoked_at", null)
      .order("granted_at", { ascending: false });

    if (mgrRes.error) {
      setMsg(`관리자 조회 실패: ${friendlyError(mgrRes.error)}`);
    } else {
      // 각 관리자의 nickname 조회
      const managersWithNick: ManagerPermission[] = [];
      for (const mgr of (mgrRes.data ?? [])) {
        const profileRes = await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", mgr.user_id)
          .single();

        managersWithNick.push({
          ...mgr,
          nickname: profileRes.data?.nickname ?? "Unknown",
        } as ManagerPermission);
      }
      setManagers(managersWithNick);
    }
  };

  const searchUsers = async () => {
    const supabase = createClient();
    setMsg("");
    setSearchResults([]);

    const keyword = searchEmail.trim();
    if (!keyword) {
      setMsg("이메일 또는 닉네임을 입력해주세요");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id,nickname,email")
      .or(`email.ilike.%${keyword}%,nickname.ilike.%${keyword}%`)
      .order("nickname", { ascending: true })
      .limit(20);

    if (error) {
      setMsg(`검색 실패: ${friendlyError(error)}`);
      return;
    }

    setSearchResults((data ?? []) as UserProfile[]);
    if ((data ?? []).length === 0) {
      setMsg("검색 결과가 없습니다.");
    }
  };

  const grantPermission = async (userId: string) => {
    const supabase = createClient();
    setMsg("");

    const granterId = user?.id;
    if (!granterId) {
      setMsg("로그인이 필요합니다");
      return;
    }

    const { error } = await supabase.from("manager_permissions").insert({
      tournament_id: tournamentId,
      user_id: userId,
      can_manage_side_events: true,
      granted_by: granterId,
    });

    if (error) {
      setMsg(`권한 부여 실패: ${friendlyError(error)}`);
    } else {
      setMsg("권한이 부여되었습니다");
      await fetchData();
    }
  };

  const revokePermission = async (managerId: number) => {
    const supabase = createClient();
    setMsg("");

    const revokerId = user?.id;
    if (!revokerId) {
      setMsg("로그인이 필요합니다");
      return;
    }

    const { error } = await supabase
      .from("manager_permissions")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: revokerId,
      })
      .eq("id", managerId);

    if (error) {
      setMsg(`권한 취소 실패: ${friendlyError(error)}`);
    } else {
      setMsg("권한이 취소되었습니다");
      await fetchData();
    }
  };

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
          <Card>
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">{msg || "권한 확인 중..."}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!t) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
          <Card>
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        {/* 헤더 */}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">
            {t.title}
          </h1>
          <p className="text-sm text-slate-500">{t.event_date} · 라운드 관리자 권한</p>
        </div>

        {/* 메시지 */}
        {/* 안내 */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg">ℹ️ 라운드 관리자란?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>
              라운드 관리자는 이 대회의 사전/사후 라운드를 생성하고 관리할 수 있는 권한을 가집니다.
            </p>
            <p>
              이 권한은 이 대회에만 적용되며, 다른 대회에는 영향을 주지 않습니다.
            </p>
            <p className="font-medium text-blue-900">
              권한을 부여하려면: 이메일 또는 닉네임으로 검색 후 선택하세요.
            </p>
          </CardContent>
        </Card>

        {/* 권한 부여 (검색) */}
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>권한 부여</CardTitle>
            <CardDescription>
              이메일 또는 닉네임으로 검색하여 권한을 부여합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">이메일 또는 닉네임</label>
              <Input
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="예: test@example.com 또는 홍길동"
              />
            </div>

            <Button onClick={searchUsers}>검색</Button>

            {searchResults.length > 0 && (
              <div className="overflow-x-auto lg:overflow-x-visible">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>닉네임</TableHead>
                      <TableHead>이메일</TableHead>
                      <TableHead className="text-center">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">
                          {profile.nickname}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {profile.email ?? "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            onClick={() => grantPermission(profile.id)}
                            size="sm"
                            variant="outline"
                          >
                            권한 부여
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 현재 라운드 관리자 목록 */}
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>현재 라운드 관리자</CardTitle>
            <CardDescription>
              이 대회의 라운드를 관리할 수 있는 사용자 목록입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {managers.length === 0 ? (
              <p className="text-sm text-slate-500">
                라운드 관리자가 없습니다.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>닉네임</TableHead>
                    <TableHead>권한</TableHead>
                    <TableHead>부여일시</TableHead>
                    <TableHead className="text-center">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managers.map((mgr) => (
                    <TableRow key={mgr.id}>
                      <TableCell className="font-medium">{mgr.nickname}</TableCell>
                      <TableCell>
                        {mgr.can_manage_side_events ? "라운드 관리" : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {new Date(mgr.granted_at).toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          onClick={() => revokePermission(mgr.id)}
                          size="sm"
                          variant="destructive"
                        >
                          권한 취소
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 돌아가기 */}
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/tournaments">대회 목록</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/tournaments/${tournamentId}/side-events`}>
              라운드 관리
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
