"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { createClient } from "../../lib/supabaseClient";
import {
  getTournamentAdminAccess,
  listManagedTournamentIds,
} from "../../lib/tournamentAdminAccess";
import { CLUB_RULES, RULES_LAST_UPDATED } from "../../lib/clubRules";

type QuickCardItem = {
  title: string;
  description: string;
  href: string;
  cta: string;
  primary?: boolean;
};

type ManagedTournament = {
  id: number;
  title: string;
  event_date: string;
  status: string;
};

function QuickCard({ item }: { item: QuickCardItem }) {
  return (
    <article className="group flex h-full flex-col justify-between rounded-2xl border border-transparent bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-green-100 hover:shadow-md">
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">{item.title}</h2>
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-500">
          {item.description}
        </p>
      </div>
      <Link
        href={item.href}
        className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${
          item.primary
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }`}
      >
        {item.cta}
      </Link>
    </article>
  );
}

export default function StartPage() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [managedTournaments, setManagedTournaments] = useState<ManagedTournament[]>([]);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setIsAdmin(false);
      setManagedTournaments([]);
      return;
    }

    const fetchAccess = async () => {
      const supabase = createClient();
      const access = await getTournamentAdminAccess(supabase, user.id);
      setIsAdmin(access.isAdmin);

      if (access.isAdmin) {
        setManagedTournaments([]);
        return;
      }

      const managedIds = await listManagedTournamentIds(supabase, user.id);
      if (managedIds.length === 0) {
        setManagedTournaments([]);
        return;
      }

      const { data } = await supabase
        .from("tournaments")
        .select("id,title,event_date,status")
        .in("id", managedIds)
        .order("event_date", { ascending: false });

      setManagedTournaments((data ?? []) as ManagedTournament[]);
    };

    void fetchAccess();
  }, [user?.id]);

  const userCards: QuickCardItem[] = [
    {
      title: "대회 바로가기",
      description: "대회 목록을 확인하고\n참가 신청을 진행하세요.",
      href: "/tournaments",
      cta: "대회 목록 보기",
      primary: true,
    },
    {
      title: "제주투어 바로가기",
      description: "준비 중인 페이지입니다.\n곧 업데이트됩니다.",
      href: "/jeju",
      cta: "페이지 열기",
    },
    {
      title: "게시판 바로가기",
      description: "피드백 요청, 버그 신고,\n기능 제안을 남겨주세요.",
      href: "/board",
      cta: "게시판으로 이동",
    },
    {
      title: "관리자 안내",
      description: "운영 정책과 화면 설명을\n빠르게 확인할 수 있습니다.",
      href: "/admin/help",
      cta: "안내문 보기",
    },
  ];

  const adminCards: QuickCardItem[] = [
    {
      title: "대회 관리",
      description: "대회 생성, 신청자 현황,\n라운드 운영을 관리합니다.",
      href: "/admin/tournaments",
      cta: "대회 관리로 이동",
      primary: true,
    },
    {
      title: "회원 관리",
      description: "회원 승인 상태와 권한을\n관리할 수 있습니다.",
      href: "/admin/users",
      cta: "회원 관리로 이동",
    },
  ];

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <header className="mb-10 space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-600">
            Quick Start
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">바로가기</h1>
          <p className="text-base text-slate-500">
            필요한 메뉴를 빠르게 선택해 작업을 시작하세요.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {userCards.map((item) => (
            <QuickCard key={item.title} item={item} />
          ))}
        </section>

        {!loading && isAdmin ? (
          <section className="mt-12 border-t border-slate-200 pt-10">
            <div className="mb-6 space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                Admin Mode
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">관리자 메뉴</h2>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {adminCards.map((item) => (
                <QuickCard key={item.title} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        {!loading && !isAdmin && managedTournaments.length > 0 ? (
          <section className="mt-12 border-t border-slate-200 pt-10">
            <div className="mb-6 space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
                Tournament Admin Mode
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">담당 대회 관리</h2>
              <p className="text-sm text-slate-500">
                권한이 부여된 대회의 라운드 관리 페이지로 바로 이동할 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {managedTournaments.map((tournament) => (
                <QuickCard
                  key={tournament.id}
                  item={{
                    title: tournament.title,
                    description: `${tournament.event_date}\n상태: ${tournament.status}`,
                    href: `/admin/tournaments/${tournament.id}/side-events`,
                    cta: "라운드 관리 열기",
                    primary: true,
                  }}
                />
              ))}
            </div>

            <div className="mt-4">
              <Link
                href="/admin/tournaments"
                className="inline-flex items-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                담당 대회 목록 보기
              </Link>
            </div>
          </section>
        ) : null}
      </div>

      {/* 회칙 모달 */}
      {isRulesOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setIsRulesOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">JUST GOLF 회칙</h2>
                <p className="mt-0.5 text-xs text-slate-400">{RULES_LAST_UPDATED}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRulesOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              {CLUB_RULES.map((section) => (
                <section key={section.id} className="mb-7">
                  <h3 className="mb-3 text-sm font-bold tracking-wide text-green-700">
                    {section.title}
                  </h3>
                  <ol className="space-y-2.5">
                    {section.items.map((item) => (
                      <li key={item.num} className="text-sm leading-relaxed text-slate-700">
                        <span className="mr-1.5 font-semibold text-slate-900">{item.num}.</span>
                        {item.text}
                        {item.sub && item.sub.length > 0 ? (
                          <ul className="mt-1.5 space-y-1 rounded-xl bg-slate-50 px-4 py-2">
                            {item.sub.map((s, idx) => (
                              <li key={idx} className="text-xs leading-relaxed text-slate-600">
                                • {s}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
            <div className="border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsRulesOpen(false)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
