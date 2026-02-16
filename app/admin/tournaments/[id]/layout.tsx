"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Menu } from "lucide-react";
import { createClient } from "../../../../lib/supabaseClient";
import { useAuth } from "../../../../lib/auth";
import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "../../../../components/ui/sheet";

const ADMIN_TOURNAMENT_TABS = [
  { id: "dashboard", label: "현황", icon: "📊" },
  { id: "edit", label: "수정", icon: "✏️" },
  { id: "registrations", label: "신청자", icon: "✅" },
  { id: "side-events", label: "라운드", icon: "🎬" },
  { id: "groups", label: "조편성", icon: "🧩" },
  { id: "extras", label: "활동", icon: "🎪" },
  { id: "meal-options", label: "메뉴", icon: "🍽️" },
  { id: "files", label: "파일", icon: "📁" },
  { id: "manager-setup", label: "관리자", icon: "👥" },
  { id: "draw", label: "배정", icon: "🎯" },
];

function getCurrentTab(pathname: string, tournamentId: string): string {
  // /admin/tournaments/[id]/{tab} 형식에서 탭 ID 추출
  const match = pathname.match(new RegExp(`/admin/tournaments/${tournamentId}/([^/]+)`));
  return match ? match[1] : "dashboard";
}

interface TournamentInfo {
  id: number;
  title: string;
}

export default function AdminTournamentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const tournamentId = useMemo(() => params.id, [params.id]);
  
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentTab = getCurrentTab(pathname, tournamentId);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const checkAdminAndLoadTournament = async () => {
      const supabase = createClient();

      // 관리자 권한 확인
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      // 대회 정보 로드
      const { data: tournament } = await supabase
        .from("tournaments")
        .select("id,title")
        .eq("id", Number(tournamentId))
        .single();

      if (tournament) {
        setTournament(tournament as TournamentInfo);
      }

      setLoading(false);
    };

    checkAdminAndLoadTournament();
  }, [user?.id, authLoading, tournamentId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-6 py-10">
        <Card className="mx-auto max-w-4xl border-slate-200/70 p-6">
          <p className="text-sm text-slate-500">로딩 중...</p>
        </Card>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-6 py-10">
        <Card className="mx-auto max-w-4xl border-slate-200/70 p-6">
          <p className="text-sm text-slate-600">관리자 권한이 없습니다.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/admin">대시보드로 이동</Link>
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        {/* 헤더 */}
        <header className="border-b border-slate-200/70 pb-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                대회 관리
              </p>
              <h1 className="text-2xl font-semibold text-slate-900">
                {tournament?.title || "대회"}
              </h1>
            </div>

            {/* 모바일 햄버거 버튼 */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100"
              aria-label="탭 메뉴 열기"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          {/* PC 탭 네비게이션 (lg 이상) */}
          <div className="hidden lg:block overflow-x-auto">
            <Tabs value={currentTab} className="w-full">
              <TabsList className="w-full justify-start">
                {ADMIN_TOURNAMENT_TABS.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id} asChild>
                    <Link href={`/admin/tournaments/${tournamentId}/${tab.id}`}>
                      <span className="mr-1">{tab.icon}</span>
                      <span className="hidden sm:inline">{tab.label}</span>
                    </Link>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* 모바일 탭 메뉴 드로어 (lg 미만) */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent className="w-64">
              <SheetHeader>
                <SheetTitle>관리 메뉴</SheetTitle>
                <SheetClose onClick={() => setMobileMenuOpen(false)} />
              </SheetHeader>

              <nav className="mt-6 space-y-2">
                {ADMIN_TOURNAMENT_TABS.map((tab) => (
                  <Button
                    key={tab.id}
                    asChild
                    className={`w-full justify-start ${
                      currentTab === tab.id
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                    variant={currentTab === tab.id ? "default" : "ghost"}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Link href={`/admin/tournaments/${tournamentId}/${tab.id}`}>
                      <span className="mr-2">{tab.icon}</span>
                      {tab.label}
                    </Link>
                  </Button>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          {/* 모바일 수평 스크롤 탭 (md 이상 lg 미만) */}
          <div className="hidden md:block lg:hidden overflow-x-auto">
            <div className="flex gap-1 pb-2">
              {ADMIN_TOURNAMENT_TABS.map((tab) => (
                <Button
                  key={tab.id}
                  asChild
                  size="sm"
                  className={`whitespace-nowrap ${
                    currentTab === tab.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  variant={currentTab === tab.id ? "default" : "outline"}
                >
                  <Link href={`/admin/tournaments/${tournamentId}/${tab.id}`}>
                    <span className="mr-1">{tab.icon}</span>
                    {tab.label}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        </header>

        {/* 콘텐츠 */}
        <div>{children}</div>
      </div>
    </div>
  );
}
