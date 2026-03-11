"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";
import { formatRegistrationStatus, formatTournamentStatus } from "../../lib/statusLabels";
import { getTournamentAdminAccess, listManagedTournamentIds } from "../../lib/tournamentAdminAccess";
import { useToast } from "../../components/ui/toast";

type Tournament = {
  id: number;
  title: string;
  event_date: string;
  course_name: string | null;
  location: string | null;
  tee_time: string | null;
  notes: string | null;
  status: string;
};

type RegistrationSummary = {
  applied: number;
  approved: number;
  waitlisted: number;
  canceled: number;
};

type RoundPreferenceSummary = {
  prePreferred: number;
  postPreferred: number;
  anyPreferred: number;
};

type RegistrationStatusRow = {
  tournament_id: number;
  status: string;
  relation: string | null;
};

type RegistrationRoundPreferenceRow = {
  tournament_id: number;
  status: string;
  pre_round_preferred: boolean | null;
  post_round_preferred: boolean | null;
};

type SideEventRow = {
  id: number;
  tournament_id: number;
  round_type: "pre" | "post";
  title: string;
};

type SideEventRegistrationRow = {
  side_event_id: number;
};

type SideEventSummary = {
  id: number;
  round_type: "pre" | "post";
  title: string;
  registration_count: number;
};

const STATUS_BADGE_STYLE: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-700",
  draft: "bg-blue-100 text-blue-700",
  closed: "bg-amber-100 text-amber-700",
  done: "bg-slate-200 text-slate-600",
};

const createEmptyRegistrationSummary = (): RegistrationSummary => ({
  applied: 0,
  approved: 0,
  waitlisted: 0,
  canceled: 0,
});

const createEmptyRoundPreferenceSummary = (): RoundPreferenceSummary => ({
  prePreferred: 0,
  postPreferred: 0,
  anyPreferred: 0,
});

const formatRoundType = (roundType: "pre" | "post") => (roundType === "pre" ? "사전" : "사후");

