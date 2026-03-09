import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

/**
 * GET /api/jeju/restaurants?category=식당
 * 맛집 목록 (카테고리 필터 가능)
 */
export async function GET(request: NextRequest) {
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { supabase, user } = result;

  const category = request.nextUrl.searchParams.get("category");

  let query = supabase
    .from("dalkkot_restaurants")
    .select(`
      id, name, category, address, description, map_url,
      like_count, created_at, updated_at,
      added_by,
      adder:profiles!dalkkot_restaurants_added_by_fkey(nickname),
      updater:profiles!dalkkot_restaurants_updated_by_fkey(nickname),
      dalkkot_restaurant_likes!left(user_id)
    `)
    .order("like_count", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 현재 사용자 좋아요 여부 표시
  type RawRow = NonNullable<typeof data>[number];
  const result2 = (data ?? []).map((r: RawRow) => ({
    ...r,
    is_liked: Array.isArray(r.dalkkot_restaurant_likes)
      ? r.dalkkot_restaurant_likes.some((l: { user_id: string }) => l.user_id === user.id)
      : false,
    dalkkot_restaurant_likes: undefined,
  }));

  return NextResponse.json(result2);
}

/**
 * POST /api/jeju/restaurants
 * 맛집 추가 (승인된 사용자 누구나)
 */
export async function POST(request: NextRequest) {
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { user } = result;

  const body = await request.json();
  const { name, category, address, description, map_url } = body;

  if (!name) {
    return NextResponse.json({ error: "이름 필수" }, { status: 400 });
  }

  const adminSupabase = createServiceRoleSupabaseClient();
  const { data, error } = await adminSupabase
    .from("dalkkot_restaurants")
    .insert({ name, category: category ?? "식당", address, description, map_url, added_by: user.id })
    .select("id, name, category")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
