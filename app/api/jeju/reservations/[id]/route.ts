import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleSupabaseClient,
  requireApiUser,
} from "@/lib/apiGuard";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/jeju/reservations/[id]
 * 단일 예약 조회 (본인 or 관리자: 실명/전화 포함)
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { user, supabase } = result;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_dalkkot_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isDalkkotAdmin = profile?.is_dalkkot_admin === true;

  const selectFields = isDalkkotAdmin
    ? "id, villa_id, user_id, nickname, check_in, check_out, color, status, visit_status, checked_in_at, checked_out_at, real_name, phone, guests, notes, gas_meter_in, gas_meter_out, water_meter_in, water_meter_out, elec_meter_in, elec_meter_out, meter_notes, settlement_completed, settlement_amount, settlement_notes, is_migrated, created_at"
    : "id, villa_id, user_id, nickname, check_in, check_out, color, status, visit_status, checked_in_at, checked_out_at, guests, notes, created_at";

  const { data, error } = await supabase
    .from("dalkkot_reservations")
    .select(selectFields)
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "예약을 찾을 수 없습니다." }, { status: 404 });

  // 본인이 아니고 관리자도 아니면 기본 공개 필드만 반환
  if (data.user_id !== user.id && !isDalkkotAdmin) {
    const { real_name: _r, phone: _p, ...publicData } = data as Record<string, unknown>;
    return NextResponse.json(publicData);
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/jeju/reservations/[id]
 * 예약 취소 (본인 pending/waiting_deposit)
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { user, supabase } = result;

  // 본인 예약인지 확인
  const { data: reservation } = await supabase
    .from("dalkkot_reservations")
    .select("id, user_id, status, nickname")
    .eq("id", id)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ error: "예약을 찾을 수 없습니다." }, { status: 404 });
  }
  if (reservation.user_id !== user.id) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }
  if (!["pending", "waiting_deposit"].includes(reservation.status)) {
    return NextResponse.json(
      { error: "확정된 예약은 직접 취소할 수 없습니다. 관리자에게 문의하세요." },
      { status: 400 }
    );
  }

  const adminSupabase = createServiceRoleSupabaseClient();
  const { error } = await adminSupabase
    .from("dalkkot_reservations")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 히스토리 로그
  await adminSupabase.from("dalkkot_reservation_history").insert({
    reservation_id: id,
    actor_id: user.id,
    actor_nickname: reservation.nickname,
    actor_role: "user",
    action_type: "cancelled",
    payload: { previous_status: reservation.status },
  });

  return NextResponse.json({ success: true });
}
