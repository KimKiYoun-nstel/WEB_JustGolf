import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  createServiceRoleSupabaseClient,
  requireApiUser,
} from "../../../../../../../lib/apiGuard";

type ExportScope = "approved" | "grouped";

type RegistrationExportRaw = {
  id: number;
  user_id: string | null;
  registering_user_id: string;
  nickname: string;
  status: string;
  relation?: string | null;
  tournament_meal_options?: { menu_name?: string | null } | null;
};

type GroupRow = {
  id: number;
  group_no: number;
  tee_time: string | null;
};

type GroupMemberRow = {
  group_id: number;
  registration_id: number;
  position: number;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
};

type GroupedSheetRow = {
  조: string;
  순번: string;
  닉네임: string;
  이름: string;
  식사메뉴: string;
  전화번호: string;
  티오프시간: string;
};

type AuthMetadata = {
  full_name: string;
  phone: string;
};

export const runtime = "nodejs";

function sanitizeForExcel(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : value == null ? "" : String(value);
  if (!text) return "";
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getTimestampLabel(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function getFilename(scope: ExportScope, tournamentId: number): string {
  return `justgolf_t${tournamentId}_${scope}_${getTimestampLabel()}.xlsx`;
}

async function loadProfileMap(
  supabaseAdmin: ReturnType<typeof createServiceRoleSupabaseClient>,
  userIds: string[]
) {
  if (userIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const profileRes = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", userIds);

  if (profileRes.error) {
    // Fallback for environments where profiles.phone does not exist.
    const fallbackRes = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (fallbackRes.error) {
      throw new Error(`프로필 조회 실패: ${fallbackRes.error.message}`);
    }

    return new Map((fallbackRes.data ?? []).map((profile) => [profile.id, profile as ProfileRow]));
  }

  return new Map((profileRes.data ?? []).map((profile) => [profile.id, profile as ProfileRow]));
}

async function loadAuthMetadataMap(
  supabaseAdmin: ReturnType<typeof createServiceRoleSupabaseClient>,
  userIds: string[]
) {
  const results = await Promise.all(
    userIds.map(async (userId) => {
      const res = await supabaseAdmin.auth.admin.getUserById(userId);
      const metadata = (res.data?.user?.user_metadata ?? {}) as Record<string, unknown>;
      const value: AuthMetadata = {
        full_name: asString(metadata.full_name),
        phone: asString(metadata.phone),
      };
      return [userId, value] as const;
    })
  );

  return new Map<string, AuthMetadata>(results);
}

function resolveMemberName(
  userId: string | null,
  profileMap: Map<string, ProfileRow>,
  authMap: Map<string, AuthMetadata>
) {
  if (!userId) return "";
  const profile = profileMap.get(userId);
  const authMeta = authMap.get(userId);
  return sanitizeForExcel(profile?.full_name ?? authMeta?.full_name ?? "");
}

function resolveMemberPhone(
  userId: string | null,
  profileMap: Map<string, ProfileRow>,
  authMap: Map<string, AuthMetadata>
) {
  if (!userId) return "";
  const profile = profileMap.get(userId);
  const authMeta = authMap.get(userId);
  return sanitizeForExcel(profile?.phone ?? authMeta?.phone ?? "");
}

async function loadApprovedRegistrations(
  supabaseAdmin: ReturnType<typeof createServiceRoleSupabaseClient>,
  tournamentId: number
) {
  const regRes = await supabaseAdmin
    .from("registrations")
    .select(
      "id,user_id,registering_user_id,nickname,status,relation,tournament_meal_options(menu_name)"
    )
    .eq("tournament_id", tournamentId)
    .eq("status", "approved")
    .order("id", { ascending: true });

  if (regRes.error) {
    throw new Error(`확정 신청자 조회 실패: ${regRes.error.message}`);
  }

  return (regRes.data ?? []) as RegistrationExportRaw[];
}

function buildApprovedSheetRows(
  rows: RegistrationExportRaw[],
  profileMap: Map<string, ProfileRow>,
  authMap: Map<string, AuthMetadata>
) {
  return rows.map((row) => ({
    닉네임: sanitizeForExcel(row.nickname),
    이름: resolveMemberName(row.user_id, profileMap, authMap),
    식사메뉴: sanitizeForExcel(row.tournament_meal_options?.menu_name ?? ""),
    전화번호: resolveMemberPhone(row.user_id, profileMap, authMap),
  }));
}

function buildWorkbookBuffer(
  scope: ExportScope,
  approvedRows: Array<Record<string, string>>,
  groupedRows?: Array<Record<string, string>>,
  unassignedRows?: Array<Record<string, string>>
) {
  const workbook = XLSX.utils.book_new();

  const approvedSheet = XLSX.utils.json_to_sheet(approvedRows, {
    header: ["닉네임", "이름", "식사메뉴", "전화번호"],
  });
  approvedSheet["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, approvedSheet, "확정자");

  if (scope === "grouped" && groupedRows) {
    const groupedSheet = XLSX.utils.json_to_sheet(groupedRows, {
      header: ["조", "순번", "닉네임", "이름", "식사메뉴", "전화번호", "티오프시간"],
    });
    groupedSheet["!cols"] = [
      { wch: 6 },
      { wch: 8 },
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(workbook, groupedSheet, "조편성");
  }

  if (scope === "grouped" && unassignedRows && unassignedRows.length > 0) {
    const unassignedSheet = XLSX.utils.json_to_sheet(unassignedRows, {
      header: ["닉네임", "이름", "식사메뉴", "전화번호"],
    });
    unassignedSheet["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, unassignedSheet, "미배정확정자");
  }

  return XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
    compression: true,
  }) as ArrayBuffer;
}

async function loadGroupedRows(
  supabaseAdmin: ReturnType<typeof createServiceRoleSupabaseClient>,
  tournamentId: number
) {
  const groupsRes = await supabaseAdmin
    .from("tournament_groups")
    .select("id,group_no,tee_time")
    .eq("tournament_id", tournamentId)
    .order("group_no", { ascending: true });

  if (groupsRes.error) {
    throw new Error(`조편성 조회 실패: ${groupsRes.error.message}`);
  }

  const groups = (groupsRes.data ?? []) as GroupRow[];
  if (groups.length === 0) {
    throw new Error("조편성 데이터가 없습니다. 조편성 완료 후 다시 시도해주세요.");
  }

  const groupIds = groups.map((group) => group.id);
  const membersRes = await supabaseAdmin
    .from("tournament_group_members")
    .select("group_id,registration_id,position")
    .in("group_id", groupIds);

  if (membersRes.error) {
    throw new Error(`조편성 멤버 조회 실패: ${membersRes.error.message}`);
  }

  const members = (membersRes.data ?? []) as GroupMemberRow[];
  const registrationIds = [...new Set(members.map((member) => member.registration_id))];
  if (registrationIds.length === 0) {
    return {
      groupedRows: [] as Array<Record<string, string>>,
      assignedRegistrationIds: [] as number[],
      approvedRowsForReference: await loadApprovedRegistrations(supabaseAdmin, tournamentId),
    };
  }

  const regsRes = await supabaseAdmin
    .from("registrations")
    .select(
      "id,user_id,registering_user_id,nickname,status,relation,tournament_meal_options(menu_name)"
    )
    .in("id", registrationIds);

  if (regsRes.error) {
    throw new Error(`조편성 대상 신청자 조회 실패: ${regsRes.error.message}`);
  }

  const regMap = new Map<number, RegistrationExportRaw>(
    ((regsRes.data ?? []) as RegistrationExportRaw[]).map((reg) => [reg.id, reg])
  );

  const memberUserIds = [
    ...new Set(
      Array.from(regMap.values())
        .map((reg) => reg.user_id)
        .filter((userId): userId is string => Boolean(userId))
    ),
  ];

  const profileMap = await loadProfileMap(supabaseAdmin, memberUserIds);
  const authMap = await loadAuthMetadataMap(supabaseAdmin, memberUserIds);
  const groupMap = new Map<number, GroupRow>(groups.map((group) => [group.id, group]));

  const sortedMembers = [...members].sort((a, b) => {
    const groupA = groupMap.get(a.group_id)?.group_no ?? Number.MAX_SAFE_INTEGER;
    const groupB = groupMap.get(b.group_id)?.group_no ?? Number.MAX_SAFE_INTEGER;
    if (groupA !== groupB) return groupA - groupB;
    return a.position - b.position;
  });

  const groupedRows = sortedMembers
    .map((member) => {
      const reg = regMap.get(member.registration_id);
      const group = groupMap.get(member.group_id);
      if (!reg || !group) return null;

      return {
        조: sanitizeForExcel(`${group.group_no}`),
        순번: sanitizeForExcel(`${member.position}`),
        닉네임: sanitizeForExcel(reg.nickname),
        이름: resolveMemberName(reg.user_id, profileMap, authMap),
        식사메뉴: sanitizeForExcel(reg.tournament_meal_options?.menu_name ?? ""),
        전화번호: resolveMemberPhone(reg.user_id, profileMap, authMap),
        티오프시간: sanitizeForExcel(group.tee_time ?? ""),
      };
    })
    .filter((row): row is GroupedSheetRow => row !== null);

  return {
    groupedRows,
    assignedRegistrationIds: registrationIds,
    approvedRowsForReference: await loadApprovedRegistrations(supabaseAdmin, tournamentId),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireApiUser({ requireAdmin: true });
    if ("error" in guard) return guard.error;

    const { id } = await params;
    const tournamentId = Number(id);
    if (!Number.isFinite(tournamentId) || tournamentId <= 0) {
      return NextResponse.json({ error: "유효하지 않은 대회 ID입니다." }, { status: 400 });
    }

    const scopeParam = request.nextUrl.searchParams.get("scope");
    const format = request.nextUrl.searchParams.get("format") ?? "xlsx";
    const scope: ExportScope = scopeParam === "grouped" ? "grouped" : "approved";

    if (format !== "xlsx") {
      return NextResponse.json({ error: "지원하지 않는 형식입니다. (xlsx만 지원)" }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleSupabaseClient();
    const approvedRowsRaw = await loadApprovedRegistrations(supabaseAdmin, tournamentId);
    const approvedUserIds = [
      ...new Set(
        approvedRowsRaw
          .map((row) => row.user_id)
          .filter((userId): userId is string => Boolean(userId))
      ),
    ];
    const profileMap = await loadProfileMap(supabaseAdmin, approvedUserIds);
    const authMap = await loadAuthMetadataMap(supabaseAdmin, approvedUserIds);
    const approvedSheetRows = buildApprovedSheetRows(approvedRowsRaw, profileMap, authMap);

    let groupedRows: Array<Record<string, string>> | undefined;
    let unassignedRows: Array<Record<string, string>> | undefined;

    if (scope === "grouped") {
      const grouped = await loadGroupedRows(supabaseAdmin, tournamentId);
      groupedRows = grouped.groupedRows;
      const assignedSet = new Set(grouped.assignedRegistrationIds);
      unassignedRows = buildApprovedSheetRows(
        grouped.approvedRowsForReference.filter((row) => !assignedSet.has(row.id)),
        profileMap,
        authMap
      );
    }

    const buffer = buildWorkbookBuffer(scope, approvedSheetRows, groupedRows, unassignedRows);
    const filename = getFilename(scope, tournamentId);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "엑셀 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
