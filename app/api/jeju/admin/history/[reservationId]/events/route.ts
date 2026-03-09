import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

type Params = { params: Promise<{ reservationId: string }> };

/**
 * GET /api/jeju/admin/history/[reservationId]/events
 * 특정 예약의 이벤트 타임라인
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { reservationId } = await params;
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

  const adminSupabase = createServiceRoleSupabaseClient();
  const { data, error } = await adminSupabase
    .from("dalkkot_reservation_history")
    .select("id, action_type, actor_nickname, actor_role, payload, created_at")
    .eq("reservation_id", reservationId)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
