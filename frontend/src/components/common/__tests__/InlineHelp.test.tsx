import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InlineHelp, { dashboardHelpContent } from '../InlineHelp';

describe('InlineHelp', () => {
  beforeEach(() => {
    // Mock window.innerWidth for responsive behavior
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024, // Desktop width
    });
  });

  it('renders help icon button by default', () => {
    render(<InlineHelp content="Test help content" />);

    const button = screen.getByRole('button', { name: /show help/i });
    expect(button).toBeInTheDocument();
  });

  it('displays help content when opened', async () => {
    render(<InlineHelp content="Test help content" />);

    const button = screen.getByRole('button', { name: /show help/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Test help content')).toBeInTheDocument();
    });
  });

  it('uses custom title when provided', async () => {
    render(<InlineHelp title="Custom Help Title" content="Test content" />);

    const button = screen.getByRole('button', { name: /show help/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Custom Help Title')).toBeInTheDocument();
    });
  });

  it('uses default title when not provided', async () => {
    render(<InlineHelp content="Test content" />);

    const button = screen.getByRole('button', { name: /show help/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Help')).toBeInTheDocument();
    });
  });

  it('renders React node content correctly', async () => {
    render(
      <InlineHelp
        content={
          <div>
            <p>Paragraph 1</p>
            <p>Paragraph 2</p>
          </div>
        }
      />
    );

    const button = screen.getByRole('button', { name: /show help/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Paragraph 1')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 2')).toBeInTheDocument();
    });
  });

  it('closes when close button is clicked', async () => {
    render(<InlineHelp content="Test content" />);

    const button = screen.getByRole('button', { name: /show help/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close help/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Test content')).not.toBeInTheDocument();
    });
  });

  it('has proper ARIA attributes', async () => {
    render(<InlineHelp content="Test content" />);

    const button = screen.getByRole('button', { name: /show help/i });
    fireEvent.click(button);

    await waitFor(() => {
      const dialog = screen.getByRole('dialog', { name: /help information/i });
      expect(dialog).toBeInTheDocument();
    });
  });
});

describe('dashboardHelpContent', () => {
  it('contains help content for filtering', () => {
    expect(dashboardHelpContent.filtering).toBeTruthy();
    expect(dashboardHelpContent.filtering).toContain('Filter');
  });

  it('contains help content for sorting', () => {
    expect(dashboardHelpContent.sorting).toBeTruthy();
    expect(dashboardHelpContent.sorting).toContain('Sort');
  });

  it('contains help content for recommendation metrics', () => {
    expect(dashboardHelpContent.recommendationMetrics).toBeTruthy();
    expect(dashboardHelpContent.recommendationMetrics).toContain('Confidence Score');
  });

  it('contains help content for tier limits', () => {
    expect(dashboardHelpContent.tierLimits).toBeTruthy();
    expect(dashboardHelpContent.tierLimits).toContain('tier');
  });
});

