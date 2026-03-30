"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
import { getTournamentAdminAccess } from "../../../../../lib/tournamentAdminAccess";
import { formatTournamentStatus } from "../../../../../lib/statusLabels";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Input } from "../../../../../components/ui/input";
import { useToast } from "../../../../../components/ui/toast";

type Status = "draft" | "open" | "closed" | "done" | "deleted";

type Tournament = {
  id: number;
  title: string;
  event_date: string;
  course_name: string | null;
  location: string | null;
  tee_time: string | null;
  notes: string | null;
  open_at: string | null;
  close_at: string | null;
  status: Status;
};

type ResultAsset = {
  tournament_id: number;
  summary_title: string | null;
  summary_text: string | null;
  pdf_url: string | null;
};

const SUMMARY_TEMPLATE = `[갈무리-{{TOURNAMENT_TITLE}}]\n\n안녕하세요, JUST GOLF 운영진입니다.\n\n이번 {{EVENT_DATE}} 대회에 함께해주신 모든 분들께 감사드립니다.\n\n1. 대회 한줄 요약\n- [대회 전체 분위기/핵심 포인트]\n\n2. 주요 결과\n- 우승/TOP3: [내용 입력]\n- 인상적인 기록: [이글/버디/니어/롱기 등]\n\n3. 운영 메모\n- 좋았던 점: [내용 입력]\n- 다음 대회 보완점: [내용 입력]\n\n4. 감사 인사\n- 도움주신 분들: [내용 입력]\n\nJUST GOLF 운영진 드림.`;

const toInputDateTime = (value: string | null) => {
  if (!value) return "";
  return value.slice(0, 16);
};

