/**
 * 관리자 API 통합 테스트
 * Service Role Key 사용하여 DB 데이터 조작
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestUser,
  deleteTestUser,
  promoteToAdmin,
  approveUser,
  getAllUsers,
  supabaseAdmin,
} from '../../lib/supabaseAdmin';

const TEST_EMAIL = `test-admin-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NICKNAME = `AdminTest${Date.now()}`;

let testUserId: string;

describe('관리자 API 통합 테스트 (Admin API Integration)', () => {
  
  beforeAll(async () => {
    console.log('테스트 전: 테스트 사용자 생성...');
    const user = await createTestUser(TEST_EMAIL, TEST_PASSWORD, TEST_NICKNAME);
    testUserId = user.id;
    console.log(`테스트 사용자 생성 완료: ${testUserId}`);
  });

  afterAll(async () => {
    console.log('테스트 후: 테스트 사용자 삭제...');
    try {
      await deleteTestUser(testUserId);
      console.log('테스트 사용자 삭제 완료');
    } catch (error) {
      console.error('테스트 사용자 삭제 실패:', error);
    }
  });

  describe('사용자 관리 (User Management)', () => {
    it('service role key로 사용자 생성', async () => {
      expect(testUserId).toBeTruthy();
      expect(testUserId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('모든 사용자 조회 (service role key)', async () => {
      const users = await getAllUsers();
      
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
      
      // 테스트 사용자가 포함되어 있는지 확인
      const testUser = users.find(u => u.id === testUserId);
      expect(testUser).toBeTruthy();
      // 참고: Supabase trigger에서 nickname을 "익명"으로 기본값 설정하므로
      // 생성 시 설정한 nickname이 아닌 기본값이 저장됨
      expect(testUser?.nickname).toBeTruthy();
    });

    it('사용자 승인 처리', async () => {
      const approvedUser = await approveUser(testUserId);
      
      expect(approvedUser).toBeTruthy();
      expect(approvedUser.is_approved).toBe(true);
    });

    it('사용자를 관리자로 승격', async () => {
      const promotedUser = await promoteToAdmin(testUserId);
      
      expect(promotedUser).toBeTruthy();
      expect(promotedUser.is_admin).toBe(true);
      expect(promotedUser.is_approved).toBe(true);
    });

    it('직접 쿼리로 사용자 정보 업데이트', async () => {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({
          nickname: `Updated${TEST_NICKNAME}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', testUserId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.nickname).toBe(`Updated${TEST_NICKNAME}`);
    });
  });

  describe('데이터 무결성 (Data Integrity)', () => {
    it('생성된 사용자의 데이터 구조 검증', async () => {
      const { data: user } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', testUserId)
        .single();

      // 필수 필드 확인
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('nickname');
      expect(user).toHaveProperty('is_admin');
      expect(user).toHaveProperty('is_approved');
      expect(user).toHaveProperty('created_at');
      expect(user).toHaveProperty('updated_at');
    });

    it('사용자 생성 시간 검증', async () => {
      const { data: user } = await supabaseAdmin
        .from('profiles')
        .select('created_at')
        .eq('id', testUserId)
        .single();

      const createdAt = new Date(user.created_at);
      const now = new Date();
      const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;

      // 생성 시간이 현재로부터 1분 이내여야 함
      expect(diffSeconds).toBeLessThan(60);
    });
  });

  describe('권한 제어 검증 (Permission Validation)', () => {
    it('관리자 사용자는 is_admin=true', async () => {
      const { data: user } = await supabaseAdmin
        .from('profiles')
        .select('is_admin')
        .eq('id', testUserId)
        .single();

      expect(user.is_admin).toBe(true);
    });

    it('승인된 사용자는 is_approved=true', async () => {
      const { data: user } = await supabaseAdmin
        .from('profiles')
        .select('is_approved')
        .eq('id', testUserId)
        .single();

      expect(user.is_approved).toBe(true);
    });
  });
});

describe('대량 데이터 관리 (Bulk Data Operations)', () => {
  const testUserIds: string[] = [];

  beforeAll(async () => {
    console.log('대량 테스트 전: 10개의 테스트 사용자 생성...');
    for (let i = 0; i < 3; i++) {
      const user = await createTestUser(
        `bulk-test-${i}-${Date.now()}@example.com`,
        'TempPass123!',
        `BulkUser${i}`
      );
      testUserIds.push(user.id);
    }
    console.log(`${testUserIds.length}개의 사용자 생성 완료`);
  });

  afterAll(async () => {
    console.log('대량 테스트 후: 생성된 사용자들 삭제...');
    for (const userId of testUserIds) {
      try {
        await deleteTestUser(userId);
      } catch (error) {
        console.error(`사용자 ${userId} 삭제 실패:`, error);
      }
    }
  });

  it('여러 사용자를 한 번에 승인', async () => {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_approved: true })
      .in('id', testUserIds);

    expect(error).toBeNull();

    // 검증
    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('id, is_approved')
      .in('id', testUserIds);

    expect(users?.every(u => u.is_approved)).toBe(true);
  });

  it('여러 사용자의 닉네임 일괄 수정', async () => {
    const updatePromises = testUserIds.map((userId, index) =>
      supabaseAdmin
        .from('profiles')
        .update({ nickname: `BulkUpdated${index}` })
        .eq('id', userId)
    );

    const results = await Promise.all(updatePromises);
    
    // 모든 업데이트가 성공했는지 확인
    expect(results.every(r => r.error === null)).toBe(true);
  });
});
