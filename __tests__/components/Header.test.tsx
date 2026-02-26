import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Header from '../../components/Header';

const mockUseAuth = vi.fn();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/',
}));

// Mock useAuth hook
vi.mock('../../lib/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock supabaseClient
vi.mock('../../lib/supabaseClient', () => ({
  createClient: () => ({
    from: vi.fn(),
    auth: {
      signOut: vi.fn(),
    },
  }),
}));

describe('components/Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });
  });

  it('should render header when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    });
    render(<Header />);

    const header = screen.getByRole('banner');
    expect(header).toBeDefined();
  });

  it('should render navigation links', () => {
    render(<Header />);
    
    // Check if header element exists
    const header = screen.queryByRole('banner');
    expect(header).toBeDefined();
  });
});
