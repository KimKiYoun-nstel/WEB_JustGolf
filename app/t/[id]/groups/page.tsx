"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../lib/supabaseClient";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";

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

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

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
      setMsg(`조 편성 조회 실패: ${groupRes.error.message}`);
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

    const groupIds = groupRows.map((g) => g.id);
    const memberRes = await supabase
      .from("tournament_group_members")
      .select("id,group_id,position,role,registrations(nickname)")
      .in("group_id", groupIds);

    if (memberRes.error) {
      setMsg(`멤버 조회 실패: ${memberRes.error.message}`);
      setLoading(false);
      return;
    }

    const mapped: GroupMember[] = ((memberRes.data ?? []) as GroupMemberQueryRow[]).map(
      (row) => {
        const registration =
          Array.isArray(row.registrations) ? row.registrations[0] : row.registrations;

        return {
          id: row.id,
          group_id: row.group_id,
          position: row.position,
          role: row.role ?? null,
          nickname: registration?.nickname ?? null,
        };
      }
    );

    setMembers(mapped);
    setLoading(false);
  };

  const membersFor = (groupId: number) =>
    members
      .filter((m) => m.group_id === groupId)
      .sort((a, b) => a.position - b.position);

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">조편성</h1>
            <p className="text-sm text-slate-500">
              공개된 조편성만 표시됩니다.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/t/${tournamentId}/participants`}>참가자 현황으로</Link>
          </Button>
        </div>

        {msg && <p className="mb-4 text-sm text-red-600">{msg}</p>}

        {loading ? (
          <Card className="border-slate-200/70">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="border-slate-200/70">
            <CardContent className="py-10 text-center text-sm text-slate-500">
              아직 조편성이 공개되지 않았습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <Card key={group.id} className="border-slate-200/70">
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <span>{group.group_no}조</span>
                    <Badge variant="default">공개</Badge>
                  </CardTitle>
                  {group.tee_time && (
                    <span className="text-sm text-slate-500">
                      티오프: {group.tee_time}
                    </span>
                  )}
                </CardHeader>
                <CardContent>
                  {membersFor(group.id).length === 0 ? (
                    <p className="text-sm text-slate-500">
                      배정된 멤버가 없습니다.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-slate-200">
                      <div className="grid grid-cols-2 bg-slate-100/80 text-xs font-semibold text-slate-700">
                        <div className="px-3 py-2 text-center">순번</div>
                        <div className="px-3 py-2 text-center">닉네임</div>
                      </div>
                      <ul className="divide-y divide-slate-100">
                        {membersFor(group.id).map((member) => (
                          <li
                            key={member.id}
                            className="grid grid-cols-2 bg-white text-sm text-slate-700"
                          >
                            <span className="px-3 py-2 text-center">
                              {member.position}
                            </span>
                            <span className="px-3 py-2 text-center">
                              {member.nickname ?? "-"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
