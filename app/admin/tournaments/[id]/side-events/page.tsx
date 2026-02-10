"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import {
  Card,
  CardContent,
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

type SideEvent = {
  id: number;
  tournament_id: number;
  round_type: "pre" | "post";
  title: string;
  tee_time: string | null;
  location: string | null;
  notes: string | null;
  max_participants: number | null;
  status: string;
  meal_option_id: number | null;
  lodging_available: boolean;
  lodging_required: boolean;
};

type SideEventRegistration = {
  id: number;
  user_id: string;
  nickname: string;
  status: "applied" | "confirmed" | "waitlisted" | "canceled";
  memo: string | null;
  meal_selected: boolean | null;
  lodging_selected: boolean | null;
};

type RoundType = "pre" | "post";
type Status = "draft" | "open" | "closed" | "done";

const toInputDateTime = (value: string | null) => {
  if (!value) return "";
  return value.slice(0, 16);
};

export default function AdminSideEventsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [msg, setMsg] = useState("");
  const [sideEvents, setSideEvents] = useState<SideEvent[]>([]);
  const [sideEventRegs, setSideEventRegs] = useState<
    Map<number, SideEventRegistration[]>
  >(new Map());

  // Available meal options
  const [mealOptions, setMealOptions] = useState<Array<{ id: number; name: string }>>([]);

  // New/Edit form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [roundType, setRoundType] = useState<RoundType>("pre");
  const [title, setTitle] = useState("");
  const [teeTime, setTeeTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [status, setStatus] = useState<Status>("draft");
  const [openAt, setOpenAt] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [mealOptionId, setMealOptionId] = useState<string>("");
  const [lodgingAvailable, setLodgingAvailable] = useState(false);
  const [lodgingRequired, setLodgingRequired] = useState(false);

  const friendlyError = (error: { code?: string; message: string }) => {
    if (error.code === "42501") return "권한이 없어요.";
    if (
      error.message.toLowerCase().includes("permission") ||
      error.message.toLowerCase().includes("denied")
    ) {
      return "권한이 없어요.";
    }
    return error.message;
  };

  const loadSideEvents = async () => {
    const supabase = createClient();
    setMsg("");
    setLoading(true);
    try {
      const seRes = await supabase
        .from("side_events")
        .select(
          "id,tournament_id,round_type,title,tee_time,location,notes,max_participants,status,meal_option_id,lodging_available,lodging_required"
        )
        .eq("tournament_id", tournamentId)
        .order("round_type,id", { ascending: true });

      if (seRes.error) {
        setMsg(`라운드 조회 실패: ${friendlyError(seRes.error)}`);
        return;
      }

      setSideEvents((seRes.data ?? []) as SideEvent[]);

      // Load registrations for each side event
      const seRegMap = new Map<number, SideEventRegistration[]>();
      for (const se of (seRes.data ?? []) as SideEvent[]) {
        const serRes = await supabase
          .from("side_event_registrations")
          .select("id,user_id,nickname,status,memo,meal_selected,lodging_selected")
          .eq("side_event_id", se.id)
          .order("id", { ascending: true });

        if (!serRes.error) {
          const filtered = ((serRes.data ?? []) as SideEventRegistration[]).filter(
            (row) => row.status !== "canceled"
          );
          seRegMap.set(se.id, filtered);
        }
      }
      setSideEventRegs(seRegMap);

      // Load meal options for this tournament
      const moRes = await supabase
        .from("meal_options")
        .select("id,name")
        .eq("tournament_id", tournamentId)
        .order("name", { ascending: true });

      if (!moRes.error) {
        setMealOptions((moRes.data ?? []) as Array<{ id: number; name: string }>);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    
    // Auth 로딩이 끝날 때까지 대기
    if (authLoading) return;

    // 로그인되지 않으면 로그인 페이지로
    if (!user?.id) {
      router.push("/login");
      return;
    }

    const checkAdmin = async () => {
      const supabase = createClient();
      // 1. Check if user is admin
      const pRes = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      const isAdmin = pRes.data?.is_admin ?? false;

      // 2. Check if user is round manager for this tournament
      const mgrRes = await supabase
        .from("manager_permissions")
        .select("can_manage_side_events")
        .eq("tournament_id", tournamentId)
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .single();

      const canManageRounds = mgrRes.data?.can_manage_side_events ?? false;

      // Allow access if either admin or round manager
      if (!isAdmin && !canManageRounds) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      await loadSideEvents();
    };

    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, user?.id, authLoading]);

  const resetForm = () => {
    setEditingId(null);
    setRoundType("pre");
    setTitle("");
    setTeeTime("");
    setLocation("");
    setNotes("");
    setMaxParticipants("");
    setStatus("draft");
    setOpenAt("");
    setCloseAt("");
    setMealOptionId("");
    setLodgingAvailable(false);
    setLodgingRequired(false);
  };

  const saveSideEvent = async () => {
    const supabase = createClient();
    setMsg("");

    if (!title.trim()) {
      setMsg("라운드 제목을 입력해줘.");
      return;
    }

    const data = {
      tournament_id: tournamentId,
      round_type: roundType,
      title: title.trim(),
      tee_time: teeTime.trim() || null,
      location: location.trim() || null,
      notes: notes.trim() || null,
      max_participants: maxParticipants ? Number(maxParticipants) : null,
      status,
      open_at: openAt ? new Date(openAt).toISOString() : null,
      close_at: closeAt ? new Date(closeAt).toISOString() : null,
      meal_option_id: mealOptionId ? Number(mealOptionId) : null,
      lodging_available: lodgingAvailable,
      lodging_required: lodgingRequired,
      created_by: user?.id,
    };

    if (editingId) {
      const { error } = await supabase
        .from("side_events")
        .update({
          ...data,
          created_by: undefined, // Don't update created_by on edit
        })
        .eq("id", editingId);

      if (error) {
        setMsg(`수정 실패: ${friendlyError(error)}`);
      } else {
        setMsg("라운드 수정 완료!");
        resetForm();
        await loadSideEvents();
      }
    } else {
      const { error } = await supabase
        .from("side_events")
        .insert([data]);

      if (error) {
        setMsg(`생성 실패: ${friendlyError(error)}`);
      } else {
        setMsg("라운드 생성 완료!");
        resetForm();
        await loadSideEvents();
      }
    }
  };

  const deleteSideEvent = async (id: number) => {
    const supabase = createClient();
    setMsg("");
    if (!confirm("정말 삭제할까? 신청 내역도 함께 삭제됩니다.")) return;

    const { error } = await supabase
      .from("side_events")
      .delete()
      .eq("id", id);

    if (error) {
      setMsg(`삭제 실패: ${friendlyError(error)}`);
    } else {
      setMsg("라운드 삭제 완료!");
      await loadSideEvents();
    }
  };

  const editSideEvent = (se: SideEvent) => {
    setEditingId(se.id);
    setRoundType(se.round_type);
    setTitle(se.title);
    setTeeTime(se.tee_time ?? "");
    setLocation(se.location ?? "");
    setNotes(se.notes ?? "");
    setMaxParticipants(se.max_participants?.toString() ?? "");
    setStatus(se.status as Status);
    setOpenAt("");
    setCloseAt("");
    setMealOptionId(se.meal_option_id?.toString() ?? "");
    setLodgingAvailable(se.lodging_available ?? false);
    setLodgingRequired(se.lodging_required ?? false);
  };

  const renderTriState = (value: boolean | null) => {
    if (value === true) return "참여";
    if (value === false) return "불참";
    return "미정";
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-sm text-slate-500">로딩중...</p>
        </div>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-6 text-red-700">
              <p>관리자만 접근할 수 있습니다.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/admin">관리자 대시보드로</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">
            사전/사후 라운드 관리
          </h1>
          <Button onClick={() => router.back()} variant="ghost">
            뒤로
          </Button>
        </div>

        {msg && (
          <Card className="border-green-200/70 bg-green-50/50">
            <CardContent className="py-3 text-sm text-green-700">{msg}</CardContent>
          </Card>
        )}

        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>
              {editingId ? "라운드 수정" : "새 라운드 추가"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">라운드 유형</label>
                <select
                  value={roundType}
                  onChange={(e) => setRoundType(e.target.value as RoundType)}
                  className="rounded border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="pre">📍 사전</option>
                  <option value="post">📍 사후</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">상태</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className="rounded border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="draft">draft</option>
                  <option value="open">open</option>
                  <option value="closed">closed</option>
                  <option value="done">done</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">제목 *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 화이트 코스 친선전"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Tee Time (선택)</label>
                <Input
                  value={teeTime}
                  onChange={(e) => setTeeTime(e.target.value)}
                  placeholder="예: 08:00"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">위치 (선택)</label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="예: 클럽 흑 금강"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">최대 인원 (선택)</label>
                <Input
                  type="number"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  placeholder="예: 20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">설명 (선택)</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="특별 안내사항"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">신청 오픈 (선택)</label>
                <Input
                  type="datetime-local"
                  value={openAt}
                  onChange={(e) => setOpenAt(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">신청 마감 (선택)</label>
                <Input
                  type="datetime-local"
                  value={closeAt}
                  onChange={(e) => setCloseAt(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">식사 옵션 (선택)</label>
                <select
                  value={mealOptionId}
                  onChange={(e) => setMealOptionId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="">없음</option>
                  {mealOptions.map((mo) => (
                    <option key={mo.id} value={mo.id}>
                      {mo.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  라운드 신청 시 식사를 선택할 수 있게 합니다.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">숙박 (선택)</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={lodgingAvailable}
                      onChange={(e) => setLodgingAvailable(e.target.checked)}
                      className="h-4 w-4"
                    />
                    숙박 가능
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={lodgingRequired}
                      onChange={(e) => setLodgingRequired(e.target.checked)}
                      className="h-4 w-4"
                    />
                    숙박 필수
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  라운드 신청 시 숙박 여부를 선택할 수 있게 합니다.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveSideEvent}>
                {editingId ? "수정" : "생성"}
              </Button>
              {editingId && (
                <Button onClick={resetForm} variant="outline">
                  취소
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {sideEvents.length === 0 ? (
          <Card className="border-slate-200/70">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-slate-500">등록된 라운드가 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sideEvents.map((se) => {
              const seRegs = sideEventRegs.get(se.id) ?? [];
              return (
                <Card key={se.id} className="border-slate-200/70">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>
                        {se.round_type === "pre" ? "📍 사전" : "📍 사후"}{" "}
                        {se.title}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {se.status}
                        </Badge>
                        <Button
                          onClick={() => editSideEvent(se)}
                          size="sm"
                          variant="ghost"
                        >
                          수정
                        </Button>
                        <Button
                          onClick={() => deleteSideEvent(se.id)}
                          size="sm"
                          variant="destructive"
                        >
                          삭제
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 text-sm">
                      <div>
                        <span className="font-medium">Tee Time:</span>{" "}
                        {se.tee_time ?? "-"}
                      </div>
                      <div>
                        <span className="font-medium">Location:</span>{" "}
                        {se.location ?? "-"}
                      </div>
                      <div>
                        <span className="font-medium">Max Participants:</span>{" "}
                        {se.max_participants ?? "-"}
                      </div>
                      {se.notes && (
                        <div>
                          <span className="font-medium">Notes:</span> {se.notes}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="mb-3 font-medium">신청 현황 ({seRegs.length})</h4>
                      {seRegs.length === 0 ? (
                        <p className="text-sm text-slate-500">신청자가 없습니다.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>닉네임</TableHead>
                              <TableHead>상태</TableHead>
                              <TableHead>식사</TableHead>
                              <TableHead>숙박</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {seRegs.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell>{r.nickname}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">
                                    {r.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">
                                    {renderTriState(r.meal_selected)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">
                                    {renderTriState(r.lodging_selected)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
