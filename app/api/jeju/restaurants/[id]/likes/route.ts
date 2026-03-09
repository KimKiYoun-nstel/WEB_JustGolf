import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

type Params = { params: Promise<{ id: string }> };

/** POST /api/jeju/restaurants/[id]/likes — 좋아요 토글 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { user, supabase } = result;

  // 이미 좋아요 했는지 확인
  const { data: existing } = await supabase
    .from("dalkkot_restaurant_likes")
    .select("restaurant_id")
    .eq("restaurant_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const adminSupabase = createServiceRoleSupabaseClient();

  if (existing) {
    // 좋아요 취소
    await adminSupabase
      .from("dalkkot_restaurant_likes")
      .delete()
      .eq("restaurant_id", id)
      .eq("user_id", user.id);
    return NextResponse.json({ liked: false });
  }

  // 좋아요 추가
  const { error } = await adminSupabase
    .from("dalkkot_restaurant_likes")
    .insert({ restaurant_id: id, user_id: user.id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ liked: true });
}
