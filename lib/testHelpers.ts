import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Mock 설정
 * 테스트에서 실제 DB 호출 없이 로직 검증
 */

/**
 * 기본 Mock 쿼리 빌더
 * .from().select() 같은 체이닝을 지원
 */
export function createMockQueryBuilder(initialData: any = null, initialError: any = null): any {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
  };

  // 최종 결과 저장
  if (initialData !== null) {
    Object.defineProperty(builder, 'data', {
      value: initialData,
      writable: true,
    });
  }
  if (initialError !== null) {
    Object.defineProperty(builder, 'error', {
      value: initialError,
      writable: true,
    });
  }

  return builder;
}

/**
 * Supabase 클라이언트 Mock
 */
export function createMockSupabaseClient(): any {
  return {
    from: vi.fn((table: string) => createMockQueryBuilder()),
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
    rpc: vi.fn(),
  };
}

/**
 * Mock 데이터 셋업 헬퍼
 */
export const mockData = {
  // 기본 사용자
  user: {
    id: 'test-user-123',
    email: 'test@example.com',
    user_metadata: {},
  },

  // 기본 프로필
  profile: {
    id: 'test-user-123',
    nickname: '테스트사용자',
    is_admin: false,
  },

  adminProfile: {
    id: 'admin-123',
    nickname: '관리자',
    is_admin: true,
  },

  // 기본 토너먼트
  tournament: {
    id: 1,
    title: '2026 골프투어',
    event_date: '2026-06-15',
    status: 'open',
    created_by: 'admin-123',
  },

  // 기본 신청서
  registration: {
    id: 1,
    tournament_id: 1,
    user_id: 'test-user-123',
    nickname: '테스트사용자',
    status: 'applied',
    approval_status: 'pending',
    approved_at: null,
    approved_by: null,
    meal_option_id: null,
    created_at: '2026-02-09T00:00:00Z',
  },

  // 승인된 신청서
  approvedRegistration: {
    id: 1,
    tournament_id: 1,
    user_id: 'test-user-123',
    nickname: '테스트사용자',
    status: 'confirmed',
    approval_status: 'approved',
    approved_at: '2026-02-09T12:00:00Z',
    approved_by: 'admin-123',
    meal_option_id: 1,
  },

  // 라운드
  sideEvent: {
    id: 1,
    tournament_id: 1,
    round_type: 'pre',
    title: '사전 친선전',
    tee_time: '08:00',
    location: '클럽 흑',
    status: 'open',
    meal_option_id: 1,
    lodging_available: true,
    lodging_required: false,
  },

  // 추가 활동
  tournamentExtra: {
    id: 1,
    tournament_id: 1,
    activity_name: '와인 바우',
    description: '저녁 와인 테이스팅',
    display_order: 1,
    is_active: true,
  },

  // 라운드 관리자 권한
  managerPermission: {
    id: 1,
    user_id: 'test-user-123',
    tournament_id: 1,
    can_manage_side_events: true,
    granted_at: '2026-02-09T00:00:00Z',
    revoked_at: null,
  },
};
