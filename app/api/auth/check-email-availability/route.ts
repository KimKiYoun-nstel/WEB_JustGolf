import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleSupabaseClient,
  requireApiUser,
} from "../../../../lib/apiGuard";

/**
 * POST /api/auth/check-email-availability
 * 온보딩용 이메일 사용 가능 여부 확인 (현재 로그인 사용자 제외)
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireApiUser();
    if ("error" in guard) {
      return guard.error;
    }

    const body = await request.json().catch(() => null);
    const email = body?.email;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email이 필요합니다." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json({ error: "email이 필요합니다." }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleSupabaseClient();

    let authEmailInUse = false;
    let page = 1;
    const perPage = 200;

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const users = data?.users ?? [];
      authEmailInUse = users.some(
        (u) =>
          (u.email ?? "").toLowerCase() === normalizedEmail && u.id !== guard.user.id
      );

      if (authEmailInUse || !data?.nextPage) {
        break;
      }

      page = data.nextPage;
    }

    const { data: profileMatches, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", normalizedEmail)
      .neq("id", guard.user.id)
      .limit(1);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const profileEmailInUse = (profileMatches ?? []).length > 0;

    return NextResponse.json({
      available: !authEmailInUse && !profileEmailInUse,
      authEmailInUse,
      profileEmailInUse,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
