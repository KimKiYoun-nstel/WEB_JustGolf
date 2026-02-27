"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";

type QuickCardItem = {
  title: string;
  description: string;
  href: string;
  cta: string;
  primary?: boolean;
};

function QuickCard({ item }: { item: QuickCardItem }) {
  return (
    <article className="group flex h-full flex-col justify-between rounded-[28px] border border-transparent bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-green-100 hover:shadow-md">
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

  useEffect(() => {
    if (!user?.id) {
      setIsAdmin(false);
      return;
    }

    const fetchProfile = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      setIsAdmin(data?.is_admin === true);
    };

    fetchProfile();
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
      title: "제주소식 바로가기",
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
      title: "관리자 도움말",
      description: "운영 정책과 화면 설명을\n빠르게 확인할 수 있습니다.",
      href: "/admin/help",
      cta: "도움말 보기",
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
      <div className="mx-auto max-w-6xl px-6 py-14">
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
      </div>
    </main>
  );
}

