import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PATCH /api/admin/users/[id]/set-admin
 * 사용자에게 관리자 권한 부여/해제 (관리자만 접근 가능)
 * Service Role Key로 프로필 업데이트
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const body = await request.json();
    const { is_admin } = body;

    if (typeof is_admin !== 'boolean') {
      return NextResponse.json(
        { error: 'is_admin은 boolean이어야 합니다' },
        { status: 400 }
      );
    }

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

    // 2. 요청자의 관리자 권한 확인 (자신도 관리자여야 함)
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!requesterProfile?.is_admin) {
      return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 });
    }

    // 3. 자신의 권한을 제거하려고 하는지 확인 (방지)
    if (user.id === userId && !is_admin) {
      return NextResponse.json(
        { error: '자신의 관리자 권한을 제거할 수 없습니다' },
        { status: 400 }
      );
    }

    // 4. Service Role Key로 권한 변경
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

    const { data: updatedProfile, error } = await supabaseAdmin
      .from('profiles')
      .update({
        is_admin,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: `관리자 권한 ${is_admin ? '부여' : '제거'} 완료`,
        profile: updatedProfile,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: '서버 오류 발생' },
      { status: 500 }
    );
  }
}
