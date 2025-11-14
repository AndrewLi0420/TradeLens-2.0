import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { login, logout, getCurrentUser } from '../services/auth';
import type { User } from '../services/auth';

const AUTH_QUERY_KEY = ['auth', 'current-user'];

/**
 * Authentication hook managing auth state via React Query
 * - Checks session on initialization via GET /api/v1/users/me
 * - Provides login/logout functions
 * - Manages isAuthenticated state
 */
export function useAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Check for existing session on mount
  const {
    data: user,
    isLoading,
    isError,
  } = useQuery<User>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getCurrentUser,
    retry: false, // Don't retry on 401 - user is not authenticated
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: async () => {
      // Refetch user data after successful login
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      // Redirect to dashboard
      navigate('/dashboard');
    },
    onError: (error) => {
      // Error handling done in login function
      console.error('Login error:', error);
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Clear all query cache
      queryClient.clear();
      // Redirect to login
      navigate('/login');
    },
    onError: (error) => {
      // Even on error, clear local state and redirect
      console.error('Logout error:', error);
      queryClient.clear();
      navigate('/login');
    },
  });

  return {
    user: user || null,
    isAuthenticated: !!user && !isError,
    isLoading,
    login: (email: string, password: string) =>
      loginMutation.mutate({ email, password }),
    logout: () => logoutMutation.mutate(),
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    loginError: loginMutation.error,
  };
}

