"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Input } from "../../../../../components/ui/input";

type Status = "draft" | "open" | "closed" | "done";

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
  const { user } = useAuth();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

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
    load();
  }, [tournamentId]);

  const save = async () => {
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

  if (loading) {
    return (
      <main>
        <Card className="border-slate-200/70 p-6">
          <p className="text-sm text-slate-500">대회 정보를 불러오는 중...</p>
        </Card>
      </main>
    );
  }

  return (
    <main>
      <Card className="max-w-2xl border-slate-200/70">
        <CardHeader>
          <CardTitle>대회 수정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
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
                <option value="draft">draft</option>
                <option value="open">open</option>
                <option value="closed">closed</option>
                <option value="done">done</option>
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

          <div className="flex flex-wrap gap-2">
            <Button onClick={save}>저장</Button>
            <Button onClick={duplicate} variant="outline">
              이 대회 복제
            </Button>
          </div>

          {msg && <p className="text-sm text-slate-600">{msg}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
