import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn() - classname merge utility', () => {
  it('should merge single class', () => {
    const result = cn('px-2');
    expect(result).toBe('px-2');
  });

  it('should merge multiple classes', () => {
    const result = cn('px-2', 'py-1', 'bg-white');
    expect(result).toContain('px-2');
    expect(result).toContain('py-1');
    expect(result).toContain('bg-white');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const result = cn('base', isActive && 'active');
    expect(result).toContain('base');
    expect(result).toContain('active');
  });

  it('should remove falsy classes', () => {
    const result = cn('px-2', false, undefined, 'py-1');
    expect(result).toBe('px-2 py-1');
  });

  it('should merge tailwind classes correctly', () => {
    // Tailwind merge should override conflicting properties
    const result = cn('px-2', 'px-4'); // px-4 should win
    expect(result).toContain('px-4');
    expect(result).not.toContain('px-2');
  });

  it('should handle empty input', () => {
    const result = cn('');
    expect(result).toBe('');
  });

  it('should handle array input', () => {
    const result = cn(['px-2', 'py-1']);
    expect(result).toContain('px-2');
    expect(result).toContain('py-1');
  });
});
