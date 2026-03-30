"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
import { getTournamentAdminAccess } from "../../../../../lib/tournamentAdminAccess";
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
import { useToast } from "../../../../../components/ui/toast";

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

export default function AdminExtrasPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [extras, setExtras] = useState<TournamentExtra[]>([]);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [msg, setMsg] = useState("");

  const friendlyError = (error: { code?: string; message: string }) => {
    if (error.code === "23505") return "이미 같은 이름의 활동이 있습니다.";
    if (error.code === "42501") return "권한이 없습니다.";
    return error.message;
  };

  const loadData = async () => {
    const supabase = createClient();

    const tRes = await supabase
      .from("tournaments")
      .select("id,title,event_date")
      .eq("id", tournamentId)
      .single();

    if (tRes.error) {
      setMsg(`대회 조회 실패: ${friendlyError(tRes.error)}`);
      setLoading(false);
      return;
    }
    setTournament(tRes.data as Tournament);

    const extrasRes = await supabase
      .from("tournament_extras")
      .select("id,activity_name,description,display_order,is_active")
      .eq("tournament_id", tournamentId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (extrasRes.error) {
      setMsg(`활동 조회 실패: ${friendlyError(extrasRes.error)}`);
      setLoading(false);
      return;
    }

    setExtras((extrasRes.data ?? []) as TournamentExtra[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    if (authLoading) return;

    if (!user?.id) {
      setLoading(false);
      return;
    }

    const checkAccessAndLoad = async () => {
      const supabase = createClient();
      const access = await getTournamentAdminAccess(supabase, user.id, tournamentId);
      if (!access.canManageTournament) {
        setMsg("해당 대회의 관리자 권한이 없습니다.");
        setLoading(false);
        return;
      }

      setHasAccess(true);
      await loadData();
    };

    void checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, authLoading, user?.id]);

  useEffect(() => {
    if (!msg) return;
    const isError = /실패|오류|없습니다|권한/.test(msg);
    toast({
      variant: isError ? "error" : "success",
      title: msg,
    });
    setMsg("");
  }, [msg, toast]);

  const addExtra = async () => {
    const supabase = createClient();
    const activityName = newName.trim();
    if (!activityName) {
      setMsg("활동명을 입력해 주세요.");
      return;
    }

    if (extras.length >= 3) {
      setMsg("활동은 최대 3개까지 등록할 수 있습니다.");
      return;
    }

    const { error } = await supabase.from("tournament_extras").insert({
      tournament_id: tournamentId,
      activity_name: activityName,
      description: newDescription.trim() || null,
      display_order: extras.length + 1,
      is_active: true,
    });

    if (error) {
      setMsg(`활동 등록 실패: ${friendlyError(error)}`);
      return;
    }

    setNewName("");
    setNewDescription("");
    setMsg("활동이 등록되었습니다.");
    await loadData();
  };

  const removeExtra = async (extraId: number) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_soft_delete_tournament_extra", {
      p_extra_id: extraId,
    });

    if (error) {
      setMsg(`활동 삭제 실패: ${friendlyError(error)}`);
      return;
    }

    setMsg("활동이 삭제되었습니다.");
    await loadData();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const supabase = createClient();
    const name = editingName.trim();
    if (!name) {
      setMsg("활동명을 입력해 주세요.");
      return;
    }

    const { error } = await supabase
      .from("tournament_extras")
      .update({
        activity_name: name,
        description: editingDescription.trim() || null,
      })
      .eq("id", editingId);

    if (error) {
      setMsg(`활동 수정 실패: ${friendlyError(error)}`);
      return;
    }

    setEditingId(null);
    setEditingName("");
    setEditingDescription("");
    setMsg("활동이 수정되었습니다.");
    await loadData();
  };

  const moveOrder = async (extraId: number, direction: "up" | "down") => {
    const currentIndex = extras.findIndex((item) => item.id === extraId);
    if (currentIndex < 0) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= extras.length) return;

    const current = extras[currentIndex];
    const target = extras[targetIndex];
    const supabase = createClient();

    const first = await supabase
      .from("tournament_extras")
      .update({ display_order: target.display_order })
      .eq("id", current.id);
    if (first.error) {
      setMsg(`순서 변경 실패: ${friendlyError(first.error)}`);
      return;
    }

    const second = await supabase
      .from("tournament_extras")
      .update({ display_order: current.display_order })
      .eq("id", target.id);
    if (second.error) {
      setMsg(`순서 변경 실패: ${friendlyError(second.error)}`);
      return;
    }

    await loadData();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-6">
          <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩 중...</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-6">
          <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">{msg || "권한 확인 중..."}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">{tournament?.title}</h1>
          <p className="text-sm text-slate-500">{tournament?.event_date} · 추가 활동 관리</p>
        </div>

        <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>추가 활동 등록</CardTitle>
            <CardDescription>대회당 최대 3개의 활동을 등록할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">활동명</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 골프존 스윙 분석"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">설명 (선택)</label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="활동 안내 문구"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => void addExtra()}>활동 추가</Button>
              <Badge variant="outline">{extras.length} / 3 사용 중</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>현재 활동 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {extras.length === 0 ? (
              <p className="text-sm text-slate-500">등록된 활동이 없습니다.</p>
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
                  {extras.map((extra, index) => {
                    const editing = editingId === extra.id;
                    return (
                      <TableRow key={extra.id}>
                        <TableCell>{extra.display_order}</TableCell>
                        <TableCell>
                          {editing ? (
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                            />
                          ) : (
                            extra.activity_name
                          )}
                        </TableCell>
                        <TableCell>
                          {editing ? (
                            <Input
                              value={editingDescription}
                              onChange={(e) => setEditingDescription(e.target.value)}
                            />
                          ) : (
                            extra.description ?? "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void moveOrder(extra.id, "up")}
                              disabled={index === 0}
                            >
                              ↑
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void moveOrder(extra.id, "down")}
                              disabled={index === extras.length - 1}
                            >
                              ↓
                            </Button>
                            {editing ? (
                              <Button size="sm" onClick={() => void saveEdit()}>
                                저장
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingId(extra.id);
                                  setEditingName(extra.activity_name);
                                  setEditingDescription(extra.description ?? "");
                                }}
                              >
                                수정
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void removeExtra(extra.id)}
                            >
                              삭제
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
            <Link href={`/t/${tournamentId}`}>공개 페이지</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="#" onClick={(e) => { e.preventDefault(); router.back(); }}>
              뒤로
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