export default function AdminTournamentEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);
  const defaultPdfUrl = useMemo(() => `/api/tournaments/${params.id}/results/pdf`, [params.id]);

  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [msg, setMsg] = useState("");
  const [isSummarySaving, setIsSummarySaving] = useState(false);
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [courseName, setCourseName] = useState("");
  const [location, setLocation] = useState("");
  const [teeTime, setTeeTime] = useState("");
  const [notes, setNotes] = useState("");
  const [openAt, setOpenAt] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [status, setStatus] = useState<Status>("draft");
  const [originalStatus, setOriginalStatus] = useState<Status | null>(null);
  const [summaryTitle, setSummaryTitle] = useState("");
  const [summaryText, setSummaryText] = useState("");
  const [pdfUrl, setPdfUrl] = useState(defaultPdfUrl);

  const load = async () => {
    const supabase = createClient();
    setMsg("");
    setLoading(true);

    const [{ data, error }, { data: assetData, error: assetError }] = await Promise.all([
      supabase
        .from("tournaments")
        .select("id,title,event_date,course_name,location,tee_time,notes,open_at,close_at,status")
        .eq("id", tournamentId)
        .single(),
      supabase
        .from("tournament_result_assets")
        .select("tournament_id,summary_title,summary_text,pdf_url")
        .eq("tournament_id", tournamentId)
        .maybeSingle(),
    ]);

    if (error) {
      setMsg(`조회 실패: ${error.message}`);
      setLoading(false);
      return;
    }

    if (assetError) {
      setMsg(`결과 갈무리 조회 실패: ${assetError.message}`);
      setLoading(false);
      return;
    }

    const t = data as Tournament;
    const asset = assetData as ResultAsset | null;

    setTitle(t.title ?? "");
    setEventDate(t.event_date ?? "");
    setCourseName(t.course_name ?? "");
    setLocation(t.location ?? "");
    setTeeTime(t.tee_time ?? "");
    setNotes(t.notes ?? "");
    setOpenAt(toInputDateTime(t.open_at));
    setCloseAt(toInputDateTime(t.close_at));
    setStatus(t.status ?? "draft");
    setOriginalStatus(t.status ?? "draft");
    setSummaryTitle(asset?.summary_title ?? `${t.title ?? "대회"} 갈무리`);
    setSummaryText(asset?.summary_text ?? "");
    setPdfUrl(asset?.pdf_url ?? defaultPdfUrl);
    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    if (authLoading) return;

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
  }, [authLoading, tournamentId, user?.id]);

  useEffect(() => {
    if (!msg) return;

    const isSuccess = ["완료", "저장", "복제", "삭제"].some((token) => msg.includes(token));
    const isError = ["실패", "오류", "없습니다", "필수"].some((token) => msg.includes(token));

    toast({
      variant: isSuccess ? "success" : isError ? "error" : "default",
      title: msg,
    });
    setMsg("");
  }, [msg, toast]);

  const saveTournament = async () => {
    const supabase = createClient();
    setMsg("");

    if (originalStatus === "done") {
      setMsg("종료된 대회는 더 이상 수정할 수 없습니다.");
      return;
    }

    if (!title.trim() || !eventDate) {
      setMsg("대회명과 일정은 필수예요.");
      return;
    }

    if (status === "done") {
      const confirmed = confirm(
        "이 대회를 종료 상태로 변경하면 이후 데이터 수정(신청/라운드/조편성/추첨)이 차단됩니다. 계속할까요?"
      );
      if (!confirmed) return;
    }

    const { error } = await supabase
      .from("tournaments")
      .update({
        title: title.trim(),
        event_date: eventDate,
        course_name: courseName.trim() || null,
        location: location.trim() || null,
        tee_time: teeTime.trim() || null,
        notes: notes.trim() || null,
        open_at: openAt || null,
        close_at: closeAt || null,
        status,
        created_by: user?.id ?? null,
      })
      .eq("id", tournamentId);

    if (error) {
      setMsg(`저장 실패: ${error.message}`);
      return;
    }

    setMsg("대회 기본 정보 저장 완료");
  };

  const saveSummaryAsset = async () => {
    const supabase = createClient();
    setIsSummarySaving(true);
    setMsg("");

    const finalTitle = summaryTitle.trim() || `${title.trim() || "대회"} 갈무리`;
    const finalPdfUrl = pdfUrl.trim() || defaultPdfUrl;

    const { error } = await supabase.from("tournament_result_assets").upsert(
      {
        tournament_id: tournamentId,
        summary_title: finalTitle,
        summary_text: summaryText.trim() || null,
        pdf_url: finalPdfUrl,
        created_by: user?.id ?? null,
      },
      { onConflict: "tournament_id" }
    );

    setIsSummarySaving(false);

    if (error) {
      setMsg(`결과 갈무리 저장 실패: ${error.message}`);
      return;
    }

    setSummaryTitle(finalTitle);
    setPdfUrl(finalPdfUrl);
    setMsg("결과 갈무리 저장 완료");
  };

  const applySummaryTemplate = () => {
    if (summaryText.trim() && !confirm("기존 갈무리 내용을 템플릿으로 덮어쓸까요?")) {
      return;
    }

    setSummaryTitle(`${title.trim() || "대회"} 갈무리`);
    setSummaryText(
      SUMMARY_TEMPLATE.replaceAll("{{TOURNAMENT_TITLE}}", title.trim() || "[대회명]").replaceAll(
        "{{EVENT_DATE}}",
        eventDate || "[대회일]"
      )
    );
    if (!pdfUrl.trim()) {
      setPdfUrl(defaultPdfUrl);
    }
  };

  const duplicate = async () => {
    const supabase = createClient();
    setMsg("");
    if (originalStatus === "done") {
      setMsg("종료된 대회는 복제할 수 없습니다.");
      return;
    }
    if (!title.trim() || !eventDate) {
      setMsg("대회명과 일정은 필수예요.");
      return;
    }

    const { data, error } = await supabase
      .from("tournaments")
      .insert({
        title: `${title.trim()} (복제)`,
        event_date: eventDate,
        course_name: courseName.trim() || null,
        location: location.trim() || null,
        tee_time: teeTime.trim() || null,
        notes: notes.trim() || null,
        open_at: openAt || null,
        close_at: closeAt || null,
        status,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (error) {
      setMsg(`복제 실패: ${error.message}`);
      return;
    }

    const id = data?.id as number | undefined;
    if (id) router.push(`/admin/tournaments/${id}/edit`);
    else setMsg("복제는 되었지만 이동할 수 없어요.");
  };

  const deleteTournament = async () => {
    if (originalStatus === "done") {
      setMsg("종료된 대회는 삭제할 수 없습니다.");
      return;
    }

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

    if (!confirm(confirmMessage)) return;

    const { error } = await supabase.from("tournaments").update({ status: "deleted" }).eq("id", tournamentId);

    if (error) {
      setMsg(`삭제 실패: ${error.message}`);
      return;
    }

    setMsg("✅ 대회가 삭제되었습니다.");
    setTimeout(() => {
      router.push("/admin/tournaments");
    }, 1000);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
          <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
          <Card className="rounded-2xl border-red-200 bg-red-50">
            <CardContent className="py-6 text-red-700">
              <p>관리자만 접근할 수 있습니다.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/admin">관리자 대시보드로</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
      <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 md:px-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">ADMIN TOURNAMENTS</p>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">대회 수정</h1>
        </header>

        <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>대회 기본 정보</CardTitle>
            {originalStatus === "done" ? (
              <p className="text-sm text-rose-600">종료된 대회입니다. 운영 데이터 보호를 위해 기본 정보 수정이 잠겨 있습니다.</p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">대회명 *</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 rounded-2xl border-slate-200 bg-slate-50" disabled={originalStatus === "done"} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">대회일 *</label>
                <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-11 rounded-2xl border-slate-200 bg-slate-50" disabled={originalStatus === "done"} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">코스명</label>
                <Input value={courseName} onChange={(e) => setCourseName(e.target.value)} className="h-11 rounded-2xl border-slate-200 bg-slate-50" disabled={originalStatus === "done"} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">지역</label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} className="h-11 rounded-2xl border-slate-200 bg-slate-50" disabled={originalStatus === "done"} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">티오프</label>
                <Input value={teeTime} onChange={(e) => setTeeTime(e.target.value)} className="h-11 rounded-2xl border-slate-200 bg-slate-50" disabled={originalStatus === "done"} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">상태</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm" disabled={originalStatus === "done"}>
                  <option value="draft">{formatTournamentStatus("draft")}</option>
                  <option value="open">{formatTournamentStatus("open")}</option>
                  <option value="closed">{formatTournamentStatus("closed")}</option>
                  <option value="done">{formatTournamentStatus("done")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">오픈 시각</label>
                <Input type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} className="h-11 rounded-2xl border-slate-200 bg-slate-50" disabled={originalStatus === "done"} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">마감 시각</label>
                <Input type="datetime-local" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} className="h-11 rounded-2xl border-slate-200 bg-slate-50" disabled={originalStatus === "done"} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">메모</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" disabled={originalStatus === "done"} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button onClick={saveTournament} className="w-full sm:w-auto" disabled={originalStatus === "done"}>저장</Button>
              <Button onClick={duplicate} variant="outline" className="w-full sm:w-auto" disabled={originalStatus === "done"}>이 대회 복제</Button>
              {status !== "deleted" && originalStatus !== "done" ? (
                <Button onClick={deleteTournament} variant="destructive" className="w-full sm:w-auto">삭제</Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>결과 갈무리 / summary</CardTitle>
            <p className="text-sm text-slate-500">결과 보기 진입 시 노출되는 팝업 텍스트와 PDF 경로를 관리합니다. 종료 대회도 이 섹션은 별도로 저장할 수 있습니다.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">갈무리 제목</label>
                <Input value={summaryTitle} onChange={(e) => setSummaryTitle(e.target.value)} className="h-11 rounded-2xl border-slate-200 bg-slate-50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">PDF 경로</label>
                <Input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} className="h-11 rounded-2xl border-slate-200 bg-slate-50" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">갈무리 본문</label>
              <textarea value={summaryText} onChange={(e) => setSummaryText(e.target.value)} rows={16} className="min-h-[320px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6" placeholder="대회 결과 보기 팝업에 노출할 요약 텍스트를 입력하세요." />
            </div>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
              <p className="font-medium text-slate-800">템플릿 메모</p>
              <p className="mt-1">`요약 템플릿 넣기`를 누르면 현재 대회명과 날짜를 반영한 기본 summary 문안이 입력됩니다.</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button onClick={saveSummaryAsset} className="w-full sm:w-auto" disabled={isSummarySaving}>{isSummarySaving ? "저장 중..." : "결과 갈무리 저장"}</Button>
              <Button onClick={applySummaryTemplate} variant="outline" className="w-full sm:w-auto">요약 템플릿 넣기</Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={`/t/${tournamentId}/results`}>결과 보기에서 확인</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
