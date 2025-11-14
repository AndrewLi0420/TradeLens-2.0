import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Profile from './Profile';
import * as userPreferencesService from '../services/userPreferences';
import { useAuth } from '../hooks/useAuth';
import { useTier } from '../hooks/useTier';

// Mock the services and hooks
vi.mock('../services/userPreferences');
vi.mock('../hooks/useAuth');
vi.mock('../hooks/useTier');

describe('Profile Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    // default non-premium tier
    vi.mocked(useTier).mockReturnValue({
      stockCount: 0,
      stockLimit: 5,
      isPremium: false,
      isLoading: false,
    } as any);
  });

  const renderProfile = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Profile />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('Component Rendering', () => {
    it('renders profile page title', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      vi.spyOn(userPreferencesService, 'getPreferences').mockResolvedValue(null);

      renderProfile();

      expect(screen.getByRole('heading', { name: /profile/i })).toBeInTheDocument();
    });

    it('displays user account information', () => {
      const mockUser = { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true };
      vi.mocked(useAuth).mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      vi.spyOn(userPreferencesService, 'getPreferences').mockResolvedValue(null);

      renderProfile();

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText(/free/i)).toBeInTheDocument();
    });

    it('displays tier status with premium indicator', () => {
      const mockUser = { id: '1', email: 'test@example.com', tier: 'premium' as const, is_verified: true };
      vi.mocked(useAuth).mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      vi.spyOn(userPreferencesService, 'getPreferences').mockResolvedValue(null);
      vi.mocked(useTier).mockReturnValue({
        stockCount: 0,
        stockLimit: null,
        isPremium: true,
        isLoading: false,
      } as any);

      renderProfile();

      expect(screen.getByText(/premium - unlimited/i)).toBeInTheDocument();
    });
  });

  describe('Preferences Dropdowns', () => {
    it('renders holding period dropdown with all options', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      vi.spyOn(userPreferencesService, 'getPreferences').mockResolvedValue(null);

      renderProfile();

      await waitFor(() => {
        const holdingPeriodSelect = screen.getByLabelText(/holding period/i);
        expect(holdingPeriodSelect).toBeInTheDocument();
      });

      const holdingPeriodSelect = screen.getByLabelText(/holding period/i) as HTMLSelectElement;
      expect(holdingPeriodSelect.options).toHaveLength(3);
      expect(holdingPeriodSelect.options[0].value).toBe('daily');
      expect(holdingPeriodSelect.options[1].value).toBe('weekly');
      expect(holdingPeriodSelect.options[2].value).toBe('monthly');
    });

    it('renders risk tolerance dropdown with all options', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      vi.spyOn(userPreferencesService, 'getPreferences').mockResolvedValue(null);

      renderProfile();

      await waitFor(() => {
        const riskToleranceSelect = screen.getByLabelText(/risk tolerance/i);
        expect(riskToleranceSelect).toBeInTheDocument();
      });

      const riskToleranceSelect = screen.getByLabelText(/risk tolerance/i) as HTMLSelectElement;
      expect(riskToleranceSelect.options).toHaveLength(3);
      expect(riskToleranceSelect.options[0].value).toBe('low');
      expect(riskToleranceSelect.options[1].value).toBe('medium');
      expect(riskToleranceSelect.options[2].value).toBe('high');
    });

    it('displays current preferences when loaded', async () => {
      vi.mocked(useAuth).mockReturnValue({
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
        user_id: '1',
        holding_period: 'weekly' as const,
        risk_tolerance: 'high' as const,
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.spyOn(userPreferencesService, 'getPreferences').mockResolvedValue(mockPreferences);

      renderProfile();

      await waitFor(() => {
        expect(screen.getByText(/saved: weekly/i)).toBeInTheDocument();
        expect(screen.getByText(/saved: high/i)).toBeInTheDocument();
      });
    });

    it('shows message when no preferences saved yet', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      vi.spyOn(userPreferencesService, 'getPreferences').mockResolvedValue(null);

      renderProfile();

      await waitFor(() => {
        expect(screen.getAllByText(/no preferences saved yet/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Form Submission', () => {
    it('calls updatePreferences API when Save is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      vi.spyOn(userPreferencesService, 'getPreferences').mockResolvedValue(null);
      const mockUpdatePreferences = vi.spyOn(userPreferencesService, 'updatePreferences').mockResolvedValue({
        id: 'pref-1',
        user_id: '1',
        holding_period: 'weekly',
        risk_tolerance: 'high',
        updated_at: '2024-01-01T00:00:00Z',
      });

      renderProfile();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save preferences/i })).toBeInTheDocument();
      });

      const holdingPeriodSelect = screen.getByLabelText(/holding period/i) as HTMLSelectElement;
      await user.selectOptions(holdingPeriodSelect, 'weekly');

      const saveButton = screen.getByRole('button', { name: /save preferences/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdatePreferences).toHaveBeenCalledWith({
          holding_period: 'weekly',
          risk_tolerance: 'medium', // Default value
        });
      });
    });

    it('shows success message after successful save', async () => {
      const user = userEvent.setup();
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      vi.spyOn(userPreferencesService, 'getPreferences').mockResolvedValue(null);
      vi.spyOn(userPreferencesService, 'updatePreferences').mockResolvedValue({
        id: 'pref-1',
        user_id: '1',
        holding_period: 'weekly',
        risk_tolerance: 'high',
        updated_at: '2024-01-01T00:00:00Z',
      });

      renderProfile();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save preferences/i })).toBeInTheDocument();
      });

      const holdingPeriodSelect = screen.getByLabelText(/holding period/i) as HTMLSelectElement;
      await user.selectOptions(holdingPeriodSelect, 'weekly');

      const saveButton = screen.getByRole('button', { name: /save preferences/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/preferences saved successfully/i)).toBeInTheDocument();
      });
    });

    it('shows error message on save failure', async () => {
      const user = userEvent.setup();
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      vi.spyOn(userPreferencesService, 'getPreferences').mockResolvedValue(null);
      vi.spyOn(userPreferencesService, 'updatePreferences').mockRejectedValue(
        new Error('Failed to update')
      );

      renderProfile();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save preferences/i })).toBeInTheDocument();
      });

      const holdingPeriodSelect = screen.getByLabelText(/holding period/i) as HTMLSelectElement;
      await user.selectOptions(holdingPeriodSelect, 'weekly');

      const saveButton = screen.getByRole('button', { name: /save preferences/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to save preferences/i)).toBeInTheDocument();
      });
    });

    it('shows loading state during save', async () => {
      const user = userEvent.setup();
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      vi.spyOn(userPreferencesService, 'getPreferences').mockResolvedValue(null);
      vi.spyOn(userPreferencesService, 'updatePreferences').mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          id: 'pref-1',
          user_id: '1',
          holding_period: 'weekly',
          risk_tolerance: 'high',
          updated_at: '2024-01-01T00:00:00Z',
        }), 100))
      );

      renderProfile();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save preferences/i })).toBeInTheDocument();
      });

      const holdingPeriodSelect = screen.getByLabelText(/holding period/i) as HTMLSelectElement;
      await user.selectOptions(holdingPeriodSelect, 'weekly');

      const saveButton = screen.getByRole('button', { name: /save preferences/i });
      await user.click(saveButton);

      // Should show loading state
      expect(screen.getByText(/saving.../i)).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Loading States', () => {
    it('shows loading state while fetching preferences', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      vi.spyOn(userPreferencesService, 'getPreferences').mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderProfile();

      expect(screen.getByText(/loading preferences/i)).toBeInTheDocument();
    });

    it('handles error state when preferences fail to load', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      vi.spyOn(userPreferencesService, 'getPreferences').mockRejectedValue(
        new Error('Failed to load')
      );

      renderProfile();

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });
  });

  describe('Recommendation Refresh on Preference Update', () => {
    it('invalidates recommendations query after preference update', async () => {
      const user = userEvent.setup();
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      vi.spyOn(userPreferencesService, 'getPreferences').mockResolvedValue(null);
      vi.spyOn(userPreferencesService, 'updatePreferences').mockResolvedValue({
        id: 'pref-1',
        user_id: '1',
        holding_period: 'weekly',
        risk_tolerance: 'high',
        updated_at: '2024-01-01T00:00:00Z',
      });

      // Spy on invalidateQueries
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      renderProfile();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save preferences/i })).toBeInTheDocument();
      });

      const holdingPeriodSelect = screen.getByLabelText(/holding period/i) as HTMLSelectElement;
      await user.selectOptions(holdingPeriodSelect, 'weekly');

      const saveButton = screen.getByRole('button', { name: /save preferences/i });
      await user.click(saveButton);

      await waitFor(() => {
        // Verify invalidateQueries was called with recommendations query key
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
          queryKey: ['recommendations', 'current-user'],
        });
      });
    });


    it('shows success message indicating recommendations will update', async () => {
      const user = userEvent.setup();
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', tier: 'free' as const, is_verified: true },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      vi.spyOn(userPreferencesService, 'getPreferences').mockResolvedValue(null);
      vi.spyOn(userPreferencesService, 'updatePreferences').mockResolvedValue({
        id: 'pref-1',
        user_id: '1',
        holding_period: 'monthly',
        risk_tolerance: 'medium',
        updated_at: '2024-01-01T00:00:00Z',
      });

      renderProfile();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save preferences/i })).toBeInTheDocument();
      });

      const holdingPeriodSelect = screen.getByLabelText(/holding period/i) as HTMLSelectElement;
      await user.selectOptions(holdingPeriodSelect, 'monthly');

      const saveButton = screen.getByRole('button', { name: /save preferences/i });
      await user.click(saveButton);

      await waitFor(() => {
        // Verify success message mentions recommendations will update
        expect(screen.getByText(/preferences saved successfully/i)).toBeInTheDocument();
        expect(screen.getByText(/recommendations will update automatically/i)).toBeInTheDocument();
      });
    });
  });
});

