import { useQuery } from '@tanstack/react-query';
import { getRecommendationDetail } from '../services/recommendations';
import type { Recommendation } from '../services/recommendations';

const RECOMMENDATION_DETAIL_QUERY_KEY = ['recommendation', 'detail'];

/**
 * React Query hook for fetching a single recommendation by ID
 * @param id - Recommendation UUID
 * @returns Recommendation data, loading state, error state, and refetch function
 */
export function useRecommendationDetail(id: string) {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Recommendation>({
    queryKey: [...RECOMMENDATION_DETAIL_QUERY_KEY, id],
    queryFn: () => getRecommendationDetail(id),
    retry: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (React Query v5)
    refetchOnWindowFocus: true,
    enabled: !!id, // Only fetch if id is provided
  });

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
  };
}


