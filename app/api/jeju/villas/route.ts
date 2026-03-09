import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

/**
 * GET /api/jeju/villas
 * 활성화된 별장 정보 조회
 */
export async function GET() {
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { supabase } = result;

  const { data, error } = await supabase
    .from("dalkkot_villas")
    .select("id, name, address, naver_map_url, kakao_map_url, intro_md, rules_md, faq_md, gas_unit_price")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "별장 정보 없음" }, { status: 404 });

  return NextResponse.json(data);
}

/**
 * PATCH /api/jeju/villas
 * 관리자 전용: 별장 콘텐츠 수정 (소개/수칙/FAQ/맵URL)
 */
export async function PATCH(request: NextRequest) {
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
  const { id, intro_md, rules_md, faq_md, address, naver_map_url, kakao_map_url, gas_unit_price } = body;

  if (!id) {
    return NextResponse.json({ error: "villa id 필요" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (intro_md       != null) updates.intro_md       = intro_md;
  if (rules_md       != null) updates.rules_md       = rules_md;
  if (faq_md         != null) updates.faq_md         = faq_md;
  if (address        != null) updates.address        = address;
  if (naver_map_url  != null) updates.naver_map_url  = naver_map_url;
  if (kakao_map_url  != null) updates.kakao_map_url  = kakao_map_url;
  if (gas_unit_price != null) updates.gas_unit_price = gas_unit_price;

  const adminSupabase = createServiceRoleSupabaseClient();
  const { error } = await adminSupabase
    .from("dalkkot_villas")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
