import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type GuardOptions = {
  requireAdmin?: boolean;
  requireApproved?: boolean;
  requireOnboardingCompleted?: boolean;
};

type GuardSuccess = {
  supabase: ReturnType<typeof createServerClient>;
  user: User;
  profile: { is_admin: boolean; is_approved: boolean } | null;
};

type GuardFailure = {
  error: NextResponse;
};

type GuardResult = GuardSuccess | GuardFailure;

export async function createRequestSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export function createServiceRoleSupabaseClient() {
  return createServerClient(
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
}

export async function requireApiUser(options: GuardOptions = {}): Promise<GuardResult> {
  const supabase = await createRequestSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "인증 필요" }, { status: 401 }) };
  }

  if (
    options.requireOnboardingCompleted &&
    user.user_metadata?.onboarding_completed !== true
  ) {
    return {
      error: NextResponse.json(
        { error: "온보딩 완료가 필요합니다." },
        { status: 403 }
      ),
    };
  }

  let profile: { is_admin: boolean; is_approved: boolean } | null = null;

  if (options.requireAdmin || options.requireApproved) {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_admin, is_approved")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data) {
      return {
        error: NextResponse.json(
          { error: "사용자 프로필 조회에 실패했습니다." },
          { status: 500 }
        ),
      };
    }

    profile = data;

    if (options.requireAdmin && !data.is_admin) {
      return {
        error: NextResponse.json({ error: "관리자 권한 필요" }, { status: 403 }),
      };
    }

    if (options.requireApproved && !data.is_approved) {
      return {
        error: NextResponse.json({ error: "승인 필요" }, { status: 403 }),
      };
    }
  }

  return { supabase, user, profile };
}
