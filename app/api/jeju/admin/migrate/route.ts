import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

interface MigrateRow {
  nickname: string;
  check_in: string;
  check_out: string;
  status?: string;
  notes?: string;
  gas_meter_out?: number;
  water_meter_out?: number;
  elec_meter_out?: number;
}

/**
 * POST /api/jeju/admin/migrate
 * 관리자 전용: 예약 이력 CSV → DB 일괄 저장
 * body: { villa_id: string, rows: MigrateRow[], confirm: boolean }
 * confirm=false → 미리보기(검증만), confirm=true → 저장
 */
export async function POST(request: NextRequest) {
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { user, supabase } = result;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_dalkkot_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_dalkkot_admin) {
    return NextResponse.json({ error: "달콧 관리자 권한 필요" }, { status: 403 });
  }

  const body = await request.json();
  const { villa_id, rows, confirm = false }: { villa_id: string; rows: MigrateRow[]; confirm: boolean } = body;

  if (!villa_id || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "villa_id와 rows 필수" }, { status: 400 });
  }

  const VALID_COLORS = [
    "#4CAF50","#2196F3","#FF9800","#9C27B0",
    "#E91E63","#00BCD4","#FF5722","#607D8B",
  ];

  // 검증
  const validated: Array<MigrateRow & { rowIndex: number; color: string; error?: string }> = rows.map((row, i) => {
    const errors: string[] = [];
    if (!row.nickname?.trim()) errors.push("닉네임 없음");
    if (!row.check_in || !/^\d{4}-\d{2}-\d{2}$/.test(row.check_in)) errors.push("check_in 형식 오류");
    if (!row.check_out || !/^\d{4}-\d{2}-\d{2}$/.test(row.check_out)) errors.push("check_out 형식 오류");
    if (row.check_in && row.check_out && row.check_in >= row.check_out) errors.push("퇴실일이 입실일 이전(당일 퇴실 불가)");

    const validStatuses = ["pending","waiting_deposit","confirmed","rejected","cancelled"];
    const status = row.status && validStatuses.includes(row.status) ? row.status : "confirmed";

    return {
      ...row,
      rowIndex: i + 2, // 1-based + header row
      status,
      color: VALID_COLORS[i % VALID_COLORS.length],
      ...(errors.length > 0 ? { error: errors.join(", ") } : {}),
    };
  });

  const valid    = validated.filter((r) => !r.error);
  const invalid  = validated.filter((r) =>  r.error);

  if (!confirm) {
    // 미리보기 모드: ① 배치 내부 겹침 ② DB 기존 예약 겹침 순서로 검사
    const adminSupabase = createServiceRoleSupabaseClient();

    // 날짜 겹침 유틸: 반열린구간 [a, b)와 [c, d)의 겹침
    const overlaps = (a: string, b: string, c: string, d: string) => a < d && c < b;

    const conflicts: typeof validated = [];
    const nonConflict: typeof validated = [];

    for (let i = 0; i < valid.length; i++) {
      const row = valid[i];
      let conflictMsg: string | null = null;

      // ① 배치 내부 충돌 (앞 행들과 비교)
      for (let j = 0; j < i; j++) {
        const other = valid[j];
        if (overlaps(row.check_in, row.check_out, other.check_in, other.check_out)) {
          conflictMsg = `배치 내 충돌: [${other.nickname}] ${other.check_in}~${other.check_out}`;
          break;
        }
      }

      // ② DB 기존 예약 충돌
      if (!conflictMsg) {
        const { data: dbRows } = await adminSupabase
          .from("dalkkot_reservations")
          .select("id, nickname, check_in, check_out")
          .eq("villa_id", villa_id)
          .lt("check_in", row.check_out)
          .gt("check_out", row.check_in)
          .limit(1);

        if (dbRows && dbRows.length > 0) {
          const o = dbRows[0];
          conflictMsg = `기존 예약 충돌: [${o.nickname}] ${o.check_in}~${o.check_out}`;
        }
      }

      if (conflictMsg) {
        conflicts.push({ ...row, error: conflictMsg });
      } else {
        nonConflict.push(row);
      }
    }

    return NextResponse.json({ valid: nonConflict, invalid, conflicts });
  }

  if (valid.length === 0) {
    return NextResponse.json({ error: "저장할 유효한 행이 없습니다." }, { status: 400 });
  }

  // 일괄 저장
  const adminSupabase = createServiceRoleSupabaseClient();
  const insertRows = valid.map((r) => ({
    villa_id,
    user_id: null,
    nickname: r.nickname.trim(),
    check_in: r.check_in,
    check_out: r.check_out,
    status: r.status ?? "confirmed",
    notes: r.notes ?? null,
    color: r.color,
    is_migrated: true,
    visit_status: "checked_out", // 과거 이력은 모두 체크아웃 상태
    settlement_completed: false,
    ...(r.gas_meter_out   != null ? { gas_meter_out:   r.gas_meter_out   } : {}),
    ...(r.water_meter_out != null ? { water_meter_out: r.water_meter_out } : {}),
    ...(r.elec_meter_out  != null ? { elec_meter_out:  r.elec_meter_out  } : {}),
  }));

  const { error } = await adminSupabase
    .from("dalkkot_reservations")
    .insert(insertRows);

  if (error) {
    if (error.code === "23P01") {
      return NextResponse.json(
        { error: "날짜가 중복되는 예약이 있습니다. 데이터를 확인해주세요.", detail: error.message },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, saved_count: valid.length, skipped_count: invalid.length });
}

/**
 * DELETE /api/jeju/admin/migrate
 * 달콧 관리자 전용: 특정 빌라의 예약 전체 삭제 (마이그레이션 전 초기화용)
 * body: { villa_id: string }
 *
 * ⚠️ 해당 빌라의 모든 예약을 삭제합니다 (테스트 예약 포함)
 */
export async function DELETE(request: NextRequest) {
  const authResult = await requireApiUser({ requireApproved: true });
  if ("error" in authResult) return authResult.error;
  const { user, supabase } = authResult;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_dalkkot_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_dalkkot_admin) {
    return NextResponse.json({ error: "달콧 관리자 권한 필요" }, { status: 403 });
  }

  const body = await request.json();
  const { villa_id } = body as { villa_id?: string };

  if (!villa_id?.trim()) {
    return NextResponse.json({ error: "villa_id 필수" }, { status: 400 });
  }

  const adminSupabase = createServiceRoleSupabaseClient();

  // 삭제 전 건수 확인
  const { count: before } = await adminSupabase
    .from("dalkkot_reservations")
    .select("id", { count: "exact", head: true })
    .eq("villa_id", villa_id);

  const { error } = await adminSupabase
    .from("dalkkot_reservations")
    .delete()
    .eq("villa_id", villa_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted_count: before ?? 0 });
}
