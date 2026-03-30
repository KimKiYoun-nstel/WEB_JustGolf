"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
import { getTournamentAdminAccess } from "../../../../../lib/tournamentAdminAccess";
import { formatRegistrationStatus } from "../../../../../lib/statusLabels";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Input } from "../../../../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../components/ui/table";
import { useToast } from "../../../../../components/ui/toast";
import { useTableOfContents, type TOCItem } from "../../../../../components/TableOfContents";

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

type RegistrationCountRow = {
  tournament_id: number;
  status: string;
  count: number | string | null;
};

type RegistrationSummary = {
  total: number;
  applied: number;
  approved: number;
  waitlisted: number;
  canceled: number;
};

const statuses: Registration["status"][] = [
  "applied",
  "approved",
  "waitlisted",
  "canceled",
];

const REGISTRATION_PAGE_SIZE = 120;

const REGISTRATION_SELECT_FIELDS = `
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
`;

const createEmptyRegistrationSummary = (): RegistrationSummary => ({
  total: 0,
  applied: 0,
  approved: 0,
  waitlisted: 0,
  canceled: 0,
});

const statusTransitionTargets = statuses.reduce((acc, current) => {
  acc[current] = statuses.filter((status) => status !== current);
  return acc;
}, {} as Record<Registration["status"], Registration["status"][]>);

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
};

