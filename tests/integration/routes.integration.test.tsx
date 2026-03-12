import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  useParams: vi.fn(),
}));

vi.mock("../../lib/supabaseClient", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn(() => {
      const defaultResponse = { data: [], error: null, count: 0 };
      const query: {
        select: ReturnType<typeof vi.fn>;
        eq: ReturnType<typeof vi.fn>;
        is: ReturnType<typeof vi.fn>;
        in: ReturnType<typeof vi.fn>;
        neq: ReturnType<typeof vi.fn>;
        order: ReturnType<typeof vi.fn>;
        limit: ReturnType<typeof vi.fn>;
        range: ReturnType<typeof vi.fn>;
        maybeSingle: ReturnType<typeof vi.fn>;
        single: ReturnType<typeof vi.fn>;
        insert: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
        then: <TResult1 = typeof defaultResponse, TResult2 = never>(
          onfulfilled?: ((value: typeof defaultResponse) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
        ) => Promise<TResult1 | TResult2>;
      } = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        is: vi.fn(() => query),
        in: vi.fn(() => query),
        neq: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        range: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data: { is_admin: false }, error: null })),
        single: vi.fn(async () => ({ data: null, error: null })),
        insert: vi.fn(() => query),
        update: vi.fn(() => query),
        delete: vi.fn(() => query),
        then: (onfulfilled, onrejected) =>
          Promise.resolve(defaultResponse).then(onfulfilled, onrejected),
      };

      return query;
    }),
  }),
}));

vi.mock("../../lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "test-user-id", email: "test@test.com" },
    loading: false,
  })),
}));

describe("WEB_JustGolf - route integration smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockedUseRouter = useRouter as unknown as {
      mockReturnValue: (value: { push: () => void; refresh: () => void; back: () => void }) => void;
    };
    mockedUseRouter.mockReturnValue({
      push: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
    });

    const mockedUseSearchParams = useSearchParams as unknown as {
      mockReturnValue: (value: { get: (key: string) => string | null }) => void;
    };
    mockedUseSearchParams.mockReturnValue({
      get: vi.fn(() => null),
    });
  });

  it("start page renders primary quick links", async () => {
    const StartPage = (await import("../../app/start/page")).default;
    render(<StartPage />);

    expect(screen.getByRole("link", { name: /대회 목록 보기/i })).toHaveAttribute("href", "/tournaments");
    expect(screen.getByRole("link", { name: /페이지 열기/i })).toHaveAttribute("href", "/jeju");
    expect(screen.getByRole("link", { name: /게시판으로 이동/i })).toHaveAttribute("href", "/board");
    expect(screen.getByRole("link", { name: /안내문 보기/i })).toHaveAttribute("href", "/admin/help");
  });

  it("admin page renders tournament management link", async () => {
    const AdminPage = (await import("../../app/admin/page")).default;
    render(<AdminPage />);

    const links = screen.getAllByRole("link");
    const hasAdminTournamentLink = links.some((link) => link.getAttribute("href") === "/admin/tournaments");
    expect(hasAdminTournamentLink).toBe(true);
  });
});
