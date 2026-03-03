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
    if (error.code === "23505") return "이미 권한이 부여된 사용자입니다.";
    if (error.code === "42501" || error.message.toLowerCase().includes("permission")) {
      return "권한이 없습니다. 관리자만 접근 가능합니다.";
    }
    return error.message;
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    if (loading) return;
    void checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, loading, user]);

  useEffect(() => {
    if (!msg) return;
    const isSuccess = /(완료|부여|취소)/.test(msg);
    const isError = /(실패|오류|없습니다|필요)/.test(msg);

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

    const mgrRes = await supabase
      .from("manager_permissions")
      .select("id,user_id,can_manage_side_events,granted_at,revoked_at")
      .eq("tournament_id", tournamentId)
      .is("revoked_at", null)
      .order("granted_at", { ascending: false });

    if (mgrRes.error) {
      setMsg(`관리자 조회 실패: ${friendlyError(mgrRes.error)}`);
      return;
    }

    const mgrRows = (mgrRes.data ?? []) as Array<Omit<ManagerPermission, "nickname">>;
    const userIds = mgrRows.map((mgr) => mgr.user_id);
    const nicknameMap = new Map<string, string>();

    if (userIds.length > 0) {
      const profileRes = await supabase
        .from("profiles")
        .select("id,nickname")
        .in("id", userIds);

      if (!profileRes.error && profileRes.data) {
        for (const profile of profileRes.data as Array<{ id: string; nickname: string | null }>) {
          nicknameMap.set(profile.id, profile.nickname ?? "Unknown");
        }
      }
    }

    const managersWithNick = mgrRows.map((mgr) => ({
      ...mgr,
      nickname: nicknameMap.get(mgr.user_id) ?? "Unknown",
    })) as ManagerPermission[];

    setManagers(managersWithNick);
  };

  const searchUsers = async () => {
    const supabase = createClient();
    setMsg("");
    setSearchResults([]);

    const keyword = searchEmail.trim();
    if (!keyword) {
      setMsg("이메일 또는 닉네임을 입력해 주세요.");
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
      setMsg("로그인이 필요합니다.");
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
      return;
    }

    setMsg("권한이 부여되었습니다.");
    await fetchData();
  };

  const revokePermission = async (managerId: number) => {
    const supabase = createClient();
    setMsg("");

    const revokerId = user?.id;
    if (!revokerId) {
      setMsg("로그인이 필요합니다.");
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
      return;
    }

    setMsg("권한이 취소되었습니다.");
    await fetchData();
  };

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#F2F4F7] pb-24 text-slate-800">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-5 px-3 py-8 md:px-4 lg:px-6">
          <Card className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
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
      <main className="min-h-screen bg-[#F2F4F7] pb-24 text-slate-800">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-5 px-3 py-8 md:px-4 lg:px-6">
          <Card className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩 중...</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F4F7] pb-24 text-slate-800">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-5 px-3 py-8 md:px-4 lg:px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">{t.title}</h1>
          <p className="text-sm text-slate-500">{t.event_date} · 라운드 관리자 권한</p>
        </div>

        <Card className="rounded-[28px] border border-blue-200 bg-blue-50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">라운드 관리자 안내</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>권한이 부여된 사용자는 해당 대회의 라운드를 생성하고 운영할 수 있습니다.</p>
            <p>권한은 현재 대회에만 적용되며, 다른 대회에는 영향이 없습니다.</p>
            <p className="font-medium text-blue-900">
              권한을 부여하려면 이메일 또는 닉네임으로 사용자를 검색하세요.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>권한 부여</CardTitle>
            <CardDescription>
              이메일 또는 닉네임으로 사용자를 검색한 뒤 라운드 관리자 권한을 부여합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">이메일 또는 닉네임</label>
              <Input
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="h-11 rounded-2xl border-slate-200 bg-slate-50"
                placeholder="예: test@example.com 또는 닉네임"
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
                        <TableCell className="font-medium">{profile.nickname}</TableCell>
                        <TableCell className="text-sm text-slate-600">{profile.email ?? "-"}</TableCell>
                        <TableCell className="text-center">
                          <Button onClick={() => grantPermission(profile.id)} size="sm" variant="outline">
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

        <Card className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>현재 라운드 관리자</CardTitle>
            <CardDescription>이 대회의 라운드를 관리할 수 있는 사용자 목록입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {managers.length === 0 ? (
              <p className="text-sm text-slate-500">라운드 관리자가 없습니다.</p>
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
                      <TableCell>{mgr.can_manage_side_events ? "라운드 관리" : "-"}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {new Date(mgr.granted_at).toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button onClick={() => revokePermission(mgr.id)} size="sm" variant="destructive">
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

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/tournaments">대회 목록</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/tournaments/${tournamentId}/side-events`}>라운드 관리</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
