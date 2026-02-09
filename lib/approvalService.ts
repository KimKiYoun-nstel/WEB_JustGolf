/**
 * 가입 승인 비즈니스 로직
 * 페이지에서 분리된 순수 함수들
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface ApprovalResult {
  success: boolean;
  error?: string;
}

/**
 * 단일 신청 승인
 */
export async function approveRegistration(
  supabase: SupabaseClient,
  registrationId: number,
  approverUserId: string
): Promise<ApprovalResult> {
  try {
    const { error } = await supabase
      .from('registrations')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: approverUserId,
      })
      .eq('id', registrationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * 단일 신청 거절
 */
export async function rejectRegistration(
  supabase: SupabaseClient,
  registrationId: number,
  approverUserId: string
): Promise<ApprovalResult> {
  try {
    const { error } = await supabase
      .from('registrations')
      .update({
        approval_status: 'rejected',
        approved_at: new Date().toISOString(),
        approved_by: approverUserId,
      })
      .eq('id', registrationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * 대기 중인 신청 개수 조회
 */
export async function getPendingApprovalsCount(
  supabase: SupabaseClient,
  tournamentId: number
): Promise<{ count: number; error?: string }> {
  try {
    const { count, error } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('approval_status', 'pending');

    if (error) {
      return { count: 0, error: error.message };
    }

    return { count: count || 0 };
  } catch (err) {
    return {
      count: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * 승인 현황 통계
 */
export async function getApprovalStatusSummary(
  supabase: SupabaseClient,
  tournamentId: number
): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('approval_status')
      .eq('tournament_id', tournamentId);

    if (error) {
      return {
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0,
        error: error.message,
      };
    }

    const regs = data || [];
    return {
      pending: regs.filter((r) => r.approval_status === 'pending').length,
      approved: regs.filter((r) => r.approval_status === 'approved').length,
      rejected: regs.filter((r) => r.approval_status === 'rejected').length,
      total: regs.length,
    };
  } catch (err) {
    return {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
