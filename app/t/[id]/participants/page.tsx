"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../../lib/supabaseClient";
import { useAuth } from "../../../../lib/auth";
import { formatRegistrationStatus, formatTournamentStatus } from "../../../../lib/statusLabels";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { useToast } from "../../../../components/ui/toast";
import { useTableOfContents, type TOCItem } from "../../../../components/TableOfContents";

type Tournament = {
  id: number;
  title: string;
  event_date: string;
  status: string;
};

type Registration = {
  id: number;
  user_id: string | null;              // NULL이면 제3자
  registering_user_id: string;         // 실제 신청한 회원
  nickname: string;
  status: string;
  memo: string | null;
  meal_name: string | null;
  pre_round_preferred: boolean;
  post_round_preferred: boolean;
  carpool_available: boolean;
  carpool_seats: number | null;
  transportation: string | null;
  departure_location: string | null;
  notes: string | null;
  created_at: string;
  activities: string[];
};

type SideEvent = {
  id: number;
  round_type: "pre" | "post";
  title: string;
  tee_time: string | null;
  status: string;
};

type SideEventRegistration = {
  id: number;
  side_event_id: number;
  nickname: string;
  status: string;
  meal_selected: boolean;
  lodging_selected: boolean;
};

type PrizeSupport = {
  id: number;
  supporter_name: string | null;
  item_name: string;
  note: string | null;
  created_at: string;
};

