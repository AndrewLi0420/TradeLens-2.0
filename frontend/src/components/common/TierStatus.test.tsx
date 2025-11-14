import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TierStatus from './TierStatus';
import { useTier } from '@/hooks/useTier';

// Mock the useTier hook
vi.mock('@/hooks/useTier');

describe('TierStatus Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Free Tier Rendering', () => {
    it('renders stock count indicator for free tier users', () => {
      vi.mocked(useTier).mockReturnValue({
        stockCount: 3,
        stockLimit: 5,
        isPremium: false,
        isLoading: false,
        tier: 'free',
        canAddMore: true,
        isLimitReached: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<TierStatus />);

      expect(screen.getByText(/Tracking 3\/5 stocks \(Free tier\)/i)).toBeInTheDocument();
    });

    it('renders correct stock count when at limit', () => {
      vi.mocked(useTier).mockReturnValue({
        stockCount: 5,
        stockLimit: 5,
        isPremium: false,
        isLoading: false,
        tier: 'free',
        canAddMore: false,
        isLimitReached: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<TierStatus />);

      expect(screen.getByText(/Tracking 5\/5 stocks \(Free tier\)/i)).toBeInTheDocument();
    });

    it('uses default stock limit of 5 when stockLimit is null', () => {
      vi.mocked(useTier).mockReturnValue({
        stockCount: 2,
        stockLimit: null,
        isPremium: false,
        isLoading: false,
        tier: 'free',
        canAddMore: true,
        isLimitReached: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<TierStatus />);

      expect(screen.getByText(/Tracking 2\/5 stocks \(Free tier\)/i)).toBeInTheDocument();
    });
  });

  describe('Premium Tier Rendering', () => {
    it('renders "Premium - Unlimited" for premium users', () => {
      vi.mocked(useTier).mockReturnValue({
        stockCount: 10,
        stockLimit: null,
        isPremium: true,
        isLoading: false,
        tier: 'premium',
        canAddMore: true,
        isLimitReached: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<TierStatus />);

      expect(screen.getByText(/Premium - Unlimited/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading message while fetching tier data', () => {
      vi.mocked(useTier).mockReturnValue({
        stockCount: 0,
        stockLimit: null,
        isPremium: false,
        isLoading: true,
        tier: 'free',
        canAddMore: false,
        isLimitReached: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<TierStatus />);

      expect(screen.getByText(/Loading tier status.../i)).toBeInTheDocument();
    });
  });

  describe('Component Styling', () => {
    it('applies correct badge styling for free tier', () => {
      vi.mocked(useTier).mockReturnValue({
        stockCount: 3,
        stockLimit: 5,
        isPremium: false,
        isLoading: false,
        tier: 'free',
        canAddMore: true,
        isLimitReached: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      const { container } = render(<TierStatus />);
      const badge = container.querySelector('.bg-financial-blue');

      expect(badge).toBeInTheDocument();
    });

    it('applies correct badge styling for premium tier', () => {
      vi.mocked(useTier).mockReturnValue({
        stockCount: 10,
        stockLimit: null,
        isPremium: true,
        isLoading: false,
        tier: 'premium',
        canAddMore: true,
        isLimitReached: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      const { container } = render(<TierStatus />);
      const badge = container.querySelector('.bg-financial-green');

      expect(badge).toBeInTheDocument();
    });
  });
});

