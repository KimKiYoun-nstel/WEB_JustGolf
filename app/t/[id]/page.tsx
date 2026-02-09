"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/auth";
import { TOURNAMENT_FILES_BUCKET } from "../../../lib/storage";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

type Tournament = {
  id: number;
  title: string;
  event_date: string;
  course_name: string | null;
  location: string | null;
  notes: string | null;
  status: string;
};

type Registration = {
  id: number;
  user_id: string;
  nickname: string;
  status: "applied" | "confirmed" | "waitlisted" | "canceled";
  memo: string | null;
};

type TournamentFile = {
  id: number;
  file_type: "groups" | "notice" | "other";
  file_name: string;
  storage_path: string;
  is_public: boolean;
};

type SideEvent = {
  id: number;
  round_type: "pre" | "post";
  title: string;
  tee_time: string | null;
  location: string | null;
  notes: string | null;
  max_participants: number | null;
  status: string;
};

type SideEventRegistration = {
  id: number;
  user_id: string;
  nickname: string;
  status: "applied" | "confirmed" | "waitlisted" | "canceled";
  memo: string | null;
};

type MealOption = {
  id: number;
  menu_name: string;
  is_active: boolean;
  display_order: number;
};

export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const { user, loading } = useAuth();
  const [me, setMe] = useState<string>("");
  const [t, setT] = useState<Tournament | null>(null);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [files, setFiles] = useState<TournamentFile[]>([]);
  const [sideEvents, setSideEvents] = useState<SideEvent[]>([]);
  const [sideEventRegs, setSideEventRegs] = useState<
    Map<number, SideEventRegistration[]>
  >(new Map());
  const [mealOptions, setMealOptions] = useState<MealOption[]>([]);
  const [nickname, setNickname] = useState("");
  const [profileNickname, setProfileNickname] = useState("");
  const [memo, setMemo] = useState("");
  const [selectedMealId, setSelectedMealId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const friendlyError = (error: { code?: string; message: string }) => {
    if (error.code === "23505") return "이미 신청했습니다.";
    if (error.code === "42501") return "권한이 없어요. 로그인 상태를 확인해줘.";
    if (error.message.toLowerCase().includes("permission")) {
      return "권한이 없어요. 로그인 상태를 확인해줘.";
    }
    return error.message;
  };

  const refresh = async () => {
    setMsg("");
    const uid = user?.id ?? "";
    setMe(uid);

    if (uid) {
      const pRes = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", uid)
        .single();

      if (!pRes.error) {
        const nick = (pRes.data?.nickname ?? "").toString();
        setProfileNickname(nick);
        if (!nickname.trim()) setNickname(nick);
      }
    } else {
      setProfileNickname("");
    }

    const tRes = await supabase
      .from("tournaments")
      .select("id,title,event_date,course_name,location,notes,status")
      .eq("id", tournamentId)
      .single();

    if (tRes.error) {
      setMsg(`대회 조회 실패: ${tRes.error.message}`);
      return;
    }
    setT(tRes.data as Tournament);

    const rRes = await supabase
      .from("registrations")
      .select("id,user_id,nickname,status,memo")
      .eq("tournament_id", tournamentId)
      .order("id", { ascending: true });

    if (rRes.error) setMsg(`신청 현황 조회 실패: ${friendlyError(rRes.error)}`);
    else setRegs((rRes.data ?? []) as Registration[]);

    const fRes = await supabase
      .from("tournament_files")
      .select("id,file_type,file_name,storage_path,is_public")
      .eq("tournament_id", tournamentId)
      .eq("is_public", true)
      .order("id", { ascending: true });

    if (fRes.error) setMsg(`파일 조회 실패: ${friendlyError(fRes.error)}`);
    else setFiles((fRes.data ?? []) as TournamentFile[]);

    // Load side events for this tournament
    const seRes = await supabase
      .from("side_events")
      .select("id,round_type,title,tee_time,location,notes,max_participants,status")
      .eq("tournament_id", tournamentId)
      .order("round_type,id", { ascending: true });

    if (seRes.error)
      setMsg(`라운드 조회 실패: ${friendlyError(seRes.error)}`);
    else {
      setSideEvents((seRes.data ?? []) as SideEvent[]);

      // Load registrations for each side event
      const seRegMap = new Map<number, SideEventRegistration[]>();
      for (const se of (seRes.data ?? []) as SideEvent[]) {
        const serRes = await supabase
          .from("side_event_registrations")
          .select("id,user_id,nickname,status,memo")
          .eq("side_event_id", se.id)
          .order("id", { ascending: true });

        if (!serRes.error) {
          seRegMap.set(se.id, (serRes.data ?? []) as SideEventRegistration[]);
        }
      }
      setSideEventRegs(seRegMap);
    }

    // Load meal options for this tournament
    const mealRes = await supabase
      .from("tournament_meal_options")
      .select("id,menu_name,is_active,display_order")
      .eq("tournament_id", tournamentId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (!mealRes.error) {
      setMealOptions((mealRes.data ?? []) as MealOption[]);
    }
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    if (loading) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, loading, user?.id]);

  const apply = async () => {
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("신청하려면 로그인 필요! (/login)");
      return;
    }
    const nick = nickname.trim() || profileNickname.trim();
    if (!nick) {
      setMsg("닉네임을 입력해줘.");
      return;
    }

    const { error } = await supabase.from("registrations").insert({
      tournament_id: tournamentId,
      user_id: uid,
      nickname: nick,
      memo: memo.trim() || null,
      meal_option_id: selectedMealId,
      status: "applied",
    });

    if (error) setMsg(`신청 실패: ${friendlyError(error)}`);
    else {
      setMsg("신청 완료!");
      await refresh();
    }
  };

  const cancelMine = async () => {
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("로그인 필요");
      return;
    }

    const mine = regs.find((r) => r.user_id === uid);
    if (!mine) {
      setMsg("내 신청 내역이 없어.");
      return;
    }

    const { error } = await supabase
      .from("registrations")
      .update({ status: "canceled" })
      .eq("id", mine.id);

    if (error) setMsg(`취소 실패: ${friendlyError(error)}`);
    else {
      setMsg("취소 완료");
      await refresh();
    }
  };

  const applySideEvent = async (sideEventId: number) => {
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("신청하려면 로그인 필요! (/login)");
      return;
    }
    const nick = nickname.trim() || profileNickname.trim();
    if (!nick) {
      setMsg("닉네임을 입력해줘.");
      return;
    }

    const { error } = await supabase
      .from("side_event_registrations")
      .insert({
        side_event_id: sideEventId,
        user_id: uid,
        nickname: nick,
        memo: memo.trim() || null,
        status: "applied",
      });

    if (error)
      setMsg(
        `라운드 신청 실패: ${friendlyError(error)}`
      );
    else {
      setMsg("라운드 신청 완료!");
      await refresh();
    }
  };

  const cancelSideEventMine = async (sideEventId: number) => {
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("로그인 필요");
      return;
    }

    const regs = sideEventRegs.get(sideEventId) ?? [];
    const mine = regs.find((r) => r.user_id === uid);
    if (!mine) {
      setMsg("이 라운드의 신청 내역이 없어.");
      return;
    }

    const { error } = await supabase
      .from("side_event_registrations")
      .update({ status: "canceled" })
      .eq("id", mine.id);

    if (error) setMsg(`취소 실패: ${friendlyError(error)}`);
    else {
      setMsg("라운드 취소 완료");
      await refresh();
    }
  };

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        {!t ? (
          <Card>
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-slate-200/70">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>{t.title}</span>
                  <Badge variant="secondary" className="capitalize">
                    {t.status}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {t.event_date} · {t.course_name ?? "-"} · {t.location ?? "-"}
                </CardDescription>
              </CardHeader>
              {t.notes && (
                <CardContent>
                  <p className="text-sm text-slate-600">{t.notes}</p>
                </CardContent>
              )}
            </Card>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-slate-200/70">
                <CardHeader>
                  <CardTitle>참가 신청</CardTitle>
                  <CardDescription>
                    현황은 공개(A). 신청은 로그인 필요.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">닉네임</label>
                    <Input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                    />
                    {profileNickname && (
                      <p className="text-xs text-slate-500">
                        기본 닉네임: {profileNickname}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">메모(선택)</label>
                    <Input
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                    />
                  </div>

                  {mealOptions.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">식사 메뉴 선택</label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={selectedMealId ?? ""}
                        onChange={(e) => setSelectedMealId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">선택 안 함</option>
                        {mealOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.menu_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={apply}>신청</Button>
                    <Button onClick={cancelMine} variant="outline">
                      내 신청 취소
                    </Button>
                    <Button onClick={refresh} variant="ghost">
                      새로고침
                    </Button>
                  </div>

                  {msg && <p className="text-sm text-slate-600">{msg}</p>}
                </CardContent>
              </Card>

              <Card className="border-slate-200/70">
                <CardHeader>
                  <CardTitle>참가 현황(공개)</CardTitle>
                  <CardDescription>닉네임과 상태만 노출됩니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>닉네임</TableHead>
                        <TableHead>상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regs.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{r.nickname}</span>
                              {me && r.user_id === me ? (
                                <Badge variant="outline">나</Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {r.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200/70">
              <CardHeader>
                <CardTitle>첨부파일</CardTitle>
                <CardDescription>조편성/안내 파일을 확인하세요.</CardDescription>
              </CardHeader>
              <CardContent>
                {files.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    공개된 파일이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {files.map((file) => {
                      const { data } = supabase.storage
                        .from(TOURNAMENT_FILES_BUCKET)
                        .getPublicUrl(file.storage_path);
                      return (
                        <li
                          key={file.id}
                          className="flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="text-sm">
                            <span className="font-medium">{file.file_name}</span>
                            <span className="text-slate-500">
                              {" "}
                              · {file.file_type}
                            </span>
                          </div>
                          <Button asChild size="sm" variant="outline">
                            <a
                              href={data.publicUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              열기
                            </a>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {sideEvents.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-slate-900">
                  사전/사후 라운드
                </h2>
                {sideEvents.map((se) => {
                  const seRegs = sideEventRegs.get(se.id) ?? [];
                  return (
                    <Card key={se.id} className="border-slate-200/70">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-3">
                          <span>
                            {se.round_type === "pre" ? "📍 사전" : "📍 사후"}{" "}
                            {se.title}
                          </span>
                          <Badge variant="secondary" className="capitalize">
                            {se.status}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {se.tee_time && `${se.tee_time} · `}
                          {se.location ?? "-"}
                          {se.max_participants &&
                            ` · 최대 ${se.max_participants}명`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {se.notes && (
                          <p className="text-sm text-slate-600">{se.notes}</p>
                        )}

                        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                          <div className="space-y-2">
                            <h3 className="font-medium">라운드 신청</h3>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => applySideEvent(se.id)}
                                size="sm"
                              >
                                신청
                              </Button>
                              <Button
                                onClick={() => cancelSideEventMine(se.id)}
                                size="sm"
                                variant="outline"
                              >
                                취소
                              </Button>
                            </div>
                          </div>

                          <div>
                            <h3 className="font-medium">신청 현황(공개)</h3>
                            <Table className="mt-2">
                              <TableHeader>
                                <TableRow>
                                  <TableHead>닉네임</TableHead>
                                  <TableHead>상태</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {seRegs.map((r) => (
                                  <TableRow key={r.id}>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <span>{r.nickname}</span>
                                        {me && r.user_id === me ? (
                                          <Badge variant="outline">나</Badge>
                                        ) : null}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="secondary"
                                        className="capitalize"
                                      >
                                        {r.status}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
