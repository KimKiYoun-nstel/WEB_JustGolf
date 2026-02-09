"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

type TournamentRow = {
  id: number;
  title: string;
  event_date: string;
  status: string;
};

export default function AdminTournamentsPage() {
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setMsg("");
    const { data, error } = await supabase
      .from("tournaments")
      .select("id,title,event_date,status")
      .order("event_date", { ascending: false });

    if (error) setMsg(`조회 실패: ${error.message}`);
    else setRows((data ?? []) as TournamentRow[]);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <main>
      <Card className="border-slate-200/70">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>대회 목록</CardTitle>
          <Button asChild>
            <Link href="/admin/tournaments/new">새 대회 만들기</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {msg && <p className="text-sm text-red-600">{msg}</p>}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>대회명</TableHead>
                <TableHead>일정</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>{row.event_date}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/tournaments/${row.id}/edit`}>
                          수정
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/admin/tournaments/${row.id}/registrations`}
                        >
                          신청자 관리
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/tournaments/${row.id}/files`}>
                          파일 관리
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/tournaments/${row.id}/side-events`}>
                          라운드 관리
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/tournaments/${row.id}/meal-options`}>
                          메뉴 관리
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/t/${row.id}`}>공개 페이지</Link>
                      </Button>
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
