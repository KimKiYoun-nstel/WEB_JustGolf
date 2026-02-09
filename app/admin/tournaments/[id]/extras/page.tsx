"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Input } from "../../../../../components/ui/input";
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
};

type TournamentExtra = {
  id: number;
  activity_name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

export default function TournamentExtrasPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const { user, loading } = useAuth();
  const [t, setT] = useState<Tournament | null>(null);
  const [extras, setExtras] = useState<TournamentExtra[]>([]);
  const [activityName, setActivityName] = useState("");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const friendlyError = (error: { code?: string; message: string }) => {
    if (error.code === "23505") return "이미 같은 이름의 활동이 있습니다.";
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

  const checkAdmin = async () => {
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

    // 2. 활동 목록
    const extrasRes = await supabase
      .from("tournament_extras")
      .select("id,activity_name,description,display_order,is_active")
      .eq("tournament_id", tournamentId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (extrasRes.error) {
      setMsg(`활동 조회 실패: ${friendlyError(extrasRes.error)}`);
    } else {
      setExtras((extrasRes.data ?? []) as TournamentExtra[]);
    }
  };

  const addActivity = async () => {
    setMsg("");

    const name = activityName.trim();
    if (!name) {
      setMsg("활동명을 입력해주세요");
      return;
    }

    if (extras.length >= 3) {
      setMsg("활동은 최대 3개까지만 등록할 수 있습니다");
      return;
    }

    const nextOrder = extras.length > 0 
      ? Math.max(...extras.map((e) => e.display_order)) + 1 
      : 0;

    const { error } = await supabase.from("tournament_extras").insert({
      tournament_id: tournamentId,
      activity_name: name,
      description: description.trim() || null,
      display_order: nextOrder,
      is_active: true,
    });

    if (error) {
      setMsg(`추가 실패: ${friendlyError(error)}`);
    } else {
      setMsg("활동이 추가되었습니다");
      setActivityName("");
      setDescription("");
      await fetchData();
    }
  };

  const deleteActivity = async (id: number) => {
    setMsg("");

    // is_active를 false로 변경 (soft delete)
    const { error } = await supabase
      .from("tournament_extras")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      setMsg(`삭제 실패: ${friendlyError(error)}`);
    } else {
      setMsg("활동이 삭제되었습니다");
      await fetchData();
    }
  };

  const moveUp = async (id: number) => {
    const idx = extras.findIndex((e) => e.id === id);
    if (idx === 0) return; // 이미 맨 위

    const current = extras[idx];
    const above = extras[idx - 1];

    // 순서 교체
    await supabase
      .from("tournament_extras")
      .update({ display_order: above.display_order })
      .eq("id", current.id);

    await supabase
      .from("tournament_extras")
      .update({ display_order: current.display_order })
      .eq("id", above.id);

    await fetchData();
  };

  const moveDown = async (id: number) => {
    const idx = extras.findIndex((e) => e.id === id);
    if (idx === extras.length - 1) return; // 이미 맨 아래

    const current = extras[idx];
    const below = extras[idx + 1];

    // 순서 교체
    await supabase
      .from("tournament_extras")
      .update({ display_order: below.display_order })
      .eq("id", current.id);

    await supabase
      .from("tournament_extras")
      .update({ display_order: current.display_order })
      .eq("id", below.id);

    await fetchData();
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
          <p className="text-sm text-slate-500">{t.event_date} · 추가 활동 관리</p>
        </div>

        {/* 메시지 */}
        {msg && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {msg}
          </div>
        )}

        {/* 활동 추가 */}
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>새 활동 추가</CardTitle>
            <CardDescription>
              참가자가 선택할 수 있는 활동을 추가합니다 (최대 3개).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">활동명 *</label>
              <Input
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder="예: 와인바우 저녁, 골프존 영상분석"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">설명 (선택)</label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="활동에 대한 간단한 설명"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={addActivity}>활동 추가</Button>
              <Badge variant="outline">
                {extras.length} / 3개 사용 중
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 활동 목록 */}
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>현재 활동 목록</CardTitle>
            <CardDescription>
              순서를 변경하거나 삭제할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {extras.length === 0 ? (
              <p className="text-sm text-slate-500">
                등록된 활동이 없습니다.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>순서</TableHead>
                    <TableHead>활동명</TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extras.map((extra, idx) => (
                    <TableRow key={extra.id}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell>{extra.activity_name}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {extra.description || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => moveUp(extra.id)}
                            size="sm"
                            variant="outline"
                            disabled={idx === 0}
                          >
                            ↑
                          </Button>
                          <Button
                            onClick={() => moveDown(extra.id)}
                            size="sm"
                            variant="outline"
                            disabled={idx === extras.length - 1}
                          >
                            ↓
                          </Button>
                          <Button
                            onClick={() => deleteActivity(extra.id)}
                            size="sm"
                            variant="destructive"
                          >
                            삭제
                          </Button>
                        </div>
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
          <Button asChild variant="ghost">
            <Link href={`/t/${tournamentId}`}>공개 페이지</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
