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
  const [mobileOpen, setMobileOpen] = useState(false);

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
      setMobileOpen(false);
    });

    return () => {
      data.subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setMobileOpen(false);
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
            <span className="text-xl font-bold text-slate-900">⛳ Just Golf</span>
          </Link>

          {/* 네비게이션 (데스크탑) */}
          <nav className="hidden items-center gap-6 md:flex">
            {/* 공개 네비 */}
            {user && (
              <Link
                href="/tournaments"
                className={`text-sm font-medium transition-colors ${
                  pathname === "/tournaments"
                    ? "text-slate-900 font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                대회 목록
              </Link>
            )}

            {user && !isAdmin && (
              <Link
                href="/start"
                className={`text-sm font-medium transition-colors ${
                  pathname === "/start"
                    ? "text-slate-900 font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                시작
              </Link>
            )}

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
                  <span className="max-w-[200px] truncate font-medium text-slate-900">
                    {user.email}
                  </span>
                </span>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/profile">내 프로필</Link>
                </Button>
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

          {/* 모바일 메뉴 버튼 */}
          <div className="flex items-center gap-2 md:hidden">
            {user ? (
              <span className="max-w-[120px] truncate text-xs text-slate-600">
                {user.email}
              </span>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
            >
              메뉴
            </Button>
          </div>
        </div>

        {/* 네비게이션 (모바일) */}
        {mobileOpen && (
          <div
            id="mobile-menu"
            className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:hidden"
          >
            <div className="flex flex-col gap-2">
              {user && (
                <Link
                  href="/tournaments"
                  className="text-sm font-medium text-slate-700"
                  onClick={() => setMobileOpen(false)}
                >
                  대회 목록
                </Link>
              )}
              {user && !isAdmin && (
                <Link
                  href="/start"
                  className="text-sm font-medium text-slate-700"
                  onClick={() => setMobileOpen(false)}
                >
                  시작
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-slate-700"
                  onClick={() => setMobileOpen(false)}
                >
                  관리자
                </Link>
              )}
              {user ? (
                <div className="flex flex-col gap-2 pt-2">
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/profile" onClick={() => setMobileOpen(false)}>
                      내 프로필
                    </Link>
                  </Button>
                  <Button onClick={handleLogout} size="sm" variant="outline">
                    로그아웃
                  </Button>
                </div>
              ) : (
                <Button asChild size="sm">
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    로그인
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 상태 바 (현재 페이지 설명) - 데스크톱만 표시 */}
        <div className="mt-3 hidden border-t border-slate-100 pt-2 text-xs text-slate-500 md:block">
          {pathname === "/" && "📍 로그인 페이지로 이동합니다"}
          {pathname === "/tournaments" && "📍 대회 목록을 확인하고 신청하세요"}
          {pathname === "/start" && "📍 빠른 바로가기를 제공합니다"}
          {pathname === "/jeju" && "📍 제주달콧 바로가기(준비중)"}
          {pathname === "/board" && "📍 피드백 게시판 - 버그 신고, 기능 제안"}
          {pathname?.startsWith("/t/") &&
            !pathname?.includes("/participants") &&
            !pathname?.includes("/groups") &&
            "📍 대회 상세 정보 및 라운드 신청"}
          {pathname?.includes("/participants") && "📍 참가자 현황을 확인합니다"}
          {pathname === "/login" && "📍 계정 생성 또는 로그인"}
          {pathname === "/profile" && "📍 내 프로필 정보를 수정합니다"}
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
