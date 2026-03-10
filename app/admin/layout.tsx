"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { createClient } from "../../lib/supabaseClient";
import { getTournamentAdminAccess } from "../../lib/tournamentAdminAccess";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useToast } from "../../components/ui/toast";

function parseTournamentId(pathname: string): number | null {
  const matched = pathname.match(/^\/admin\/tournaments\/(\d+)(?:\/|$)/);
  if (!matched) return null;
  const parsed = Number(matched[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (loading) return;

    if (!user?.id) {
      setAccessGranted(false);
      setChecking(false);
      return;
    }

    (async () => {
      const supabase = createClient();

      try {
        const tournamentId = parseTournamentId(pathname);

        if (pathname === "/admin/tournaments") {
          const access = await getTournamentAdminAccess(supabase, user.id);
          setAccessGranted(access.isAdmin || access.hasAnyManagedTournament);
          setChecking(false);
          return;
        }

        if (tournamentId) {
          const access = await getTournamentAdminAccess(supabase, user.id, tournamentId);
          setAccessGranted(access.canManageTournament);
          setChecking(false);
          return;
        }

        const access = await getTournamentAdminAccess(supabase, user.id);
        setAccessGranted(access.isAdmin);
      } catch (err) {
        setError(err instanceof Error ? err.message : "권한 확인 중 오류가 발생했습니다.");
        setAccessGranted(false);
      } finally {
        setChecking(false);
      }
    })();
  }, [loading, pathname, user?.id]);

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
      <main className="min-h-screen bg-slate-50/70 px-4 py-10 md:px-6 lg:px-8">
        <Card className="mx-auto max-w-3xl border-slate-200/70 p-6">
          <p className="text-sm text-slate-500">권한을 확인하는 중입니다...</p>
        </Card>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-4 py-10 md:px-6 lg:px-8">
        <Card className="mx-auto max-w-3xl border-slate-200/70 p-6">
          <p className="text-sm text-slate-600">관리 페이지는 로그인 후 이용할 수 있습니다.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/login">로그인으로 이동</Link>
          </Button>
        </Card>
      </main>
    );
  }

  if (!accessGranted) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-4 py-10 md:px-6 lg:px-8">
        <Card className="mx-auto max-w-3xl border-slate-200/70 p-6">
          <p className="text-sm text-slate-600">접근 권한이 없습니다.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/start">시작 페이지로 이동</Link>
          </Button>
        </Card>
      </main>
    );
  }

  return <div className="min-h-screen bg-slate-50/70">{children}</div>;
}
