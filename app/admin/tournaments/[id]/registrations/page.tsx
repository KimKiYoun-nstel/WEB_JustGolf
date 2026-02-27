"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useToast } from "../../../../../components/ui/toast";
import { TableOfContents, useTableOfContents, type TOCItem } from "../../../../../components/TableOfContents";

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
  pre_round_preferred: boolean;
  post_round_preferred: boolean;
  activities: string[];                  // 참여 활동 목록
  created_at: string;
};

type RegistrationActivitySelectionRow = {
  selected?: boolean | null;
  tournament_extras?: { activity_name?: string | null } | null;
};

type RegistrationRow = {
  id: number;
  user_id: string | null;
  registering_user_id: string;
  nickname: string;
  status: Registration["status"];
  memo: string | null;
  meal_option_id: number | null;
  pre_round_preferred?: boolean | null;
  post_round_preferred?: boolean | null;
  tournament_meal_options?: { menu_name?: string | null } | null;
  registration_activity_selections?: RegistrationActivitySelectionRow[] | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  nickname: string | null;
};

const statuses: Registration["status"][] = [
  "applied",
  "approved",
  "waitlisted",
  "canceled",
];

const statusTransitionTargets = statuses.reduce((acc, current) => {
  acc[current] = statuses.filter((status) => status !== current);
  return acc;
}, {} as Record<Registration["status"], Registration["status"][]>);

