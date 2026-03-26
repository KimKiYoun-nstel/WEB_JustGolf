import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleSupabaseClient,
  requireApiUser,
} from "../../../../../lib/apiGuard";

type TournamentRow = {
  id: number;
  title: string;
  event_date: string;
  status: string;
};

type ResultAssetRow = {
  tournament_id: number;
  summary_title: string | null;
  summary_text: string | null;
  pdf_url: string | null;
};

type ResultRow = {
  id: number;
  section: string;
  row_order: number;
  display_name: string;
  score_label: string | null;
  score_value: string | null;
  note: string | null;
  payload: Record<string, unknown> | null;
};

type GroupRow = {
  id: number;
  group_no: number;
  tee_time: string | null;
};

type GroupMemberRow = {
  id: number;
  group_id: number;
  position: number;
  role: string | null;
  registrations:
    | { nickname: string | null }
    | { nickname: string | null }[]
    | null;
};

type ProfileNameRow = {
  id: string;
  full_name: string | null;
};

function parseTournamentId(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeDisplayName(value: string | null | undefined) {
  return (value ?? "").trim();
}

async function readFallbackSummaryText() {
  const summaryPath = path.join(process.cwd(), "DevGuide", "20260326", "summary.txt");
  try {
    return await fs.readFile(summaryPath, "utf-8");
  } catch {
    return "";
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournamentId = parseTournamentId(id);
    if (!tournamentId) {
      return NextResponse.json({ error: "유효하지 않은 대회 ID입니다." }, { status: 400 });
    }

    const guard = await requireApiUser();
    if ("error" in guard) return guard.error;

    const supabaseAdmin = createServiceRoleSupabaseClient();

    const tournamentRes = await supabaseAdmin
      .from("tournaments")
      .select("id,title,event_date,status")
      .eq("id", tournamentId)
      .maybeSingle<TournamentRow>();

    if (tournamentRes.error) {
      return NextResponse.json({ error: tournamentRes.error.message }, { status: 500 });
    }

    if (!tournamentRes.data || tournamentRes.data.status === "deleted") {
      return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
    }

    const [assetRes, rowsRes, groupsRes, myProfileRes] = await Promise.all([
      supabaseAdmin
        .from("tournament_result_assets")
        .select("tournament_id,summary_title,summary_text,pdf_url")
        .eq("tournament_id", tournamentId)
        .maybeSingle<ResultAssetRow>(),
      supabaseAdmin
        .from("tournament_result_rows")
        .select("id,section,row_order,display_name,score_label,score_value,note,payload")
        .eq("tournament_id", tournamentId)
        .order("section", { ascending: true })
        .order("row_order", { ascending: true })
        .order("id", { ascending: true }),
      supabaseAdmin
        .from("tournament_groups")
        .select("id,group_no,tee_time")
        .eq("tournament_id", tournamentId)
        .eq("is_published", true)
        .order("group_no", { ascending: true }),
      supabaseAdmin
        .from("profiles")
        .select("id,full_name")
        .eq("id", guard.user.id)
        .maybeSingle<ProfileNameRow>(),
    ]);

    if (assetRes.error) {
      return NextResponse.json({ error: assetRes.error.message }, { status: 500 });
    }
    if (rowsRes.error) {
      return NextResponse.json({ error: rowsRes.error.message }, { status: 500 });
    }
    if (groupsRes.error) {
      return NextResponse.json({ error: groupsRes.error.message }, { status: 500 });
    }
    if (myProfileRes.error) {
      return NextResponse.json({ error: myProfileRes.error.message }, { status: 500 });
    }

    const groups = (groupsRes.data ?? []) as GroupRow[];
    const groupIds = groups.map((group) => group.id);

    let membersByGroupId = new Map<
      number,
      Array<{ id: number; position: number; role: string | null; nickname: string | null }>
    >();

    if (groupIds.length > 0) {
      const memberRes = await supabaseAdmin
        .from("tournament_group_members")
        .select("id,group_id,position,role,registrations(nickname)")
        .in("group_id", groupIds);

      if (memberRes.error) {
        return NextResponse.json({ error: memberRes.error.message }, { status: 500 });
      }

      const rows = (memberRes.data ?? []) as GroupMemberRow[];
      rows.forEach((row) => {
        const registration = Array.isArray(row.registrations)
          ? row.registrations[0]
          : row.registrations;
        const bucket = membersByGroupId.get(row.group_id) ?? [];
        bucket.push({
          id: row.id,
          position: row.position,
          role: row.role ?? null,
          nickname: registration?.nickname ?? null,
        });
        membersByGroupId.set(row.group_id, bucket);
      });

      membersByGroupId = new Map(
        Array.from(membersByGroupId.entries()).map(([groupId, members]) => [
          groupId,
          [...members].sort((a, b) => a.position - b.position),
        ])
      );
    }

    const resultRows = (rowsRes.data ?? []) as ResultRow[];
    const usedDisplayNames = Array.from(
      new Set(
        resultRows
          .map((row) => normalizeDisplayName(row.display_name))
          .filter((name) => name.length > 0)
      )
    );

    let profileRows: ProfileNameRow[] = [];
    if (usedDisplayNames.length > 0) {
      const profileRes = await supabaseAdmin
        .from("profiles")
        .select("id,full_name")
        .in("full_name", usedDisplayNames);

      if (profileRes.error) {
        return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
      }

      profileRows = (profileRes.data ?? []) as ProfileNameRow[];
    }

    const nameToUserIds = new Map<string, string[]>();
    profileRows.forEach((profile) => {
      const normalized = normalizeDisplayName(profile.full_name);
      if (!normalized) return;
      const bucket = nameToUserIds.get(normalized) ?? [];
      bucket.push(profile.id);
      nameToUserIds.set(normalized, bucket);
    });

    const myFullName = normalizeDisplayName(myProfileRes.data?.full_name);

    const resolvedRows = resultRows.map((row) => {
      const normalized = normalizeDisplayName(row.display_name);
      const matchedUserIds = nameToUserIds.get(normalized) ?? [];
      const matchStatus =
        matchedUserIds.length === 1
          ? "matched"
          : matchedUserIds.length > 1
            ? "ambiguous"
            : "pending";
      const matchedUserId = matchedUserIds.length === 1 ? matchedUserIds[0] : null;

      return {
        id: row.id,
        section: row.section,
        row_order: row.row_order,
        display_name: row.display_name,
        score_label: row.score_label,
        score_value: row.score_value,
        note: row.note,
        payload: row.payload ?? {},
        match_status: matchStatus,
        matched_user_id: matchedUserId,
        is_mine:
          matchStatus === "matched" &&
          matchedUserId === guard.user.id &&
          myFullName.length > 0 &&
          myFullName === normalized,
      };
    });

    const fallbackSummary = await readFallbackSummaryText();

    return NextResponse.json(
      {
        tournament: tournamentRes.data,
        summary_title: assetRes.data?.summary_title ?? "대회 갈무리",
        summary_text: assetRes.data?.summary_text ?? fallbackSummary,
        pdf_url: assetRes.data?.pdf_url ?? `/api/tournaments/${tournamentId}/results/pdf`,
        results: resolvedRows,
        groups: groups.map((group) => ({
          id: group.id,
          group_no: group.group_no,
          tee_time: group.tee_time,
          members: membersByGroupId.get(group.id) ?? [],
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Tournament results API error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
