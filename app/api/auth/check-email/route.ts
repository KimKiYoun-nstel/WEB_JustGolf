import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/check-email
 * 이메일 존재 여부 확인 (로그인 에러 메시지 개선용)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = body?.email;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "email이 필요합니다." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {},
        },
      }
    );

    let userExists = false;
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
      userExists = users.some(
        (user) => (user.email ?? "").toLowerCase() === normalizedEmail
      );

      if (userExists) {
        break;
      }

      if (!data?.nextPage) {
        break;
      }

      page = data.nextPage;
    }

    let profileExists = false;

    if (!userExists) {
      const { data: profileMatches, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", normalizedEmail)
        .limit(1);

      if (!profileError && (profileMatches ?? []).length > 0) {
        profileExists = true;
      }
    }

    return NextResponse.json({
      exists: userExists,
      profileExists,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
