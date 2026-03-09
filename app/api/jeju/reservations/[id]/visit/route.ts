import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/jeju/reservations/[id]/visit
 * 예약자 본인: 체크인 / 체크아웃
 * body: { action: 'checkin' | 'checkout' }
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { user, supabase } = result;

  const body = await request.json();
  const action: string = body.action;

  if (!["checkin", "checkout"].includes(action)) {
    return NextResponse.json({ error: "action은 checkin 또는 checkout" }, { status: 400 });
  }

  const adminSupabase = createServiceRoleSupabaseClient();
  const { data: reservation } = await adminSupabase
    .from("dalkkot_reservations")
    .select("id, user_id, status, visit_status, nickname")
    .eq("id", id)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ error: "예약 없음" }, { status: 404 });
  }
  if (reservation.user_id !== user.id) {
    return NextResponse.json({ error: "본인 예약만 처리 가능합니다." }, { status: 403 });
  }
  if (reservation.status !== "confirmed") {
    return NextResponse.json({ error: "확정된 예약만 체크인/아웃 가능합니다." }, { status: 400 });
  }

  if (action === "checkin") {
    if (reservation.visit_status !== "not_checked") {
      return NextResponse.json({ error: "이미 체크인된 예약입니다." }, { status: 400 });
    }
    const now = new Date().toISOString();
    // 계량기 값 선택 입력
    const meterIn: Record<string, number> = {};
    if (body.gas_meter_in   != null) meterIn.gas_meter_in   = Number(body.gas_meter_in);
    if (body.water_meter_in != null) meterIn.water_meter_in = Number(body.water_meter_in);
    if (body.elec_meter_in  != null) meterIn.elec_meter_in  = Number(body.elec_meter_in);

    const { error } = await adminSupabase
      .from("dalkkot_reservations")
      .update({ visit_status: "checked_in", checked_in_at: now, ...meterIn })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await adminSupabase.from("dalkkot_reservation_history").insert({
      reservation_id: id,
      actor_id: user.id,
      actor_nickname: reservation.nickname,
      actor_role: "user",
      action_type: "checkin",
      payload: { checked_in_at: now, ...meterIn },
    });

    return NextResponse.json({ success: true, visit_status: "checked_in" });
  }

  // checkout
  if (reservation.visit_status !== "checked_in") {
    return NextResponse.json({ error: "체크인 후에만 체크아웃 가능합니다." }, { status: 400 });
  }

  // 계량기 값 필수 입력
  const { gas_meter_out, water_meter_out, elec_meter_out } = body;
  if (gas_meter_out == null || water_meter_out == null || elec_meter_out == null) {
    return NextResponse.json({ error: "가스/전기/수도 계량기 값을 모두 입력해주세요." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await adminSupabase
    .from("dalkkot_reservations")
    .update({
      visit_status: "checked_out",
      checked_out_at: now,
      gas_meter_out:   Number(gas_meter_out),
      water_meter_out: Number(water_meter_out),
      elec_meter_out:  Number(elec_meter_out),
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await adminSupabase.from("dalkkot_reservation_history").insert({
    reservation_id: id,
    actor_id: user.id,
    actor_nickname: reservation.nickname,
    actor_role: "user",
    action_type: "checkout",
    payload: { checked_out_at: now, gas_meter_out, water_meter_out, elec_meter_out },
  });

  return NextResponse.json({ success: true, visit_status: "checked_out" });
}
