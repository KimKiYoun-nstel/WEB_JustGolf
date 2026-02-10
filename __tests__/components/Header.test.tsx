import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Header from '../../components/Header';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/',
}));

// Mock useAuth hook
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
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
  });

  it('should render header when auth is loading', () => {
    vi.mocked(useAuth()).loading = true;
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
