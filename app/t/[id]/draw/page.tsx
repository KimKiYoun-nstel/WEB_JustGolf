"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";

export default function TournamentDrawPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>Draw</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Draw information will be available soon.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={`/t/${tournamentId}/groups`}>View groups</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/t/${tournamentId}/participants`}>
                  View participants
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
