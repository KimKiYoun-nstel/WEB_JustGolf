"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { createClient } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";
import { Button } from "./ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

const HIDE_HEADER_PATTERNS = [
  /^\/login$/,
  /^\/start$/,
  /^\/tournaments$/,
  /^\/t\/[^/]+$/,
  /^\/t\/[^/]+\/participants$/,
  /^\/admin\/tournaments$/,
  /^\/admin\/tournaments\/[^/]+\/registrations$/,
  /^\/admin\/tournaments\/[^/]+\/side-events$/,
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const [isAdmin, setIsAdmin] = useState(false);
  const [profileNickname, setProfileNickname] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const shouldHideHeader = useMemo(() => {
    if (!pathname) return false;
    return HIDE_HEADER_PATTERNS.some((pattern) => pattern.test(pathname));
  }, [pathname]);

  useEffect(() => {
    if (!user?.id) {
      setIsAdmin(false);
      setProfileNickname("");
      return;
    }

    const fetchProfile = async () => {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin,nickname")
        .eq("id", user.id)
        .single();

      setIsAdmin(profile?.is_admin ?? false);
      setProfileNickname(profile?.nickname ?? "");
    };

    fetchProfile();
  }, [user?.id]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsAdmin(false);
    setProfileNickname("");
    setMobileMenuOpen(false);
    router.push("/login");
  };

  if (shouldHideHeader) return null;

  const headerClassName =
    "sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85";

  if (loading) {
    return (
      <header className={headerClassName}>
        <div className="mx-auto max-w-6xl px-4 py-3">
          <Link href="/login" className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-900">Just Golf</span>
          </Link>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className={headerClassName}>
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href={user ? "/start" : "/login"} className="flex items-center gap-2">
              <span className="text-xl font-bold text-slate-900">Just Golf</span>
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              {user ? (
                <>
                  <span className="px-2 py-1.5 text-sm font-medium text-slate-700">
                    {profileNickname ? `${profileNickname}님` : "사용자"}
                  </span>
                  {isAdmin ? (
                    <>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/admin/tournaments">대회 관리</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/admin/users">회원 관리</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/admin/help">도움말</Link>
                      </Button>
                    </>
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link href="/start">홈</Link>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link href="/profile">내 프로필</Link>
                  </Button>
                  <Button onClick={handleLogout} size="sm" variant="outline">
                    로그아웃
                  </Button>
                </>
              ) : (
                <Button asChild size="sm">
                  <Link href="/login">로그인</Link>
                </Button>
              )}
            </nav>

            {user ? (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100 md:hidden"
                aria-label="메뉴 열기"
              >
                <Menu className="h-6 w-6" />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent className="w-64">
          <SheetHeader>
            <SheetTitle>메뉴</SheetTitle>
            <SheetClose onClick={() => setMobileMenuOpen(false)} />
          </SheetHeader>

          <nav className="mt-6 space-y-2">
            <div className="border-b border-slate-200 pb-4 text-sm font-medium text-slate-700">
              {profileNickname ? `${profileNickname}님` : "사용자"}
            </div>

            {isAdmin ? (
              <>
                <Button asChild className="w-full justify-start" variant="ghost">
                  <Link href="/admin/tournaments" onClick={() => setMobileMenuOpen(false)}>
                    대회 관리
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="ghost">
                  <Link href="/admin/users" onClick={() => setMobileMenuOpen(false)}>
                    회원 관리
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="ghost">
                  <Link href="/admin/help" onClick={() => setMobileMenuOpen(false)}>
                    도움말
                  </Link>
                </Button>
              </>
            ) : (
              <Button asChild className="w-full justify-start" variant="ghost">
                <Link href="/start" onClick={() => setMobileMenuOpen(false)}>
                  홈
                </Link>
              </Button>
            )}

            <Button asChild className="w-full justify-start" variant="ghost">
              <Link href="/profile" onClick={() => setMobileMenuOpen(false)}>
                내 프로필
              </Link>
            </Button>

            <div className="border-t border-slate-200 pt-2">
              <Button onClick={handleLogout} className="w-full justify-start" variant="ghost">
                로그아웃
              </Button>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}

