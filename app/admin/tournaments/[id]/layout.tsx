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
  { id: "dashboard", label: "현황" },
  { id: "edit", label: "수정" },
  { id: "registrations", label: "신청자" },
  { id: "side-events", label: "라운드" },
  { id: "groups", label: "조편성" },
  { id: "extras", label: "활동" },
  { id: "meal-options", label: "메뉴" },
  { id: "files", label: "파일" },
  { id: "manager-setup", label: "관리자" },
  { id: "draw", label: "추첨" },
];

function getCurrentTab(pathname: string, tournamentId: string): string {
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
  const [tabMenuOpen, setTabMenuOpen] = useState(false);

  const currentTab = getCurrentTab(pathname, tournamentId);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      const timer = window.setTimeout(() => setLoading(false), 0);
      return () => window.clearTimeout(timer);
    }

    const checkAdminAndLoadTournament = async () => {
      const supabase = createClient();

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

      const { data: tournamentData } = await supabase
        .from("tournaments")
        .select("id,title")
        .eq("id", Number(tournamentId))
        .single();

      if (tournamentData) {
        setTournament(tournamentData as TournamentInfo);
      }

      setLoading(false);
    };

    void checkAdminAndLoadTournament();
  }, [user?.id, authLoading, tournamentId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-3 py-6 md:px-4 lg:px-6">
        <Card className="mx-auto max-w-7xl border-slate-200/70 p-6">
          <p className="text-sm text-slate-500">濡쒕뵫 以?..</p>
        </Card>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-3 py-6 md:px-4 lg:px-6">
        <Card className="mx-auto max-w-7xl border-slate-200/70 p-6">
          <p className="text-sm text-slate-600">愿由ъ옄 沅뚰븳???놁뒿?덈떎.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/admin">??쒕낫?쒕줈 ?대룞</Link>
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-7xl flex-col px-3 md:px-4 lg:px-6">
        <header className="sticky top-16 z-40 mb-2 border-b border-slate-200/70 bg-slate-50/95 py-1.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                대회 관리
              </p>
              <h1 className="truncate text-xl font-semibold text-slate-900">
                {tournament?.title || "대회"}
              </h1>
            </div>

            <div className="hidden min-w-0 flex-1 md:flex md:justify-end">
              <div className="max-w-full overflow-x-auto">
                <Tabs value={currentTab}>
                  <TabsList className="ml-auto h-9 w-max gap-1 bg-slate-100/80 p-1">
                    {ADMIN_TOURNAMENT_TABS.map((tab) => (
                      <TabsTrigger key={tab.id} value={tab.id} asChild className="px-2.5 py-1 text-sm">
                        <Link href={`/admin/tournaments/${tournamentId}/${tab.id}`}>{tab.label}</Link>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </div>

            <button
              onClick={() => setTabMenuOpen(true)}
              className="ml-auto inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100 md:hidden"
              aria-label="대회 메뉴 열기"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </header>

        <Sheet open={tabMenuOpen} onOpenChange={setTabMenuOpen}>
          <SheetContent className="w-64">
            <SheetHeader>
              <SheetTitle>???硫붾돱</SheetTitle>
              <SheetClose onClick={() => setTabMenuOpen(false)} />
            </SheetHeader>
            <nav className="mt-6 space-y-2">
              {ADMIN_TOURNAMENT_TABS.map((tab) => (
                <Button
                  key={tab.id}
                  asChild
                  className="w-full justify-start"
                  variant={currentTab === tab.id ? "secondary" : "ghost"}
                  onClick={() => setTabMenuOpen(false)}
                >
                  <Link href={`/admin/tournaments/${tournamentId}/${tab.id}`}>{tab.label}</Link>
                </Button>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="pb-4">{children}</div>
      </div>
    </div>
  );
}

