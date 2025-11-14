import { useQuery } from '@tanstack/react-query';
import { getRecommendations, type GetRecommendationsParams } from '../services/recommendations';
import { getPreferences } from '../services/userPreferences';
import type { UserPreferences } from '../types/user';
import { mergePreferencesWithParams } from '../utils/preferences';

const RECOMMENDATIONS_QUERY_KEY = ['recommendations', 'current-user'];
const PREFERENCES_QUERY_KEY = ['preferences', 'current-user'];

/**
 * React Query hook for fetching recommendations with user preference defaults
 * @param params - Query parameters for filtering and sorting (explicit params override preferences)
 * @returns Recommendations data, loading state, error state, and refetch function
 */
export function useRecommendations(params?: GetRecommendationsParams) {
  // Fetch user preferences to use as default filters
  const { data: preferences } = useQuery<UserPreferences | null>({
    queryKey: PREFERENCES_QUERY_KEY,
    queryFn: getPreferences,
    retry: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (React Query v5)
  });

  // Merge user preferences with explicit params (explicit params take precedence)
  const effectiveParams = mergePreferencesWithParams(preferences, params);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [...RECOMMENDATIONS_QUERY_KEY, effectiveParams],
    queryFn: async () => {
      const result = await getRecommendations(effectiveParams);
      // Debug logging in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[useRecommendations] Fetched recommendations:', {
          count: result.length,
          params: effectiveParams,
          recommendations: result,
        });
      }
      return result;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (React Query v5)
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  return {
    data: data ?? [],
    isLoading,
    isError,
    error,
    refetch,
  };
}

