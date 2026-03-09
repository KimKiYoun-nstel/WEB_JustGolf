import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

type Params = { params: Promise<{ id: string }> };

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:         ["waiting_deposit", "rejected"],
  waiting_deposit: ["confirmed", "rejected"],
  confirmed:       ["cancelled"],
  rejected:        [],
  cancelled:       [],
};

/**
 * PATCH /api/jeju/reservations/[id]/status
 * 관리자 전용: 예약 상태 변경
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { user, supabase } = result;

  // 달콧 관리자 체크
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_dalkkot_admin, nickname")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_dalkkot_admin) {
    return NextResponse.json({ error: "달콧 관리자 권한 필요" }, { status: 403 });
  }

  const body = await request.json();
  const { status: newStatus } = body;

  if (!newStatus) {
    return NextResponse.json({ error: "status 필드 필요" }, { status: 400 });
  }

  // 현재 상태 조회
  const adminSupabase = createServiceRoleSupabaseClient();
  const { data: reservation } = await adminSupabase
    .from("dalkkot_reservations")
    .select("id, status, nickname")
    .eq("id", id)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ error: "예약 없음" }, { status: 404 });
  }

  const allowed = VALID_TRANSITIONS[reservation.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `${reservation.status} → ${newStatus} 전환 불가` },
      { status: 400 }
    );
  }

  const { error } = await adminSupabase
    .from("dalkkot_reservations")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 히스토리 로그
  await adminSupabase.from("dalkkot_reservation_history").insert({
    reservation_id: id,
    actor_id: user.id,
    actor_nickname: profile.nickname ?? "관리자",
    actor_role: "admin",
    action_type: "status_changed",
    payload: { previous_status: reservation.status, new_status: newStatus },
  });

  return NextResponse.json({ success: true, status: newStatus });
}
