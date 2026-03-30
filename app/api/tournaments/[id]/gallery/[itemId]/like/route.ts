/**
 * POST   /api/tournaments/[id]/gallery/[itemId]/like  — 좋아요 추가
 * DELETE /api/tournaments/[id]/gallery/[itemId]/like  — 좋아요 취소
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "../../../../../../../lib/apiGuard";

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(
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
  const { user, supabase } = guard;

  const { error } = await supabase
    .from("tournament_gallery_likes")
    .insert({ item_id: itemIdNum, user_id: user.id });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 좋아요를 눌렀습니다." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
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
  const { user, supabase } = guard;

  const { error } = await supabase
    .from("tournament_gallery_likes")
    .delete()
    .eq("item_id", itemIdNum)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
