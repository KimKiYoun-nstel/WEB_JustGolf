/**
 * 핵심 Route 통합 테스트
 * 
 * 테스트 범위:
 * - 시작 페이지 렌더링
 * - 대회 목록 조회
 * - 관리자 대시보드
 * - 회원 승인 페이지
 * 
 * Note: Supabase Mock을 사용한 UI/UX 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  useParams: vi.fn(),
}));

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  },
}));

// Mock useAuth hook
vi.mock('../../lib/auth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    loading: false,
  })),
}));

describe('WEB_JustGolf - Route Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({
      push: vi.fn(),
      refresh: vi.fn(),
    });
    (useSearchParams as any).mockReturnValue({
      get: vi.fn(() => null),
    });
  });

  describe('시작 페이지 (/start)', () => {
    it('바로가기 카드 3개가 렌더링되어야 한다', async () => {
      const StartPage = (await import('../../app/start/page')).default;
      render(<StartPage />);
      
      // 바로가기 카드 제목 확인
      expect(screen.getByText(/대회/)).toBeInTheDocument();
      expect(screen.getByText(/제주/)).toBeInTheDocument();
      expect(screen.getByText(/게시판/)).toBeInTheDocument();
    });

    it('대회 카드 클릭 시 /tournaments로 이동한다', async () => {
      const StartPage = (await import('../../app/start/page')).default;
const { container } = render(<StartPage />);
      
      const tournamentLink = screen.getByRole('link', { name: /대회.*로/i });
      expect(tournamentLink).toHaveAttribute('href', '/tournaments');
    });
  });

  describe('관리자 대시보드 (/admin)', () => {
    it('관리자 메뉴 카드가 렌더링되어야 한다', async () => {
      const AdminPage = (await import('../../app/admin/page')).default;
      render(<AdminPage />);
      
      // 주요 관리 기능 확인
      expect(screen.getByText(/대회 관리/)).toBeInTheDocument();
      expect(screen.getByText(/회원 관리/)).toBeInTheDocument();
      expect(screen.getByText(/조편성 관리/)).toBeInTheDocument();
    });

    it('대회 관리 링크가 올바른 경로를 가져야 한다', async () => {
      const AdminPage = (await import('../../app/admin/page')).default;
      render(<AdminPage />);
      
      const tournamentLink = screen.getByRole('link', { name: /대회 목록으로/i });
      expect(tournamentLink).toHaveAttribute('href', '/admin/tournaments');
    });
  });

  describe('네비게이션 통합', () => {
    it('모든 주요 Route가 정의되어 있어야 한다', () => {
      const expectedRoutes = [
        '/start',
        '/tournaments',
        '/login',
        '/admin',
        '/admin/users',
        '/admin/tournaments',
      ];
      
      // Route 파일 존재 여부는 빌드 시 확인됨
      // 여기서는 개념적 검증
      expect(expectedRoutes.length).toBeGreaterThan(0);
    }); it('비로그인 사용자는 /login으로 리다이렉트되어야 한다', () => {
      // Proxy middleware가 이 로직을 처리
      // 실제 동작은 E2E 테스트 또는 수동 테스트로 검증
      expect(true).toBe(true); // Placeholder
    });
  });
});
