import { useQuery } from '@tanstack/react-query';
import { checkTierLimit } from '../services/tier';
import type { TierStatus } from '../services/tier';

const TIER_QUERY_KEY = ['tier-status', 'current-user'];

/**
 * React Query hook for tier status management
 * @returns Tier status data, loading state, and error state
 */
export function useTier() {
  const {
    data: tierStatus,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<TierStatus>({
    queryKey: TIER_QUERY_KEY,
    queryFn: checkTierLimit,
    retry: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes (per story requirements)
    gcTime: 10 * 60 * 1000, // Cache for 10 minutes (formerly cacheTime in React Query v4)
    refetchOnWindowFocus: true,
  });

  const isLimitReached = !tierStatus?.can_add_more && tierStatus?.tier === 'free';

  // TODO: When stock addition UI is implemented, components should check isLimitReached
  // to disable "Add Stock" buttons and show upgrade prompt when limit is reached.
  // Example: <Button disabled={isLimitReached} onClick={handleAddStock}>Add Stock</Button>

  return {
    tier: tierStatus?.tier ?? 'free',
    stockCount: tierStatus?.stock_count ?? 0,
    stockLimit: tierStatus?.stock_limit ?? null,
    canAddMore: tierStatus?.can_add_more ?? false,
    isLimitReached,
    isPremium: tierStatus?.tier === 'premium',
    isLoading,
    isError,
    error,
    refetch,
  };
}

