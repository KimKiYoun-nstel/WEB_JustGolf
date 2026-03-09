import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

type Params = { params: Promise<{ id: string; commentId: string }> };

/** PATCH /api/jeju/restaurants/[id]/comments/[commentId] — 본인 댓글 수정 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { commentId } = await params;
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { user, supabase } = result;

  const { data: comment } = await supabase
    .from("dalkkot_restaurant_comments")
    .select("id, user_id")
    .eq("id", commentId)
    .maybeSingle();

  if (!comment) return NextResponse.json({ error: "댓글 없음" }, { status: 404 });
  if (comment.user_id !== user.id) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json();
  const { content } = body;
  if (!content?.trim()) return NextResponse.json({ error: "내용 필수" }, { status: 400 });

  const adminSupabase = createServiceRoleSupabaseClient();
  const { error } = await adminSupabase
    .from("dalkkot_restaurant_comments")
    .update({ content: content.trim() })
    .eq("id", commentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE /api/jeju/restaurants/[id]/comments/[commentId] — 본인 or 관리자 삭제 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { commentId } = await params;
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { user, supabase } = result;

  const { data: comment } = await supabase
    .from("dalkkot_restaurant_comments")
    .select("id, user_id")
    .eq("id", commentId)
    .maybeSingle();

  if (!comment) return NextResponse.json({ error: "댓글 없음" }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_dalkkot_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (comment.user_id !== user.id && !profile?.is_dalkkot_admin) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const adminSupabase = createServiceRoleSupabaseClient();
  const { error } = await adminSupabase
    .from("dalkkot_restaurant_comments")
    .delete()
    .eq("id", commentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
