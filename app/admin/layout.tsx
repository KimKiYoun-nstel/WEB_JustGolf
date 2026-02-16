"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { createClient } from "../../lib/supabaseClient";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useToast } from "../../components/ui/toast";

type AdminProfile = {
  is_admin: boolean;
  nickname: string | null;
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }

    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin,nickname")
        .eq("id", user.id)
        .single();

      if (error) {
        setError(error.message);
        setIsAdmin(false);
        setChecking(false);
        return;
      }

      const profile = data as AdminProfile;
      setNickname(profile.nickname ?? "");
      setIsAdmin(Boolean(profile.is_admin));
      setChecking(false);
    })();
  }, [loading, user?.id]);

  useEffect(() => {
    if (!error) return;

    toast({
      variant: "error",
      title: "관리자 권한 확인 실패",
      description: error,
      duration: 1800,
    });
    setError("");
  }, [error, toast]);

  if (loading || checking) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-6 py-10">
        <Card className="mx-auto max-w-3xl border-slate-200/70 p-6">
          <p className="text-sm text-slate-500">관리자 권한 확인 중...</p>
        </Card>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-6 py-10">
        <Card className="mx-auto max-w-3xl border-slate-200/70 p-6">
          <p className="text-sm text-slate-600">
            관리자 페이지는 로그인 후 이용 가능해요.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/login">로그인으로 이동</Link>
          </Button>
        </Card>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-6 py-10">
        <Card className="mx-auto max-w-3xl border-slate-200/70 p-6">
          <p className="text-sm text-slate-600">관리자 권한이 없습니다.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/start">홈으로 이동</Link>
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-4 border-b border-slate-200/70 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              관리자 콘솔
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">관리자</h1>
            <p className="text-sm text-slate-500">
              {nickname ? `${nickname}님` : "관리자 계정"}
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/start">홈</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin">대시보드</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/tournaments">대회 관리</Link>
            </Button>
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