export default function AdminRegistrationsPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exportingScope, setExportingScope] = useState<"approved" | "grouped" | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
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
        pre_round_preferred,
        post_round_preferred,
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
    const dataRows = (data ?? []) as RegistrationRow[];
    const registeringUserIds = [
      ...new Set(dataRows.map((row) => row.registering_user_id).filter(Boolean)),
    ];
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("id", registeringUserIds);
    
    const profileMap = new Map(
      ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p.nickname])
    );

    // Transform data to include meal_name, activities, and registering_user_nickname
    const transformed = dataRows.map((row) => {
      const activities = (row.registration_activity_selections ?? [])
        .filter((sel) => sel?.selected)
        .map((sel) => sel?.tournament_extras?.activity_name)
        .filter((name): name is string => Boolean(name));

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
        pre_round_preferred: row.pre_round_preferred ?? false,
        post_round_preferred: row.post_round_preferred ?? false,
        activities: activities as string[],
        created_at: row.created_at,
      };
    });

    setRows(transformed as Registration[]);
    setLoading(false);
  }, [tournamentId]);

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

  useEffect(() => {
    if (!msg) return;

    const normalized = msg.replace(/^✅\s*/, "");
    const isSuccess = msg.startsWith("✅") || /완료|저장|변경되었습니다/.test(msg);
    const isError = /실패|오류|없습니다|필요/.test(msg);

    toast({
      variant: isSuccess ? "success" : isError ? "error" : "default",
      title: normalized,
    });
    setMsg("");
  }, [msg, toast]);

  const updateStatus = useCallback(async (
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
  }, [load]);

  const updateSelectedStatus = useCallback(async (status: Registration["status"]) => {
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
  }, [selectedIds, load]);

  const downloadExcel = useCallback(async (scope: "approved" | "grouped") => {
    setExportingScope(scope);
    setMsg("");

    try {
      const response = await fetch(
        `/api/admin/tournaments/${tournamentId}/registrations/export?scope=${scope}&format=xlsx`
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setMsg(`엑셀 다운로드 실패: ${data?.error ?? response.statusText}`);
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const filename =
        filenameMatch?.[1] ??
        `justgolf_t${tournamentId}_${scope}_${new Date().toISOString().replace(/[:.]/g, "")}.xlsx`;

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);

      setMsg("✅ 엑셀 파일 다운로드가 완료되었습니다.");
    } catch (error) {
      setMsg(`엑셀 다운로드 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      setExportingScope(null);
    }
  }, [tournamentId]);

  const appliedRows = useMemo(
    () => rows.filter((r) => r.status === "applied"),
    [rows]
  );

  const allRowsSelected = useMemo(
    () => rows.length > 0 && rows.every((row) => selectedIds.has(row.id)),
    [rows, selectedIds]
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const shouldClear = rows.length > 0 && rows.every((row) => prev.has(row.id));
      if (shouldClear) return new Set();
      return new Set(rows.map((row) => row.id));
    });
  }, [rows]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

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

  // 상태별 그룹화
  const groupedByStatus = {
    applied: rows.filter(r => r.status === "applied"),
    approved: rows.filter(r => r.status === "approved"),
    waitlisted: rows.filter(r => r.status === "waitlisted"),
    canceled: rows.filter(r => r.status === "canceled"),
  };

  const renderStatusActions = useCallback(
    (row: Registration) => (
      <div className="flex flex-wrap gap-1">
        {statusTransitionTargets[row.status].map((nextStatus) => (
          <Button
            key={nextStatus}
            onClick={() => updateStatus(row.id, nextStatus)}
            size="sm"
            variant="ghost"
          >
            {formatRegistrationStatus(nextStatus)}
          </Button>
        ))}
      </div>
    ),
    [updateStatus]
  );

  const renderRoundPreference = useCallback(
    (row: Registration) => {
      if (!row.pre_round_preferred && !row.post_round_preferred) {
        return <span className="text-slate-400 text-xs">-</span>;
      }

      return (
        <div className="flex flex-wrap gap-1">
          {row.pre_round_preferred && (
            <Badge variant="outline" className="text-xs">사전 희망</Badge>
          )}
          {row.post_round_preferred && (
            <Badge variant="outline" className="text-xs">사후 희망</Badge>
          )}
        </div>
      );
    },
    []
  );

  // TableOfContents 아이템
  const tocItems: TOCItem[] = [
    ...(groupedByStatus.applied.length > 0 ? [{ id: "applied-section", label: "신청" }] : []),
    ...(groupedByStatus.approved.length > 0 ? [{ id: "approved-section", label: "확정" }] : []),
    ...(groupedByStatus.waitlisted.length > 0 ? [{ id: "waitlisted-section", label: "대기" }] : []),
    ...(groupedByStatus.canceled.length > 0 ? [{ id: "canceled-section", label: "취소" }] : []),
  ];

  const activeSection = useTableOfContents(tocItems.map((item) => item.id));

  return (
    <main className="min-h-screen bg-[#F2F4F7]">
      <TableOfContents
        items={tocItems}
        activeSection={activeSection}
        fabIcon="☰"
        panelTitle="섹션 메뉴"
        showIcons={false}
      />
      <div className="mx-auto w-full max-w-screen-2xl px-3 md:px-4 lg:px-6 py-8">
        {loading && (
          <Card className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
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
            <Card className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>신청 현황 통계</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadExcel("approved")}
                    disabled={exportingScope !== null || groupedByStatus.approved.length === 0}
                    data-testid="export-approved-xlsx"
                  >
                    {exportingScope === "approved" ? "확정자 엑셀 생성 중..." : "확정자 엑셀 다운로드"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadExcel("grouped")}
                    disabled={exportingScope !== null}
                    data-testid="export-grouped-xlsx"
                  >
                    {exportingScope === "grouped" ? "조편성 엑셀 생성 중..." : "조편성 엑셀 다운로드"}
                  </Button>
                </div>
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

                {rows.length > 0 && (
                  <div className="mt-5 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={allRowsSelected}
                        onChange={toggleSelectAll}
                        aria-label="전체 인원 선택"
                      />
                      전체 인원 선택
                    </label>
                    <span className="text-sm text-slate-500">선택 {selectedIds.size}명</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateSelectedStatus("approved")}
                      disabled={selectedIds.size === 0}
                    >
                      일괄 확정
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateSelectedStatus("waitlisted")}
                      disabled={selectedIds.size === 0}
                    >
                      일괄 대기
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateSelectedStatus("canceled")}
                      disabled={selectedIds.size === 0}
                    >
                      일괄 취소
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {appliedRows.length > 0 && (
              <Card id="applied-section" className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>📋 신청 ({appliedRows.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={allRowsSelected}
                            onChange={toggleSelectAll}
                            aria-label="전체 인원 선택"
                          />
                        </TableHead>
                        <TableHead>닉네임</TableHead>
                        <TableHead>구분</TableHead>
                        <TableHead>등록자</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>식사 메뉴</TableHead>
                        <TableHead>참여 활동</TableHead>
                        <TableHead>라운드 희망</TableHead>
                        <TableHead>메모</TableHead>
                        <TableHead>변경</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appliedRows.map((row) => (
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
                              <Badge variant="outline" className="bg-slate-50 text-slate-700">회원</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">제3자</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {row.registering_user_nickname ?? "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {formatRegistrationStatus(row.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {row.meal_name ? <span className="text-sm">{row.meal_name}</span> : <span className="text-slate-400 text-xs">-</span>}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {row.activities.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {row.activities.map((activity, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">{activity}</Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600">{renderRoundPreference(row)}</TableCell>
                          <TableCell className="text-slate-500 text-sm">{row.memo ?? "-"}</TableCell>
                          <TableCell>
                            {renderStatusActions(row)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {groupedByStatus.approved.length > 0 && (
              <Card id="approved-section" className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>✅ 확정 ({groupedByStatus.approved.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>닉네임</TableHead>
                        <TableHead>구분</TableHead>
                        <TableHead>등록자</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>식사 메뉴</TableHead>
                        <TableHead>참여 활동</TableHead>
                        <TableHead>라운드 희망</TableHead>
                        <TableHead>메모</TableHead>
                        <TableHead>변경</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedByStatus.approved.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.nickname}</TableCell>
                          <TableCell>
                            {row.user_id ? (
                              <Badge variant="outline" className="bg-slate-50 text-slate-700">회원</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">제3자</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {row.registering_user_nickname ?? "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="capitalize">
                              {formatRegistrationStatus(row.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {row.meal_name ? <span className="text-sm">{row.meal_name}</span> : <span className="text-slate-400 text-xs">-</span>}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {row.activities.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {row.activities.map((activity, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">{activity}</Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600">{renderRoundPreference(row)}</TableCell>
                          <TableCell className="text-slate-500 text-sm">{row.memo ?? "-"}</TableCell>
                          <TableCell>
                            {renderStatusActions(row)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {groupedByStatus.waitlisted.length > 0 && (
              <Card id="waitlisted-section" className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>⏳ 대기 ({groupedByStatus.waitlisted.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>닉네임</TableHead>
                        <TableHead>구분</TableHead>
                        <TableHead>등록자</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>식사 메뉴</TableHead>
                        <TableHead>참여 활동</TableHead>
                        <TableHead>라운드 희망</TableHead>
                        <TableHead>메모</TableHead>
                        <TableHead>변경</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedByStatus.waitlisted.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.nickname}</TableCell>
                          <TableCell>
                            {row.user_id ? (
                              <Badge variant="outline" className="bg-slate-50 text-slate-700">회원</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">제3자</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {row.registering_user_nickname ?? "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {formatRegistrationStatus(row.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {row.meal_name ? <span className="text-sm">{row.meal_name}</span> : <span className="text-slate-400 text-xs">-</span>}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {row.activities.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {row.activities.map((activity, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">{activity}</Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600">{renderRoundPreference(row)}</TableCell>
                          <TableCell className="text-slate-500 text-sm">{row.memo ?? "-"}</TableCell>
                          <TableCell>
                            {renderStatusActions(row)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {groupedByStatus.canceled.length > 0 && (
              <Card id="canceled-section" className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>❌ 취소 ({groupedByStatus.canceled.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>닉네임</TableHead>
                        <TableHead>구분</TableHead>
                        <TableHead>등록자</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>식사 메뉴</TableHead>
                        <TableHead>참여 활동</TableHead>
                        <TableHead>라운드 희망</TableHead>
                        <TableHead>메모</TableHead>
                        <TableHead>변경</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedByStatus.canceled.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.nickname}</TableCell>
                          <TableCell>
                            {row.user_id ? (
                              <Badge variant="outline" className="bg-slate-50 text-slate-700">회원</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">제3자</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {row.registering_user_nickname ?? "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {formatRegistrationStatus(row.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {row.meal_name ? <span className="text-sm">{row.meal_name}</span> : <span className="text-slate-400 text-xs">-</span>}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {row.activities.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {row.activities.map((activity, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">{activity}</Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600">{renderRoundPreference(row)}</TableCell>
                          <TableCell className="text-slate-500 text-sm">{row.memo ?? "-"}</TableCell>
                          <TableCell>
                            {renderStatusActions(row)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Button onClick={load} variant="secondary">
              새로고침
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