export default function TournamentParticipantsPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);
  const supabase = createClient();

  const { user, loading: authLoading } = useAuth();
  const [t, setT] = useState<Tournament | null>(null);
  const [rows, setRows] = useState<Registration[]>([]);
  const [sideEvents, setSideEvents] = useState<SideEvent[]>([]);
  const [sideEventRegs, setSideEventRegs] = useState<Map<number, SideEventRegistration[]>>(new Map());
  const [prizes, setPrizes] = useState<PrizeSupport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeletedTournament, setIsDeletedTournament] = useState(false);
  const [msg, setMsg] = useState("");
  const { toast } = useToast();
  const hasMyActiveRegistration = rows.some(
    (r) => r.user_id === user?.id && r.status !== "canceled"
  );

  const fetchData = async () => {
    setLoading(true);
    setMsg("");
    setIsDeletedTournament(false);

    const tRes = await supabase
      .from("tournaments")
      .select("id,title,event_date,status")
      .eq("id", tournamentId)
      .single();

    if (tRes.error) {
      setMsg(`대회 조회 실패: ${tRes.error.message}`);
      setLoading(false);
      return;
    }

    const tournament = tRes.data as Tournament;
    if (tournament.status === "deleted") {
      setIsDeletedTournament(true);
      setT(null);
      setRows([]);
      setSideEvents([]);
      setSideEventRegs(new Map());
      setPrizes([]);
      setLoading(false);
      return;
    }

    setT(tournament);

    const rRes = await supabase
      .from("registrations")
      .select(
        "id,user_id,registering_user_id,nickname,status,memo,created_at,pre_round_preferred,post_round_preferred,"
          + "tournament_meal_options(menu_name),"
          + "registration_extras(carpool_available,carpool_seats,transportation,departure_location,notes),"
          + "registration_activity_selections(selected,tournament_extras(activity_name))"
      )
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });

    if (rRes.error) {
      setMsg(`참가자 조회 실패: ${rRes.error.message}`);
      setLoading(false);
      return;
    }

    type RegistrationRow = {
      id: number;
      user_id: string | null;
      registering_user_id: string;
      nickname: string;
      status: string;
      memo: string | null;
      created_at: string;
      pre_round_preferred?: boolean | null;
      post_round_preferred?: boolean | null;
      tournament_meal_options?: { menu_name?: string | null } | null;
      registration_extras?: {
        carpool_available?: boolean | null;
        carpool_seats?: number | null;
        transportation?: string | null;
        departure_location?: string | null;
        notes?: string | null;
      } | null;
      registration_activity_selections?: Array<{
        selected?: boolean | null;
        tournament_extras?: { activity_name?: string | null } | null;
      }> | null;
    };

    const registrationRows = (rRes.data ?? []) as unknown as RegistrationRow[];
    const transformed = registrationRows.map((row) => {
      const activities = (row.registration_activity_selections ?? [])
        .filter((sel) => sel?.selected)
        .map((sel) => sel?.tournament_extras?.activity_name)
        .filter((name): name is string => Boolean(name));

      return {
      id: row.id,
      user_id: row.user_id,
      registering_user_id: row.registering_user_id,
      nickname: row.nickname,
      status: row.status,
      memo: row.memo ?? null,
      meal_name: row.tournament_meal_options?.menu_name ?? null,
      pre_round_preferred: row.pre_round_preferred ?? false,
      post_round_preferred: row.post_round_preferred ?? false,
      carpool_available: row.registration_extras?.carpool_available ?? false,
      carpool_seats: row.registration_extras?.carpool_seats ?? null,
      transportation: row.registration_extras?.transportation ?? null,
      departure_location: row.registration_extras?.departure_location ?? null,
      notes: row.registration_extras?.notes ?? null,
      created_at: row.created_at,
      activities: activities as string[],
      };
    });

    setRows(transformed as Registration[]);

    // Load side events
    const seRes = await supabase
      .from("side_events")
      .select("id,round_type,title,tee_time,status")
      .eq("tournament_id", tournamentId)
      .order("round_type,id", { ascending: true });

    if (!seRes.error) {
      const sideEvents = (seRes.data ?? []) as SideEvent[];
      setSideEvents(sideEvents);

      const seRegMap = new Map<number, SideEventRegistration[]>();
      const sideEventIds = sideEvents.map((se) => se.id);

      if (sideEventIds.length > 0) {
        const serRes = await supabase
          .from("side_event_registrations")
          .select("id,side_event_id,nickname,status,meal_selected,lodging_selected")
          .in("side_event_id", sideEventIds)
          .neq("status", "canceled")
          .order("side_event_id", { ascending: true })
          .order("id", { ascending: true });

        if (!serRes.error) {
          for (const row of (serRes.data ?? []) as SideEventRegistration[]) {
            const bucket = seRegMap.get(row.side_event_id) ?? [];
            bucket.push(row);
            seRegMap.set(row.side_event_id, bucket);
          }
        }
      }

      setSideEventRegs(seRegMap);
    }

    // Load prize supports
    const prizeRes = await supabase
      .from("tournament_prize_supports")
      .select("id,item_name,note,created_at,supporter_nickname")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });

    if (!prizeRes.error) {
      type PrizeRow = {
        id: number;
        supporter_nickname?: string | null;
        item_name: string;
        note?: string | null;
        created_at: string;
      };
      const mapped = ((prizeRes.data ?? []) as unknown as PrizeRow[]).map((row) => ({
        id: row.id,
        supporter_name: row.supporter_nickname ?? null,
        item_name: row.item_name,
        note: row.note ?? null,
        created_at: row.created_at,
      }));
      setPrizes(mapped as PrizeSupport[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    
    // Auth 로딩이 끝날 때까지 대기
    if (authLoading) return;

    // 로그인하지 않았으면 로그인 페이지로
    if (!user?.id) {
      setLoading(false);
      return;
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, user?.id, authLoading]);

  useEffect(() => {
    if (!msg) return;

    toast({ variant: "error", title: msg });
    setMsg("");
  }, [msg, toast]);  // Section anchor items
  const tocItems: TOCItem[] = [
    { id: "registrations-section", label: "참가자 목록" },
    ...(sideEvents.length > 0 ? [{ id: "side-events-section", label: "라운드" }] : []),
    ...(prizes.length > 0 ? [{ id: "prizes-section", label: "경품" }] : []),
    { id: "groups-section", label: "조편성" },
  ];

  const activeSection = useTableOfContents(tocItems.map((item) => item.id));
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.scrollY - 138;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, []);

  return (
    <main className="min-h-screen bg-slate-50/70">
      <section className="sticky top-16 z-30 border-b border-slate-200/70 bg-slate-50/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                참가자 현황
              </p>
              <h1 className="truncate text-2xl font-semibold text-slate-900">
                {t?.title ?? "대회"}
              </h1>
              {t ? <p className="text-xs text-slate-500">{t.event_date}</p> : null}
            </div>
            {t ? (
              <Badge variant="secondary" className="capitalize">
                {formatTournamentStatus(t.status)}
              </Badge>
            ) : null}
          </div>
          {t ? (
            <nav className="flex flex-wrap items-center gap-1" aria-label="페이지 목차">
              {tocItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeSection === item.id
                      ? "border-sky-300 bg-sky-100 text-sky-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          ) : null}
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
        {(loading || authLoading) && (
          <Card className="border-slate-200/70">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        )}

        {!authLoading && !user && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-10">
              <p className="text-sm text-red-700 mb-4">이 페이지는 로그인이 필요합니다.</p>
              <Button asChild variant="default">
                <Link href="/login">로그인하기</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && isDeletedTournament && user && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-10">
              <p className="mb-4 text-sm text-red-700">삭제된 대회는 접근할 수 없습니다.</p>
              <Button asChild variant="outline">
                <Link href="/tournaments">대회 목록으로</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !isDeletedTournament && !t && user && (
          <Card className="border-slate-200/70">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">대회를 찾을 수 없습니다.</p>
            </CardContent>
          </Card>
        )}

        {!loading && !isDeletedTournament && t && user && (
          <>
            <Card id="registrations-section" className="border-slate-200/70">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>참가자 목록</CardTitle>
                    <CardDescription>
                      신청 정보가 최대한 공개됩니다.
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-sm text-slate-500">총 신청</div>
                    <div className="text-2xl font-bold text-slate-900">{rows.length}명</div>
                    <div className="flex gap-2 text-xs">
                      <span className="text-green-700">
                        확정 {rows.filter((r) => r.status === "approved").length}
                      </span>
                      <span className="text-blue-700">
                        신청 {rows.filter((r) => r.status === "applied").length}
                      </span>
                      <span className="text-yellow-700">
                        대기 {rows.filter((r) => r.status === "waitlisted").length}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {rows.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    아직 참가자가 없습니다.
                  </p>
                ) : (
                  <div className="overflow-x-auto lg:overflow-x-visible">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">닉네임</TableHead>
                          <TableHead className="whitespace-nowrap">구분</TableHead>
                          <TableHead className="whitespace-nowrap">상태</TableHead>
                          <TableHead className="whitespace-nowrap">식사</TableHead>
                          <TableHead className="whitespace-nowrap">활동</TableHead>
                          <TableHead className="whitespace-nowrap">라운드 희망</TableHead>
                          <TableHead className="whitespace-nowrap">카풀</TableHead>
                          <TableHead className="whitespace-nowrap">이동/출발지</TableHead>
                          <TableHead className="whitespace-nowrap">비고</TableHead>
                          <TableHead className="whitespace-nowrap">메모</TableHead>
                          <TableHead className="whitespace-nowrap">신청일시</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{r.nickname}</span>
                                {user?.id && r.user_id === user.id ? (
                                  <Badge variant="outline">나</Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              {r.user_id ? (
                                <Badge variant="outline" className="bg-slate-50 text-slate-700">
                                  회원
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                  제3자
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">
                                {formatRegistrationStatus(r.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {r.meal_name ?? "-"}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {r.activities.length > 0
                                ? r.activities.slice(0, 3).join(", ")
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {r.pre_round_preferred || r.post_round_preferred ? (
                                <div className="flex flex-wrap gap-1">
                                  {r.pre_round_preferred && (
                                    <Badge variant="outline" className="text-xs">사전 희망</Badge>
                                  )}
                                  {r.post_round_preferred && (
                                    <Badge variant="outline" className="text-xs">사후 희망</Badge>
                                  )}
                                </div>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {r.carpool_available
                                ? `${r.carpool_seats ?? 0}석`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {r.transportation || r.departure_location
                                ? `${r.transportation ?? "-"} / ${r.departure_location ?? "-"}`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {r.notes ?? "-"}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {r.memo ?? "-"}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {new Date(r.created_at).toLocaleString("ko-KR")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {sideEvents.length > 0 && (
              <Card id="side-events-section" className="border-slate-200/70">
                <CardHeader>
                  <CardTitle>사전/사후 라운드 참가자 현황</CardTitle>
                  <CardDescription>
                    각 라운드별 신청 현황입니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {sideEvents.map((se) => {
                    const regs = sideEventRegs.get(se.id) ?? [];
                    return (
                      <div key={se.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-slate-900">
                            [{se.round_type === "pre" ? "사전" : "사후"}] {se.title}
                          </h3>
                          <Badge variant="outline">{regs.length}명</Badge>
                        </div>
                        {regs.length === 0 ? (
                          <p className="text-sm text-slate-500">신청자가 없습니다.</p>
                        ) : (
                          <div className="overflow-x-auto lg:overflow-x-visible">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="whitespace-nowrap">닉네임</TableHead>
                                  <TableHead className="whitespace-nowrap">상태</TableHead>
                                  <TableHead className="whitespace-nowrap">식사</TableHead>
                                  <TableHead className="whitespace-nowrap">숙박</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {regs.map((r) => (
                                  <TableRow key={r.id}>
                                    <TableCell>{r.nickname}</TableCell>
                                    <TableCell>
                                      <Badge variant="secondary">
                                        {formatRegistrationStatus(r.status)}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">
                                      {r.meal_selected === null ? "미정" : r.meal_selected ? "참여" : "불참"}
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">
                                      {r.lodging_selected === null ? "미정" : r.lodging_selected ? "참여" : "불참"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            <Card id="prizes-section" className="border-slate-200/70">
              <CardHeader>
                <CardTitle>경품 지원 현황</CardTitle>
                <CardDescription>
                  참가자분들이 제공한 경품 목록입니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {prizes.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    아직 등록된 경품이 없습니다.
                  </p>
                ) : (
                  <div className="overflow-x-auto lg:overflow-x-visible">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">지원자</TableHead>
                          <TableHead className="whitespace-nowrap">경품명</TableHead>
                          <TableHead className="whitespace-nowrap">비고</TableHead>
                          <TableHead className="whitespace-nowrap">등록일</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {prizes.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.supporter_name ?? "익명"}</TableCell>
                            <TableCell>{p.item_name}</TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {p.note ?? "-"}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {new Date(p.created_at).toLocaleDateString("ko-KR")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card id="groups-section" className="border-slate-200/70">
              <CardHeader>
                <CardTitle>조편성</CardTitle>
                <CardDescription>공개된 조편성을 확인하세요.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href={`/t/${tournamentId}/groups`}>조편성 보기</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/t/${tournamentId}/draw`}>라이브 조편성</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              {user && (
                <Button asChild>
                  <Link href={`/t/${tournamentId}`}>
                    {hasMyActiveRegistration ? "참가 정보 수정" : "참가 신청"}
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/tournaments">대회 목록</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
