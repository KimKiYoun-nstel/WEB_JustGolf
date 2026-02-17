"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
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

const toInputDateTime = (value: string | null) => {
  if (!value) return "";
  return value.slice(0, 16);
};

export default function AdminTournamentEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [msg, setMsg] = useState("");
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

  const load = async () => {
    const supabase = createClient();
    setMsg("");
    setLoading(true);

    const { data, error } = await supabase
      .from("tournaments")
      .select(
        "id,title,event_date,course_name,location,tee_time,notes,open_at,close_at,status"
      )
      .eq("id", tournamentId)
      .single();

    if (error) {
      setMsg(`조회 실패: ${error.message}`);
      setLoading(false);
      return;
    }

    const t = data as Tournament;
    setTitle(t.title ?? "");
    setEventDate(t.event_date ?? "");
    setCourseName(t.course_name ?? "");
    setLocation(t.location ?? "");
    setTeeTime(t.tee_time ?? "");
    setNotes(t.notes ?? "");
    setOpenAt(toInputDateTime(t.open_at));
    setCloseAt(toInputDateTime(t.close_at));
    setStatus(t.status ?? "draft");
    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    
    // Auth 로딩이 끝날 때까지 대기
    if (authLoading) return;

    // 로그인되지 않으면 리턴
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

    const isSuccess = /완료|저장|복제|삭제되었습니다/.test(msg);
    const isError = /실패|오류|없습니다|필요/.test(msg);

    toast({
      variant: isSuccess ? "success" : isError ? "error" : "default",
      title: msg,
    });
    setMsg("");
  }, [msg, toast]);

  const save = async () => {
    const supabase = createClient();
    setMsg("");
    if (!title.trim() || !eventDate) {
      setMsg("대회명과 일정은 필수예요.");
      return;
    }

    const { error } = await supabase.from("tournaments").update({
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
    }).eq("id", tournamentId);

    if (error) {
      setMsg(`저장 실패: ${error.message}`);
      return;
    }

    setMsg("저장 완료");
  };

  const duplicate = async () => {
    const supabase = createClient();
    setMsg("");
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
      return;
    }

    setMsg("✅ 대회가 삭제되었습니다.");
    setTimeout(() => {
      router.push("/admin/tournaments");
    }, 1000);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <Card className="border-slate-200/70">
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
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <Card className="border-red-200 bg-red-50">
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
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Card className="border-slate-200/70">
        <CardHeader>
          <CardTitle>대회 수정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">대회명 *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">대회일 *</label>
              <Input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">코스명</label>
              <Input
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">지역</label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">티오프</label>
              <Input value={teeTime} onChange={(e) => setTeeTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">상태</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="draft">{formatTournamentStatus("draft")}</option>
                <option value="open">{formatTournamentStatus("open")}</option>
                <option value="closed">{formatTournamentStatus("closed")}</option>
                <option value="done">{formatTournamentStatus("done")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">오픈 시각</label>
              <Input
                type="datetime-local"
                value={openAt}
                onChange={(e) => setOpenAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">마감 시각</label>
              <Input
                type="datetime-local"
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">메모</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="border-input min-h-[120px] w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button onClick={save} className="w-full sm:w-auto">저장</Button>
            <Button onClick={duplicate} variant="outline" className="w-full sm:w-auto">
              이 대회 복제
            </Button>
            {status !== "deleted" && (
              <Button onClick={deleteTournament} variant="destructive" className="w-full sm:w-auto">
                삭제
              </Button>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
    </main>
  );
}
