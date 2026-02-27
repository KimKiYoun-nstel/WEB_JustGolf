"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "../../../../lib/supabaseClient";
import { useAuth } from "../../../../lib/auth";
import { formatRegistrationStatus, formatTournamentStatus } from "../../../../lib/statusLabels";
import { Badge } from "../../../../components/ui/badge";
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
  user_id: string | null;
  registering_user_id: string;
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
  meal_selected: boolean | null;
  lodging_selected: boolean | null;
};

type PrizeSupport = {
  id: number;
  supporter_name: string | null;
  item_name: string;
  note: string | null;
  created_at: string;
};

function formatDate(date: string) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("ko-KR");
}

function formatDateTime(date: string) {
  if (!date) return "-";
  return new Date(date).toLocaleString("ko-KR");
}

function formatBooleanSelection(value: boolean | null) {
  if (value === null) return "미정";
  return value ? "참여" : "불참";
}

export default function TournamentParticipantsPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [rows, setRows] = useState<Registration[]>([]);
  const [sideEvents, setSideEvents] = useState<SideEvent[]>([]);
  const [sideEventRegs, setSideEventRegs] = useState<Map<number, SideEventRegistration[]>>(new Map());
  const [prizes, setPrizes] = useState<PrizeSupport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeletedTournament, setIsDeletedTournament] = useState(false);
  const [msg, setMsg] = useState("");

  const hasMyActiveRegistration = rows.some(
    (row) => row.user_id === user?.id && row.status !== "canceled"
  );

  const registrationSummary = useMemo(() => {
    return {
      total: rows.length,
      approved: rows.filter((row) => row.status === "approved").length,
      applied: rows.filter((row) => row.status === "applied").length,
      waitlisted: rows.filter((row) => row.status === "waitlisted").length,
    };
  }, [rows]);

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

    const tournamentData = tRes.data as Tournament;
    if (tournamentData.status === "deleted") {
      setIsDeletedTournament(true);
      setTournament(null);
      setRows([]);
      setSideEvents([]);
      setSideEventRegs(new Map());
      setPrizes([]);
      setLoading(false);
      return;
    }

    setTournament(tournamentData);

    const rRes = await supabase
      .from("registrations")
      .select(
        "id,user_id,registering_user_id,nickname,status,memo,created_at,pre_round_preferred,post_round_preferred," +
          "tournament_meal_options(menu_name)," +
          "registration_extras(carpool_available,carpool_seats,transportation,departure_location,notes)," +
          "registration_activity_selections(selected,tournament_extras(activity_name))"
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
    const transformedRows = registrationRows.map((row) => {
      const activities = (row.registration_activity_selections ?? [])
        .filter((selection) => selection?.selected)
        .map((selection) => selection?.tournament_extras?.activity_name)
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

    setRows(transformedRows as Registration[]);

    const seRes = await supabase
      .from("side_events")
      .select("id,round_type,title,tee_time,status")
      .eq("tournament_id", tournamentId)
      .order("round_type,id", { ascending: true });

    if (!seRes.error) {
      const sideEventRows = (seRes.data ?? []) as SideEvent[];
      setSideEvents(sideEventRows);

      const sideEventMap = new Map<number, SideEventRegistration[]>();
      const sideEventIds = sideEventRows.map((sideEvent) => sideEvent.id);

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
            const bucket = sideEventMap.get(row.side_event_id) ?? [];
            bucket.push(row);
            sideEventMap.set(row.side_event_id, bucket);
          }
        }
      }

      setSideEventRegs(sideEventMap);
    }

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

      const mappedPrizes = ((prizeRes.data ?? []) as unknown as PrizeRow[]).map((row) => ({
        id: row.id,
        supporter_name: row.supporter_nickname ?? null,
        item_name: row.item_name,
        note: row.note ?? null,
        created_at: row.created_at,
      }));
      setPrizes(mappedPrizes as PrizeSupport[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    if (authLoading) return;

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
  }, [msg, toast]);

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
    const top = element.getBoundingClientRect().top + window.scrollY - 124;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, []);

  const showContents = !loading && !isDeletedTournament && Boolean(tournament) && Boolean(user);

  return (
    <main className="min-h-screen bg-[#F2F4F7] pb-28 text-slate-800">
      <section className="border-b border-slate-100 bg-white px-6 pb-7 pt-10">
        <div className="mx-auto max-w-6xl">
          {tournament ? (
            <>
              <div className="mb-3 flex items-center gap-2">
                <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {formatTournamentStatus(tournament.status)}
                </Badge>
                <span className="text-xs font-semibold tracking-wide text-slate-400">
                  참가 현황 확인
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{tournament.title}</h1>
              <p className="mt-2 text-sm text-slate-500">{formatDate(tournament.event_date)}</p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold tracking-wide text-slate-400">참가 현황 확인</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">대회 상세</h1>
            </>
          )}
        </div>
      </section>

      {showContents ? (
        <nav className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-6 py-2">
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

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-7">
        {(loading || authLoading) && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-sm text-slate-500">로딩 중...</p>
          </section>
        )}

        {!authLoading && !user && (
          <section className="rounded-[28px] border border-rose-100 bg-rose-50 p-7">
            <p className="text-sm font-medium text-rose-700">
              이 페이지는 로그인 후 이용할 수 있습니다.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              로그인하기
            </Link>
          </section>
        )}

        {!loading && isDeletedTournament && user && (
          <section className="rounded-[28px] border border-rose-100 bg-rose-50 p-7">
            <p className="text-sm font-medium text-rose-700">삭제된 대회는 접근할 수 없습니다.</p>
            <Link
              href="/tournaments"
              className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              대회 목록으로
            </Link>
          </section>
        )}

        {!loading && !isDeletedTournament && !tournament && user && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-sm text-slate-500">대회를 찾을 수 없습니다.</p>
          </section>
        )}

        {showContents && tournament ? (
          <>
            <section
              id="registrations-section"
              className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm"
            >
              <div className="border-b border-slate-100 px-6 py-5 md:px-7">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">참가자 목록</h2>
                    <p className="mt-1 text-sm text-slate-500">참가 신청 상세 현황</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-white">
                      총 {registrationSummary.total}명
                    </span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                      확정 {registrationSummary.approved}
                    </span>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">
                      신청 {registrationSummary.applied}
                    </span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                      대기 {registrationSummary.waitlisted}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 md:hidden">
                {rows.length === 0 ? (
                  <p className="text-sm text-slate-500">아직 참가자가 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {rows.map((row) => {
                      const roundFlags = [
                        row.pre_round_preferred ? "사전" : null,
                        row.post_round_preferred ? "사후" : null,
                      ]
                        .filter(Boolean)
                        .join(", ");

                      return (
                        <article
                          key={row.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-slate-900">{row.nickname}</p>
                                {user?.id && row.user_id === user.id ? (
                                  <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                    나
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-slate-500">{formatDateTime(row.created_at)}</p>
                            </div>
                            <Badge variant="secondary">{formatRegistrationStatus(row.status)}</Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-600">
                            <p>식사: {row.meal_name ?? "-"}</p>
                            <p>라운드: {roundFlags || "-"}</p>
                            <p>이동: {row.transportation ?? "-"}</p>
                            <p>출발지: {row.departure_location ?? "-"}</p>
                            <p className="col-span-2">
                              액티비티: {row.activities.length > 0 ? row.activities.join(", ") : "-"}
                            </p>
                            <p className="col-span-2">비고: {row.notes ?? "-"}</p>
                            <p className="col-span-2">메모: {row.memo ?? "-"}</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="hidden p-6 md:block md:px-7">
                {rows.length === 0 ? (
                  <p className="text-sm text-slate-500">아직 참가자가 없습니다.</p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                        <tr>
                          <th className="whitespace-nowrap px-4 py-3">닉네임</th>
                          <th className="whitespace-nowrap px-4 py-3">상태</th>
                          <th className="whitespace-nowrap px-4 py-3">식사</th>
                          <th className="whitespace-nowrap px-4 py-3">액티비티</th>
                          <th className="whitespace-nowrap px-4 py-3">라운드</th>
                          <th className="whitespace-nowrap px-4 py-3">카풀</th>
                          <th className="whitespace-nowrap px-4 py-3">이동/출발지</th>
                          <th className="whitespace-nowrap px-4 py-3">비고</th>
                          <th className="whitespace-nowrap px-4 py-3">메모</th>
                          <th className="whitespace-nowrap px-4 py-3">신청일시</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {rows.map((row) => (
                          <tr key={row.id}>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              <div className="flex items-center gap-2">
                                <span>{row.nickname}</span>
                                {user?.id && row.user_id === user.id ? (
                                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                    나
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="secondary">{formatRegistrationStatus(row.status)}</Badge>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{row.meal_name ?? "-"}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {row.activities.length > 0 ? row.activities.slice(0, 3).join(", ") : "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <div className="flex flex-wrap gap-1">
                                {row.pre_round_preferred ? (
                                  <span className="rounded-md border border-slate-200 px-1.5 py-0.5 text-xs">
                                    사전
                                  </span>
                                ) : null}
                                {row.post_round_preferred ? (
                                  <span className="rounded-md border border-slate-200 px-1.5 py-0.5 text-xs">
                                    사후
                                  </span>
                                ) : null}
                                {!row.pre_round_preferred && !row.post_round_preferred ? "-" : null}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {row.carpool_available ? `${row.carpool_seats ?? 0}석` : "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {row.transportation || row.departure_location
                                ? `${row.transportation ?? "-"} / ${row.departure_location ?? "-"}`
                                : "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{row.notes ?? "-"}</td>
                            <td className="px-4 py-3 text-slate-600">{row.memo ?? "-"}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                              {formatDateTime(row.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {sideEvents.length > 0 ? (
              <section
                id="side-events-section"
                className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm md:p-7"
              >
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-900">사전/사후 라운드 현황</h2>
                  <p className="mt-1 text-sm text-slate-500">라운드별 신청 내역을 확인하세요.</p>
                </div>
                <div className="space-y-4">
                  {sideEvents.map((sideEvent) => {
                    const regs = sideEventRegs.get(sideEvent.id) ?? [];

                    return (
                      <article
                        key={sideEvent.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">
                              [{sideEvent.round_type === "pre" ? "사전" : "사후"}] {sideEvent.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              티타임: {sideEvent.tee_time ?? "미정"} / 상태:{" "}
                              {formatTournamentStatus(sideEvent.status)}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                            신청 {regs.length}명
                          </span>
                        </div>

                        {regs.length === 0 ? (
                          <p className="text-sm text-slate-500">신청자가 없습니다.</p>
                        ) : (
                          <>
                            <div className="space-y-2 md:hidden">
                              {regs.map((reg) => (
                                <div
                                  key={reg.id}
                                  className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600"
                                >
                                  <p className="text-sm font-semibold text-slate-900">{reg.nickname}</p>
                                  <p className="mt-1">상태: {formatRegistrationStatus(reg.status)}</p>
                                  <p>식사: {formatBooleanSelection(reg.meal_selected)}</p>
                                  <p>숙박: {formatBooleanSelection(reg.lodging_selected)}</p>
                                </div>
                              ))}
                            </div>

                            <div className="hidden overflow-x-auto md:block">
                              <table className="min-w-full text-sm">
                                <thead className="text-left text-xs font-semibold text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2">닉네임</th>
                                    <th className="px-3 py-2">상태</th>
                                    <th className="px-3 py-2">식사</th>
                                    <th className="px-3 py-2">숙박</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {regs.map((reg) => (
                                    <tr key={reg.id}>
                                      <td className="px-3 py-2 font-medium text-slate-800">{reg.nickname}</td>
                                      <td className="px-3 py-2 text-slate-600">
                                        {formatRegistrationStatus(reg.status)}
                                      </td>
                                      <td className="px-3 py-2 text-slate-600">
                                        {formatBooleanSelection(reg.meal_selected)}
                                      </td>
                                      <td className="px-3 py-2 text-slate-600">
                                        {formatBooleanSelection(reg.lodging_selected)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section
              id="prizes-section"
              className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm md:p-7"
            >
              <h2 className="text-xl font-bold text-slate-900">경품 지원 현황</h2>
              <p className="mt-1 text-sm text-slate-500">참가자가 등록한 경품 내역입니다.</p>

              {prizes.length === 0 ? (
                <p className="mt-5 text-sm text-slate-500">아직 등록된 경품이 없습니다.</p>
              ) : (
                <div className="mt-5 grid gap-3">
                  {prizes.map((prize) => (
                    <article
                      key={prize.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {prize.supporter_name ?? "익명"} · {prize.item_name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{prize.note ?? "비고 없음"}</p>
                        </div>
                        <span className="text-xs text-slate-400">{formatDate(prize.created_at)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section
              id="groups-section"
              className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm md:p-7"
            >
              <h2 className="text-xl font-bold text-slate-900">조편성</h2>
              <p className="mt-1 text-sm text-slate-500">공개된 조편성표를 확인하세요.</p>
              <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
                <Link
                  href={`/t/${tournamentId}/groups`}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  조편성표 보기
                </Link>
                <Link
                  href={`/t/${tournamentId}/draw`}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  라이브 조편성
                </Link>
              </div>
            </section>
          </>
        ) : null}
      </div>

      {showContents ? (
        <div className="fixed bottom-5 left-0 right-0 z-40 px-6">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-end gap-2">
            <Link
              href="/tournaments"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm"
            >
              대회 목록
            </Link>
            <Link
              href={`/t/${tournamentId}`}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm"
            >
              {hasMyActiveRegistration ? "참가 정보 수정" : "참가 신청"}
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  );
}
