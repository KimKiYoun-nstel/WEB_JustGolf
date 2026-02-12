import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleSupabaseClient,
  requireApiUser,
} from "../../../../../lib/apiGuard";

/**
 * GET /api/admin/users/[id]
 * 관리자용 사용자 상세 조회
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    const guard = await requireApiUser({ requireAdmin: true });
    if ("error" in guard) {
      return guard.error;
    }

    const supabaseAdmin = createServiceRoleSupabaseClient();

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id,nickname,email,full_name,is_admin,is_approved,created_at,updated_at")
      .eq("id", userId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const metadata = authUserData?.user?.user_metadata ?? {};

    return NextResponse.json({
      ...profile,
      full_name: profile.full_name ?? metadata.full_name ?? null,
      phone: metadata.phone ?? null,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
