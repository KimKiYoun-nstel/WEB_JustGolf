import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabaseClient, mockData } from './testHelpers';
import {
  approveRegistration,
  rejectRegistration,
  getPendingApprovalsCount,
  getApprovalStatusSummary,
} from './approvalService';

describe('Approval Service - Integration Tests', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  // ============================================================================
  // Test: 단일 신청 승인
  // ============================================================================
  it('should approve a registration', async () => {
    mockSupabase.from.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await approveRegistration(
      mockSupabase,
      mockData.registration.id,
      mockData.adminProfile.id
    );

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should handle approval error', async () => {
    const mockError = { message: 'Database error' };
    mockSupabase.from.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: mockError }),
    });

    const result = await approveRegistration(
      mockSupabase,
      999,
      mockData.adminProfile.id
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database error');
  });

  // ============================================================================
  // Test: 단일 신청 거절
  // ============================================================================
  it('should reject a registration', async () => {
    mockSupabase.from.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await rejectRegistration(
      mockSupabase,
      mockData.registration.id,
      mockData.adminProfile.id
    );

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // ============================================================================
  // Test: 대기 신청 개수 조회
  // ============================================================================
  it('should get pending approvals count', async () => {
    const mockBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn()
        .mockReturnValueOnce({
          eq: vi.fn().mockResolvedValue({
            count: 5,
            error: null,
          }),
        }),
    };

    mockSupabase.from.mockReturnValue(mockBuilder);

    const result = await getPendingApprovalsCount(
      mockSupabase,
      mockData.tournament.id
    );

    expect(result.count).toBe(5);
    expect(result.error).toBeUndefined();
  });

  it('should return 0 when no pending approvals', async () => {
    const mockBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn()
        .mockReturnValueOnce({
          eq: vi.fn().mockResolvedValue({
            count: 0,
            error: null,
          }),
        }),
    };

    mockSupabase.from.mockReturnValue(mockBuilder);

    const result = await getPendingApprovalsCount(
      mockSupabase,
      mockData.tournament.id
    );

    expect(result.count).toBe(0);
  });

  // ============================================================================
  // Test: 승인 현황 요약
  // ============================================================================
  it('should get approval status summary', async () => {
    const mockRegistrations = [
      { ...mockData.registration, approval_status: 'pending' },
      { ...mockData.registration, id: 2, approval_status: 'pending' },
      { ...mockData.approvedRegistration, approval_status: 'approved' },
      { ...mockData.registration, id: 4, approval_status: 'rejected' },
    ];

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: mockRegistrations,
        error: null,
      }),
    });

    const result = await getApprovalStatusSummary(
      mockSupabase,
      mockData.tournament.id
    );

    expect(result.pending).toBe(2);
    expect(result.approved).toBe(1);
    expect(result.rejected).toBe(1);
    expect(result.total).toBe(4);
    expect(result.error).toBeUndefined();
  });

  it('should handle empty registrations in summary', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    const result = await getApprovalStatusSummary(
      mockSupabase,
      999
    );

    expect(result.pending).toBe(0);
    expect(result.approved).toBe(0);
    expect(result.rejected).toBe(0);
    expect(result.total).toBe(0);
  });

  // ============================================================================
  // Test: 에러 처리
  // ============================================================================
  it('should handle database errors in approval', async () => {
    mockSupabase.from.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        error: { message: 'Database error' },
      }),
    });

    const result = await approveRegistration(
      mockSupabase,
      1,
      mockData.adminProfile.id
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
