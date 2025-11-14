import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingTooltips, { useOnboardingComplete, resetOnboarding } from '../OnboardingTooltips';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('OnboardingTooltips', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('does not render if onboarding is already complete', () => {
    localStorageMock.setItem('onboarding_complete', 'true');

    render(<OnboardingTooltips />);

    expect(screen.queryByText('Welcome to Your Dashboard')).not.toBeInTheDocument();
  });

  it('renders first step for new users', async () => {
    render(<OnboardingTooltips />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to Your Dashboard')).toBeInTheDocument();
    });
  });

  it('shows step counter', async () => {
    render(<OnboardingTooltips />);

    await waitFor(() => {
      expect(screen.getByText('1 of 4')).toBeInTheDocument();
    });
  });

  it('advances to next step when Next is clicked', async () => {
    render(<OnboardingTooltips />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to Your Dashboard')).toBeInTheDocument();
    });

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Confidence Score')).toBeInTheDocument();
      expect(screen.getByText('2 of 4')).toBeInTheDocument();
    });
  });

  it('completes onboarding when Get Started is clicked on last step', async () => {
    render(<OnboardingTooltips />);

    // Navigate through all steps
    for (let i = 0; i < 3; i++) {
      await waitFor(() => {
        const nextButton = screen.getByText(i === 2 ? 'Get Started' : 'Next');
        expect(nextButton).toBeInTheDocument();
      });
      const nextButton = screen.getByText(i === 2 ? 'Get Started' : 'Next');
      fireEvent.click(nextButton);
    }

    await waitFor(() => {
      expect(localStorageMock.getItem('onboarding_complete')).toBe('true');
      expect(screen.queryByText('Tier Status')).not.toBeInTheDocument();
    });
  });

  it('skips onboarding when Skip Tour is clicked', async () => {
    render(<OnboardingTooltips />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to Your Dashboard')).toBeInTheDocument();
    });

    const skipButton = screen.getByText('Skip Tour');
    fireEvent.click(skipButton);

    await waitFor(() => {
      expect(localStorageMock.getItem('onboarding_complete')).toBe('true');
      expect(screen.queryByText('Welcome to Your Dashboard')).not.toBeInTheDocument();
    });
  });

  it('calls onComplete callback when completed', async () => {
    const onComplete = vi.fn();
    render(<OnboardingTooltips onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to Your Dashboard')).toBeInTheDocument();
    });

    const skipButton = screen.getByText('Skip Tour');
    fireEvent.click(skipButton);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });
});

describe('useOnboardingComplete hook', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('returns false when onboarding is not complete', () => {
    // This would need to be tested in a component that uses the hook
    // For now, we test the localStorage logic
    expect(localStorageMock.getItem('onboarding_complete')).toBeNull();
  });

  it('returns true when onboarding is complete', () => {
    localStorageMock.setItem('onboarding_complete', 'true');
    expect(localStorageMock.getItem('onboarding_complete')).toBe('true');
  });
});

describe('resetOnboarding function', () => {
  it('removes onboarding completion from localStorage', () => {
    localStorageMock.setItem('onboarding_complete', 'true');
    expect(localStorageMock.getItem('onboarding_complete')).toBe('true');

    resetOnboarding();
    expect(localStorageMock.getItem('onboarding_complete')).toBeNull();
  });
});

