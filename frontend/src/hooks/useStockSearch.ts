import { useQuery } from '@tanstack/react-query';
import { searchStocks, type StockSearch } from '../services/recommendations';
import { useEffect, useState } from 'react';

const STOCK_SEARCH_QUERY_KEY = ['stocks', 'search'];

/**
 * React Query hook for searching stocks with debouncing
 * @param query - Search query string (min 2 characters)
 * @param debounceMs - Debounce delay in milliseconds (default: 500ms)
 * @returns Stock search results, loading state, error state, and refetch function
 */
export function useStockSearch(query: string, debounceMs: number = 500) {
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the query
  useEffect(() => {
    if (query.length < 2) {
      setDebouncedQuery('');
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [...STOCK_SEARCH_QUERY_KEY, debouncedQuery],
    queryFn: () => searchStocks(debouncedQuery),
    enabled: debouncedQuery.length >= 2, // Only fetch when query is at least 2 characters
    retry: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (React Query v5)
    refetchOnWindowFocus: false, // Don't refetch on window focus for search
  });

  return {
    data: data ?? [],
    isLoading,
    isError,
    error,
    refetch,
  };
}

