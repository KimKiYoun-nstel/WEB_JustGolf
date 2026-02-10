"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";
import { Button } from "./ui/button";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileNickname, setProfileNickname] = useState("");
  const supabase = createClient();

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setProfileNickname("");
      return;
    }

    const fetchProfile = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin,nickname")
        .eq("id", user.id)
        .single();

      setIsAdmin(profile?.is_admin ?? false);
      setProfileNickname(profile?.nickname ?? "");
    };

    fetchProfile();
  }, [user]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsAdmin(false);
    setProfileNickname("");
    router.push("/login");
  };

  if (loading) {
    return (
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <Link href="/login" className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-900">⛳ Just Golf</span>
          </Link>
        </div>
      </header>
    );
  }

  // 로그인 페이지에서는 로고만 표시
  if (pathname === "/login") {
    return (
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <Link href="/login" className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-900">⛳ Just Golf</span>
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between">
          {/* 로고/홈 */}
          <Link href={user ? "/start" : "/login"} className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-900">⛳ Just Golf</span>
          </Link>

          {/* 네비게이션 */}
          <nav className="flex items-center gap-2">
            {user && (
              <>
                <span className="text-sm font-medium text-slate-700">
                  {profileNickname ? `${profileNickname}님` : "닉네임 없음"}
                </span>
                {!isAdmin && (
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/start">홈</Link>
                  </Button>
                )}
                {isAdmin && (
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/admin">관리자</Link>
                  </Button>
                )}
                <Button asChild size="sm" variant="ghost">
                  <Link href="/profile">내 프로필</Link>
                </Button>
                <Button onClick={handleLogout} size="sm" variant="outline">
                  로그아웃
                </Button>
              </>
            )}
            {!user && (
              <Button asChild size="sm">
                <Link href="/login">로그인</Link>
              </Button>
            )}
          </nav>
        </div>

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
