"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import { useAuth } from "../../../../lib/auth";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";

type Tournament = {
  id: number;
  title: string;
  event_date: string;
  status: string;
};

type Registration = {
  id: number;
  user_id: string;
  nickname: string;
  status: string;
  memo: string | null;
  meal_name: string | null;
  carpool_available: boolean | null;
  carpool_seats: number | null;
  transportation: string | null;
  departure_location: string | null;
  notes: string | null;
  created_at: string;
};

export default function TournamentParticipantsPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const { user } = useAuth();
  const [t, setT] = useState<Tournament | null>(null);
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setMsg("");

    const tRes = await supabase
      .from("tournaments")
      .select("id,title,event_date,status")
      .eq("id", tournamentId)
      .single();

    if (tRes.error) {
      setMsg(`대회 조회 실패: ${tRes.error.message}`);
      setLoading(false);
      return;
    }

    setT(tRes.data as Tournament);

    const rRes = await supabase
      .from("registrations")
      .select(
        "id,user_id,nickname,status,memo,created_at,"
          + "tournament_meal_options(menu_name),"
          + "registration_extras(carpool_available,carpool_seats,transportation,departure_location,notes)"
      )
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });

    if (rRes.error) {
      setMsg(`참가자 조회 실패: ${rRes.error.message}`);
      setLoading(false);
      return;
    }

    const transformed = (rRes.data ?? []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      nickname: row.nickname,
      status: row.status,
      memo: row.memo ?? null,
      meal_name: row.tournament_meal_options?.menu_name ?? null,
      carpool_available: row.registration_extras?.carpool_available ?? null,
      carpool_seats: row.registration_extras?.carpool_seats ?? null,
      transportation: row.registration_extras?.transportation ?? null,
      departure_location: row.registration_extras?.departure_location ?? null,
      notes: row.registration_extras?.notes ?? null,
      created_at: row.created_at,
    }));

    setRows(transformed as Registration[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        {loading && (
          <Card className="border-slate-200/70">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        )}

        {!loading && !t && (
          <Card className="border-slate-200/70">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">대회를 찾을 수 없습니다.</p>
            </CardContent>
          </Card>
        )}

        {!loading && t && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-3xl font-semibold text-slate-900">
                  {t.title}
                </h1>
                <Badge variant="secondary" className="capitalize">
                  {t.status}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                {t.event_date} · 참가자 현황
              </p>
            </div>

            {msg && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {msg}
              </div>
            )}

            <Card className="border-slate-200/70">
              <CardHeader>
                <CardTitle>참가자 목록</CardTitle>
                <CardDescription>
                  신청 정보가 최대한 공개됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rows.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    아직 참가자가 없습니다.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>닉네임</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>식사</TableHead>
                          <TableHead>카풀</TableHead>
                          <TableHead>이동/출발지</TableHead>
                          <TableHead>비고</TableHead>
                          <TableHead>메모</TableHead>
                          <TableHead>신청일시</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{r.nickname}</span>
                                {user?.id && r.user_id === user.id ? (
                                  <Badge variant="outline">나</Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">
                                {r.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {r.meal_name ?? "-"}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {r.carpool_available
                                ? `${r.carpool_seats ?? 0}석`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {r.transportation || r.departure_location
                                ? `${r.transportation ?? "-"} / ${r.departure_location ?? "-"}`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {r.notes ?? "-"}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {r.memo ?? "-"}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {new Date(r.created_at).toLocaleString("ko-KR")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href={`/t/${tournamentId}`}>대회 상세</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
