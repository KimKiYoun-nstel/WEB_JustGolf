"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { formatTournamentStatus } from "../../../../lib/statusLabels";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { useToast } from "../../../../components/ui/toast";

type ResultItem = {
  id: number;
  section: string;
  row_order: number;
  display_name: string;
  score_label: string | null;
  score_value: string | null;
  note: string | null;
  payload: Record<string, unknown>;
  match_status: "matched" | "ambiguous" | "pending";
  matched_user_id: string | null;
  is_mine: boolean;
};

type GroupItem = {
  id: number;
  group_no: number;
  tee_time: string | null;
  members: Array<{
    id: number;
    position: number;
    role: string | null;
    nickname: string | null;
  }>;
};

type ResultApiResponse = {
  tournament: {
    id: number;
    title: string;
    event_date: string;
    status: string;
  };
  summary_title: string;
  summary_text: string;
  pdf_url: string;
  results: ResultItem[];
  groups: GroupItem[];
};

const getTodayKey = () => new Date().toISOString().slice(0, 10);

function isResultApiResponse(payload: unknown): payload is ResultApiResponse {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  return (
    typeof value.summary_title === "string" &&
    typeof value.summary_text === "string" &&
    typeof value.pdf_url === "string" &&
    Array.isArray(value.results) &&
    Array.isArray(value.groups) &&
    !!value.tournament
  );
}

export default function TournamentResultsPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ResultApiResponse | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;

    let active = true;

    const load = async () => {
      setLoading(true);

      const response = await fetch(`/api/tournaments/${tournamentId}/results`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | ResultApiResponse
        | { error?: string }
        | null;

      if (!active) return;

      if (!response.ok || !isResultApiResponse(payload)) {
        const errorMessage =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "결과를 불러오지 못했습니다.";
        toast({ variant: "error", title: errorMessage });
        setLoading(false);
        return;
      }

      setData(payload);
      if (payload.summary_text && typeof window !== "undefined") {
        const seenEverKey = `result-summary-seen-ever:${tournamentId}`;
        const hiddenTodayKey = `result-summary-hide-today:${tournamentId}`;
        const today = getTodayKey();

        const hasSeenEver = window.localStorage.getItem(seenEverKey) === "1";
        const hiddenToday = window.localStorage.getItem(hiddenTodayKey) === today;
        setIsSummaryOpen(!hasSeenEver || !hiddenToday);
      } else {
        setIsSummaryOpen(false);
      }
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [toast, tournamentId]);

  const rowsBySection = useMemo(() => {
    const grouped = new Map<string, ResultItem[]>();
    (data?.results ?? []).forEach((row) => {
      const bucket = grouped.get(row.section) ?? [];
      bucket.push(row);
      grouped.set(row.section, bucket);
    });

    return Array.from(grouped.entries()).map(([section, rows]) => ({
      section,
      rows: [...rows].sort((a, b) => a.row_order - b.row_order || a.id - b.id),
    }));
  }, [data?.results]);

  const closeSummary = (hideToday: boolean) => {
    if (typeof window !== "undefined") {
      const seenEverKey = `result-summary-seen-ever:${tournamentId}`;
      const hiddenTodayKey = `result-summary-hide-today:${tournamentId}`;
      window.localStorage.setItem(seenEverKey, "1");
      if (hideToday) {
        window.localStorage.setItem(hiddenTodayKey, getTodayKey());
      }
    }

    setIsSummaryOpen(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Card>
            <CardContent className="py-10 text-sm text-slate-500">결과를 불러오는 중...</CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Card>
            <CardContent className="py-10 text-sm text-slate-500">결과 정보를 찾을 수 없습니다.</CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/70 px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <Card className="border-slate-200/80">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-xl font-bold text-slate-900 sm:text-2xl">
                {data.tournament.title} 결과 보기
              </CardTitle>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {formatTournamentStatus(data.tournament.status)}
              </span>
            </div>
            <p className="text-sm text-slate-500">{data.tournament.event_date}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/t/${data.tournament.id}/participants`}>참가자 현황</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/t/${data.tournament.id}/groups`}>조편성표</Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="border-slate-200/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">대회 결과</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {rowsBySection.length === 0 ? (
                <p className="text-sm text-slate-500">등록된 결과 행이 아직 없습니다. 아래 PDF를 참고해주세요.</p>
              ) : (
                rowsBySection.map((sectionBlock) => (
                  <div key={sectionBlock.section} className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-700">{sectionBlock.section}</h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">이름</th>
                            <th className="px-3 py-2 text-left font-medium">항목</th>
                            <th className="px-3 py-2 text-left font-medium">값</th>
                            <th className="px-3 py-2 text-left font-medium">비고</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sectionBlock.rows.map((row) => (
                            <tr key={row.id} className="border-t border-slate-100 text-slate-700">
                              <td className="px-3 py-2 align-top">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-slate-900">{row.display_name}</span>
                                  {row.is_mine ? (
                                    <Badge className="bg-emerald-600">본인</Badge>
                                  ) : row.match_status === "ambiguous" ? (
                                    <Badge variant="outline">동명이인</Badge>
                                  ) : row.match_status === "pending" ? (
                                    <Badge variant="outline">매칭 보류</Badge>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-top">{row.score_label ?? "-"}</td>
                              <td className="px-3 py-2 align-top">{row.score_value ?? "-"}</td>
                              <td className="px-3 py-2 align-top text-slate-500">{row.note ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">기존 조편성</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.groups.length === 0 ? (
                <p className="text-sm text-slate-500">공개된 조편성 정보가 없습니다.</p>
              ) : (
                data.groups.map((group) => (
                  <div key={group.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-900">{group.group_no}조</span>
                      <span className="text-slate-500">{group.tee_time ?? "티오프 미정"}</span>
                    </div>
                    {group.members.length === 0 ? (
                      <p className="text-xs text-slate-500">배정 멤버 없음</p>
                    ) : (
                      <ul className="space-y-1 text-sm text-slate-700">
                        {group.members.map((member) => (
                          <li key={member.id} className="flex items-center gap-2">
                            <span className="w-5 text-xs text-slate-500">{member.position}</span>
                            <span className="truncate">{member.nickname ?? "-"}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">원본 PDF</CardTitle>
          </CardHeader>
          <CardContent>
            {data.pdf_url ? (
              <iframe
                src={data.pdf_url}
                title="대회 결과 PDF"
                className="h-[72vh] w-full rounded-xl border border-slate-200"
              />
            ) : (
              <p className="text-sm text-slate-500">등록된 PDF 링크가 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {isSummaryOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="max-h-[82vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">{data.summary_title || "대회 갈무리"}</h2>
            </div>
            <div className="max-h-[56vh] overflow-y-auto px-5 py-4">
              <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{data.summary_text}</pre>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <Button variant="outline" onClick={() => closeSummary(true)}>
                오늘 하루 보지 않기
              </Button>
              <Button onClick={() => closeSummary(false)}>확인</Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
