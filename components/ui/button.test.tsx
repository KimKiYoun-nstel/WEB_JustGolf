import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button Component', () => {
  it('should render button with text', () => {
    render(<Button>클릭</Button>);
    const button = screen.getByRole('button', { name: '클릭' });
    expect(button).toBeInTheDocument();
  });

  it('should render all variants without error', () => {
    const { rerender } = render(<Button variant="default">기본</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<Button variant="outline">테두리</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<Button variant="ghost">유령</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<Button variant="destructive">삭제</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should render all sizes without error', () => {
    const { rerender } = render(<Button size="sm">작음</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<Button size="default">기본</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<Button size="lg">큼</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>비활성화</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should render as child element (link)', () => {
    render(
      <Button asChild>
        <a href="/test">링크</a>
      </Button>
    );
    const link = screen.getByRole('link', { name: '링크' });
    expect(link).toHaveAttribute('href', '/test');
  });

  it('should handle click events', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>클릭 테스트</Button>);
    
    const button = screen.getByRole('button');
    const user = userEvent.setup();
    
    await user.click(button);
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('should not call onClick when disabled', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick} disabled>비활성화</Button>);
    
    const button = screen.getByRole('button');
    const user = userEvent.setup();
    
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should render multiple buttons independently', () => {
    render(
      <>
        <Button>버튼1</Button>
        <Button>버튼2</Button>
      </>
    );
    
    expect(screen.getByRole('button', { name: '버튼1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '버튼2' })).toBeInTheDocument();
  });

  it('should have proper button type attribute', () => {
    render(<Button>기본 버튼</Button>);
    const button = screen.getByRole('button');
    expect(button.tagName).toBe('BUTTON');
  });

  it('should support children with HTML', () => {
    render(<Button>아이콘 <span>버튼</span></Button>);
    const button = screen.getByRole('button');
    expect(button).toContainElement(screen.getByText('버튼'));
  });
});
