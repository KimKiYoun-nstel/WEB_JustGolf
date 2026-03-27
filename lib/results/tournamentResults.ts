import { promises as fs } from "fs";
import path from "path";
import { unstable_cache } from "next/cache";
import { createServiceRoleSupabaseClient } from "../apiGuard";
import { LEGACY_TOURNAMENT_RESULT_DETAILS } from "./legacyTournamentResultDetails";

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

type CachedGroup = {
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

type CachedTournamentResultsBase = {
  tournament: TournamentRow;
  asset: ResultAssetRow | null;
  rows: ResultRow[];
  groups: CachedGroup[];
  fallbackSummary: string;
};

export type TournamentResultItem = {
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

export type TournamentResultsPayload = {
  tournament: {
    id: number;
    title: string;
    event_date: string;
    status: string;
  };
  summary_title: string;
  summary_text: string;
  pdf_url: string;
  results: TournamentResultItem[];
  groups: CachedGroup[];
};

export class TournamentResultsError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "TournamentResultsError";
    this.status = status;
  }
}

const legacyDetailMap = new Map(
  LEGACY_TOURNAMENT_RESULT_DETAILS.map((detail) => [
    `${detail.rowOrder}:${normalizeDisplayName(detail.displayName)}`,
    detail,
  ])
);
const legacyDetailByRowOrderMap = new Map(
  LEGACY_TOURNAMENT_RESULT_DETAILS.map((detail) => [detail.rowOrder, detail])
);

