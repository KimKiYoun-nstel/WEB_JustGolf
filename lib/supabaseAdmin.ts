/**
 * Supabase Server Helper
 * Service Role Key를 사용한 서버 사이드 Supabase 클라이언트
 * 테스트 및 서버 API에서 사용
 */

import { createClient } from '@supabase/supabase-js';

// 환경변수 가져오기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
  );
}

/**
 * Service Role Key 기반 Supabase 클라이언트
 * - 모든 RLS 규칙 무시
 * - 관리자 기능에만 사용
 * - 프로덕션 환경에서는 신중하게 사용
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * 사용자 생성 (테스트용)
 */
export async function createTestUser(email: string, password: string, nickname: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }

  // 프로필 생성
  await supabaseAdmin
    .from('profiles')
    .insert({
      id: data.user.id,
      nickname,
      is_approved: true,
      is_admin: false,
    });

  return data.user;
}

/**
 * 사용자 삭제 (테스트용)
 */
export async function deleteTestUser(userId: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error(`Failed to delete user: ${error.message}`);
  }
}

/**
 * 사용자를 관리자로 승격 (테스트용)
 */
export async function promoteToAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ is_admin: true, is_approved: true })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to promote user: ${error.message}`);
  }

  return data;
}

/**
 * 사용자 승인 (테스트용)
 */
export async function approveUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ is_approved: true })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to approve user: ${error.message}`);
  }

  return data;
}

/**
 * 모든 사용자 조회 (테스트용)
 */
export async function getAllUsers() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, nickname, email, is_admin, is_approved, created_at');

  if (error) {
    throw new Error(`Failed to get users: ${error.message}`);
  }

  return data;
}

/**
 * 테이블 비우기 (테스트 정리용)
 */
export async function clearTable(tableName: string) {
  const { error } = await supabaseAdmin
    .from(tableName)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 행 삭제

  if (error) {
    throw new Error(`Failed to clear ${tableName}: ${error.message}`);
  }
}

export default supabaseAdmin;
