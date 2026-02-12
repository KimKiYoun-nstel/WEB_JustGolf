import { NextResponse } from "next/server";
import {
  createServiceRoleSupabaseClient,
  requireApiUser,
} from "../../../../lib/apiGuard";

/**
 * POST /api/auth/sync-approval
 * approval_required=false 인 경우, 현재 사용자 is_approved를 true로 동기화
 */
export async function POST() {
  try {
    const guard = await requireApiUser();
    if ("error" in guard) {
      return guard.error;
    }

    const supabaseAdmin = createServiceRoleSupabaseClient();
    const { data: setting, error: settingError } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "approval_required")
      .maybeSingle<{ value: boolean }>();

    if (settingError) {
      return NextResponse.json({ error: settingError.message }, { status: 500 });
    }

    const approvalRequired =
      typeof setting?.value === "boolean" ? setting.value : true;

    if (approvalRequired) {
      return NextResponse.json({
        synced: false,
        reason: "approval_required_enabled",
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ is_approved: true, updated_at: new Date().toISOString() })
      .eq("id", guard.user.id)
      .eq("is_approved", false);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ synced: true });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
