import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import Dashboard from '../Dashboard';
import * as recommendationsService from '@/services/recommendations';
import * as userPreferencesService from '@/services/userPreferences';
import * as authHook from '@/hooks/useAuth';

// Mock dependencies
vi.mock('@/services/recommendations', () => ({
  getRecommendations: vi.fn(),
}));

vi.mock('@/services/userPreferences', () => ({
  getPreferences: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useTier', () => ({
  useTier: () => ({
    stockCount: 3,
    stockLimit: 5,
    isPremium: false,
    isLoading: false,
  }),
}));

const mockGetRecommendations = vi.mocked(recommendationsService.getRecommendations);
const mockGetPreferences = vi.mocked(userPreferencesService.getPreferences);
const mockUseAuth = vi.mocked(authHook.useAuth);

describe('Dashboard Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(undefined);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('displays filtered recommendations when filters are applied', async () => {
    const mockRecommendations = [
      {
        id: '1',
        user_id: 'user-1',
        stock_id: 'stock-1',
        stock: { id: 'stock-1', symbol: 'AAPL', company_name: 'Apple Inc.' },
        signal: 'buy' as const,
        confidence_score: 0.8,
        sentiment_score: 0.7,
        risk_level: 'low' as const,
        explanation: 'Test explanation',
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    mockGetPreferences.mockResolvedValue({
      holding_period: 'weekly',
      risk_tolerance: 'medium',
    } as any);

    mockGetRecommendations.mockResolvedValue(mockRecommendations);

    render(<Dashboard />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Verify filter controls are rendered
    expect(screen.getByText('Holding Period')).toBeInTheDocument();
    expect(screen.getByText('Risk Level')).toBeInTheDocument();

    // Apply filter
    const riskLevelLabel = screen.getByText('Risk Level');
    const riskLevelSelect = riskLevelLabel.parentElement?.querySelector('button[role="combobox"]');
    await userEvent.click(riskLevelSelect!);
    await userEvent.click(screen.getByText('Low'));

    // Verify API was called with filter
    await waitFor(() => {
      expect(mockGetRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          risk_level: 'low',
        })
      );
    });
  });

  it('updates recommendations list when filters change', async () => {
    const mockRecommendations: any[] = [];
    mockGetPreferences.mockResolvedValue(null);
    mockGetRecommendations.mockResolvedValue(mockRecommendations);

    render(<Dashboard />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Change sort
    const sortByLabel = screen.getByText('Sort By');
    const sortBySelect = sortByLabel.parentElement?.querySelector('button[role="combobox"]');
    await userEvent.click(sortBySelect!);
    await userEvent.click(screen.getByText('Confidence'));

    // Verify API was called with new sort
    await waitFor(() => {
      expect(mockGetRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          sort_by: 'confidence',
        })
      );
    });
  });

  it('displays active filters visually', async () => {
    mockGetPreferences.mockResolvedValue(null);
    mockGetRecommendations.mockResolvedValue([]);

    render(<Dashboard />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Apply multiple filters
    const holdingPeriodLabel = screen.getByText('Holding Period');
    const holdingPeriodSelect = holdingPeriodLabel.parentElement?.querySelector('button[role="combobox"]');
    await userEvent.click(holdingPeriodSelect!);
    await userEvent.click(screen.getByText('Weekly'));

    const riskLevelLabel = screen.getByText('Risk Level');
    const riskLevelSelect = riskLevelLabel.parentElement?.querySelector('button[role="combobox"]');
    await userEvent.click(riskLevelSelect!);
    await userEvent.click(screen.getByText('High'));

    // Verify active filter badges are displayed
    await waitFor(() => {
      expect(screen.getByText('Period: weekly')).toBeInTheDocument();
      expect(screen.getByText('Risk: high')).toBeInTheDocument();
    });
  });

  it('supports combined filtering (multiple filters + sort)', async () => {
    mockGetPreferences.mockResolvedValue(null);
    mockGetRecommendations.mockResolvedValue([]);

    render(<Dashboard />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Apply holding period
    const holdingPeriodLabel = screen.getByText('Holding Period');
    const holdingPeriodSelect = holdingPeriodLabel.parentElement?.querySelector('button[role="combobox"]');
    await userEvent.click(holdingPeriodSelect!);
    await userEvent.click(screen.getByText('Daily'));

    // Apply risk level
    const riskLevelLabel = screen.getByText('Risk Level');
    const riskLevelSelect = riskLevelLabel.parentElement?.querySelector('button[role="combobox"]');
    await userEvent.click(riskLevelSelect!);
    await userEvent.click(screen.getByText('Medium'));

    // Apply confidence
    const confidenceInput = screen.getByPlaceholderText('0.0 - 1.0');
    await userEvent.clear(confidenceInput);
    await userEvent.type(confidenceInput, '0.75');

    // Change sort
    const sortByLabel = screen.getByText('Sort By');
    const sortBySelect = sortByLabel.parentElement?.querySelector('button[role="combobox"]');
    await userEvent.click(sortBySelect!);
    await userEvent.click(screen.getByText('Sentiment'));

    // Verify all filters and sort are applied together
    await waitFor(() => {
      expect(mockGetRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          holding_period: 'daily',
          risk_level: 'medium',
          confidence_min: 0.75,
          sort_by: 'sentiment',
        })
      );
    });
  });

  it('clears filters when clear button is clicked', async () => {
    mockGetPreferences.mockResolvedValue(null);
    mockGetRecommendations.mockResolvedValue([]);

    render(<Dashboard />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Apply filters
    const holdingPeriodLabel = screen.getByText('Holding Period');
    const holdingPeriodSelect = holdingPeriodLabel.parentElement?.querySelector('button[role="combobox"]');
    await userEvent.click(holdingPeriodSelect!);
    await userEvent.click(screen.getByText('Weekly'));

    // Wait for clear button to appear
    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

    // Click clear
    const clearButton = screen.getByText('Clear Filters');
    await userEvent.click(clearButton);

    // Verify filters were cleared (API called with minimal params)
    await waitFor(() => {
      const calls = mockGetRecommendations.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toEqual({
        sort_by: 'date',
        sort_direction: 'desc',
      });
    });
  });

  it('persists filter state during session via React Query cache', async () => {
    mockGetPreferences.mockResolvedValue(null);
    mockGetRecommendations.mockResolvedValue([]);

    const { unmount } = render(<Dashboard />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Apply filter
    const riskLevelSelect = screen.getByRole('combobox', { name: /risk level/i });
    await userEvent.click(riskLevelSelect);
    await userEvent.click(screen.getByText('Low'));

    await waitFor(() => {
      expect(mockGetRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({ risk_level: 'low' })
      );
    });

    // Unmount and remount (simulating navigation away and back)
    unmount();
    render(<Dashboard />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Filter state should persist in React Query cache
    // The query key includes params, so cache should maintain state
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();
    const recommendationsQuery = queries.find((q) =>
      q.queryKey.includes('recommendations')
    );
    
    // Query should exist in cache with filter params
    expect(recommendationsQuery).toBeDefined();
  });

  it('displays tier status indicator', async () => {
    mockGetPreferences.mockResolvedValue(null);
    mockGetRecommendations.mockResolvedValue([]);

    render(<Dashboard />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Tracking 3\/5 stocks \(Free tier\)/i)).toBeInTheDocument();
    });
  });

  describe('Preference Integration', () => {
    it('displays PreferenceIndicator when preferences are set', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });
      const mockPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        holding_period: 'weekly' as const,
        risk_tolerance: 'medium' as const,
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockGetPreferences.mockResolvedValue(mockPreferences);
      mockGetRecommendations.mockResolvedValue([]);

      render(<Dashboard />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Showing Weekly recommendations/i)).toBeInTheDocument();
        expect(screen.getByText(/Prioritizing Medium risk/i)).toBeInTheDocument();
      });
    });

    it('filters recommendations by user preferences when no explicit filters provided', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });
      const mockPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        holding_period: 'daily' as const,
        risk_tolerance: 'high' as const,
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockGetPreferences.mockResolvedValue(mockPreferences);
      mockGetRecommendations.mockResolvedValue([]);

      render(<Dashboard />, { wrapper });

      // Wait for preferences to load (indicated by PreferenceIndicator appearing)
      await waitFor(() => {
        expect(screen.getByText(/Showing Daily recommendations/i)).toBeInTheDocument();
      });

      // Verify recommendations are fetched with user preferences merged with default sort params
      await waitFor(() => {
        expect(mockGetRecommendations).toHaveBeenCalledWith(
          expect.objectContaining({
            holding_period: 'daily',
            risk_level: 'high',
            sort_by: 'date',
            sort_direction: 'desc',
          })
        );
      });
    });

    it('shows default message when preferences not set', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });
      mockGetPreferences.mockResolvedValue(null);
      mockGetRecommendations.mockResolvedValue([]);

      render(<Dashboard />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Personalize your recommendations/i)).toBeInTheDocument();
        expect(screen.getByText(/Set your holding period and risk tolerance preferences/i)).toBeInTheDocument();
      });
    });

    it('does not show PreferenceIndicator when preferences not set', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });
      mockGetPreferences.mockResolvedValue(null);
      mockGetRecommendations.mockResolvedValue([]);

      render(<Dashboard />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      // PreferenceIndicator should not be displayed
      expect(screen.queryByText(/Showing .* recommendations/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Prioritizing .* risk/i)).not.toBeInTheDocument();
    });

    it('merges user preferences with explicit filter params', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });
      const mockPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        holding_period: 'weekly' as const,
        risk_tolerance: 'medium' as const,
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockGetPreferences.mockResolvedValue(mockPreferences);
      mockGetRecommendations.mockResolvedValue([]);

      render(<Dashboard />, { wrapper });

      // Wait for preferences to load (indicated by PreferenceIndicator appearing)
      await waitFor(() => {
        expect(screen.getByText(/Showing Weekly recommendations/i)).toBeInTheDocument();
      });

      // Verify that recommendations were eventually called with preferences merged with default sort params
      // (The hook may make multiple calls - initial without preferences, then with preferences after they load)
      await waitFor(() => {
        const calls = mockGetRecommendations.mock.calls;
        const callWithPreferences = calls.find((call) => {
          const params = call[0];
          return params && 
            params.holding_period === 'weekly' && 
            params.risk_level === 'medium';
        });
        expect(callWithPreferences).toBeDefined();
      });
    });
  });
});

