import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStockSearch } from '../useStockSearch';
import { searchStocks } from '../../services/recommendations';

// Mock the service
vi.mock('../../services/recommendations', () => ({
  searchStocks: vi.fn(),
}));

describe('useStockSearch', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('fetches search results successfully', async () => {
    const mockResults = [
      {
        id: 'stock-1',
        symbol: 'AAPL',
        company_name: 'Apple Inc.',
        sector: 'Technology',
        fortune_500_rank: 1,
        has_recommendation: true,
      },
      {
        id: 'stock-2',
        symbol: 'MSFT',
        company_name: 'Microsoft Corporation',
        sector: 'Technology',
        fortune_500_rank: 2,
        has_recommendation: false,
      },
    ];

    vi.mocked(searchStocks).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useStockSearch('app'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 3000 });

    expect(result.current.data).toEqual(mockResults);
    expect(result.current.isError).toBe(false);
  });

  it('does not fetch when query is less than 2 characters', async () => {
    const { result } = renderHook(() => useStockSearch('a'), { wrapper });

    // Wait a bit for debounce
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(result.current.isLoading).toBe(false);
    expect(searchStocks).not.toHaveBeenCalled();
  });

  it('debounces search queries', async () => {
    vi.mocked(searchStocks).mockResolvedValue([]);

    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useStockSearch(query),
      {
        wrapper,
        initialProps: { query: 'ap' },
      }
    );

    // Change query quickly
    rerender({ query: 'app' });
    rerender({ query: 'appl' });
    rerender({ query: 'apple' });

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 600));

    // Should only call once after debounce
    await waitFor(() => {
      expect(searchStocks).toHaveBeenCalled();
    });

    expect(searchStocks).toHaveBeenCalledWith('apple');
  });

  it('handles errors gracefully', async () => {
    const error = new Error('Search failed');
    vi.mocked(searchStocks).mockRejectedValue(error);

    const { result } = renderHook(() => useStockSearch('app'), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeTruthy();
  });

  it('provides refetch function', async () => {
    const mockResults = [
      {
        id: 'stock-1',
        symbol: 'AAPL',
        company_name: 'Apple Inc.',
        sector: 'Technology',
        fortune_500_rank: 1,
        has_recommendation: true,
      },
    ];

    vi.mocked(searchStocks).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useStockSearch('app'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.refetch).toBeDefined();
    expect(typeof result.current.refetch).toBe('function');
  });
});

