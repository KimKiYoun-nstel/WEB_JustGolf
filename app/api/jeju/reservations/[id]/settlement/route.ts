import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/jeju/reservations/[id]/settlement
 * 관리자 전용: 정산 완료 처리
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
  const { amount, notes } = body;

  const adminSupabase = createServiceRoleSupabaseClient();
  const { data: reservation } = await adminSupabase
    .from("dalkkot_reservations")
    .select("id, nickname, status")
    .eq("id", id)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ error: "예약 없음" }, { status: 404 });
  }
  if (reservation.status !== "confirmed") {
    return NextResponse.json({ error: "확정된 예약만 정산 처리 가능합니다." }, { status: 400 });
  }

  const { error } = await adminSupabase
    .from("dalkkot_reservations")
    .update({
      settlement_completed: true,
      settlement_amount: amount ?? null,
      settlement_notes: notes ?? null,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await adminSupabase.from("dalkkot_reservation_history").insert({
    reservation_id: id,
    actor_id: user.id,
    actor_nickname: profile.nickname ?? "관리자",
    actor_role: "admin",
    action_type: "settlement_done",
    payload: { amount, notes },
  });

  return NextResponse.json({ success: true });
}
