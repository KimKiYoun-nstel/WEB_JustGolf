"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../components/ui/table";

type Registration = {
  id: number;
  user_id: string;
  nickname: string;
  status: "applied" | "approved" | "waitlisted" | "canceled";
  memo: string | null;
  meal_option_id: number | null;
  meal_name: string | null;
  carpool_available: boolean | null;
  carpool_seats: number | null;
  transportation: string | null;
  departure_location: string | null;
  notes: string | null;
  created_at: string;
};

const statuses: Registration["status"][] = [
  "applied",
  "approved",
  "waitlisted",
  "canceled",
];

export default function AdminRegistrationsPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const supabase = createClient();
    setMsg("");
    setLoading(true);
    const { data, error } = await supabase
      .from("registrations")
      .select(`
        id,
        user_id,
        nickname,
        status,
        memo,
        meal_option_id,
        tournament_meal_options(menu_name),
        registration_extras(carpool_available,carpool_seats,transportation,departure_location,notes),
        created_at
      `)
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });

    if (error) {
      setMsg(`조회 실패: ${error.message}`);
      setLoading(false);
      return;
    }

    // Transform data to include meal_name
    const transformed = (data ?? []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      nickname: row.nickname,
      status: row.status,
      memo: row.memo,
      meal_option_id: row.meal_option_id,
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
    
    // Auth 로딩이 끝날 때까지 대기
    if (authLoading) return;

    // 로그인되지 않으면 로그인 페이지로
    if (!user?.id) {
      setLoading(false);
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

      await load();
    };

    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, user?.id, authLoading]);

  const updateStatus = async (
    id: number,
    status: Registration["status"]
  ) => {
    const supabase = createClient();
    setMsg("");
    const { error } = await supabase
      .from("registrations")
      .update({ status })
      .eq("id", id);

    if (error) setMsg(`상태 변경 실패: ${error.message}`);
    else {
      setMsg("상태 변경 완료");
      await load();
    }
  };

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {loading && (
          <Card className="border-slate-200/70">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        )}

        {unauthorized && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-6 text-red-700">
              <p>관리자만 접근할 수 있습니다.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/admin">관리자 대시보드로</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !unauthorized && (
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>신청자 관리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {msg && <p className="text-sm text-red-600">{msg}</p>}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>닉네임</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>식사 메뉴</TableHead>
                <TableHead>카풀</TableHead>
                <TableHead>이동/출발지</TableHead>
                <TableHead>비고</TableHead>
                <TableHead>메모</TableHead>
                <TableHead>변경</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.nickname}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {row.meal_name ? (
                      <span className="text-sm">{row.meal_name}</span>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {row.carpool_available ? (
                      <span className="text-sm">
                        가능{row.carpool_seats ? ` (${row.carpool_seats}석)` : ""}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {row.transportation || row.departure_location ? (
                      <span className="text-sm">
                        {row.transportation ?? "-"} / {row.departure_location ?? "-"}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {row.notes ? (
                      <span className="text-sm">{row.notes}</span>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {row.memo ?? "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {statuses.map((status) => (
                        <Button
                          key={status}
                          onClick={() => updateStatus(row.id, status)}
                          disabled={row.status === status}
                          size="sm"
                          variant={row.status === status ? "secondary" : "outline"}
                        >
                          {status}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Button onClick={load} variant="ghost">
            새로고침
          </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
