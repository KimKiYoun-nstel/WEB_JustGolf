import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

/**
 * GET /api/jeju/admin/billing-settings?villa_id=...
 * 승인된 사용자: 요금 설정 조회
 *
 * PUT /api/jeju/admin/billing-settings
 * 관리자 전용: 요금 설정 저장 (upsert)
 */

export async function GET(request: NextRequest) {
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;

  const villaId = request.nextUrl.searchParams.get("villa_id");
  const adminSupabase = createServiceRoleSupabaseClient();

  let query = adminSupabase
    .from("dalkkot_billing_settings")
    .select("id, villa_id, gas_rate, water_rate, elec_rate, bank_name, bank_account, bank_holder, notes, updated_at");

  if (villaId) query = query.eq("villa_id", villaId);

  const { data, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {});
}

export async function PUT(request: NextRequest) {
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
  const { villa_id, gas_rate, water_rate, elec_rate, bank_name, bank_account, bank_holder, notes } = body;

  if (!villa_id) return NextResponse.json({ error: "villa_id 필수" }, { status: 400 });

  const adminSupabase = createServiceRoleSupabaseClient();
  const { error } = await adminSupabase
    .from("dalkkot_billing_settings")
    .upsert(
      {
        villa_id,
        gas_rate:    gas_rate    ?? 0,
        water_rate:  water_rate  ?? 0,
        elec_rate:   elec_rate   ?? 0,
        bank_name:   bank_name   ?? null,
        bank_account: bank_account ?? null,
        bank_holder: bank_holder ?? null,
        notes:       notes       ?? null,
        updated_by:  user.id,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: "villa_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
