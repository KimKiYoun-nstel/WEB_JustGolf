"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";

export default function AdminTournamentDrawPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    if (authLoading) return;

    if (!user?.id) {
      setLoading(false);
      setMsg("Please sign in to view this page.");
      return;
    }

    const checkAdmin = async () => {
      const supabase = createClient();
      const pRes = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!pRes.data?.is_admin) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      setLoading(false);
    };

    checkAdmin();
  }, [tournamentId, user?.id, authLoading]);

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto max-w-7xl px-3 md:px-4 lg:px-6 py-8">
        {loading && (
          <Card className="border-slate-200/70">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">Loading...</p>
            </CardContent>
          </Card>
        )}

        {unauthorized && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-6 text-red-700">
              <p>Admins only.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/admin">Back to admin</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !unauthorized && (
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>Draw Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">
                Draw setup is not available yet.
              </p>
              {msg && <p className="text-sm text-slate-500">{msg}</p>}
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={`/admin/tournaments/${tournamentId}/groups`}>
                    Manage groups
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/tournaments">Back to tournaments</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
