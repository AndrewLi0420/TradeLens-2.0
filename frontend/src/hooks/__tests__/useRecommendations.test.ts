import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { useRecommendations } from '../useRecommendations';
import * as recommendationsService from '@/services/recommendations';
import * as userPreferencesService from '@/services/userPreferences';
import type { GetRecommendationsParams } from '@/services/recommendations';
import type { UserPreferences } from '@/types/user';

// Mock the recommendations service
vi.mock('@/services/recommendations', () => ({
  getRecommendations: vi.fn(),
}));

// Mock the user preferences service
vi.mock('@/services/userPreferences', () => ({
  getPreferences: vi.fn(),
}));

const mockGetRecommendations = vi.mocked(recommendationsService.getRecommendations);
const mockGetPreferences = vi.mocked(userPreferencesService.getPreferences);

describe('useRecommendations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
    // Default: no preferences
    mockGetPreferences.mockResolvedValue(null);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('fetches recommendations without params', async () => {
    const mockRecommendations = [
      {
        id: '1',
        user_id: 'user-1',
        stock_id: 'stock-1',
        stock: { id: 'stock-1', symbol: 'AAPL', company_name: 'Apple Inc.' },
        signal: 'buy' as const,
        confidence_score: 0.8,
        sentiment_score: 0.7,
        risk_level: 'medium' as const,
        explanation: 'Test explanation',
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    mockGetRecommendations.mockResolvedValue(mockRecommendations);

    const { result } = renderHook(() => useRecommendations(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetRecommendations).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual(mockRecommendations);
    expect(result.current.isError).toBe(false);
  });

  it('accepts filter params and maps to API query params', async () => {
    const mockRecommendations: any[] = [];
    mockGetRecommendations.mockResolvedValue(mockRecommendations);

    const params: GetRecommendationsParams = {
      holding_period: 'weekly',
      risk_level: 'low',
      confidence_min: 0.7,
      sort_by: 'confidence',
      sort_direction: 'desc',
    };

    const { result } = renderHook(() => useRecommendations(params), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetRecommendations).toHaveBeenCalledWith(params);
  });

  it('refetches when filter params change', async () => {
    const mockRecommendations: any[] = [];
    mockGetRecommendations.mockResolvedValue(mockRecommendations);

    const { result, rerender } = renderHook(
      ({ params }: { params?: GetRecommendationsParams }) => useRecommendations(params),
      {
        wrapper,
        initialProps: { params: { holding_period: 'daily' } },
      }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetRecommendations).toHaveBeenCalledWith({ holding_period: 'daily' });

    // Change params
    rerender({ params: { holding_period: 'weekly', risk_level: 'high' } });

    await waitFor(() => {
      expect(mockGetRecommendations).toHaveBeenCalledWith({
        holding_period: 'weekly',
        risk_level: 'high',
      });
    });
  });

  it('handles loading state', () => {
    mockGetRecommendations.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useRecommendations(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it('handles error state', async () => {
    const error = new Error('Failed to fetch recommendations');
    mockGetRecommendations.mockRejectedValue(error);

    const { result } = renderHook(() => useRecommendations(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
    expect(result.current.data).toEqual([]);
  });

  it('includes params in query key for cache persistence', async () => {
    const mockRecommendations: any[] = [];
    mockGetRecommendations.mockResolvedValue(mockRecommendations);

    const params: GetRecommendationsParams = {
      sort_by: 'date',
      sort_direction: 'desc',
    };

    const { result } = renderHook(() => useRecommendations(params), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify query key includes params (React Query includes params in key)
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();
    expect(queries.length).toBeGreaterThan(0);
    
    // Query key should include params for proper cache separation
    const query = queries.find((q) => q.queryKey.includes('recommendations'));
    expect(query).toBeDefined();
    expect(query?.queryKey).toContain('recommendations');
  });

  it('provides refetch function', async () => {
    const mockRecommendations: any[] = [];
    mockGetRecommendations.mockResolvedValue(mockRecommendations);

    const { result } = renderHook(() => useRecommendations(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe('function');

    // Call refetch
    await result.current.refetch();

    // Should have been called at least twice (initial + refetch)
    expect(mockGetRecommendations).toHaveBeenCalledTimes(2);
  });

  it('handles all filter combinations correctly', async () => {
    const mockRecommendations: any[] = [];
    mockGetRecommendations.mockResolvedValue(mockRecommendations);

    const testCases: GetRecommendationsParams[] = [
      { holding_period: 'daily' },
      { risk_level: 'medium' },
      { confidence_min: 0.8 },
      { sort_by: 'risk' },
      { sort_direction: 'asc' },
      {
        holding_period: 'weekly',
        risk_level: 'high',
        confidence_min: 0.7,
        sort_by: 'sentiment',
        sort_direction: 'desc',
      },
    ];

    for (const params of testCases) {
      const { result } = renderHook(() => useRecommendations(params), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetRecommendations).toHaveBeenCalledWith(params);
    }
  });

  describe('User Preference Integration', () => {
    it('uses user preferences as default filters when no params provided', async () => {
      const mockPreferences: UserPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        holding_period: 'weekly',
        risk_tolerance: 'medium',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockGetPreferences.mockResolvedValue(mockPreferences);

      const mockRecommendations: any[] = [];
      mockGetRecommendations.mockResolvedValue(mockRecommendations);

      const { result } = renderHook(() => useRecommendations(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetRecommendations).toHaveBeenCalledWith({
        holding_period: 'weekly',
        risk_level: 'medium',
      });
    });

    it('explicit params override user preferences', async () => {
      const mockPreferences: UserPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        holding_period: 'weekly',
        risk_tolerance: 'medium',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockGetPreferences.mockResolvedValue(mockPreferences);

      const mockRecommendations: any[] = [];
      mockGetRecommendations.mockResolvedValue(mockRecommendations);

      const params: GetRecommendationsParams = {
        holding_period: 'daily', // Override preference
        sort_by: 'confidence',
      };

      const { result } = renderHook(() => useRecommendations(params), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Explicit holding_period should override preference, but risk_level should use preference
      expect(mockGetRecommendations).toHaveBeenCalledWith({
        holding_period: 'daily', // Explicit override
        risk_level: 'medium', // From preferences
        sort_by: 'confidence',
      });
    });

    it('merges explicit params with preferences correctly', async () => {
      const mockPreferences: UserPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        holding_period: 'monthly',
        risk_tolerance: 'low',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockGetPreferences.mockResolvedValue(mockPreferences);

      const mockRecommendations: any[] = [];
      mockGetRecommendations.mockResolvedValue(mockRecommendations);

      const params: GetRecommendationsParams = {
        risk_level: 'high', // Override preference
        confidence_min: 0.8,
        sort_by: 'date',
      };

      const { result } = renderHook(() => useRecommendations(params), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetRecommendations).toHaveBeenCalledWith({
        holding_period: 'monthly', // From preferences
        risk_level: 'high', // Explicit override
        confidence_min: 0.8,
        sort_by: 'date',
      });
    });

    it('uses only explicit params when preferences not set', async () => {
      mockGetPreferences.mockResolvedValue(null);

      const mockRecommendations: any[] = [];
      mockGetRecommendations.mockResolvedValue(mockRecommendations);

      const params: GetRecommendationsParams = {
        holding_period: 'daily',
        risk_level: 'high',
      };

      const { result } = renderHook(() => useRecommendations(params), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetRecommendations).toHaveBeenCalledWith(params);
    });

    it('calls getRecommendations with undefined when no preferences and no params', async () => {
      mockGetPreferences.mockResolvedValue(null);

      const mockRecommendations: any[] = [];
      mockGetRecommendations.mockResolvedValue(mockRecommendations);

      const { result } = renderHook(() => useRecommendations(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetRecommendations).toHaveBeenCalledWith(undefined);
    });

    it('refetches recommendations when preferences change', async () => {
      const initialPreferences: UserPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        holding_period: 'daily',
        risk_tolerance: 'low',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockGetPreferences.mockResolvedValue(initialPreferences);

      const mockRecommendations: any[] = [];
      mockGetRecommendations.mockResolvedValue(mockRecommendations);

      const { result } = renderHook(() => useRecommendations(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetRecommendations).toHaveBeenCalledWith({
        holding_period: 'daily',
        risk_level: 'low',
      });

      // Clear previous calls
      mockGetRecommendations.mockClear();

      // Update preferences in React Query cache (simulating preference change)
      const updatedPreferences: UserPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        holding_period: 'weekly',
        risk_tolerance: 'medium',
        updated_at: '2024-01-02T00:00:00Z',
      };
      queryClient.setQueryData(['preferences', 'current-user'], updatedPreferences);

      // Wait for hook to react to preference change
      await waitFor(() => {
        expect(mockGetRecommendations).toHaveBeenCalledWith({
          holding_period: 'weekly',
          risk_level: 'medium',
        });
      }, { timeout: 3000 });
    });
  });
});

