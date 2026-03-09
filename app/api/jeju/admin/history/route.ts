import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

/**
 * GET /api/jeju/admin/history
 * 관리자 전용: 예약 히스토리 & 사용자 통계
 * query: type=user_stats|reservations, nickname?, date_from?, date_to?, status?
 */
export async function GET(request: NextRequest) {
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

  const { searchParams } = request.nextUrl;
  const type      = searchParams.get("type") ?? "reservations";
  const nickname  = searchParams.get("nickname");
  const dateFrom  = searchParams.get("date_from");
  const dateTo    = searchParams.get("date_to");
  const status    = searchParams.get("status");

  const adminSupabase = createServiceRoleSupabaseClient();

  if (type === "user_stats") {
    // View 조회
    let query = adminSupabase.from("dalkkot_user_stats").select("*");
    if (nickname) query = query.ilike("nickname", `%${nickname}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // 전체 예약 목록 (관리자용 — 실명/전화 포함)
  let query = adminSupabase
    .from("dalkkot_reservations")
    .select("id, nickname, real_name, phone, check_in, check_out, status, visit_status, checked_in_at, checked_out_at, settlement_completed, settlement_amount, gas_meter_in, gas_meter_out, water_meter_in, water_meter_out, elec_meter_in, elec_meter_out, created_at, guests, notes")
    .order("check_in", { ascending: false });

  if (nickname)  query = query.ilike("nickname", `%${nickname}%`);
  if (dateFrom)  query = query.gte("check_in", dateFrom);
  if (dateTo)    query = query.lte("check_out", dateTo);
  if (status)    query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
