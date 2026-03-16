"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../lib/supabaseClient";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { useToast } from "../../../../components/ui/toast";

type Group = {
  id: number;
  group_no: number;
  tee_time: string | null;
  is_published: boolean;
};

type GroupMember = {
  id: number;
  group_id: number;
  position: number;
  nickname: string | null;
  role: string | null;
};

type GroupMemberQueryRow = {
  id: number;
  group_id: number;
  position: number;
  role: string | null;
  registrations:
    | { nickname: string | null }
    | { nickname: string | null }[]
    | null;
};

export default function TournamentGroupsPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  useEffect(() => {
    if (!msg) return;

    toast({ variant: "error", title: msg });
    setMsg("");
  }, [msg, toast]);

  const membersByGroupId = useMemo(() => {
    const grouped = new Map<number, GroupMember[]>();
    for (const member of members) {
      const bucket = grouped.get(member.group_id) ?? [];
      bucket.push(member);
      grouped.set(member.group_id, bucket);
    }

    for (const [groupId, bucket] of grouped.entries()) {
      grouped.set(
        groupId,
        [...bucket].sort((left, right) => left.position - right.position)
      );
    }

    return grouped;
  }, [members]);

  const load = async () => {
    setLoading(true);
    setMsg("");

    const supabase = createClient();
    const groupRes = await supabase
      .from("tournament_groups")
      .select("id,group_no,tee_time,is_published")
      .eq("tournament_id", tournamentId)
      .eq("is_published", true)
      .order("group_no", { ascending: true });

    if (groupRes.error) {
      setMsg(`조편성 조회 실패: ${groupRes.error.message}`);
      setLoading(false);
      return;
    }

    const groupRows = (groupRes.data ?? []) as Group[];
    setGroups(groupRows);

    if (groupRows.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const groupIds = groupRows.map((group) => group.id);
    const memberRes = await supabase
      .from("tournament_group_members")
      .select("id,group_id,position,role,registrations(nickname)")
      .in("group_id", groupIds);

    if (memberRes.error) {
      setMsg(`멤버 조회 실패: ${memberRes.error.message}`);
      setLoading(false);
      return;
    }

    const mapped: GroupMember[] = ((memberRes.data ?? []) as GroupMemberQueryRow[]).map((row) => {
      const registration =
        Array.isArray(row.registrations) ? row.registrations[0] : row.registrations;

      return {
        id: row.id,
        group_id: row.group_id,
        position: row.position,
        role: row.role ?? null,
        nickname: registration?.nickname ?? null,
      };
    });

    setMembers(mapped);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">조편성표</h1>
            <p className="text-xs text-slate-500 sm:text-sm">공개된 조편성만 표시됩니다.</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/t/${tournamentId}/participants`}>참가자 현황으로</Link>
          </Button>
        </div>

        {loading ? (
          <Card className="border-slate-200/70">
            <CardContent className="py-8">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="border-slate-200/70">
            <CardContent className="py-8 text-center text-sm text-slate-500">
              아직 조편성이 공개되지 않았습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {groups.map((group) => {
              const groupMembers = membersByGroupId.get(group.id) ?? [];

              return (
                <Card key={group.id} className="border-slate-200/80 shadow-sm">
                  <CardHeader className="space-y-0 px-3 py-2">
                    <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-900">
                      <span className="whitespace-nowrap">{group.group_no}조</span>
                      <span className="whitespace-nowrap text-[11px] font-medium text-slate-500">
                        {group.tee_time ?? "티오프 미정"}
                      </span>
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="px-0 pb-1 pt-0">
                    {groupMembers.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">배정 멤버 없음</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 border-t border-slate-100">
                        {groupMembers.map((member) => (
                          <li
                            key={member.id}
                            className="grid grid-cols-[28px_1fr] items-center gap-2 px-3 py-1.5 text-xs text-slate-700"
                          >
                            <span className="text-center font-medium tabular-nums text-slate-500">
                              {member.position}
                            </span>
                            <span className="truncate whitespace-nowrap font-semibold text-slate-900">
                              {member.nickname ?? "-"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
