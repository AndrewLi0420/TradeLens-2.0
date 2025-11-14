import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTier } from './useTier';
import { checkTierLimit } from '../services/tier';
import type { TierStatus } from '../services/tier';

// Mock the tier service
vi.mock('../services/tier', () => ({
  checkTierLimit: vi.fn(),
}));

const mockCheckTierLimit = vi.mocked(checkTierLimit);

describe('useTier Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('Free Tier Scenarios', () => {
    it('returns correct values for free tier user with available slots', async () => {
      const mockTierStatus: TierStatus = {
        tier: 'free',
        stock_count: 3,
        stock_limit: 5,
        can_add_more: true,
      };

      mockCheckTierLimit.mockResolvedValue(mockTierStatus);

      const { result } = renderHook(() => useTier(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tier).toBe('free');
      expect(result.current.stockCount).toBe(3);
      expect(result.current.stockLimit).toBe(5);
      expect(result.current.canAddMore).toBe(true);
      expect(result.current.isPremium).toBe(false);
      expect(result.current.isLimitReached).toBe(false);
    });

    it('calculates isLimitReached correctly when free tier limit is reached', async () => {
      const mockTierStatus: TierStatus = {
        tier: 'free',
        stock_count: 5,
        stock_limit: 5,
        can_add_more: false,
      };

      mockCheckTierLimit.mockResolvedValue(mockTierStatus);

      const { result } = renderHook(() => useTier(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLimitReached).toBe(true);
      expect(result.current.canAddMore).toBe(false);
    });

    it('handles free tier with null stock limit', async () => {
      const mockTierStatus: TierStatus = {
        tier: 'free',
        stock_count: 2,
        stock_limit: null,
        can_add_more: true,
      };

      mockCheckTierLimit.mockResolvedValue(mockTierStatus);

      const { result } = renderHook(() => useTier(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stockLimit).toBe(null);
      expect(result.current.isLimitReached).toBe(false);
    });
  });

  describe('Premium Tier Scenarios', () => {
    it('returns correct values for premium user', async () => {
      const mockTierStatus: TierStatus = {
        tier: 'premium',
        stock_count: 10,
        stock_limit: null,
        can_add_more: true,
      };

      mockCheckTierLimit.mockResolvedValue(mockTierStatus);

      const { result } = renderHook(() => useTier(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tier).toBe('premium');
      expect(result.current.stockCount).toBe(10);
      expect(result.current.stockLimit).toBe(null);
      expect(result.current.canAddMore).toBe(true);
      expect(result.current.isPremium).toBe(true);
      expect(result.current.isLimitReached).toBe(false);
    });
  });

  describe('Loading and Error States', () => {
    it('returns loading state while fetching', () => {
      mockCheckTierLimit.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useTier(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.tier).toBe('free'); // Default value
    });

    it('handles error state correctly', async () => {
      const mockError = new Error('Failed to fetch tier status');
      mockCheckTierLimit.mockRejectedValue(mockError);

      const { result } = renderHook(() => useTier(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(mockError);
    });

    it('returns default values when tier status is undefined', async () => {
      mockCheckTierLimit.mockResolvedValue(undefined as any);

      const { result } = renderHook(() => useTier(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tier).toBe('free');
      expect(result.current.stockCount).toBe(0);
      expect(result.current.stockLimit).toBe(null);
      expect(result.current.canAddMore).toBe(false);
      expect(result.current.isPremium).toBe(false);
      expect(result.current.isLimitReached).toBe(false);
    });
  });

  describe('React Query Integration', () => {
    it('caches tier status with correct query key', async () => {
      const mockTierStatus: TierStatus = {
        tier: 'free',
        stock_count: 3,
        stock_limit: 5,
        can_add_more: true,
      };

      mockCheckTierLimit.mockResolvedValue(mockTierStatus);

      const { result } = renderHook(() => useTier(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify query is cached
      const cachedData = queryClient.getQueryData<TierStatus>(['tier-status', 'current-user']);
      expect(cachedData).toEqual(mockTierStatus);
    });

    it('provides refetch function', async () => {
      const mockTierStatus: TierStatus = {
        tier: 'free',
        stock_count: 3,
        stock_limit: 5,
        can_add_more: true,
      };

      mockCheckTierLimit.mockResolvedValue(mockTierStatus);

      const { result } = renderHook(() => useTier(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');

      // Test refetch
      const refetchPromise = result.current.refetch();
      expect(mockCheckTierLimit).toHaveBeenCalledTimes(2); // Initial + refetch
      await refetchPromise;
    });
  });

  describe('isLimitReached Calculation Logic', () => {
    it('returns false when can_add_more is true even for free tier', async () => {
      const mockTierStatus: TierStatus = {
        tier: 'free',
        stock_count: 4,
        stock_limit: 5,
        can_add_more: true,
      };

      mockCheckTierLimit.mockResolvedValue(mockTierStatus);

      const { result } = renderHook(() => useTier(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLimitReached).toBe(false);
    });

    it('returns false for premium tier even when can_add_more is false', async () => {
      const mockTierStatus: TierStatus = {
        tier: 'premium',
        stock_count: 100,
        stock_limit: null,
        can_add_more: false, // Edge case
      };

      mockCheckTierLimit.mockResolvedValue(mockTierStatus);

      const { result } = renderHook(() => useTier(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Premium tier should never have limit reached
      expect(result.current.isLimitReached).toBe(false);
    });

    it('returns true only when free tier AND can_add_more is false', async () => {
      const mockTierStatus: TierStatus = {
        tier: 'free',
        stock_count: 5,
        stock_limit: 5,
        can_add_more: false,
      };

      mockCheckTierLimit.mockResolvedValue(mockTierStatus);

      const { result } = renderHook(() => useTier(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLimitReached).toBe(true);
    });
  });
});

