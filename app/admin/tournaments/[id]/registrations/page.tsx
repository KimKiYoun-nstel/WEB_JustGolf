"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";
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
  status: "applied" | "confirmed" | "waitlisted" | "canceled";
  memo: string | null;
  created_at: string;
};

const statuses: Registration["status"][] = [
  "applied",
  "confirmed",
  "waitlisted",
  "canceled",
];

export default function AdminRegistrationsPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const [rows, setRows] = useState<Registration[]>([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setMsg("");
    const { data, error } = await supabase
      .from("registrations")
      .select("id,user_id,nickname,status,memo,created_at")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });

    if (error) setMsg(`조회 실패: ${error.message}`);
    else setRows((data ?? []) as Registration[]);
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    load();
  }, [tournamentId]);

  const updateStatus = async (
    id: number,
    status: Registration["status"]
  ) => {
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
    <main>
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
    </main>
  );
}
