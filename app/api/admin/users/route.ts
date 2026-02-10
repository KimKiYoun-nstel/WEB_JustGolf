import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/users
 * 모든 사용자 목록 조회 (관리자만 접근 가능)
 * Service Role Key로 모든 프로필 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 요청자가 관리자인지 확인
    const cookieStore = await cookies();
    const supabase = createServerClient(
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    }

    // 2. 요청자의 관리자 권한 확인
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!requesterProfile?.is_admin) {
      return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 });
    }

    // 3. Service Role Key로 모든 프로필 조회
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

    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, nickname, email, is_admin, is_approved, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(profiles);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: '서버 오류 발생' },
      { status: 500 }
    );
  }
}
