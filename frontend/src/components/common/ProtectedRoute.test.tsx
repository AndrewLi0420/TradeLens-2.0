import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../../hooks/useAuth';

// Mock useAuth hook
vi.mock('../../hooks/useAuth');

describe('ProtectedRoute Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderProtectedRoute = (initialEntries = ['/protected']) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('Authentication Check', () => {
    it('redirects to login when user is not authenticated', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      renderProtectedRoute();

      // Should redirect to login (Navigate component behavior)
      // In MemoryRouter, we can't easily test redirect, but we can verify component doesn't render children
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('renders children when user is authenticated', () => {
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

      renderProtectedRoute();

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('shows loading state while checking authentication', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: null,
      });

      renderProtectedRoute();

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });
});

