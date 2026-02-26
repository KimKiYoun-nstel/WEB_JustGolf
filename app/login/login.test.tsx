import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

type MockArgs = unknown[];

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockToast = vi.fn();
const mockPush = vi.fn();

vi.mock("../../lib/supabaseClient", () => {
  const client = {
    auth: {
      signInWithPassword: (...args: MockArgs) => mockSignInWithPassword(...args),
      signUp: (...args: MockArgs) => mockSignUp(...args),
      signOut: vi.fn(),
    },
    rpc: (...args: MockArgs) => mockRpc(...args),
    from: (...args: MockArgs) => {
      mockFrom(...args);
      return {
        select: (...selectArgs: MockArgs) => {
          mockSelect(...selectArgs);
          return {
            eq: (...eqArgs: MockArgs) => {
              mockEq(...eqArgs);
              return {
                single: () => mockSingle(),
              };
            },
          };
        },
        update: (...updateArgs: MockArgs) => {
          mockUpdate(...updateArgs);
          return {
            eq: (...eqArgs: MockArgs) => {
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

vi.mock("../../lib/auth", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    toasts: [],
    toast: mockToast,
    dismiss: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
  useRouter: () => ({
    push: mockPush,
  }),
}));

function getPasswordInput() {
  const input = document.querySelector("input[type='password']");
  if (!input) throw new Error("비밀번호 입력 필드를 찾을 수 없습니다.");
  return input as HTMLInputElement;
}

function getLatestToastTitle() {
  const call = mockToast.mock.calls.at(-1)?.[0] as { title?: string } | undefined;
  return call?.title ?? "";
}

describe("Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockStorage: Storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    };
    global.localStorage = mockStorage;

    mockRpc.mockResolvedValue({ data: true, error: null });
    mockSingle.mockResolvedValue({ data: { value: true }, error: null });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ exists: false, profileExists: false }),
    } as unknown as Response) as typeof fetch;
  });

  describe("회원가입", () => {
    it("신규 사용자는 회원가입 성공 토스트를 표시해야 한다", async () => {
      const user = userEvent.setup();

      mockSignUp.mockResolvedValue({
        data: {
          user: {
            id: "test-user-id",
            email: "newuser@test.com",
          },
        },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: {
          id: "test-user-id",
          nickname: "테스터",
          is_approved: false,
        },
        error: null,
      });

      render(<LoginPage />);

      await user.type(screen.getByPlaceholderText("example@company.com"), "newuser@test.com");
      await user.type(getPasswordInput(), "password123");
      await user.type(screen.getByPlaceholderText("닉네임"), "테스터");
      await user.click(screen.getByRole("button", { name: "회원가입" }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: "newuser@test.com",
          password: "password123",
          options: {
            data: { nickname: "테스터", onboarding_completed: false },
          },
        });
      });

      await waitFor(() => {
        expect(getLatestToastTitle()).toMatch(/회원가입 완료/);
      });
    });

    it("회원가입 실패 시 실패 토스트를 표시해야 한다", async () => {
      const user = userEvent.setup();

      mockSignUp.mockResolvedValue({
        data: null,
        error: { message: "User already registered" },
      });

      render(<LoginPage />);

      await user.type(screen.getByPlaceholderText("example@company.com"), "existing@test.com");
      await user.type(getPasswordInput(), "password123");
      await user.type(screen.getByPlaceholderText("닉네임"), "기존사용자");
      await user.click(screen.getByRole("button", { name: "회원가입" }));

      await waitFor(() => {
        expect(getLatestToastTitle()).toMatch(/회원가입 실패/);
      });
    });
  });

  describe("로그인", () => {
    it("로그인 성공 시 성공 토스트를 표시해야 한다", async () => {
      const user = userEvent.setup();

      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: "approved-user-id",
            email: "approved@test.com",
            user_metadata: {},
          },
        },
        error: null,
      });

      render(<LoginPage />);

      await user.type(screen.getByPlaceholderText("example@company.com"), "approved@test.com");
      await user.type(getPasswordInput(), "password123");
      await user.click(screen.getByRole("button", { name: "로그인" }));

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith({
          email: "approved@test.com",
          password: "password123",
        });
      });

      await waitFor(() => {
        expect(getLatestToastTitle()).toMatch(/로그인 성공/);
      });
    });

    it("잘못된 비밀번호로 로그인 시 비밀번호 오류 토스트를 표시해야 한다", async () => {
      const user = userEvent.setup();

      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: { message: "Invalid login credentials" },
      });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ exists: true, profileExists: false }),
      } as unknown as Response) as typeof fetch;

      render(<LoginPage />);

      await user.type(screen.getByPlaceholderText("example@company.com"), "user@test.com");
      await user.type(getPasswordInput(), "wrongpassword");
      await user.click(screen.getByRole("button", { name: "로그인" }));

      await waitFor(() => {
        expect(getLatestToastTitle()).toContain("로그인 실패: 비밀번호가 틀렸습니다.");
      });
    });

    it("존재하지 않는 이메일 로그인 시 계정 없음 토스트를 표시해야 한다", async () => {
      const user = userEvent.setup();

      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: { message: "Invalid login credentials" },
      });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ exists: false, profileExists: false }),
      } as unknown as Response) as typeof fetch;

      render(<LoginPage />);

      await user.type(screen.getByPlaceholderText("example@company.com"), "unknown@test.com");
      await user.type(getPasswordInput(), "wrongpassword");
      await user.click(screen.getByRole("button", { name: "로그인" }));

      await waitFor(() => {
        expect(getLatestToastTitle()).toContain("로그인 실패: 존재하지 않는 계정입니다.");
      });
    });

    it("카카오 계정 이메일로 로그인 시 카카오 안내 토스트를 표시해야 한다", async () => {
      const user = userEvent.setup();

      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: { message: "Invalid login credentials" },
      });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ exists: false, profileExists: true }),
      } as unknown as Response) as typeof fetch;

      render(<LoginPage />);

      await user.type(screen.getByPlaceholderText("example@company.com"), "profileonly@test.com");
      await user.type(getPasswordInput(), "wrongpassword");
      await user.click(screen.getByRole("button", { name: "로그인" }));

      await waitFor(() => {
        expect(getLatestToastTitle()).toContain("카카오 로그인을 이용해주세요.");
      });
    });
  });
});
