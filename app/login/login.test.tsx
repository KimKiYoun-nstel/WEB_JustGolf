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
const mockRpc = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../../lib/supabaseClient', () => {
  const client = {
    auth: {
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      signUp: (...args: any[]) => mockSignUp(...args),
      signOut: vi.fn(),
    },
    rpc: (...args: any[]) => mockRpc(...args),
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
        update: (...updateArgs: any[]) => {
          mockUpdate(...updateArgs);
          return {
            eq: (...eqArgs: any[]) => {
              mockEq(...eqArgs);
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };

  return {
    createClient: () => client,
    supabase: client,
  };
});

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
  useRouter: () => ({
    push: vi.fn(),
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
    mockRpc.mockResolvedValue({ data: true, error: null });
    mockSingle.mockResolvedValue({ data: { value: true }, error: null });
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

      mockRpc.mockResolvedValue({
        data: true,
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: {
          id: 'test-user-id',
          nickname: '테스터',
          is_approved: false,
        },
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
            data: { nickname: '테스터', onboarding_completed: false },
          },
        });
      });

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('is_nickname_available', {
          p_nickname: '테스터',
          p_user_id: null,
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/회원가입 완료/)).toBeInTheDocument();
        expect(screen.getByText(/관리자 승인 후 로그인/)).toBeInTheDocument();
      });
    });

    it('회원가입 실패 시 에러 메시지를 표시해야 한다', async () => {
      const user = userEvent.setup();
      
      mockSignUp.mockResolvedValue({
        data: null,
        error: { message: 'User already registered' },
      });
      mockRpc.mockResolvedValue({
        data: true,
        error: null,
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

    it('미승인 사용자도 로그인 성공 메시지를 표시한다', async () => {
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
        expect(screen.getByText(/로그인 성공/)).toBeInTheDocument();
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
      (globalThis as any).fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ exists: true, profileExists: false }),
      });

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('example@company.com');
      const passwordInput = screen.getAllByDisplayValue('')[1];
      const loginButton = screen.getByText('로그인');

      await user.type(emailInput, 'user@test.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText(/로그인 실패: 비밀번호가 틀렸습니다\./)).toBeInTheDocument();
      });
    });

    it('존재하지 않는 이메일로 로그인 시 계정 없음 메시지를 표시해야 한다', async () => {
      const user = userEvent.setup();

      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });
      (globalThis as any).fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ exists: false, profileExists: false }),
      });

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('example@company.com');
      const passwordInput = screen.getAllByDisplayValue('')[1];
      const loginButton = screen.getByText('로그인');

      await user.type(emailInput, 'unknown@test.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText(/로그인 실패: 존재하지 않는 계정입니다\./)).toBeInTheDocument();
      });
    });

    it('프로필만 존재하는 계정은 상태 오류 메시지를 표시해야 한다', async () => {
      const user = userEvent.setup();

      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });
      (globalThis as any).fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ exists: false, profileExists: true }),
      });

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('example@company.com');
      const passwordInput = screen.getAllByDisplayValue('')[1];
      const loginButton = screen.getByText('로그인');

      await user.type(emailInput, 'profileonly@test.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(loginButton);

      await waitFor(() => {
        expect(
          screen.getByText(/계정 상태에 문제가 있습니다/)
        ).toBeInTheDocument();
      });
    });
  });
});
