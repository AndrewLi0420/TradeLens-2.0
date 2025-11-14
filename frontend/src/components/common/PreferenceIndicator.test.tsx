import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PreferenceIndicator from './PreferenceIndicator';
import * as userPreferencesService from '@/services/userPreferences';
import type { UserPreferences } from '@/types/user';

// Mock the user preferences service
vi.mock('@/services/userPreferences', () => ({
  getPreferences: vi.fn(),
}));

const mockGetPreferences = vi.mocked(userPreferencesService.getPreferences);

describe('PreferenceIndicator Component', () => {
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
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('Rendering with Preferences', () => {
    it('displays holding period preference badge', async () => {
      const mockPreferences: UserPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        holding_period: 'daily',
        risk_tolerance: 'low',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockGetPreferences.mockResolvedValue(mockPreferences);

      render(<PreferenceIndicator />, { wrapper });

      expect(await screen.findByText(/Showing Daily recommendations/i)).toBeInTheDocument();
    });

    it('displays risk tolerance preference badge', async () => {
      const mockPreferences: UserPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        holding_period: 'weekly',
        risk_tolerance: 'medium',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockGetPreferences.mockResolvedValue(mockPreferences);

      render(<PreferenceIndicator />, { wrapper });

      expect(await screen.findByText(/Prioritizing Medium risk/i)).toBeInTheDocument();
    });

    it('displays both preference badges correctly', async () => {
      const mockPreferences: UserPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        holding_period: 'monthly',
        risk_tolerance: 'high',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockGetPreferences.mockResolvedValue(mockPreferences);

      render(<PreferenceIndicator />, { wrapper });

      expect(await screen.findByText(/Showing Monthly recommendations/i)).toBeInTheDocument();
      expect(await screen.findByText(/Prioritizing High risk/i)).toBeInTheDocument();
    });

    it('capitalizes preference labels correctly', async () => {
      const mockPreferences: UserPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        holding_period: 'weekly',
        risk_tolerance: 'low',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockGetPreferences.mockResolvedValue(mockPreferences);

      render(<PreferenceIndicator />, { wrapper });

      expect(await screen.findByText(/Showing Weekly recommendations/i)).toBeInTheDocument();
      expect(await screen.findByText(/Prioritizing Low risk/i)).toBeInTheDocument();
    });
  });

  describe('Rendering without Preferences', () => {
    it('does not render when preferences are null', async () => {
      mockGetPreferences.mockResolvedValue(null);

      const { container } = render(<PreferenceIndicator />, { wrapper });

      // Wait for query to resolve using waitFor
      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });

    it('does not render while loading', () => {
      mockGetPreferences.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { container } = render(<PreferenceIndicator />, { wrapper });

      // Component should not render anything while loading
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Component Styling', () => {
    it('applies correct badge styling', async () => {
      const mockPreferences: UserPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        holding_period: 'daily',
        risk_tolerance: 'medium',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockGetPreferences.mockResolvedValue(mockPreferences);

      const { container } = render(<PreferenceIndicator />, { wrapper });

      await screen.findByText(/Showing Daily recommendations/i);

      // Check for badge classes
      const badges = container.querySelectorAll('.bg-financial-blue, .bg-financial-green');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('renders badges in flex container', async () => {
      const mockPreferences: UserPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        holding_period: 'weekly',
        risk_tolerance: 'low',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockGetPreferences.mockResolvedValue(mockPreferences);

      const { container } = render(<PreferenceIndicator />, { wrapper });

      await screen.findByText(/Showing Weekly recommendations/i);

      const flexContainer = container.querySelector('.flex.items-center');
      expect(flexContainer).toBeInTheDocument();
    });
  });

  describe('All Preference Combinations', () => {
    const testCases: Array<{
      holding_period: UserPreferences['holding_period'];
      risk_tolerance: UserPreferences['risk_tolerance'];
    }> = [
      { holding_period: 'daily', risk_tolerance: 'low' },
      { holding_period: 'daily', risk_tolerance: 'medium' },
      { holding_period: 'daily', risk_tolerance: 'high' },
      { holding_period: 'weekly', risk_tolerance: 'low' },
      { holding_period: 'weekly', risk_tolerance: 'medium' },
      { holding_period: 'weekly', risk_tolerance: 'high' },
      { holding_period: 'monthly', risk_tolerance: 'low' },
      { holding_period: 'monthly', risk_tolerance: 'medium' },
      { holding_period: 'monthly', risk_tolerance: 'high' },
    ];

    testCases.forEach(({ holding_period, risk_tolerance }) => {
      it(`displays correct labels for ${holding_period} holding period and ${risk_tolerance} risk tolerance`, async () => {
        const mockPreferences: UserPreferences = {
          id: 'pref-1',
          user_id: 'user-1',
          holding_period,
          risk_tolerance,
          updated_at: '2024-01-01T00:00:00Z',
        };
        mockGetPreferences.mockResolvedValue(mockPreferences);

        render(<PreferenceIndicator />, { wrapper });

        const holdingPeriodLabel = holding_period.charAt(0).toUpperCase() + holding_period.slice(1);
        const riskToleranceLabel = risk_tolerance.charAt(0).toUpperCase() + risk_tolerance.slice(1);

        expect(
          await screen.findByText(new RegExp(`Showing ${holdingPeriodLabel} recommendations`, 'i'))
        ).toBeInTheDocument();
        expect(
          await screen.findByText(new RegExp(`Prioritizing ${riskToleranceLabel} risk`, 'i'))
        ).toBeInTheDocument();
      });
    });
  });
});

