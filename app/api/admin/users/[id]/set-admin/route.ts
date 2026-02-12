import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleSupabaseClient,
  requireApiUser,
} from "../../../../../../lib/apiGuard";

/**
 * PATCH /api/admin/users/[id]/set-admin
 * 사용자 관리자 권한 부여/해제 (관리자 전용)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const body = await request.json().catch(() => null);
    const isAdmin = body?.is_admin;

    if (typeof isAdmin !== "boolean") {
      return NextResponse.json(
        { error: "is_admin은 boolean이어야 합니다." },
        { status: 400 }
      );
    }

    const guard = await requireApiUser({ requireAdmin: true });
    if ("error" in guard) {
      return guard.error;
    }

    if (guard.user.id === userId && !isAdmin) {
      return NextResponse.json(
        { error: "자신의 관리자 권한은 해제할 수 없습니다." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createServiceRoleSupabaseClient();

    const { data: updatedProfile, error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_admin: isAdmin,
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
        message: `관리자 권한 ${isAdmin ? "부여" : "해제"} 완료`,
        profile: updatedProfile,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
