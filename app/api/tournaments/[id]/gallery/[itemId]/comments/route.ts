/**
 * GET  /api/tournaments/[id]/gallery/[itemId]/comments  — 댓글 목록
 * POST /api/tournaments/[id]/gallery/[itemId]/comments  — 댓글 작성
 * DELETE /api/tournaments/[id]/gallery/[itemId]/comments?commentId=  — 댓글 삭제
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "../../../../../../../lib/apiGuard";

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params;
  const itemIdNum = parseId(itemId);
  if (!itemIdNum) {
    return NextResponse.json({ error: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const { supabase } = guard;

  const { data, error } = await supabase
    .from("tournament_gallery_comments")
    .select(
      `id, item_id, user_id, content, created_at,
       profiles!tournament_gallery_comments_user_id_fkey(nickname)`
    )
    .eq("item_id", itemIdNum)
    .eq("is_hidden", false)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const comments = (data ?? []).map((row: Record<string, unknown>) => {
    const profiles = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      item_id: row.item_id,
      user_id: row.user_id,
      content: row.content,
      created_at: row.created_at,
      commenter_nickname:
        (profiles as { nickname?: string } | null)?.nickname ?? "알 수 없음",
    };
  });

  return NextResponse.json({ comments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params;
  const itemIdNum = parseId(itemId);
  if (!itemIdNum) {
    return NextResponse.json({ error: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  const guard = await requireApiUser({ requireApproved: true });
  if ("error" in guard) return guard.error;
  const { user, supabase } = guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const content = typeof (body as Record<string, unknown>).content === "string"
    ? (body as Record<string, unknown>).content as string
    : "";

  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 500) {
    return NextResponse.json({ error: "댓글은 1~500자 이내여야 합니다." }, { status: 400 });
  }

  const { data: comment, error } = await supabase
    .from("tournament_gallery_comments")
    .insert({ item_id: itemIdNum, user_id: user.id, content: trimmed })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: comment.id, created_at: comment.created_at }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params;
  const itemIdNum = parseId(itemId);
  if (!itemIdNum) {
    return NextResponse.json({ error: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  const commentId = parseId(request.nextUrl.searchParams.get("commentId") ?? "");
  if (!commentId) {
    return NextResponse.json({ error: "commentId가 필요합니다." }, { status: 400 });
  }

  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const { user, supabase } = guard;

  // 권한 확인
  const { data: comment } = await supabase
    .from("tournament_gallery_comments")
    .select("user_id")
    .eq("id", commentId)
    .eq("item_id", itemIdNum)
    .maybeSingle();

  if (!comment) {
    return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.is_admin === true;
  if (comment.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  const { error } = await supabase
    .from("tournament_gallery_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
