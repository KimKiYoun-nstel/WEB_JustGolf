import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/jeju/restaurants/[id] — 본인 또는 달콧 관리자 수정 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { user, supabase } = result;

  const { data: restaurant } = await supabase
    .from("dalkkot_restaurants")
    .select("id, added_by")
    .eq("id", id)
    .maybeSingle();

  if (!restaurant) return NextResponse.json({ error: "없음" }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_dalkkot_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (restaurant.added_by !== user.id && !profile?.is_dalkkot_admin) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const body = await request.json();
  const { name, category, address, description, map_url } = body;

  const adminSupabase = createServiceRoleSupabaseClient();
  const { error } = await adminSupabase
    .from("dalkkot_restaurants")
    .update({ name, category, address, description, map_url, updated_by: user.id })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE /api/jeju/restaurants/[id] — 본인 또는 달콧 관리자 삭제 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { user, supabase } = result;

  const { data: restaurant } = await supabase
    .from("dalkkot_restaurants")
    .select("id, added_by")
    .eq("id", id)
    .maybeSingle();

  if (!restaurant) return NextResponse.json({ error: "없음" }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_dalkkot_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (restaurant.added_by !== user.id && !profile?.is_dalkkot_admin) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const adminSupabase = createServiceRoleSupabaseClient();
  const { error } = await adminSupabase
    .from("dalkkot_restaurants")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
