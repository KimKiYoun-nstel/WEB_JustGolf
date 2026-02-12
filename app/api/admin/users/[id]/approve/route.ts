import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleSupabaseClient,
  requireApiUser,
} from "../../../../../../lib/apiGuard";

/**
 * PATCH /api/admin/users/[id]/approve
 * 사용자 계정 승인/해제 (관리자 전용)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const body = await request.json().catch(() => null);
    const approved =
      body && typeof body.approved === "boolean" ? body.approved : true;

    const guard = await requireApiUser({ requireAdmin: true });
    if ("error" in guard) {
      return guard.error;
    }

    const supabaseAdmin = createServiceRoleSupabaseClient();

    const { data: updatedProfile, error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_approved: approved,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: approved ? "사용자 승인 완료" : "사용자 승인 해제 완료",
        profile: updatedProfile,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
