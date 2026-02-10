"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Input } from "../../../../../components/ui/input";

type Group = {
  id: number;
  tournament_id: number;
  group_no: number;
  tee_time: string | null;
  is_published: boolean;
  notes: string | null;
};

type GroupMember = {
  id: number;
  group_id: number;
  registration_id: number;
  position: number;
  role: string | null;
  nickname: string | null;
};

type Registration = {
  id: number;
  nickname: string;
  status: "approved";
};

export default function AdminTournamentGroupsPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [confirmedRegs, setConfirmedRegs] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const checkAdminAndLoad = async () => {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      await loadAll();
    };

    checkAdminAndLoad();
  }, [tournamentId, user?.id, authLoading]);

  const loadAll = async () => {
    const supabase = createClient();
    setMsg("");
    setLoading(true);

    const groupRes = await supabase
      .from("tournament_groups")
      .select("id,tournament_id,group_no,tee_time,is_published,notes")
      .eq("tournament_id", tournamentId)
      .order("group_no", { ascending: true });

    if (groupRes.error) {
      setMsg(`조 편성 조회 실패: ${groupRes.error.message}`);
      setLoading(false);
      return;
    }

    const groupRows = (groupRes.data ?? []) as Group[];
    setGroups(groupRows);

    const regRes = await supabase
      .from("registrations")
      .select("id,nickname,status")
      .eq("tournament_id", tournamentId)
      .eq("status", "approved")
      .order("id", { ascending: true });

    if (regRes.error) {
      setMsg(`참가자 조회 실패: ${regRes.error.message}`);
      setLoading(false);
      return;
    }

    setConfirmedRegs((regRes.data ?? []) as Registration[]);

    if (groupRows.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const groupIds = groupRows.map((g) => g.id);
    const memberRes = await supabase
      .from("tournament_group_members")
      .select("id,group_id,registration_id,position,role,registrations(nickname)")
      .in("group_id", groupIds);

    if (memberRes.error) {
      setMsg(`멤버 조회 실패: ${memberRes.error.message}`);
      setLoading(false);
      return;
    }

    const mapped = (memberRes.data ?? []).map((row: any) => ({
      id: row.id,
      group_id: row.group_id,
      registration_id: row.registration_id,
      position: row.position,
      role: row.role ?? null,
      nickname: row.registrations?.nickname ?? null,
    }));

    setMembers(mapped as GroupMember[]);
    setLoading(false);
  };

  const createGroup = async () => {
    const supabase = createClient();
    setMsg("");
    const nextNo = groups.length > 0 ? Math.max(...groups.map((g) => g.group_no)) + 1 : 1;
    const { error } = await supabase.from("tournament_groups").insert({
      tournament_id: tournamentId,
      group_no: nextNo,
      is_published: false,
    });

    if (error) {
      setMsg(`조 생성 실패: ${error.message}`);
      return;
    }

    await loadAll();
  };

  const updateGroup = async (group: Group) => {
    const supabase = createClient();
    setMsg("");
    const { error } = await supabase
      .from("tournament_groups")
      .update({ tee_time: group.tee_time })
      .eq("id", group.id);

    if (error) {
      setMsg(`티오프 저장 실패: ${error.message}`);
      return;
    }

    setMsg("티오프 시간이 저장되었습니다.");
  };

  const togglePublish = async (group: Group) => {
    const supabase = createClient();
    setMsg("");
    const { error } = await supabase
      .from("tournament_groups")
      .update({ is_published: !group.is_published })
      .eq("id", group.id);

    if (error) {
      setMsg(`공개 상태 변경 실패: ${error.message}`);
      return;
    }

    await loadAll();
  };

  const setAllPublish = async (nextState: boolean) => {
    const supabase = createClient();
    setMsg("");
    const { error } = await supabase
      .from("tournament_groups")
      .update({ is_published: nextState })
      .eq("tournament_id", tournamentId);

    if (error) {
      setMsg(`일괄 공개 변경 실패: ${error.message}`);
      return;
    }

    await loadAll();
  };

  const deleteGroup = async (group: Group) => {
    const supabase = createClient();
    const hasMembers = members.some((m) => m.group_id === group.id);
    if (hasMembers) {
      const ok = confirm("배정된 멤버가 있습니다. 그래도 삭제할까요?");
      if (!ok) return;
    } else {
      const ok = confirm("이 조를 삭제할까요?");
      if (!ok) return;
    }

    const { error } = await supabase
      .from("tournament_groups")
      .delete()
      .eq("id", group.id);

    if (error) {
      setMsg(`삭제 실패: ${error.message}`);
      return;
    }

    await loadAll();
  };

  const updateMember = async (
    groupId: number,
    position: number,
    registrationId: number | null
  ) => {
    const supabase = createClient();
    setMsg("");

    if (!registrationId) {
      const { error } = await supabase
        .from("tournament_group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("position", position);

      if (error) {
        setMsg(`멤버 해제 실패: ${error.message}`);
        return;
      }

      await loadAll();
      return;
    }

    // Remove existing assignment for this registration
    await supabase
      .from("tournament_group_members")
      .delete()
      .eq("registration_id", registrationId);

    const { error } = await supabase
      .from("tournament_group_members")
      .upsert(
        {
          group_id: groupId,
          registration_id: registrationId,
          position,
        },
        { onConflict: "group_id,position" }
      );

    if (error) {
      setMsg(`멤버 배정 실패: ${error.message}`);
      return;
    }

    await loadAll();
  };

  const updateGroupField = (groupId: number, field: "tee_time", value: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, [field]: value } : g))
    );
  };

  const memberFor = (groupId: number, position: number) =>
    members.find((m) => m.group_id === groupId && m.position === position);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto max-w-5xl px-6 py-10">
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
        <div className="mx-auto max-w-5xl px-6 py-10">
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
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">조편성 관리</h1>
            <p className="text-sm text-slate-500">
              확정 참가자를 조에 배정하고 공개 여부를 설정합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={createGroup}>조 추가</Button>
            <Button variant="outline" onClick={() => setAllPublish(true)}>
              전체 공개
            </Button>
            <Button variant="outline" onClick={() => setAllPublish(false)}>
              전체 비공개
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/t/${tournamentId}/groups`}>공개 보기</Link>
            </Button>
          </div>
        </div>

        {msg && <p className="mb-4 text-sm text-red-600">{msg}</p>}

        {groups.length === 0 ? (
          <Card className="border-slate-200/70">
            <CardContent className="py-10 text-center text-sm text-slate-500">
              아직 조가 없습니다. "조 추가" 버튼을 눌러 생성하세요.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <Card key={group.id} className="border-slate-200/70">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <span>{group.group_no}조</span>
                    <Badge variant={group.is_published ? "default" : "secondary"}>
                      {group.is_published ? "공개" : "비공개"}
                    </Badge>
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => togglePublish(group)}>
                      {group.is_published ? "비공개" : "공개"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateGroup(group)}>
                      티오프 저장
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteGroup(group)}>
                      삭제
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">티오프 시간</label>
                      <Input
                        value={group.tee_time ?? ""}
                        placeholder="예: 08:10"
                        onChange={(e) => updateGroupField(group.id, "tee_time", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {[1, 2, 3, 4].map((position) => {
                      const member = memberFor(group.id, position);
                      return (
                        <div key={position} className="space-y-2">
                          <label className="text-sm font-medium">{position}번</label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                            value={member?.registration_id ?? ""}
                            onChange={(e) =>
                              updateMember(
                                group.id,
                                position,
                                e.target.value ? Number(e.target.value) : null
                              )
                            }
                          >
                            <option value="">배정 안 함</option>
                            {confirmedRegs.map((reg) => (
                              <option key={reg.id} value={reg.id}>
                                {reg.nickname}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
