"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../../../lib/supabaseClient";
import { useAuth } from "../../../../lib/auth";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";

type Status = "draft" | "open" | "closed" | "done";

export default function AdminTournamentNewPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [courseName, setCourseName] = useState("");
  const [location, setLocation] = useState("");
  const [teeTime, setTeeTime] = useState("");
  const [notes, setNotes] = useState("");
  const [openAt, setOpenAt] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [status, setStatus] = useState<Status>("draft");
  const [msg, setMsg] = useState("");

  const save = async () => {
    const supabase = createClient();
    setMsg("");
    if (!title.trim() || !eventDate) {
      setMsg("대회명과 일정은 필수예요.");
      return;
    }

    const { data, error } = await supabase
      .from("tournaments")
      .insert({
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
      .select("id")
      .single();

    if (error) {
      setMsg(`생성 실패: ${error.message}`);
      return;
    }

    const id = data?.id as number | undefined;
    if (id) router.push(`/admin/tournaments/${id}/edit`);
    else setMsg("생성은 되었지만 이동할 수 없어요.");
  };

  return (
    <main>
      <Card className="max-w-2xl border-slate-200/70">
        <CardHeader>
          <CardTitle>새 대회 만들기</CardTitle>
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

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button onClick={save} className="w-full sm:w-auto">저장</Button>
          </div>

          {msg && <p className="text-sm text-slate-600">{msg}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