export function parseTournamentId(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeDisplayName(value: string | null | undefined) {
  return (value ?? "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function findLegacyDetail(row: ResultRow) {
  const exact = legacyDetailMap.get(
    `${row.row_order}:${normalizeDisplayName(row.display_name)}`
  );
  if (exact) return exact;

  if (row.section === "전체 스코어") {
    return legacyDetailByRowOrderMap.get(row.row_order);
  }

  return undefined;
}

function mergeLegacyPayload(row: ResultRow) {
  const payload = isRecord(row.payload) ? row.payload : {};
  const legacy = findLegacyDetail(row);

  if (!legacy) return payload;

  const payloadStats = isRecord(payload.stats) ? payload.stats : {};

  return {
    ...payload,
    tee_time: typeof payload.tee_time === "string" ? payload.tee_time : legacy.teeTime,
    out_course:
      typeof payload.out_course === "string" ? payload.out_course : legacy.outCourse,
    in_course:
      typeof payload.in_course === "string" ? payload.in_course : legacy.inCourse,
    out_scores:
      Array.isArray(payload.out_scores) && payload.out_scores.length === 9
        ? payload.out_scores
        : legacy.outScores,
    in_scores:
      Array.isArray(payload.in_scores) && payload.in_scores.length === 9
        ? payload.in_scores
        : legacy.inScores,
    out_total:
      typeof payload.out_total === "number" ? payload.out_total : legacy.outTotal,
    in_total: typeof payload.in_total === "number" ? payload.in_total : legacy.inTotal,
    gross_total:
      typeof payload.gross_total === "number" ? payload.gross_total : legacy.grossTotal,
    net: typeof payload.net === "number" ? payload.net : legacy.net,
    rank: typeof payload.rank === "number" ? payload.rank : legacy.rank,
    handicap:
      typeof payload.handicap === "number" ? payload.handicap : legacy.handicap,
    award:
      typeof payload.award === "string" || payload.award === null
        ? payload.award
        : legacy.award,
    near: typeof payload.near === "number" ? payload.near : legacy.near,
    long: typeof payload.long === "number" ? payload.long : legacy.long,
    stats: {
      ...legacy.stats,
      ...payloadStats,
    },
    source:
      typeof payload.source === "string"
        ? payload.source
        : `단체 스코어.pdf p${legacy.sourcePage}`,
    source_page:
      typeof payload.source_page === "number"
        ? payload.source_page
        : legacy.sourcePage,
  };
}

async function readLegacySummaryText() {
  const summaryPath = path.join(process.cwd(), "DevGuide", "20260326", "summary.txt");
  try {
    return await fs.readFile(summaryPath, "utf-8");
  } catch {
    return "";
  }
}

const getCachedTournamentResultsBase = unstable_cache(
  async (tournamentId: number): Promise<CachedTournamentResultsBase> => {
    const supabaseAdmin = createServiceRoleSupabaseClient();

    const tournamentRes = await supabaseAdmin
      .from("tournaments")
      .select("id,title,event_date,status")
      .eq("id", tournamentId)
      .maybeSingle<TournamentRow>();

    if (tournamentRes.error) {
      throw new TournamentResultsError(tournamentRes.error.message, 500);
    }

    if (!tournamentRes.data || tournamentRes.data.status === "deleted") {
      throw new TournamentResultsError("대회를 찾을 수 없습니다.", 404);
    }

    const [assetRes, rowsRes, groupsRes] = await Promise.all([
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
    ]);

    if (assetRes.error) {
      throw new TournamentResultsError(assetRes.error.message, 500);
    }
    if (rowsRes.error) {
      throw new TournamentResultsError(rowsRes.error.message, 500);
    }
    if (groupsRes.error) {
      throw new TournamentResultsError(groupsRes.error.message, 500);
    }

    const groups = (groupsRes.data ?? []) as GroupRow[];
    const groupIds = groups.map((group) => group.id);
    const membersByGroupId = new Map<
      number,
      Array<{ id: number; position: number; role: string | null; nickname: string | null }>
    >();

    if (groupIds.length > 0) {
      const memberRes = await supabaseAdmin
        .from("tournament_group_members")
        .select("id,group_id,position,role,registrations(nickname)")
        .in("group_id", groupIds);

      if (memberRes.error) {
        throw new TournamentResultsError(memberRes.error.message, 500);
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
    }

    const fallbackSummary = await readLegacySummaryText();

    return {
      tournament: tournamentRes.data,
      asset: assetRes.data ?? null,
      rows: (rowsRes.data ?? []) as ResultRow[],
      groups: groups.map((group) => ({
        id: group.id,
        group_no: group.group_no,
        tee_time: group.tee_time,
        members: [...(membersByGroupId.get(group.id) ?? [])].sort(
          (a, b) => a.position - b.position
        ),
      })),
      fallbackSummary,
    };
  },
  ["tournament-results-base"],
  { revalidate: 86400 }
);

export async function getTournamentResultsForUser(
  tournamentId: number,
  userId: string
): Promise<TournamentResultsPayload> {
  const base = await getCachedTournamentResultsBase(tournamentId);
  const supabaseAdmin = createServiceRoleSupabaseClient();

  const usedDisplayNames = Array.from(
    new Set(
      base.rows
        .map((row) =>
          normalizeDisplayName(findLegacyDetail(row)?.displayName ?? row.display_name)
        )
        .filter((name) => name.length > 0)
    )
  );

  const [myProfileRes, profileRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id,full_name")
      .eq("id", userId)
      .maybeSingle<ProfileNameRow>(),
    usedDisplayNames.length > 0
      ? supabaseAdmin
          .from("profiles")
          .select("id,full_name")
          .in("full_name", usedDisplayNames)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (myProfileRes.error) {
    throw new TournamentResultsError(myProfileRes.error.message, 500);
  }
  if (profileRes.error) {
    throw new TournamentResultsError(profileRes.error.message, 500);
  }

  const nameToUserIds = new Map<string, string[]>();
  ((profileRes.data ?? []) as ProfileNameRow[]).forEach((profile) => {
    const normalized = normalizeDisplayName(profile.full_name);
    if (!normalized) return;
    const bucket = nameToUserIds.get(normalized) ?? [];
    bucket.push(profile.id);
    nameToUserIds.set(normalized, bucket);
  });

  const myFullName = normalizeDisplayName(myProfileRes.data?.full_name);

  const results = base.rows.map((row) => {
    const legacy = findLegacyDetail(row);
    const displayName = legacy?.displayName ?? row.display_name;
    const normalized = normalizeDisplayName(displayName);
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
      display_name: displayName,
      score_label: row.score_label,
      score_value: row.score_value,
      note: row.note,
      payload: mergeLegacyPayload(row),
      match_status: matchStatus,
      matched_user_id: matchedUserId,
      is_mine:
        matchStatus === "matched" &&
        matchedUserId === userId &&
        myFullName.length > 0 &&
        myFullName === normalized,
    } satisfies TournamentResultItem;
  });

  return {
    tournament: base.tournament,
    summary_title: base.asset?.summary_title ?? "대회 갈무리",
    summary_text: base.asset?.summary_text ?? base.fallbackSummary,
    pdf_url: base.asset?.pdf_url ?? `/api/tournaments/${tournamentId}/results/pdf`,
    results,
    groups: base.groups,
  };
}