export default function AdminRegistrationsPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const [rows, setRows] = useState<Registration[]>([]);
  const [registrationSummary, setRegistrationSummary] = useState<RegistrationSummary>(
    createEmptyRegistrationSummary()
  );
  const [totalRegistrationCount, setTotalRegistrationCount] = useState(0);
  const [registrationOffset, setRegistrationOffset] = useState(0);
  const [hasMoreRegistrations, setHasMoreRegistrations] = useState(false);
  const [loadingMoreRegistrations, setLoadingMoreRegistrations] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [isDoneTournament, setIsDoneTournament] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exportingScope, setExportingScope] = useState<"approved" | "grouped" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Registration["status"]>("all");
  const [sortOrder, setSortOrder] = useState<"createdAsc" | "createdDesc" | "nicknameAsc">("createdAsc");
  const { toast } = useToast();

  const buildRegistrationSummary = useCallback(
    (countRows: RegistrationCountRow[] | null | undefined): RegistrationSummary => {
      const summary = createEmptyRegistrationSummary();
      (countRows ?? []).forEach((row) => {
        const count = Number(row.count ?? 0);
        if (row.status === "applied") summary.applied = count;
        if (row.status === "approved") summary.approved = count;
        if (row.status === "waitlisted") summary.waitlisted = count;
        if (row.status === "canceled") summary.canceled = count;
      });
      summary.total =
        summary.applied + summary.approved + summary.waitlisted + summary.canceled;
      return summary;
    },
    []
  );

  const transformRegistrationRows = useCallback(
    (dataRows: RegistrationRow[], profileMap: Map<string, string | null>) => {
      return dataRows.map((row) => {
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
        } as Registration;
      });
    },
    []
  );

  const fetchRegistrationPage = useCallback(
    async (offset: number) => {
      const supabase = createClient();
      const { data, error, count } = await supabase
        .from("registrations")
        .select(REGISTRATION_SELECT_FIELDS, { count: "exact" })
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: true })
        .range(offset, offset + REGISTRATION_PAGE_SIZE - 1);

      if (error) throw new Error(error.message);

      const dataRows = (data ?? []) as RegistrationRow[];
      const registeringUserIds = Array.from(
        new Set(dataRows.map((row) => row.registering_user_id).filter(Boolean))
      ) as string[];

      let profileMap = new Map<string, string | null>();
      if (registeringUserIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, nickname")
          .in("id", registeringUserIds);

        if (profileError) throw new Error(profileError.message);
        profileMap = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p.nickname]));
      }

      return {
        transformedRows: transformRegistrationRows(dataRows, profileMap),
        totalCount: Number(count ?? 0),
      };
    },
    [tournamentId, transformRegistrationRows]
  );

  const load = useCallback(async () => {
    setMsg("");
    setLoading(true);
    setLoadingMoreRegistrations(false);
    setRows([]);
    setRegistrationOffset(0);
    setHasMoreRegistrations(false);
    setTotalRegistrationCount(0);
    setRegistrationSummary(createEmptyRegistrationSummary());

    try {
      const supabase = createClient();
      const tournamentRes = await supabase
        .from("tournaments")
        .select("status")
        .eq("id", tournamentId)
        .maybeSingle<{ status: string }>();

      if (!tournamentRes.error) {
        setIsDoneTournament(tournamentRes.data?.status === "done");
      }

      const [summaryResult, firstPage] = await Promise.all([
        supabase.rpc("get_registration_counts_by_tournaments", {
          tournament_ids: [tournamentId],
        }),
        fetchRegistrationPage(0),
      ]);

      if (summaryResult.error) {
        throw new Error(`요약 조회 실패: ${summaryResult.error.message}`);
      }

      const summary = buildRegistrationSummary(
        (summaryResult.data ?? []) as RegistrationCountRow[]
      );
      setRegistrationSummary(summary);

      setRows(firstPage.transformedRows);
      setTotalRegistrationCount(firstPage.totalCount);
      setRegistrationOffset(firstPage.transformedRows.length);
      setHasMoreRegistrations(firstPage.transformedRows.length < firstPage.totalCount);
    } catch (error) {
      setMsg(`조회 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      setLoading(false);
    }
  }, [buildRegistrationSummary, fetchRegistrationPage, tournamentId]);

  const loadMoreRegistrations = useCallback(async () => {
    if (loadingMoreRegistrations || !hasMoreRegistrations) return;

    setLoadingMoreRegistrations(true);
    setMsg("");

    try {
      const currentOffset = registrationOffset;
      const nextPage = await fetchRegistrationPage(currentOffset);

      setRows((prev) => [...prev, ...nextPage.transformedRows]);
      const nextOffset = currentOffset + nextPage.transformedRows.length;
      setRegistrationOffset(nextOffset);
      setTotalRegistrationCount(nextPage.totalCount);
      setHasMoreRegistrations(nextOffset < nextPage.totalCount);
    } catch (error) {
      setMsg(`추가 조회 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      setLoadingMoreRegistrations(false);
    }
  }, [fetchRegistrationPage, hasMoreRegistrations, loadingMoreRegistrations, registrationOffset]);

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    
    // Auth 로딩이 끝날 때까지 대기
    if (authLoading) return;

    // 로그인되지 않으면 로그인 페이지로
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const checkAccess = async () => {
      const supabase = createClient();
      const access = await getTournamentAdminAccess(supabase, user.id, tournamentId);
      if (!access.canManageTournament) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      await load();
    };

    void checkAccess();
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
    if (isDoneTournament) {
      setMsg("종료된 대회는 신청 상태를 변경할 수 없습니다.");
      return;
    }

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
  }, [load, isDoneTournament]);

  const updateSelectedStatus = useCallback(async (status: Registration["status"]) => {
    if (isDoneTournament) {
      setMsg("종료된 대회는 신청 상태를 일괄 변경할 수 없습니다.");
      return;
    }

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
  }, [selectedIds, load, isDoneTournament]);

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

  const filteredRows = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const statusMatched = statusFilter === "all" ? true : row.status === statusFilter;
      if (!statusMatched) return false;

      if (!keyword) return true;

      const searchable = [
        row.nickname,
        row.registering_user_nickname ?? "",
        row.memo ?? "",
        row.meal_name ?? "",
        row.activities.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(keyword);
    });

    const sorted = [...filtered].sort((left, right) => {
      if (sortOrder === "nicknameAsc") {
        return left.nickname.localeCompare(right.nickname, "ko");
      }

      const leftAt = new Date(left.created_at).getTime();
      const rightAt = new Date(right.created_at).getTime();

      if (Number.isNaN(leftAt) || Number.isNaN(rightAt)) return 0;
      return sortOrder === "createdDesc" ? rightAt - leftAt : leftAt - rightAt;
    });

    return sorted;
  }, [rows, searchQuery, statusFilter, sortOrder]);

  const appliedRows = useMemo(
    () => filteredRows.filter((r) => r.status === "applied"),
    [filteredRows]
  );

  const allRowsSelected = useMemo(
    () =>
      filteredRows.length > 0 && filteredRows.every((row) => selectedIds.has(row.id)),
    [filteredRows, selectedIds]
  );
  const selectedVisibleCount = useMemo(
    () => filteredRows.filter((row) => selectedIds.has(row.id)).length,
    [filteredRows, selectedIds]
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const shouldClear =
        filteredRows.length > 0 && filteredRows.every((row) => prev.has(row.id));
      const next = new Set(prev);
      if (shouldClear) {
        filteredRows.forEach((row) => next.delete(row.id));
        return next;
      }
      filteredRows.forEach((row) => next.add(row.id));
      return next;
    });
  }, [filteredRows]);

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

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(rows.map((row) => row.id));
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  // 식사 메뉴 통계 (현재 로드/필터 기준)
  const stats = useMemo(() => {
    const mealCount = new Map<string, number>();
    filteredRows.forEach((r) => {
      if (r.meal_name) {
        mealCount.set(r.meal_name, (mealCount.get(r.meal_name) ?? 0) + 1);
      }
    });

    return { mealCount };
  }, [filteredRows]);

  // 상태별 그룹화
  const groupedByStatus = {
    applied: filteredRows.filter((r) => r.status === "applied"),
    approved: filteredRows.filter((r) => r.status === "approved"),
    waitlisted: filteredRows.filter((r) => r.status === "waitlisted"),
    canceled: filteredRows.filter((r) => r.status === "canceled"),
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
            disabled={isDoneTournament}
          >
            {formatRegistrationStatus(nextStatus)}
          </Button>
        ))}
      </div>
    ),
    [updateStatus, isDoneTournament]
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

  const renderRegistrationCard = useCallback(
    (row: Registration) => (
      <article key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={selectedIds.has(row.id)}
              onChange={() => toggleSelect(row.id)}
              aria-label={`${row.nickname} 선택`}
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">{row.nickname}</p>
              <p className="text-xs text-slate-500">
                등록자: {row.registering_user_nickname ?? "-"}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="capitalize">
            {formatRegistrationStatus(row.status)}
          </Badge>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-600">
          <p>구분: {row.user_id ? "회원" : "제3자"}</p>
          <p>식사: {row.meal_name ?? "-"}</p>
          <p className="col-span-2">신청일시: {formatDateTime(row.created_at)}</p>
          <p className="col-span-2">활동: {row.activities.length > 0 ? row.activities.join(", ") : "-"}</p>
          <div className="col-span-2">라운드: {renderRoundPreference(row)}</div>
          <p className="col-span-2">메모: {row.memo ?? "-"}</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">{renderStatusActions(row)}</div>
      </article>
    ),
    [renderRoundPreference, renderStatusActions, selectedIds, toggleSelect]
  );

  // TableOfContents 아이템
  const tocItems: TOCItem[] = [
    ...(groupedByStatus.applied.length > 0 ? [{ id: "applied-section", label: "신청" }] : []),
    ...(groupedByStatus.approved.length > 0 ? [{ id: "approved-section", label: "확정" }] : []),
    ...(groupedByStatus.waitlisted.length > 0 ? [{ id: "waitlisted-section", label: "대기" }] : []),
    ...(groupedByStatus.canceled.length > 0 ? [{ id: "canceled-section", label: "취소" }] : []),
  ];

  const activeSection = useTableOfContents(tocItems.map((item) => item.id));
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.scrollY - 130;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
      <section className="border-b border-slate-100 bg-white px-4 pb-4 pt-6 md:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">
            ADMIN REGISTRATIONS
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">신청자 관리</h1>
          <p className="mt-2 text-sm text-slate-500">
            상태 분류, 일괄 처리, 엑셀 내보내기를 한 화면에서 관리합니다.
          </p>
          {isDoneTournament ? (
            <p className="mt-2 text-sm font-medium text-rose-600">
              종료된 대회입니다. 신청 상태 변경은 잠금 처리되어 읽기 전용입니다.
            </p>
          ) : null}
        </div>
      </section>

      {!loading && !unauthorized && tocItems.length > 0 ? (
        <nav className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2 md:px-6">
            {tocItems.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      ) : null}

      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
        {loading && (
          <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        )}

        {unauthorized && (
          <Card className="rounded-2xl border-red-200 bg-red-50">
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
            <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>신청 현황 통계</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadExcel("approved")}
                    disabled={exportingScope !== null || registrationSummary.approved === 0}
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
                <div className="mb-4 grid gap-3 md:grid-cols-[1fr_160px_190px_auto]">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="닉네임/등록자/메모 검색"
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as "all" | Registration["status"])
                    }
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  >
                    <option value="all">전체 상태</option>
                    <option value="applied">신청</option>
                    <option value="approved">확정</option>
                    <option value="waitlisted">대기</option>
                    <option value="canceled">취소</option>
                  </select>
                  <select
                    value={sortOrder}
                    onChange={(e) =>
                      setSortOrder(e.target.value as "createdAsc" | "createdDesc" | "nicknameAsc")
                    }
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  >
                    <option value="createdAsc">신청일시 오래된순</option>
                    <option value="createdDesc">신청일시 최신순</option>
                    <option value="nicknameAsc">닉네임 가나다순</option>
                  </select>
                  <Button onClick={load} variant="secondary" className="h-11 rounded-2xl">
                    새로고침
                  </Button>
                </div>
                <p className="mb-4 text-xs font-medium text-slate-500">
                  필터 결과 {filteredRows.length}명 / 로드 {rows.length}명 / 전체 {totalRegistrationCount}명
                </p>
                <p className="-mt-2 mb-4 text-xs text-slate-400">
                  상태 통계는 전체 신청자 기준이며, 식사 메뉴 통계는 현재 로드된 결과 기준입니다.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                    <p className="text-xs text-blue-700 font-medium">신청</p>
                    <p className="text-2xl font-bold text-blue-900">{registrationSummary.applied}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-md border border-green-200">
                    <p className="text-xs text-green-700 font-medium">확정</p>
                    <p className="text-2xl font-bold text-green-900">{registrationSummary.approved}</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
                    <p className="text-xs text-yellow-700 font-medium">대기</p>
                    <p className="text-2xl font-bold text-yellow-900">{registrationSummary.waitlisted}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                    <p className="text-xs text-slate-700 font-medium">취소</p>
                    <p className="text-2xl font-bold text-slate-900">{registrationSummary.canceled}</p>
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

                {filteredRows.length > 0 && (
                  <div className="mt-5 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={allRowsSelected}
                        onChange={toggleSelectAll}
                        aria-label="현재 로드 인원 선택"
                      />
                      현재 로드 인원 선택
                    </label>
                    <span className="text-sm text-slate-500">
                      선택 {selectedVisibleCount}명(필터) / 전체 {selectedIds.size}명
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearSelection}
                      disabled={selectedIds.size === 0}
                    >
                      선택 초기화
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateSelectedStatus("approved")}
                      disabled={isDoneTournament || selectedIds.size === 0}
                    >
                      일괄 확정
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateSelectedStatus("waitlisted")}
                      disabled={isDoneTournament || selectedIds.size === 0}
                    >
                      일괄 대기
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateSelectedStatus("canceled")}
                      disabled={isDoneTournament || selectedIds.size === 0}
                    >
                      일괄 취소
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {filteredRows.length === 0 && (
              <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                <CardContent className="py-10 text-center">
                  <p className="text-sm text-slate-500">필터 조건에 맞는 신청자가 없습니다.</p>
                </CardContent>
              </Card>
            )}

            {appliedRows.length > 0 && (
              <Card id="applied-section" className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>📋 신청 ({appliedRows.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 md:hidden">
                    {appliedRows.map((row) => renderRegistrationCard(row))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={allRowsSelected}
                              onChange={toggleSelectAll}
                              aria-label="현재 로드 인원 선택"
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
                          <TableHead>신청일시</TableHead>
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
                            <TableCell className="whitespace-nowrap text-slate-600">
                              {formatDateTime(row.created_at)}
                            </TableCell>
                            <TableCell>
                              {renderStatusActions(row)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {groupedByStatus.approved.length > 0 && (
              <Card id="approved-section" className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>✅ 확정 ({groupedByStatus.approved.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 md:hidden">
                    {groupedByStatus.approved.map((row) => renderRegistrationCard(row))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={allRowsSelected}
                              onChange={toggleSelectAll}
                              aria-label="현재 로드 인원 선택"
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
                          <TableHead>신청일시</TableHead>
                          <TableHead>변경</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedByStatus.approved.map((row) => (
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
                            <TableCell className="whitespace-nowrap text-slate-600">
                              {formatDateTime(row.created_at)}
                            </TableCell>
                            <TableCell>
                              {renderStatusActions(row)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {groupedByStatus.waitlisted.length > 0 && (
              <Card id="waitlisted-section" className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>⏳ 대기 ({groupedByStatus.waitlisted.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 md:hidden">
                    {groupedByStatus.waitlisted.map((row) => renderRegistrationCard(row))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={allRowsSelected}
                              onChange={toggleSelectAll}
                              aria-label="현재 로드 인원 선택"
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
                          <TableHead>신청일시</TableHead>
                          <TableHead>변경</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedByStatus.waitlisted.map((row) => (
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
                            <TableCell className="whitespace-nowrap text-slate-600">
                              {formatDateTime(row.created_at)}
                            </TableCell>
                            <TableCell>
                              {renderStatusActions(row)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {groupedByStatus.canceled.length > 0 && (
              <Card id="canceled-section" className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>❌ 취소 ({groupedByStatus.canceled.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 md:hidden">
                    {groupedByStatus.canceled.map((row) => renderRegistrationCard(row))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={allRowsSelected}
                              onChange={toggleSelectAll}
                              aria-label="현재 로드 인원 선택"
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
                          <TableHead>신청일시</TableHead>
                          <TableHead>변경</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedByStatus.canceled.map((row) => (
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
                            <TableCell className="whitespace-nowrap text-slate-600">
                              {formatDateTime(row.created_at)}
                            </TableCell>
                            <TableCell>
                              {renderStatusActions(row)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {hasMoreRegistrations && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadMoreRegistrations()}
                  disabled={loadingMoreRegistrations}
                >
                  {loadingMoreRegistrations
                    ? "추가 로딩 중..."
                    : `${REGISTRATION_PAGE_SIZE}명 더 보기 (${rows.length}/${totalRegistrationCount})`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
