import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

type Params = { params: Promise<{ id: string }> };

/** GET /api/jeju/restaurants/[id]/comments — 댓글 목록 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { supabase } = result;

  const { data, error } = await supabase
    .from("dalkkot_restaurant_comments")
    .select(`
      id, content, created_at, updated_at, user_id,
      author:profiles!dalkkot_restaurant_comments_user_id_fkey(nickname)
    `)
    .eq("restaurant_id", id)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST /api/jeju/restaurants/[id]/comments — 댓글 작성 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { user } = result;

  const body = await request.json();
  const { content } = body;

  if (!content || content.trim().length === 0) {
    return NextResponse.json({ error: "내용 필수" }, { status: 400 });
  }
  if (content.length > 500) {
    return NextResponse.json({ error: "최대 500자" }, { status: 400 });
  }

  const adminSupabase = createServiceRoleSupabaseClient();
  const { data, error } = await adminSupabase
    .from("dalkkot_restaurant_comments")
    .insert({ restaurant_id: id, user_id: user.id, content: content.trim() })
    .select("id, content, created_at, user_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
