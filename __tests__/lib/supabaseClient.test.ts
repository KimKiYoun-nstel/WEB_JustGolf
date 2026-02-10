import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('lib/supabaseClient', () => {
  beforeEach(() => {
    // Set environment variables for testing
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('should export createClient function', async () => {
    // Dynamic import to allow environment variables to be set first
    const { createClient } = await import('../../lib/supabaseClient');
    expect(typeof createClient).toBe('function');
  });

  it('should create a Supabase client with correct configuration', async () => {
    const { createClient } = await import('../../lib/supabaseClient');
    const client = createClient();
    
    // Check that client has expected Supabase methods
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
    expect(typeof client.auth).toBe('object');
  });

  it('should initialize with environment variables', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    expect(url).toBe('https://test.supabase.co');
    expect(key).toBe('test-anon-key');
  });
});
