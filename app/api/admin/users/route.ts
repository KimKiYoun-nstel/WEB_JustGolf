import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleSupabaseClient,
  requireApiUser,
} from "../../../../lib/apiGuard";

/**
 * GET /api/admin/users
 * 모든 사용자 목록 조회 (관리자 전용)
 */
export async function GET(_request: NextRequest) {
  try {
    const guard = await requireApiUser({ requireAdmin: true });
    if ("error" in guard) {
      return guard.error;
    }

    const supabaseAdmin = createServiceRoleSupabaseClient();

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, nickname, email, is_admin, is_approved, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(profiles);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
