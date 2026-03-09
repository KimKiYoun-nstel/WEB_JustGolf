import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/jeju/reservations/[id]/meters
 * 승인된 사용자: 현재 예약 계량기 값 + 이전 퇴실 참고값 + 빌링 설정
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;

  const adminSupabase = createServiceRoleSupabaseClient();

  const { data: reservation } = await adminSupabase
    .from("dalkkot_reservations")
    .select("id, villa_id, gas_meter_in, gas_meter_out, water_meter_in, water_meter_out, elec_meter_in, elec_meter_out")
    .eq("id", id)
    .maybeSingle();

  if (!reservation) return NextResponse.json({ error: "예약 없음" }, { status: 404 });

  // 같은 villa의 가장 최근 퇴실 완료된 예약의 계량기 out 값 (이번 입실 기준값 참고)
  const { data: lastRes } = await adminSupabase
    .from("dalkkot_reservations")
    .select("gas_meter_out, water_meter_out, elec_meter_out, checked_out_at")
    .eq("villa_id", reservation.villa_id)
    .eq("visit_status", "checked_out")
    .neq("id", id)
    .order("checked_out_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 빌링 설정 (단가 + 계좌)
  const { data: billing } = await adminSupabase
    .from("dalkkot_billing_settings")
    .select("gas_rate, water_rate, elec_rate, bank_name, bank_account, bank_holder")
    .eq("villa_id", reservation.villa_id)
    .maybeSingle();

  return NextResponse.json({
    current: {
      gas_meter_in:   reservation.gas_meter_in,
      gas_meter_out:  reservation.gas_meter_out,
      water_meter_in: reservation.water_meter_in,
      water_meter_out: reservation.water_meter_out,
      elec_meter_in:  reservation.elec_meter_in,
      elec_meter_out: reservation.elec_meter_out,
    },
    prev_out: lastRes ? {
      gas:   lastRes.gas_meter_out,
      water: lastRes.water_meter_out,
      elec:  lastRes.elec_meter_out,
    } : null,
    billing: billing ?? { gas_rate: 0, water_rate: 0, elec_rate: 0, bank_name: null, bank_account: null, bank_holder: null },
  });
}

/**
 * PATCH /api/jeju/reservations/[id]/meters
 * 관리자 전용: 공과금 검침값 입력
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { user, supabase } = result;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_dalkkot_admin, nickname")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_dalkkot_admin) {
    return NextResponse.json({ error: "달콧 관리자 권한 필요" }, { status: 403 });
  }

  const body = await request.json();
  const {
    gas_meter_in, gas_meter_out,
    water_meter_in, water_meter_out,
    elec_meter_in, elec_meter_out,
    meter_notes,
  } = body;

  const adminSupabase = createServiceRoleSupabaseClient();
  const { data: reservation } = await adminSupabase
    .from("dalkkot_reservations")
    .select("id, nickname, gas_meter_in, gas_meter_out, water_meter_in, water_meter_out, elec_meter_in, elec_meter_out")
    .eq("id", id)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ error: "예약 없음" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (gas_meter_in   != null) updates.gas_meter_in   = gas_meter_in;
  if (gas_meter_out  != null) updates.gas_meter_out  = gas_meter_out;
  if (water_meter_in  != null) updates.water_meter_in  = water_meter_in;
  if (water_meter_out != null) updates.water_meter_out = water_meter_out;
  if (elec_meter_in  != null) updates.elec_meter_in  = elec_meter_in;
  if (elec_meter_out != null) updates.elec_meter_out = elec_meter_out;
  if (meter_notes    != null) updates.meter_notes    = meter_notes;

  const { error } = await adminSupabase
    .from("dalkkot_reservations")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 히스토리 로그
  await adminSupabase.from("dalkkot_reservation_history").insert({
    reservation_id: id,
    actor_id: user.id,
    actor_nickname: profile.nickname ?? "관리자",
    actor_role: "admin",
    action_type: "meters_updated",
    payload: updates,
  });

  return NextResponse.json({ success: true });
}
