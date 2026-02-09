/**
 * 라운드 신청 및 활동 선택 비즈니스 로직
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface SideEventRegistrationPayload {
  side_event_id: number;
  user_id: string;
  nickname: string;
  memo?: string | null;
  meal_selected?: boolean;
  lodging_selected?: boolean;
}

export interface ActivitySelectionPayload {
  registration_id: number;
  extra_id: number;
  selected: boolean;
}

export interface RegistrationResult {
  success: boolean;
  id?: number;
  error?: string;
}

/**
 * 라운드 신청
 */
export async function applySideEvent(
  supabase: SupabaseClient,
  payload: SideEventRegistrationPayload
): Promise<RegistrationResult> {
  try {
    const { data, error } = await supabase
      .from('side_event_registrations')
      .insert([
        {
          side_event_id: payload.side_event_id,
          user_id: payload.user_id,
          nickname: payload.nickname,
          memo: payload.memo || null,
          status: 'applied',
          meal_selected: payload.meal_selected || false,
          lodging_selected: payload.lodging_selected || false,
        },
      ])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * 라운드 신청 취소
 */
export async function cancelSideEventRegistration(
  supabase: SupabaseClient,
  registrationId: number
): Promise<RegistrationResult> {
  try {
    const { error } = await supabase
      .from('side_event_registrations')
      .update({ status: 'canceled' })
      .eq('id', registrationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: registrationId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * 활동 선택 저장/업데이트
 */
export async function upsertActivitySelection(
  supabase: SupabaseClient,
  registrationId: number,
  selectedExtraIds: number[]
): Promise<RegistrationResult> {
  try {
    // 1. 기존 선택 모두 삭제
    const { error: deleteError } = await supabase
      .from('registration_activity_selections')
      .delete()
      .eq('registration_id', registrationId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // 2. 새 선택 삽입
    if (selectedExtraIds.length > 0) {
      const insertPayload = selectedExtraIds.map((extraId) => ({
        registration_id: registrationId,
        extra_id: extraId,
        selected: true,
      }));

      const { error: insertError } = await supabase
        .from('registration_activity_selections')
        .insert(insertPayload);

      if (insertError) {
        return { success: false, error: insertError.message };
      }
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
 * 라운드 신청 목록 조회
 */
export async function getSideEventRegistrations(
  supabase: SupabaseClient,
  sideEventId: number
): Promise<{
  data: any[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('side_event_registrations')
      .select('id,user_id,nickname,status,memo,meal_selected,lodging_selected')
      .eq('side_event_id', sideEventId)
      .order('id', { ascending: true });

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: data || [] };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * 사용자의 활동 선택 조회
 */
export async function getUserActivitySelections(
  supabase: SupabaseClient,
  registrationId: number
): Promise<{
  data: number[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('registration_activity_selections')
      .select('extra_id')
      .eq('registration_id', registrationId)
      .eq('selected', true);

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: (data || []).map((d) => d.extra_id) };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
