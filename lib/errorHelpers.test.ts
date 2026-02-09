import { describe, it, expect } from 'vitest';
import { friendlyError, friendlyErrorApproval, friendlyErrorTournament } from './errorHelpers';

describe('friendlyError() - Supabase error to Korean message', () => {
  it('should return message for unique constraint violation (23505)', () => {
    const error = { code: '23505', message: 'duplicate key value' };
    const result = friendlyError(error);
    expect(result).toBe('이미 등록된 정보입니다.');
  });

  it('should return message for permission denied (42501)', () => {
    const error = { code: '42501', message: 'permission denied' };
    const result = friendlyError(error);
    expect(result).toBe('권한이 없습니다.');
  });

  it('should return message for not found (PGRST116)', () => {
    const error = { code: 'PGRST116', message: 'not found' };
    const result = friendlyError(error);
    expect(result).toBe('요청한 데이터를 찾을 수 없습니다.');
  });

  it('should detect "permission" in message', () => {
    const error = { message: 'You do not have permission to access' };
    const result = friendlyError(error);
    expect(result).toBe('권한이 없습니다.');
  });

  it('should detect "not found" in message', () => {
    const error = { message: 'User not found' };
    const result = friendlyError(error);
    expect(result).toBe('찾을 수 없습니다.');
  });

  it('should detect "unique" in message', () => {
    const error = { message: 'unique constraint violated' };
    const result = friendlyError(error);
    expect(result).toBe('중복된 항목입니다.');
  });

  it('should return original message as fallback', () => {
    const error = { message: '예상치 못한 에러가 발생했습니다.' };
    const result = friendlyError(error);
    expect(result).toBe('예상치 못한 에러가 발생했습니다.');
  });

  it('should handle null/undefined', () => {
    const result = friendlyError(null as any);
    expect(result).toBe('알 수 없는 에러가 발생했습니다.');
  });
});

describe('friendlyErrorApproval() - Approval-specific errors', () => {
  it('should return approval-specific message for duplicate', () => {
    const error = { code: '23505', message: 'duplicate' };
    const result = friendlyErrorApproval(error);
    expect(result).toBe('이미 처리된 신청입니다.');
  });

  it('should return approval-specific message for permission denied', () => {
    const error = { code: '42501', message: 'permission denied' };
    const result = friendlyErrorApproval(error);
    expect(result).toBe('승인 권한이 없습니다.');
  });

  it('should fallback to main friendlyError for other codes', () => {
    const error = { code: 'UNKNOWN', message: 'unknown error' };
    const result = friendlyErrorApproval(error);
    expect(result).toBe('unknown error');
  });
});

describe('friendlyErrorTournament() - Tournament-specific errors', () => {
  it('should return tournament-specific message for permission denied', () => {
    const error = { code: '42501', message: 'permission denied' };
    const result = friendlyErrorTournament(error);
    expect(result).toBe('대회 관리자만 접근할 수 있습니다.');
  });

  it('should fallback to main friendlyError for other codes', () => {
    const error = { code: '23505', message: 'duplicate' };
    const result = friendlyErrorTournament(error);
    expect(result).toBe('이미 등록된 정보입니다.');
  });
});
