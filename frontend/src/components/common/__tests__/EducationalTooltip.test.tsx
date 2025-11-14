import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EducationalTooltip, { InfoTooltip, tooltipContent } from '../EducationalTooltip';

describe('EducationalTooltip', () => {
  beforeEach(() => {
    // Mock window.innerWidth for responsive behavior
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024, // Desktop width
    });
  });

  it('renders trigger element', () => {
    render(
      <EducationalTooltip
        trigger={<button>Hover me</button>}
        content="Test tooltip content"
      />
    );

    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('displays tooltip content on hover (desktop)', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024 });

    render(
      <EducationalTooltip
        trigger={<button>Hover me</button>}
        content="Test tooltip content"
      />
    );

    const trigger = screen.getByText('Hover me');
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      expect(screen.getByText('Test tooltip content')).toBeInTheDocument();
    });
  });

  it('displays tooltip content on click (mobile)', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375 }); // Mobile width

    render(
      <EducationalTooltip
        trigger={<button>Click me</button>}
        content="Test tooltip content"
      />
    );

    const trigger = screen.getByText('Click me');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Test tooltip content')).toBeInTheDocument();
    });
  });

  it('accepts placement prop', () => {
    render(
      <EducationalTooltip
        trigger={<button>Hover me</button>}
        content="Test content"
        placement="bottom"
      />
    );

    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });
});

describe('InfoTooltip', () => {
  it('renders info icon button', () => {
    render(<InfoTooltip content="Test content" />);
    // Info icon should be present (lucide-react Info component)
    const button = screen.getByRole('button', { name: /more information/i });
    expect(button).toBeInTheDocument();
  });

  it('displays tooltip content when triggered', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024 });

    render(<InfoTooltip content="Test content" />);

    const button = screen.getByRole('button', { name: /more information/i });
    fireEvent.mouseEnter(button);

    await waitFor(() => {
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });
  });
});

describe('tooltipContent', () => {
  it('contains pre-defined content for confidence score', () => {
    expect(tooltipContent.confidenceScore).toBeTruthy();
    expect(tooltipContent.confidenceScore).toContain('Confidence score');
  });

  it('contains pre-defined content for R²', () => {
    expect(tooltipContent.rSquared).toBeTruthy();
    expect(tooltipContent.rSquared).toContain('R²');
  });

  it('contains pre-defined content for sentiment analysis', () => {
    expect(tooltipContent.sentimentAnalysis).toBeTruthy();
    expect(tooltipContent.sentimentAnalysis).toContain('sentiment');
  });

  it('contains pre-defined content for ML model signals', () => {
    expect(tooltipContent.mlModelSignals).toBeTruthy();
    expect(tooltipContent.mlModelSignals).toContain('Machine learning');
  });

  it('contains pre-defined content for risk level', () => {
    expect(tooltipContent.riskLevel).toBeTruthy();
    expect(tooltipContent.riskLevel).toContain('Risk level');
  });

  it('has accessible trigger with proper ARIA labels', () => {
    render(
      <EducationalTooltip
        trigger={<button>Test</button>}
        content="Test content"
      />
    );

    const trigger = screen.getByText('Test');
    expect(trigger).toHaveAttribute('aria-label', 'Show more information');
  });

  it('tooltip content has proper ARIA attributes', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024 });

    render(
      <EducationalTooltip
        trigger={<button>Test</button>}
        content="Test content"
      />
    );

    const trigger = screen.getByText('Test');
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      const content = screen.getByText('Test content');
      expect(content.closest('[role="tooltip"]')).toBeInTheDocument();
      expect(content.closest('[aria-live="polite"]')).toBeInTheDocument();
    });
  });

  it('InfoTooltip button has proper touch target size (44x44px minimum)', () => {
    const { container } = render(<InfoTooltip content="Test content" />);
    const button = container.querySelector('button');
    expect(button).toHaveClass('min-w-[44px]', 'min-h-[44px]');
  });
});