export default function TournamentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<Tournament[]>([]);
  const [error, setError] = useState("");
  const [myStatuses, setMyStatuses] = useState<Record<number, string>>({});
  const [registrationSummaries, setRegistrationSummaries] = useState<Record<number, RegistrationSummary>>({});
  const [roundPreferenceSummaries, setRoundPreferenceSummaries] = useState<Record<number, RoundPreferenceSummary>>(
    {}
  );
  const [sideEventSummaries, setSideEventSummaries] = useState<Record<number, SideEventSummary[]>>({});
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [managedTournamentIds, setManagedTournamentIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const formatStatus = (status: string) => formatRegistrationStatus(status);

  useEffect(() => {
    let active = true;

    (async () => {
      setIsLoading(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from("tournaments")
        .select("id,title,event_date,course_name,location,tee_time,notes,status")
        .neq("status", "deleted")
        .order("event_date", { ascending: false });

      if (!active) return;

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      const tournamentRows = (data ?? []) as Tournament[];
      setRows(tournamentRows);
      const tournamentIds = tournamentRows.map((row) => row.id);

      if (tournamentIds.length === 0) {
        setRegistrationSummaries({});
        setRoundPreferenceSummaries({});
        setSideEventSummaries({});
        setMyStatuses({});
        setIsGlobalAdmin(false);
        setManagedTournamentIds([]);
        setIsLoading(false);
        return;
      }

      const { data: countData, error: countError } = await supabase.rpc(
        "get_registration_counts_by_tournaments",
        { tournament_ids: tournamentIds }
      );

      if (!active) return;

      if (!countError && countData) {
        const nextSummaries: Record<number, RegistrationSummary> = {};
        (countData as { tournament_id: number; status: string; count: number }[]).forEach((row) => {
          const current = nextSummaries[row.tournament_id] ?? createEmptyRegistrationSummary();
          if (row.status === "applied") current.applied = row.count;
          if (row.status === "approved") current.approved = row.count;
          if (row.status === "waitlisted") current.waitlisted = row.count;
          if (row.status === "canceled") current.canceled = row.count;
          nextSummaries[row.tournament_id] = current;
        });
        setRegistrationSummaries(nextSummaries);
      } else {
        setRegistrationSummaries({});
      }

      const { data: roundPreferenceData, error: roundPreferenceError } = await supabase
        .from("registrations")
        .select("tournament_id,status,pre_round_preferred,post_round_preferred")
        .in("tournament_id", tournamentIds);

      if (!active) return;

      if (!roundPreferenceError && roundPreferenceData) {
        const nextRoundPreferenceSummaries: Record<number, RoundPreferenceSummary> = {};
        (roundPreferenceData as RegistrationRoundPreferenceRow[]).forEach((row) => {
          if (row.status === "canceled") return;
          const current =
            nextRoundPreferenceSummaries[row.tournament_id] ?? createEmptyRoundPreferenceSummary();

          const prePreferred = Boolean(row.pre_round_preferred);
          const postPreferred = Boolean(row.post_round_preferred);

          if (prePreferred) current.prePreferred += 1;
          if (postPreferred) current.postPreferred += 1;
          if (prePreferred || postPreferred) current.anyPreferred += 1;

          nextRoundPreferenceSummaries[row.tournament_id] = current;
        });
        setRoundPreferenceSummaries(nextRoundPreferenceSummaries);
      } else {
        setRoundPreferenceSummaries({});
      }

      const { data: sideEventData, error: sideEventError } = await supabase
        .from("side_events")
        .select("id,tournament_id,round_type,title")
        .in("tournament_id", tournamentIds)
        .order("tournament_id", { ascending: true })
        .order("round_type", { ascending: true })
        .order("id", { ascending: true });

      if (!active) return;

      if (!sideEventError && sideEventData) {
        const sideEventRows = (sideEventData ?? []) as SideEventRow[];
        const sideEventIds = sideEventRows.map((row) => row.id);
        const registrationCountMap = new Map<number, number>();

        if (sideEventIds.length > 0) {
          const { data: sideEventRegistrationData, error: sideEventRegistrationError } = await supabase
            .from("side_event_registrations")
            .select("side_event_id")
            .in("side_event_id", sideEventIds)
            .neq("status", "canceled");

          if (!active) return;

          if (!sideEventRegistrationError && sideEventRegistrationData) {
            (sideEventRegistrationData as SideEventRegistrationRow[]).forEach((row) => {
              registrationCountMap.set(
                row.side_event_id,
                (registrationCountMap.get(row.side_event_id) ?? 0) + 1
              );
            });
          }
        }

        const nextSideEventSummaries: Record<number, SideEventSummary[]> = {};
        sideEventRows.forEach((row) => {
          const summaryRow: SideEventSummary = {
            id: row.id,
            round_type: row.round_type,
            title: row.title,
            registration_count: registrationCountMap.get(row.id) ?? 0,
          };

          const bucket = nextSideEventSummaries[row.tournament_id] ?? [];
          bucket.push(summaryRow);
          nextSideEventSummaries[row.tournament_id] = bucket;
        });

        setSideEventSummaries(nextSideEventSummaries);
      } else {
        setSideEventSummaries({});
      }

      if (!user?.id) {
        setMyStatuses({});
        setIsGlobalAdmin(false);
        setManagedTournamentIds([]);
        setIsLoading(false);
        return;
      }

      const access = await getTournamentAdminAccess(supabase, user.id);
      if (!active) return;

      setIsGlobalAdmin(access.isAdmin);

      if (access.isAdmin) {
        setManagedTournamentIds([]);
      } else {
        const scopedIds = await listManagedTournamentIds(supabase, user.id);
        if (!active) return;
        setManagedTournamentIds(scopedIds);
      }

      const { data: regData, error: regError } = await supabase
        .from("registrations")
        .select("tournament_id,status,relation")
        .in("tournament_id", tournamentIds)
        .eq("user_id", user.id)
        .eq("relation", "본인");

      if (!active) return;

      if (regError) {
        setMyStatuses({});
        setIsLoading(false);
        return;
      }

      const nextStatuses: Record<number, string> = {};
      ((regData ?? []) as RegistrationStatusRow[]).forEach((row) => {
        nextStatuses[row.tournament_id] = row.status;
      });
      setMyStatuses(nextStatuses);
      setIsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!error) return;

    toast({ variant: "error", title: "대회 조회 실패", description: error });
    setError("");
  }, [error, toast]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const summaryCount = useMemo(() => rows.length, [rows.length]);
  const managedTournamentIdSet = useMemo(() => new Set(managedTournamentIds), [managedTournamentIds]);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <header className="hidden sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/start" className="text-xl font-bold text-slate-900">
            Just Golf
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
            >
              내 프로필
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-rose-500 transition-colors hover:bg-rose-50"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-14">
        <section className="mb-10 space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-600">Tournaments</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">대회 목록</h1>
          <p className="text-base text-slate-500">
            진행 중인 대회를 확인하고 참가 상태를 확인하세요. 전체 {summaryCount}개
          </p>
        </section>

        <section className="space-y-4">
          {isLoading ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
              로딩 중...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
              등록된 대회가 없습니다.
            </div>
          ) : (
            rows.map((t) => {
              const badgeClass = STATUS_BADGE_STYLE[t.status] ?? "bg-slate-100 text-slate-600";
              const myStatus = myStatuses[t.id];
              const registrationSummary = registrationSummaries[t.id] ?? createEmptyRegistrationSummary();
              const roundPreferenceSummary =
                roundPreferenceSummaries[t.id] ?? createEmptyRoundPreferenceSummary();
              const sideEventSummary = sideEventSummaries[t.id] ?? [];
              const canManageSideEvents = isGlobalAdmin || managedTournamentIdSet.has(t.id);

              return (
                <article
                  key={t.id}
                  className="group rounded-[30px] border border-transparent bg-white p-6 shadow-sm transition-all hover:border-green-100 hover:shadow-md md:p-8"
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${badgeClass}`}>
                          {formatTournamentStatus(t.status)}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">{t.event_date}</span>
                      </div>

                      <h2 className="truncate text-2xl font-bold text-slate-900 transition-colors group-hover:text-green-700">
                        {t.title}
                      </h2>

                      <div className="grid gap-1 text-sm text-slate-500">
                        <p>코스: {t.course_name ?? "-"}</p>
                        <p>지역: {t.location ?? "-"}</p>
                        <p>티오프: {t.tee_time ?? "-"}</p>
                        <p>
                          신청/확정/대기/취소: {registrationSummary.applied}/{registrationSummary.approved}/
                          {registrationSummary.waitlisted}/{registrationSummary.canceled}명
                        </p>
                        <p>
                          라운드 희망(사전/사후): {roundPreferenceSummary.prePreferred}/
                          {roundPreferenceSummary.postPreferred}명
                        </p>
                        <p>메모: {t.notes ?? "-"}</p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-600">사전/사후 라운드 요약</p>
                        {sideEventSummary.length === 0 ? (
                          <p className="mt-1 text-xs text-slate-400">생성된 라운드가 없습니다.</p>
                        ) : (
                          <div className="mt-2 space-y-1">
                            {sideEventSummary.map((sideEvent) => (
                              <p key={sideEvent.id} className="text-xs text-slate-600">
                                [{formatRoundType(sideEvent.round_type)}] {sideEvent.title} · 신청 {sideEvent.registration_count}명
                              </p>
                            ))}
                          </div>
                        )}
                      </div>

                      {user ? (
                        <p className="text-xs font-semibold text-slate-500">
                          내 참가 상태: {myStatus ? formatStatus(myStatus) : "미신청"}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:min-w-[140px]">
                      <Link
                        href={`/t/${t.id}/participants`}
                        className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
                      >
                        상세 보기
                      </Link>
                      {canManageSideEvents ? (
                        <Link
                          href={`/admin/tournaments/${t.id}/side-events`}
                          className="inline-flex items-center justify-center rounded-2xl bg-green-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-green-700"
                        >
                          라운드 관리
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
