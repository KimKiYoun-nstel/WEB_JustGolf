/**
 * DELETE /api/tournaments/[id]/gallery/[itemId]
 * 갤러리 아이템 삭제 (본인 또는 관리자)
 * - DB 삭제 + Cloudinary 이미지 삭제
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "../../../../../../lib/apiGuard";
import { deleteCloudinaryImage } from "../../../../../../lib/cloudinary";

function parseTournamentId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;

  const tournamentId = parseTournamentId(id);
  const itemIdNum = parseTournamentId(itemId);
  if (!tournamentId || !itemIdNum) {
    return NextResponse.json({ error: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const { user, supabase } = guard;

  // 아이템 조회 (권한 확인용)
  const { data: item, error: fetchError } = await supabase
    .from("tournament_gallery_items")
    .select("id, user_id, media_type, cloudinary_public_id")
    .eq("id", itemIdNum)
    .eq("tournament_id", tournamentId)
    .maybeSingle();

  if (fetchError || !item) {
    return NextResponse.json({ error: "아이템을 찾을 수 없습니다." }, { status: 404 });
  }

  // 권한 확인: 본인 또는 관리자
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.is_admin === true;
  if (item.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  // DB에서 삭제
  const { error: deleteError } = await supabase
    .from("tournament_gallery_items")
    .delete()
    .eq("id", itemIdNum);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Cloudinary 이미지 삭제 (이미지 타입일 때만)
  if (item.media_type === "image" && item.cloudinary_public_id) {
    try {
      await deleteCloudinaryImage(item.cloudinary_public_id);
    } catch {
      // Cloudinary 삭제 실패는 무시 (DB는 이미 삭제됨)
    }
  }

  return NextResponse.json({ success: true });
}
