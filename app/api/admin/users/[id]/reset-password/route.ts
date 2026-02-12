import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleSupabaseClient,
  requireApiUser,
} from "../../../../../../lib/apiGuard";

/**
 * PATCH /api/admin/users/[id]/reset-password
 * 관리자용 비밀번호 강제 설정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const body = await request.json().catch(() => null);
    const password = body?.password;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "password가 필요합니다." },
        { status: 400 }
      );
    }

    const guard = await requireApiUser({ requireAdmin: true });
    if ("error" in guard) {
      return guard.error;
    }

    const supabaseAdmin = createServiceRoleSupabaseClient();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: "비밀번호가 초기화되었습니다." },
      { status: 200 }
    );
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
