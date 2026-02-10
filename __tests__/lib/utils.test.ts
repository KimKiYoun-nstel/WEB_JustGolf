import { describe, it, expect } from 'vitest';
import { cn } from '../../lib/utils';

describe('lib/utils', () => {
  describe('cn() - className merge utility', () => {
    it('should merge simple class names', () => {
      expect(cn('px-2 py-1', 'px-3')).toBe('py-1 px-3');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      expect(cn('px-2', isActive && 'bg-blue-500')).toContain('px-2');
      expect(cn('px-2', isActive && 'bg-blue-500')).toContain('bg-blue-500');
    });

    it('should remove duplicate classess favoring rightmost', () => {
      expect(cn('px-2 px-3')).toBe('px-3');
    });

    it('should handle undefined and null values', () => {
      expect(cn('px-2', undefined, null, 'py-1')).toBe('px-2 py-1');
    });

    it('should handle empty strings', () => {
      expect(cn('', 'px-2', '')).toBe('px-2');
    });

    it('should merge tailwind conflicts correctly', () => {
      const result = cn('text-red-500', 'text-blue-500');
      expect(result).toBe('text-blue-500');
    });

    it('should return empty string for empty input', () => {
      expect(cn('')).toBe('');
    });
  });
});
