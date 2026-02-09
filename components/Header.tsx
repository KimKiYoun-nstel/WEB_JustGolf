"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { Button } from "./ui/button";
import type { User } from "@supabase/supabase-js";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);

      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin,nickname")
          .eq("id", data.user.id)
          .single();

        setIsAdmin(profile?.is_admin ?? false);
      }
      setLoading(false);
    };

    checkAuth();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsAdmin(false);
      }
    });

    return () => {
      data.subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    router.push("/");
  };

  if (loading) {
    return (
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <p className="text-sm text-slate-500">로딩중...</p>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between">
          {/* 로고/홈 */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-900">⛳ Golf Tour</span>
          </Link>

          {/* 네비게이션 */}
          <nav className="flex items-center gap-6">
            {/* 공개 네비 */}
            <Link
              href="/"
              className={`text-sm font-medium transition-colors ${
                pathname === "/"
                  ? "text-slate-900 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              대회 목록
            </Link>

            {/* 관리자 네비 */}
            {isAdmin && (
              <Link
                href="/admin"
                className={`text-sm font-medium transition-colors ${
                  pathname?.startsWith("/admin")
                    ? "text-slate-900 font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                관리자
              </Link>
            )}

            {/* 사용자 상태 및 로그인/로그아웃 */}
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">
                  {isAdmin ? "👨‍💼" : "👤"}{" "}
                  <span className="font-medium text-slate-900">
                    {user.email}
                  </span>
                </span>
                <Button onClick={handleLogout} size="sm" variant="outline">
                  로그아웃
                </Button>
              </div>
            ) : (
              <Button asChild size="sm">
                <Link href="/login">로그인</Link>
              </Button>
            )}
          </nav>
        </div>

        {/* 상태 바 (현재 페이지 설명) */}
        <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
          {pathname === "/" && "📍 대회 목록을 확인하고 신청하세요"}
          {pathname?.startsWith("/t/") && "📍 대회 상세 정보 및 라운드 신청"}
          {pathname === "/login" && "📍 계정 생성 또는 로그인"}
          {pathname?.startsWith("/admin") && pathname === "/admin" && "📍 관리자 대시보드"}
          {pathname?.startsWith("/admin/tournaments") &&
            pathname === "/admin/tournaments" &&
            "📍 대회를 관리합니다"}
          {pathname?.startsWith("/admin/tournaments") &&
            pathname.includes("/registrations") &&
            "📍 신청자 상태를 관리합니다"}
          {pathname?.startsWith("/admin/tournaments") &&
            pathname.includes("/files") &&
            "📍 파일을 업로드하고 관리합니다"}
          {pathname?.startsWith("/admin/tournaments") &&
            pathname.includes("/side-events") &&
            "📍 사전/사후 라운드를 관리합니다"}
        </div>
      </div>
    </header>
  );
}
