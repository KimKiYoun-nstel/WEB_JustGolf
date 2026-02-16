"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { createClient } from "../../lib/supabaseClient";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "../../components/ui/sheet";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
        <header className="border-b border-slate-200/70 pb-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex-1">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                관리자 콘솔
              </p>
              <h1 className="text-2xl font-semibold text-slate-900">관리자</h1>
              <p className="text-sm text-slate-500">
                {nickname ? `${nickname}님` : "관리자 계정"}
              </p>
            </div>

            {/* 모바일 햄버거 버튼 */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100"
              aria-label="메뉴 열기"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          {/* PC 네비게이션 (lg 이상에서만 표시) */}
          <nav className="hidden gap-2 lg:flex">
            <Button asChild variant="secondary">
              <Link href="/start">🏠 홈</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin">📊 대시보드</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/tournaments">📋 대회 관리</Link>
            </Button>
          </nav>

          {/* 모바일 메뉴 드로어 */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent className="w-64">
              <SheetHeader>
                <SheetTitle>관리자 메뉴</SheetTitle>
                <SheetClose onClick={() => setMobileMenuOpen(false)} />
              </SheetHeader>

              <nav className="mt-6 space-y-2">
                <Button
                  asChild
                  className="w-full justify-start"
                  variant="ghost"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link href="/start">🏠 홈</Link>
                </Button>

                <Button
                  asChild
                  className="w-full justify-start"
                  variant="ghost"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link href="/admin">📊 대시보드</Link>
                </Button>

                <Button
                  asChild
                  className="w-full justify-start"
                  variant="ghost"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link href="/admin/tournaments">📋 대회 관리</Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </header>
        {children}
      </div>
    </div>
  );
}
