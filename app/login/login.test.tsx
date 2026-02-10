import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './page';

// Mock Supabase
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      signUp: (...args: any[]) => mockSignUp(...args),
      signOut: vi.fn(),
    },
    from: (...args: any[]) => {
      mockFrom(...args);
      return {
        select: (...selectArgs: any[]) => {
          mockSelect(...selectArgs);
          return {
            eq: (...eqArgs: any[]) => {
              mockEq(...eqArgs);
              return {
                single: () => mockSingle(),
              };
            },
          };
        },
        insert: (...insertArgs: any[]) => {
          mockInsert(...insertArgs);
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  },
}));

// Mock auth hook
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}));

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as any;
  });

  describe('회원가입', () => {
    it('신규 사용자는 is_approved=false로 생성되어야 한다', async () => {
      const user = userEvent.setup();
      
      mockSignUp.mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'newuser@test.com',
          },
        },
        error: null,
      });

      mockInsert.mockResolvedValue({
        data: null,
        error: null,
      });

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('example@company.com');
      const passwordInput = screen.getAllByDisplayValue('')[1]; // 비밀번호 필드
      const nicknameInput = screen.getByPlaceholderText(/회원가입 시/);
      const signupButton = screen.getByText('회원가입');

      await user.type(emailInput, 'newuser@test.com');
      await user.type(passwordInput, 'password123');
      await user.type(nicknameInput, '테스터');
      await user.click(signupButton);

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: 'newuser@test.com',
          password: 'password123',
          options: {
            data: { nickname: '테스터' },
          },
        });
      });

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith({
          id: 'test-user-id',
          nickname: '테스터',
          email: 'newuser@test.com',
          is_approved: false,
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/관리자 승인 후 로그인/)).toBeInTheDocument();
      });
    });

    it('회원가입 실패 시 에러 메시지를 표시해야 한다', async () => {
      const user = userEvent.setup();
      
      mockSignUp.mockResolvedValue({
        data: null,
        error: { message: 'User already registered' },
      });

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('example@company.com');
      const passwordInput = screen.getAllByDisplayValue('')[1];
      const nicknameInput = screen.getByPlaceholderText(/회원가입 시/);
      const signupButton = screen.getByText('회원가입');

      await user.type(emailInput, 'existing@test.com');
      await user.type(passwordInput, 'password123');
      await user.type(nicknameInput, '기존사용자');
      await user.click(signupButton);

      await waitFor(() => {
        expect(screen.getByText(/회원가입 실패.*User already registered/)).toBeInTheDocument();
      });
    });
  });

  describe('로그인', () => {
    it('승인된 일반 사용자는 로그인할 수 있어야 한다', async () => {
      const user = userEvent.setup();
      
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'approved-user-id',
            email: 'approved@test.com',
          },
        },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: {
          id: 'approved-user-id',
          email: 'approved@test.com',
          nickname: '승인된사용자',
          is_approved: true,
          is_admin: false,
        },
        error: null,
      });

      // Mock window.location
      delete (window as any).location;
      (window as any).location = { href: '' };

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('example@company.com');
      const passwordInput = screen.getAllByDisplayValue('')[1];
      const loginButton = screen.getByText('로그인');

      await user.type(emailInput, 'approved@test.com');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith({
          email: 'approved@test.com',
          password: 'password123',
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/로그인 성공/)).toBeInTheDocument();
      });
    });

    it('미승인 일반 사용자는 로그인할 수 없어야 한다', async () => {
      const user = userEvent.setup();
      
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'unapproved-user-id',
            email: 'unapproved@test.com',
          },
        },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: {
          id: 'unapproved-user-id',
          email: 'unapproved@test.com',
          nickname: '미승인사용자',
          is_approved: false,
          is_admin: false,
        },
        error: null,
      });

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('example@company.com');
      const passwordInput = screen.getAllByDisplayValue('')[1];
      const loginButton = screen.getByText('로그인');

      await user.type(emailInput, 'unapproved@test.com');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText(/관리자 승인 대기/)).toBeInTheDocument();
      });
    });

    it('관리자는 승인 없이도 로그인할 수 있어야 한다', async () => {
      const user = userEvent.setup();
      
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'admin-user-id',
            email: 'admin@test.com',
          },
        },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: {
          id: 'admin-user-id',
          email: 'admin@test.com',
          nickname: '관리자',
          is_approved: false, // 승인 안 됐어도
          is_admin: true,     // 관리자면 통과
        },
        error: null,
      });

      delete (window as any).location;
      (window as any).location = { href: '' };

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('example@company.com');
      const passwordInput = screen.getAllByDisplayValue('')[1];
      const loginButton = screen.getByText('로그인');

      await user.type(emailInput, 'admin@test.com');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText(/로그인 성공/)).toBeInTheDocument();
      });
    });

    it('잘못된 비밀번호로 로그인 시 에러 메시지를 표시해야 한다', async () => {
      const user = userEvent.setup();
      
      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('example@company.com');
      const passwordInput = screen.getAllByDisplayValue('')[1];
      const loginButton = screen.getByText('로그인');

      await user.type(emailInput, 'user@test.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText(/로그인 실패.*Invalid login credentials/)).toBeInTheDocument();
      });
    });
  });
});
