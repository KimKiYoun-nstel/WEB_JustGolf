"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabaseClient";
import { formatTournamentStatus } from "../../../lib/statusLabels";
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
import { useToast } from "../../../components/ui/toast";

type TournamentRow = {
  id: number;
  title: string;
  event_date: string;
  status: string;
};

export default function AdminTournamentsPage() {
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [msg, setMsg] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setMsg("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tournaments")
      .select("id,title,event_date,status")
      .order("event_date", { ascending: false });

    if (error) setMsg(`조회 실패: ${error.message}`);
    else setRows((data ?? []) as TournamentRow[]);
  };
  const deleteTournament = async (tournamentId: number, title: string, status: string) => {
    if (status === "deleted") {
      setMsg("이미 삭제된 대회입니다.");
      return;
    }

    const supabase = createClient();
    const { count: registrationCount, error: countError } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId);

    if (countError) {
      setMsg(`삭제 전 확인 실패: ${countError.message}`);
      return;
    }

    const confirmMessage =
      `"${title}" 대회를 삭제하시겠습니까?\n\n` +
      `현재 신청자: ${registrationCount ?? 0}명\n` +
      "삭제하면 대회는 숨김 처리되며 복구 가능합니다.";

    if (!confirm(confirmMessage)) {
      return;
    }

    setMsg("");
    const { error } = await supabase
      .from("tournaments")
      .update({ status: "deleted" })
      .eq("id", tournamentId);

    if (error) {
      setMsg(`삭제 실패: ${error.message}`);
    } else {
      setMsg("✅ 대회가 삭제되었습니다.");
      await load();
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!msg) return;

    const normalized = msg.replace(/^✅\s*/, "");
    const isSuccess = msg.startsWith("✅") || /완료|삭제되었습니다/.test(msg);
    const isError = /실패|오류|없습니다|필요/.test(msg);

    toast({
      variant: isSuccess ? "success" : isError ? "error" : "default",
      title: normalized,
    });
    setMsg("");
  }, [msg, toast]);

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
          <div className="space-y-3">
            {rows.map((row) => (
              <Card key={row.id} className="border-slate-200/70">
                <CardHeader className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{row.title}</CardTitle>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{row.event_date}</span>
                        <Badge variant="secondary" className="capitalize">
                          {formatTournamentStatus(row.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/tournaments/${row.id}/edit`}>
                        수정
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/tournaments/${row.id}/dashboard`}>
                        대회 현황
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/tournaments/${row.id}/registrations`}>
                        신청자 관리
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/tournaments/${row.id}/side-events`}>
                        라운드 관리
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/tournaments/${row.id}/files`}>
                        파일 관리
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/tournaments/${row.id}/meal-options`}>
                        메뉴 관리
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/tournaments/${row.id}/extras`}>
                        활동 관리
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/tournaments/${row.id}/groups`}>
                        조편성
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/tournaments/${row.id}/draw`}>
                        라이브 조편성
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/t/${row.id}/participants`}>참가자 현황</Link>
                    </Button>
                    {row.status !== "deleted" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteTournament(row.id, row.title, row.status)}
                      >
                        삭제
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button onClick={load} variant="secondary">
            새로고침
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
