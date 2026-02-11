"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
import { formatRegistrationStatus } from "../../../../../lib/statusLabels";
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
  user_id: string | null;                // NULL이면 제3자
  registering_user_id: string;           // 실제 등록한 회원
  registering_user_nickname: string | null; // 등록자 닉네임
  nickname: string;
  status: "applied" | "approved" | "waitlisted" | "canceled";
  memo: string | null;
  meal_option_id: number | null;
  meal_name: string | null;
  activities: string[];                  // 참여 활동 목록
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const load = async () => {
    const supabase = createClient();
    setMsg("");
    setLoading(true);
    const { data, error } = await supabase
      .from("registrations")
      .select(`
        id,
        user_id,
        registering_user_id,
        nickname,
        status,
        memo,
        meal_option_id,
        tournament_meal_options(menu_name),
        registration_activity_selections(selected,tournament_extras(activity_name)),
        created_at
      `)
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });

    if (error) {
      setMsg(`조회 실패: ${error.message}`);
      setLoading(false);
      return;
    }

    // 등록자 닉네임 조회 (profiles)
    const registeringUserIds = [...new Set(
      (data ?? []).map((row: any) => row.registering_user_id).filter(Boolean)
    )];
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("id", registeringUserIds);
    
    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [p.id, p.nickname])
    );

    // Transform data to include meal_name, activities, and registering_user_nickname
    const transformed = (data ?? []).map((row: any) => {
      const activities = (row.registration_activity_selections ?? [])
        .filter((sel: any) => sel?.selected)
        .map((sel: any) => sel?.tournament_extras?.activity_name)
        .filter((name: string | null) => Boolean(name));

      return {
        id: row.id,
        user_id: row.user_id,
        registering_user_id: row.registering_user_id,
        registering_user_nickname: profileMap.get(row.registering_user_id) ?? null,
        nickname: row.nickname,
        status: row.status,
        memo: row.memo,
        meal_option_id: row.meal_option_id,
        meal_name: row.tournament_meal_options?.menu_name ?? null,
        activities: activities as string[],
        created_at: row.created_at,
      };
    });

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
      setMsg("✅ 상태 변경 완료");
      await load();
    }
  };

  const updateSelectedStatus = async (status: Registration["status"]) => {
    if (selectedIds.size === 0) {
      setMsg("신청자를 선택해주세요.");
      return;
    }

    const supabase = createClient();
    setMsg("");
    const { error } = await supabase
      .from("registrations")
      .update({ status })
      .in("id", Array.from(selectedIds));

    if (error) setMsg(`일괄 상태 변경 실패: ${error.message}`);
    else {
      setMsg(`✅ ${selectedIds.size}명의 상태가 변경되었습니다.`);
      setSelectedIds(new Set());
      await load();
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // 통계 계산
  const stats = useMemo(() => {
    const statusCount = {
      applied: rows.filter((r) => r.status === "applied").length,
      approved: rows.filter((r) => r.status === "approved").length,
      waitlisted: rows.filter((r) => r.status === "waitlisted").length,
      canceled: rows.filter((r) => r.status === "canceled").length,
    };

    const mealCount = new Map<string, number>();
    rows.forEach((r) => {
      if (r.meal_name) {
        mealCount.set(r.meal_name, (mealCount.get(r.meal_name) ?? 0) + 1);
      }
    });

    return { statusCount, mealCount };
  }, [rows]);

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
          <>
            <Card className="border-slate-200/70 mb-6">
              <CardHeader>
                <CardTitle>신청 현황 통계</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                    <p className="text-xs text-blue-700 font-medium">신청</p>
                    <p className="text-2xl font-bold text-blue-900">{stats.statusCount.applied}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-md border border-green-200">
                    <p className="text-xs text-green-700 font-medium">확정</p>
                    <p className="text-2xl font-bold text-green-900">{stats.statusCount.approved}</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
                    <p className="text-xs text-yellow-700 font-medium">대기</p>
                    <p className="text-2xl font-bold text-yellow-900">{stats.statusCount.waitlisted}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                    <p className="text-xs text-slate-700 font-medium">취소</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.statusCount.canceled}</p>
                  </div>
                </div>

                {stats.mealCount.size > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">식사 메뉴 통계</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Array.from(stats.mealCount.entries()).map(([meal, count]) => (
                        <div key={meal} className="p-2 bg-slate-50 rounded border border-slate-200">
                          <p className="text-xs text-slate-600">{meal}</p>
                          <p className="text-lg font-semibold text-slate-900">{count}명</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200/70">
              <CardHeader>
                <CardTitle>신청자 관리</CardTitle>
                {selectedIds.size > 0 && (
                  <div className="flex gap-2 mt-4">
                    <Button onClick={() => updateSelectedStatus("approved")} size="sm">
                      선택 확정 ({selectedIds.size})
                    </Button>
                    <Button onClick={() => updateSelectedStatus("waitlisted")} size="sm" variant="outline">
                      선택 대기 ({selectedIds.size})
                    </Button>
                    <Button onClick={() => updateSelectedStatus("canceled")} size="sm" variant="outline">
                      선택 취소 ({selectedIds.size})
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {msg && (
                  <div className={`text-sm p-3 rounded-md ${msg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {msg}
                  </div>
                )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={rows.length > 0 && selectedIds.size === rows.length}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>닉네임</TableHead>
                <TableHead>구분</TableHead>
                <TableHead>등록자</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>식사 메뉴</TableHead>
                <TableHead>참여 활동</TableHead>
                <TableHead>메모</TableHead>
                <TableHead>변경</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{row.nickname}</TableCell>
                  <TableCell>
                    {row.user_id ? (
                      <Badge variant="outline" className="bg-slate-50 text-slate-700">
                        회원
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        제3자
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {row.registering_user_nickname ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={row.status === "approved" ? "default" : "secondary"} 
                      className="capitalize"
                    >
                      {formatRegistrationStatus(row.status)}
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
                    {row.activities.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.activities.map((activity, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {activity}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {row.memo ?? "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {statuses.map((status) => (
                        <Button
                          key={status}
                          onClick={() => updateStatus(row.id, status)}
                          disabled={row.status === status}
                          size="sm"
                          variant={row.status === status ? "secondary" : "ghost"}
                        >
                          {formatRegistrationStatus(status)}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Button onClick={load} variant="secondary">
            새로고침
          </Button>
            </CardContent>
          </Card>
          </>
        )}
      </div>
    </main>
  );
}
