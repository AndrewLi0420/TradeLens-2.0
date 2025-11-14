import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from './Login';
import { useAuth } from '../hooks/useAuth';

// Mock useAuth hook
vi.mock('../hooks/useAuth');

describe('Login Component', () => {
  let queryClient: QueryClient;
  let mockLogin: ReturnType<typeof vi.fn>;
  let mockIsLoggingIn: boolean;
  let mockLoginError: Error | null;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockLogin = vi.fn();
    mockIsLoggingIn = false;
    mockLoginError = null;

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      isLoggingIn: mockIsLoggingIn,
      isLoggingOut: false,
      loginError: mockLoginError,
    });
  });

  const renderLogin = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('Component Rendering', () => {
    it('renders form fields', () => {
      renderLogin();

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('renders form title and description', () => {
      renderLogin();

      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByText('Login to your account')).toBeInTheDocument();
    });

    it('renders link to register page', () => {
      renderLogin();

      const registerLink = screen.getByRole('link', { name: /register/i });
      expect(registerLink).toBeInTheDocument();
      expect(registerLink).toHaveAttribute('href', '/register');
    });
  });

  describe('Email Validation', () => {
    it('shows error for invalid email format on form submission', async () => {
      const user = userEvent.setup();
      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(emailInput, 'notanemail');
      await user.type(passwordInput, 'password123');
      const form = emailInput.closest('form') as HTMLFormElement;
      if (form) form.noValidate = true;
      // submit the form directly to bypass native email validation
      form ? form.dispatchEvent(new Event('submit', { bubbles: true })) : await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('clears email error when valid email is entered', async () => {
      const user = userEvent.setup();
      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      // Enter invalid email
      await user.type(emailInput, 'invalid');
      await user.type(passwordInput, 'password123');
      const form = emailInput.closest('form') as HTMLFormElement;
      if (form) form.noValidate = true;
      form ? form.dispatchEvent(new Event('submit', { bubbles: true })) : await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });

      // Enter valid email
      await user.clear(emailInput);
      await user.type(emailInput, 'valid@example.com');

      await waitFor(() => {
        expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('calls login function with email and password on valid submission', async () => {
      const user = userEvent.setup();
      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('shows loading state during login', () => {
      mockIsLoggingIn = true;
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: vi.fn(),
        isLoggingIn: true,
        isLoggingOut: false,
        loginError: null,
      });

      renderLogin();

      expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('displays generic error message for authentication failures', async () => {
      mockLoginError = new Error('Invalid email or password');
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: vi.fn(),
        isLoggingIn: false,
        isLoggingOut: false,
        loginError: new Error('Invalid email or password'),
      });

      renderLogin();

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });
    });
  });

  describe('Required Field Validation', () => {
    it('shows error when email is empty', async () => {
      const user = userEvent.setup();
      renderLogin();

      const passwordInput = screen.getByLabelText(/password/i);
      const form = passwordInput.closest('form') as HTMLFormElement;
      if (form) form.noValidate = true;
      await user.type(passwordInput, 'password123');
      form ? form.dispatchEvent(new Event('submit', { bubbles: true })) : await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });
    });

    it('shows error when password is empty', async () => {
      const user = userEvent.setup();
      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const form = emailInput.closest('form') as HTMLFormElement;
      if (form) form.noValidate = true;
      await user.type(emailInput, 'test@example.com');
      form ? form.dispatchEvent(new Event('submit', { bubbles: true })) : await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });
  });
});

