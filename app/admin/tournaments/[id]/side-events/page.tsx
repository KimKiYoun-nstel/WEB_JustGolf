"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
import { getTournamentAdminAccess } from "../../../../../lib/tournamentAdminAccess";
import { formatRegistrationStatus, formatTournamentStatus } from "../../../../../lib/statusLabels";
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
import { useToast } from "../../../../../components/ui/toast";
import { useTableOfContents, type TOCItem } from "../../../../../components/TableOfContents";

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
  open_at: string | null;
  close_at: string | null;
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

type RoundPreferenceSummary = {
  prePreferred: number;
  postPreferred: number;
  anyPreferred: number;
};

type SideEventRegistrationRow = SideEventRegistration & {
  side_event_id: number;
};

type RoundType = "pre" | "post";
type Status = "draft" | "open" | "closed" | "done";

const SIDE_EVENT_REGISTRATION_STATUSES: SideEventRegistration["status"][] = [
  "applied",
  "confirmed",
  "waitlisted",
  "canceled",
];

type SideEventStatusSummary = Record<SideEventRegistration["status"], number>;

const createEmptySideEventStatusSummary = (): SideEventStatusSummary => ({
  applied: 0,
  confirmed: 0,
  waitlisted: 0,
  canceled: 0,
});

const createEmptyRoundPreferenceSummary = (): RoundPreferenceSummary => ({
  prePreferred: 0,
  postPreferred: 0,
  anyPreferred: 0,
});

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
  const { toast } = useToast();
  const [sideEvents, setSideEvents] = useState<SideEvent[]>([]);
  const [sideEventRegs, setSideEventRegs] = useState<
    Map<number, SideEventRegistration[]>
  >(new Map());
  const [roundPreferenceSummary, setRoundPreferenceSummary] = useState<RoundPreferenceSummary>(
    createEmptyRoundPreferenceSummary()
  );
  const [updatingRegistrationId, setUpdatingRegistrationId] = useState<number | null>(null);

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
          "id,tournament_id,round_type,title,tee_time,location,notes,max_participants,status,open_at,close_at,meal_option_id,lodging_available,lodging_required"
        )
        .eq("tournament_id", tournamentId)
        .order("round_type,id", { ascending: true });

      if (seRes.error) {
        setMsg(`라운드 조회 실패: ${friendlyError(seRes.error)}`);
        return;
      }

      const sideEvents = (seRes.data ?? []) as SideEvent[];
      setSideEvents(sideEvents);

      const sideEventIds = sideEvents.map((sideEvent) => sideEvent.id);
      const sideEventRegistrationsPromise =
        sideEventIds.length > 0
          ? supabase
              .from("side_event_registrations")
              .select("id,side_event_id,user_id,nickname,status,memo,meal_selected,lodging_selected")
              .in("side_event_id", sideEventIds)
              .order("side_event_id", { ascending: true })
              .order("id", { ascending: true })
          : Promise.resolve({
              data: [] as SideEventRegistrationRow[],
              error: null,
            });

      const [serRes, roundPreferenceRes, moRes] = await Promise.all([
        sideEventRegistrationsPromise,
        supabase.rpc("get_round_preference_counts_by_tournaments", {
          tournament_ids: [tournamentId],
        }),
        supabase
          .from("meal_options")
          .select("id,name")
          .eq("tournament_id", tournamentId)
          .order("name", { ascending: true }),
      ]);

      const seRegMap = new Map<number, SideEventRegistration[]>();
      if (!serRes.error) {
        const registrationRows = (serRes.data ?? []) as SideEventRegistrationRow[];
        registrationRows.forEach((row) => {
          const bucket = seRegMap.get(row.side_event_id) ?? [];
          bucket.push({
            id: row.id,
            user_id: row.user_id,
            nickname: row.nickname,
            status: row.status,
            memo: row.memo,
            meal_selected: row.meal_selected,
            lodging_selected: row.lodging_selected,
          });
          seRegMap.set(row.side_event_id, bucket);
        });
      }
      setSideEventRegs(seRegMap);

      if (!roundPreferenceRes.error && roundPreferenceRes.data && roundPreferenceRes.data.length > 0) {
        const summaryRow = roundPreferenceRes.data[0] as {
          pre_preferred_count?: number | string | null;
          post_preferred_count?: number | string | null;
          any_preferred_count?: number | string | null;
        };
        setRoundPreferenceSummary({
          prePreferred: Number(summaryRow.pre_preferred_count ?? 0),
          postPreferred: Number(summaryRow.post_preferred_count ?? 0),
          anyPreferred: Number(summaryRow.any_preferred_count ?? 0),
        });
      } else {
        setRoundPreferenceSummary(createEmptyRoundPreferenceSummary());
      }

      setMealOptions(
        !moRes.error ? ((moRes.data ?? []) as Array<{ id: number; name: string }>) : []
      );
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

    const checkAccess = async () => {
      const supabase = createClient();
      const access = await getTournamentAdminAccess(supabase, user.id, tournamentId);
      if (!access.canManageSideEvents) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      await loadSideEvents();
    };

    void checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, user?.id, authLoading]);

  useEffect(() => {
    if (!msg) return;

    const isSuccess = /완료|저장|삭제되었습니다/.test(msg);
    const isError = /실패|오류|없습니다|필요/.test(msg);

    toast({
      variant: isSuccess ? "success" : isError ? "error" : "default",
      title: msg,
    });
    setMsg("");
  }, [msg, toast]);

  const resetForm = useCallback(() => {
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
  }, []);

  const saveSideEvent = useCallback(async () => {
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
  }, [tournamentId, roundType, title, teeTime, location, notes, maxParticipants, status, openAt, closeAt, mealOptionId, lodgingAvailable, lodgingRequired, user?.id, resetForm]);

  const deleteSideEvent = useCallback(async (id: number) => {
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
  }, []);

  const updateSideEventRegistrationStatus = async (
    registrationId: number,
    currentStatus: SideEventRegistration["status"],
    nextStatus: SideEventRegistration["status"]
  ) => {
    if (currentStatus === nextStatus) return;

    const supabase = createClient();
    setMsg("");
    setUpdatingRegistrationId(registrationId);

    const { error } = await supabase
      .from("side_event_registrations")
      .update({ status: nextStatus })
      .eq("id", registrationId);

    setUpdatingRegistrationId(null);

    if (error) {
      setMsg(`신청 상태 변경 실패: ${friendlyError(error)}`);
      return;
    }

    setMsg("신청 상태를 변경했습니다.");
    await loadSideEvents();
  };

  const editSideEvent = useCallback((se: SideEvent) => {
    setEditingId(se.id);
    setRoundType(se.round_type);
    setTitle(se.title);
    setTeeTime(se.tee_time ?? "");
    setLocation(se.location ?? "");
    setNotes(se.notes ?? "");
    setMaxParticipants(se.max_participants?.toString() ?? "");
    setStatus(se.status as Status);
    setOpenAt(toInputDateTime(se.open_at));
    setCloseAt(toInputDateTime(se.close_at));
    setMealOptionId(se.meal_option_id?.toString() ?? "");
    setLodgingAvailable(se.lodging_available ?? false);
    setLodgingRequired(se.lodging_required ?? false);
  }, []);

  const renderTriState = useCallback((value: boolean | null) => {
    if (value === true) return "참여";
    if (value === false) return "불참";
    return "미정";
  }, []);

  // 라운드 타입별 그룹화
  const groupedByRoundType = {
    pre: sideEvents.filter(se => se.round_type === "pre"),
    post: sideEvents.filter(se => se.round_type === "post"),
  };

  const sideEventSummary = useMemo(() => {
    let totalActiveRegistrations = 0;
    let preActiveRegistrations = 0;
    let postActiveRegistrations = 0;
    let totalRegistrationHistoryCount = 0;
    const totalPreferredRegistrations = roundPreferenceSummary.anyPreferred;
    const prePreferredRegistrations = roundPreferenceSummary.prePreferred;
    const postPreferredRegistrations = roundPreferenceSummary.postPreferred;

    const totalStatusSummary = createEmptySideEventStatusSummary();
    const preStatusSummary = createEmptySideEventStatusSummary();
    const postStatusSummary = createEmptySideEventStatusSummary();

    const topRounds = sideEvents
      .map((sideEvent) => {
        const regs = sideEventRegs.get(sideEvent.id) ?? [];
        const activeRegistrationCount = regs.filter((row) => row.status !== "canceled").length;

        totalActiveRegistrations += activeRegistrationCount;
        totalRegistrationHistoryCount += regs.length;

        regs.forEach((row) => {
          totalStatusSummary[row.status] += 1;
          if (sideEvent.round_type === "pre") preStatusSummary[row.status] += 1;
          if (sideEvent.round_type === "post") postStatusSummary[row.status] += 1;
        });

        if (sideEvent.round_type === "pre") preActiveRegistrations += activeRegistrationCount;
        if (sideEvent.round_type === "post") postActiveRegistrations += activeRegistrationCount;

        return {
          id: sideEvent.id,
          title: sideEvent.title,
          roundType: sideEvent.round_type,
          registrationCount: activeRegistrationCount,
        };
      })
      .sort((a, b) => b.registrationCount - a.registrationCount)
      .slice(0, 3);

    return {
      totalRounds: sideEvents.length,
      preRounds: groupedByRoundType.pre.length,
      postRounds: groupedByRoundType.post.length,
      totalActiveRegistrations,
      preActiveRegistrations,
      postActiveRegistrations,
      totalRegistrationHistoryCount,
      totalStatusSummary,
      preStatusSummary,
      postStatusSummary,
      totalPreferredRegistrations,
      prePreferredRegistrations,
      postPreferredRegistrations,
      topRounds,
    };
  }, [
    groupedByRoundType.post.length,
    groupedByRoundType.pre.length,
    sideEventRegs,
    sideEvents,
    roundPreferenceSummary,
  ]);

  const mealOptionMap = useMemo(
    () => new Map(mealOptions.map((option) => [option.id, option.name])),
    [mealOptions]
  );

  // TableOfContents 아이템
  const tocItems: TOCItem[] = [
    ...(groupedByRoundType.pre.length > 0 ? [{ id: "pre-round-section", label: "사전 라운드" }] : []),
    ...(groupedByRoundType.post.length > 0 ? [{ id: "post-round-section", label: "사후 라운드" }] : []),
  ];

  const activeSection = useTableOfContents(tocItems.map((item) => item.id));
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.scrollY - 130;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, []);

  const formatDateTime = useCallback((value: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const renderSideEventCard = useCallback(
    (se: SideEvent) => {
      const seRegs = sideEventRegs.get(se.id) ?? [];
      const activeRegistrationCount = seRegs.filter((row) => row.status !== "canceled").length;
      const mealLabel = se.meal_option_id ? mealOptionMap.get(se.meal_option_id) ?? "선택됨" : "없음";

      return (
        <Card key={se.id} className="rounded-[30px] border border-slate-100 bg-white shadow-sm">
          <CardHeader className="gap-4 border-b border-slate-100">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{se.title}</CardTitle>
                  <Badge variant="secondary" className="capitalize">
                    {formatTournamentStatus(se.status)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                    활성 신청 {activeRegistrationCount}명
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                    신청 이력 {seRegs.length}건
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                    식사 {mealLabel}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                    숙박 {se.lodging_available ? (se.lodging_required ? "필수" : "가능") : "없음"}
                  </span>
                </div>
              </div>
              <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
                <Button onClick={() => editSideEvent(se)} size="sm" variant="outline" className="flex-1 md:flex-none">
                  수정
                </Button>
                <Button onClick={() => deleteSideEvent(se.id)} size="sm" variant="destructive" className="flex-1 md:flex-none">
                  삭제
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5 md:p-6">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-xs font-medium text-slate-500">티타임</dt>
                <dd className="mt-1 font-medium text-slate-800">{se.tee_time ?? "-"}</dd>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-xs font-medium text-slate-500">위치</dt>
                <dd className="mt-1 font-medium text-slate-800">{se.location ?? "-"}</dd>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-xs font-medium text-slate-500">최대 인원</dt>
                <dd className="mt-1 font-medium text-slate-800">{se.max_participants ?? "-"}</dd>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-xs font-medium text-slate-500">신청 오픈/마감</dt>
                <dd className="mt-1 font-medium text-slate-800">
                  {formatDateTime(se.open_at)} / {formatDateTime(se.close_at)}
                </dd>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">설명</dt>
                <dd className="mt-1 font-medium text-slate-800">{se.notes ?? "-"}</dd>
              </div>
            </dl>

            <div>
              <h4 className="mb-3 font-medium">신청 현황 ({seRegs.length})</h4>
              {seRegs.length === 0 ? (
                <p className="text-sm text-slate-500">신청자가 없습니다.</p>
              ) : (
                <>
                  <div className="space-y-2 md:hidden">
                    {seRegs.map((r) => (
                      <article key={r.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{r.nickname}</p>
                          <Badge variant="secondary">{formatRegistrationStatus(r.status)}</Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                          <p>식사: {renderTriState(r.meal_selected)}</p>
                          <p>숙박: {renderTriState(r.lodging_selected)}</p>
                          <p className="col-span-2">메모: {r.memo ?? "-"}</p>
                        </div>
                        <div className="mt-3 space-y-1">
                          <label className="text-xs font-medium text-slate-600">상태 변경</label>
                          <select
                            value={r.status}
                            onChange={(event) =>
                              void updateSideEventRegistrationStatus(
                                r.id,
                                r.status,
                                event.target.value as SideEventRegistration["status"]
                              )
                            }
                            disabled={updatingRegistrationId === r.id}
                            className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs"
                          >
                            {SIDE_EVENT_REGISTRATION_STATUSES.map((optionStatus) => (
                              <option key={optionStatus} value={optionStatus}>
                                {formatRegistrationStatus(optionStatus)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>닉네임</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>상태 변경</TableHead>
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
                                {formatRegistrationStatus(r.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <select
                                value={r.status}
                                onChange={(event) =>
                                  void updateSideEventRegistrationStatus(
                                    r.id,
                                    r.status,
                                    event.target.value as SideEventRegistration["status"]
                                  )
                                }
                                disabled={updatingRegistrationId === r.id}
                                className="h-9 w-full min-w-[120px] rounded-xl border border-slate-200 bg-white px-2 text-sm"
                              >
                                {SIDE_EVENT_REGISTRATION_STATUSES.map((optionStatus) => (
                                  <option key={optionStatus} value={optionStatus}>
                                    {formatRegistrationStatus(optionStatus)}
                                  </option>
                                ))}
                              </select>
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
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      );
    },
    [
      deleteSideEvent,
      editSideEvent,
      formatDateTime,
      mealOptionMap,
      renderTriState,
      sideEventRegs,
      updateSideEventRegistrationStatus,
      updatingRegistrationId,
    ]
  );

  const renderRoundSection = useCallback(
    (sectionId: string, title: string, events: SideEvent[]) => {
      if (events.length === 0) return null;
      return (
        <section id={sectionId} className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          {events.map((se) => renderSideEventCard(se))}
        </section>
      );
    },
    [renderSideEventCard]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F2F4F7]">
        <div className="mx-auto max-w-7xl px-3 md:px-4 lg:px-6 py-8">
          <p className="text-sm text-slate-500">로딩중...</p>
        </div>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="min-h-screen bg-[#F2F4F7]">
        <div className="mx-auto max-w-7xl px-3 md:px-4 lg:px-6 py-8">
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
    <main className="min-h-screen bg-[#F2F4F7] pb-24 text-slate-800">
      <section className="border-b border-slate-100 bg-white px-3 pb-6 pt-8 md:px-4 lg:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">ADMIN SIDE EVENTS</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
              사전/사후 라운드 관리
            </h1>
            <p className="mt-2 text-sm text-slate-500">라운드 생성, 수정, 신청 현황을 통합 관리합니다.</p>
          </div>
          <Button onClick={() => router.back()} variant="secondary" className="w-full md:w-auto">
            뒤로
          </Button>
        </div>
      </section>

      <section className="border-b border-slate-100 bg-[#F2F4F7] px-3 py-6 md:px-4 lg:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <Card className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle>라운드 요약</CardTitle>
              <p className="text-sm text-slate-500">사전/사후 라운드 구성과 신청 현황을 빠르게 확인합니다.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">전체 라운드</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{sideEventSummary.totalRounds}개</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-800">사전/사후 라운드</p>
                  <p className="mt-1 text-xl font-bold text-amber-900">
                    {sideEventSummary.preRounds}/{sideEventSummary.postRounds}개
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    활성 {sideEventSummary.preActiveRegistrations}/{sideEventSummary.postActiveRegistrations}명
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    희망 {sideEventSummary.prePreferredRegistrations}/{sideEventSummary.postPreferredRegistrations}명
                  </p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                  <p className="text-xs font-medium text-indigo-700">활성 신청자</p>
                  <p className="mt-1 text-xl font-bold text-indigo-900">
                    {sideEventSummary.totalActiveRegistrations}명
                  </p>
                  <p className="mt-1 text-xs text-indigo-700">
                    신청 {sideEventSummary.totalStatusSummary.applied} / 확정{" "}
                    {sideEventSummary.totalStatusSummary.confirmed}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-medium text-emerald-700">신청 이력</p>
                  <p className="mt-1 text-xl font-bold text-emerald-900">
                    {sideEventSummary.totalRegistrationHistoryCount}건
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    대기 {sideEventSummary.totalStatusSummary.waitlisted} / 취소{" "}
                    {sideEventSummary.totalStatusSummary.canceled}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-600">전체 상태</p>
                  <p className="mt-2 text-xs text-slate-600">
                    신청 {sideEventSummary.totalStatusSummary.applied} / 확정{" "}
                    {sideEventSummary.totalStatusSummary.confirmed} / 대기{" "}
                    {sideEventSummary.totalStatusSummary.waitlisted} / 취소{" "}
                    {sideEventSummary.totalStatusSummary.canceled}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-700">
                    라운드 희망 총 {sideEventSummary.totalPreferredRegistrations}명
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800">사전 상태</p>
                  <p className="mt-2 text-xs text-amber-700">
                    신청 {sideEventSummary.preStatusSummary.applied} / 확정{" "}
                    {sideEventSummary.preStatusSummary.confirmed} / 대기{" "}
                    {sideEventSummary.preStatusSummary.waitlisted} / 취소{" "}
                    {sideEventSummary.preStatusSummary.canceled}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-amber-700">
                    라운드 희망 {sideEventSummary.prePreferredRegistrations}명
                  </p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                  <p className="text-xs font-semibold text-indigo-700">사후 상태</p>
                  <p className="mt-2 text-xs text-indigo-700">
                    신청 {sideEventSummary.postStatusSummary.applied} / 확정{" "}
                    {sideEventSummary.postStatusSummary.confirmed} / 대기{" "}
                    {sideEventSummary.postStatusSummary.waitlisted} / 취소{" "}
                    {sideEventSummary.postStatusSummary.canceled}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-indigo-700">
                    라운드 희망 {sideEventSummary.postPreferredRegistrations}명
                  </p>
                </div>
              </div>

              {sideEventSummary.topRounds.length === 0 ? (
                <p className="text-sm text-slate-500">등록된 라운드가 없습니다.</p>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-600">신청 상위 라운드</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    {sideEventSummary.topRounds.map((round) => (
                      <p key={round.id} className="text-xs text-slate-600">
                        [{round.roundType === "pre" ? "사전" : "사후"}] {round.title} · 활성 신청{" "}
                        {round.registrationCount}명
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {tocItems.length > 0 ? (
        <nav className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-1 overflow-x-auto px-3 py-2 md:px-4 lg:px-6">
            {tocItems.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      ) : null}

      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-3 py-7 md:px-4 lg:px-6">

        <Card className="rounded-[30px] border border-slate-100 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>
              {editingId ? "라운드 수정" : "새 라운드 추가"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6 md:p-7">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">라운드 유형</label>
                <select
                  value={roundType}
                  onChange={(e) => setRoundType(e.target.value as RoundType)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
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
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
                >
                  <option value="draft">{formatTournamentStatus("draft")}</option>
                  <option value="open">{formatTournamentStatus("open")}</option>
                  <option value="closed">{formatTournamentStatus("closed")}</option>
                  <option value="done">{formatTournamentStatus("done")}</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">제목 *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 화이트 코스 친선전"
                className="h-11 rounded-2xl border-slate-200 bg-slate-50"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Tee Time (선택)</label>
                <Input
                  value={teeTime}
                  onChange={(e) => setTeeTime(e.target.value)}
                  placeholder="예: 08:00"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">위치 (선택)</label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="예: 클럽 흑 금강"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50"
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
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">설명 (선택)</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="특별 안내사항"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50"
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
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">신청 마감 (선택)</label>
                <Input
                  type="datetime-local"
                  value={closeAt}
                  onChange={(e) => setCloseAt(e.target.value)}
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">식사 옵션 (선택)</label>
                <select
                  value={mealOptionId}
                  onChange={(e) => setMealOptionId(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
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
              <Button onClick={saveSideEvent} className="rounded-2xl">
                {editingId ? "수정" : "생성"}
              </Button>
              {editingId && (
                <Button onClick={resetForm} variant="outline" className="rounded-2xl">
                  취소
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {sideEvents.length === 0 ? (
          <Card className="rounded-[30px] border border-slate-100 bg-white shadow-sm">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-slate-500">등록된 라운드가 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {renderRoundSection("pre-round-section", "🌅 사전 라운드", groupedByRoundType.pre)}
            {renderRoundSection("post-round-section", "🌆 사후 라운드", groupedByRoundType.post)}
          </>
        )}
      </div>
    </main>
  );
}
