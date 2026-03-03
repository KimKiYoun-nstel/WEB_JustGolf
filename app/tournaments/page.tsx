"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";
import { formatRegistrationStatus, formatTournamentStatus } from "../../lib/statusLabels";
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

type RegistrationCountRow = {
  tournament_id: number;
  status: string;
};

type RegistrationStatusRow = {
  tournament_id: number;
  status: string;
  relation: string | null;
};

const STATUS_BADGE_STYLE: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-700",
  draft: "bg-blue-100 text-blue-700",
  closed: "bg-amber-100 text-amber-700",
  done: "bg-slate-200 text-slate-600",
};

export default function TournamentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<Tournament[]>([]);
  const [error, setError] = useState("");
  const [myStatuses, setMyStatuses] = useState<Record<number, string>>({});
  const [applicantCounts, setApplicantCounts] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const formatStatus = (status: string) => formatRegistrationStatus(status);

  useEffect(() => {
    let active = true;

    (async () => {
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

      const { data: countData, error: countError } = await supabase
        .from("registrations")
        .select("tournament_id,status")
        .eq("status", "applied");

      if (!countError) {
        const nextCounts: Record<number, number> = {};
        ((countData ?? []) as RegistrationCountRow[]).forEach((row) => {
          nextCounts[row.tournament_id] = (nextCounts[row.tournament_id] ?? 0) + 1;
        });
        setApplicantCounts(nextCounts);
      } else {
        setApplicantCounts({});
      }

      if (!user?.id) {
        setMyStatuses({});
        setIsLoading(false);
        return;
      }

      const { data: regData, error: regError } = await supabase
        .from("registrations")
        .select("tournament_id,status,relation")
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

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
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
                        <p>신청자 수: {applicantCounts[t.id] ?? 0}명</p>
                        <p>메모: {t.notes ?? "-"}</p>
                      </div>

                      {user ? (
                        <p className="text-xs font-semibold text-slate-500">
                          내 참가 상태: {myStatus ? formatStatus(myStatus) : "미신청"}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/t/${t.id}/participants`}
                        className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
                      >
                        상세 보기
                      </Link>
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

