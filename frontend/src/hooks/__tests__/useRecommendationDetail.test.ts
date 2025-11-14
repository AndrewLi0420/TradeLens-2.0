import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRecommendationDetail } from '../useRecommendationDetail';
import { getRecommendationDetail } from '../../services/recommendations';

// Mock the service
vi.mock('../../services/recommendations', () => ({
  getRecommendationDetail: vi.fn(),
}));

describe('useRecommendationDetail', () => {
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

  it('fetches recommendation data successfully', async () => {
    const mockRecommendation = {
      id: 'rec-1',
      user_id: 'user-1',
      stock_id: 'stock-1',
      stock: { id: 'stock-1', symbol: 'AAPL', company_name: 'Apple Inc.' },
      signal: 'buy' as const,
      confidence_score: 0.85,
      sentiment_score: 0.23,
      risk_level: 'low' as const,
      explanation: 'Test explanation',
      created_at: new Date().toISOString(),
    };

    vi.mocked(getRecommendationDetail).mockResolvedValue(mockRecommendation);

    const { result } = renderHook(() => useRecommendationDetail('rec-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockRecommendation);
    expect(result.current.isError).toBe(false);
    expect(getRecommendationDetail).toHaveBeenCalledWith('rec-1');
  });

  it('handles 404 error (recommendation not found)', async () => {
    const error = new Error('Not found');
    (error as any).response = { status: 404 };
    vi.mocked(getRecommendationDetail).mockRejectedValue(error);

    const { result } = renderHook(() => useRecommendationDetail('rec-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeTruthy();
  });

  it('handles 403 error (access denied)', async () => {
    const error = new Error('Forbidden');
    (error as any).response = { status: 403 };
    vi.mocked(getRecommendationDetail).mockRejectedValue(error);

    const { result } = renderHook(() => useRecommendationDetail('rec-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeTruthy();
  });

  it('handles network errors', async () => {
    const error = new Error('Network error');
    vi.mocked(getRecommendationDetail).mockRejectedValue(error);

    const { result } = renderHook(() => useRecommendationDetail('rec-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeTruthy();
  });

  it('does not fetch when id is empty', () => {
    const { result } = renderHook(() => useRecommendationDetail(''), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(getRecommendationDetail).not.toHaveBeenCalled();
  });

  it('provides refetch function', async () => {
    const mockRecommendation = {
      id: 'rec-1',
      user_id: 'user-1',
      stock_id: 'stock-1',
      stock: { id: 'stock-1', symbol: 'AAPL', company_name: 'Apple Inc.' },
      signal: 'buy' as const,
      confidence_score: 0.85,
      sentiment_score: 0.23,
      risk_level: 'low' as const,
      explanation: 'Test explanation',
      created_at: new Date().toISOString(),
    };

    vi.mocked(getRecommendationDetail).mockResolvedValue(mockRecommendation);

    const { result } = renderHook(() => useRecommendationDetail('rec-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.refetch).toBeDefined();
    expect(typeof result.current.refetch).toBe('function');
  });
});


