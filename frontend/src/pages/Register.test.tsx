import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Register from './Register';
import * as authService from '../services/auth';

// Mock the auth service
vi.mock('../services/auth');

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Register Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders form fields', () => {
      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('renders form title and description', () => {
      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      // Use heading role for title, not just text
      expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByText('Sign up to get started')).toBeInTheDocument();
    });

    it('renders link to login page', () => {
      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const loginLink = screen.getByRole('link', { name: /sign in/i });
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute('href', '/login');
    });
  });

  describe('Email Validation', () => {
    it('shows error for invalid email format on form submission', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const passwordConfirmInput = screen.getByLabelText(/confirm password/i);
      const form = emailInput.closest('form') as HTMLFormElement;

      // Use a string that fails our regex validation
      await user.clear(emailInput);
      await user.type(emailInput, 'notanemail');
      // Remove HTML5 validation by removing required temporarily
      (emailInput as HTMLInputElement).removeAttribute('required');
      
      await user.type(passwordInput, 'SecurePass123!');
      await user.type(passwordConfirmInput, 'SecurePass123!');

      // Submit form directly to bypass browser validation
      if (form) {
        fireEvent.submit(form);
      } else {
        const submitButton = screen.getByRole('button', { name: /create account/i });
        await user.click(submitButton);
      }

      // Error should appear on form submission
      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('clears email error when valid email is entered', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const passwordConfirmInput = screen.getByLabelText(/confirm password/i);
      const form = emailInput.closest('form');
      
      // Submit with invalid email to trigger error
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid');
      (emailInput as HTMLInputElement).removeAttribute('required');
      
      await user.type(passwordInput, 'SecurePass123!');
      await user.type(passwordConfirmInput, 'SecurePass123!');
      
      // Submit form directly
      if (form) {
        fireEvent.submit(form);
      } else {
        const submitButton = screen.getByRole('button', { name: /create account/i });
        await user.click(submitButton);
      }
      
      // Should show error
      await waitFor(() => {
        expect(screen.queryByText(/please enter a valid email address/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Enter valid email - error clears on change (per component logic)
      await user.clear(emailInput);
      await user.type(emailInput, 'test@example.com');

      // Error should clear (component clears on input change if validation passes)
      await waitFor(() => {
        expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
      });
    });

    it('shows error for empty email on form submission', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const form = emailInput.closest('form');
      
      // Remove required to allow form submission
      (emailInput as HTMLInputElement).removeAttribute('required');

      // Submit form directly
      if (form) {
        fireEvent.submit(form);
      } else {
        const submitButton = screen.getByRole('button', { name: /create account/i });
        await user.click(submitButton);
      }

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Password Validation', () => {
    it('shows error for password less than 8 characters on form submission', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const passwordConfirmInput = screen.getByLabelText(/confirm password/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'short');
      await user.type(passwordConfirmInput, 'short');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it('shows error for password with only letters on form submission', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const passwordConfirmInput = screen.getByLabelText(/confirm password/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'passwordonlyletters');
      await user.type(passwordConfirmInput, 'passwordonlyletters');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password must contain at least one number or special character/i)).toBeInTheDocument();
      });
    });

    it('shows error for password with only numbers on form submission', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const passwordConfirmInput = screen.getByLabelText(/confirm password/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, '12345678');
      await user.type(passwordConfirmInput, '12345678');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password cannot contain only numbers/i)).toBeInTheDocument();
      });
    });

    it('clears password error when valid password is entered', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const passwordConfirmInput = screen.getByLabelText(/confirm password/i);
      
      // Submit with invalid password to trigger error
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'short');
      await user.type(passwordConfirmInput, 'short');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });

      // Enter valid password - error clears on change (per component logic)
      await user.clear(passwordInput);
      await user.type(passwordInput, 'ValidPass123!');

      // Error should clear (component clears on input change if validation passes)
      await waitFor(() => {
        expect(screen.queryByText(/password must be at least 8 characters/i)).not.toBeInTheDocument();
      });
    });

    it('shows password requirements hint', () => {
      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      expect(screen.getByText(/must be at least 8 characters with numbers or special characters/i)).toBeInTheDocument();
    });
  });

  describe('Password Confirmation', () => {
    it('shows error when passwords do not match on submission', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const passwordConfirmInput = screen.getByLabelText(/confirm password/i);
      const form = emailInput.closest('form');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.type(passwordConfirmInput, 'DifferentPass123!');

      // Submit form directly
      if (form) {
        fireEvent.submit(form);
      } else {
        const submitButton = screen.getByRole('button', { name: /create account/i });
        await user.click(submitButton);
      }

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('clears password confirmation error when passwords match', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const passwordConfirmInput = screen.getByLabelText(/confirm password/i);
      const form = emailInput.closest('form');

      // Enter mismatched passwords
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.type(passwordConfirmInput, 'Different');
      
      // Submit to trigger error
      if (form) {
        fireEvent.submit(form);
      } else {
        const submitButton = screen.getByRole('button', { name: /create account/i });
        await user.click(submitButton);
      }

      await waitFor(() => {
        expect(screen.queryByText(/passwords do not match/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Fix password confirmation
      await user.clear(passwordConfirmInput);
      await user.type(passwordConfirmInput, 'SecurePass123!');

      // Error should clear (component clears on change when passwords match)
      await waitFor(() => {
        expect(screen.queryByText(/passwords do not match/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('calls register API with valid data and redirects on success', async () => {
      const user = userEvent.setup();
      const mockRegister = vi.spyOn(authService, 'register').mockResolvedValue({
        id: 'test-id',
        email: 'test@example.com',
        is_verified: false,
      });

      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const passwordConfirmInput = screen.getByLabelText(/confirm password/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.type(passwordConfirmInput, 'SecurePass123!');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith('test@example.com', 'SecurePass123!');
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      vi.spyOn(authService, 'register').mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ id: 'test', email: 'test@example.com', is_verified: false }), 100))
      );

      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const passwordConfirmInput = screen.getByLabelText(/confirm password/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.type(passwordConfirmInput, 'SecurePass123!');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Should show loading state
      expect(screen.getByText('Creating Account...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('Error Handling', () => {
    it('displays API error message for duplicate email', async () => {
      const user = userEvent.setup();
      const mockError = {
        response: {
          status: 400,
          data: {
            error: {
              type: 'ValidationError',
              message: 'An account with this email already exists',
            },
          },
        },
      };
      vi.spyOn(authService, 'register').mockRejectedValue(mockError);

      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const passwordConfirmInput = screen.getByLabelText(/confirm password/i);

      await user.type(emailInput, 'existing@example.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.type(passwordConfirmInput, 'SecurePass123!');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/an account with this email already exists/i)).toBeInTheDocument();
      });
    });

    it('displays user-friendly message for 409 duplicate email status', async () => {
      const user = userEvent.setup();
      const mockError = {
        response: {
          status: 409,
          data: {},
        },
      };
      vi.spyOn(authService, 'register').mockRejectedValue(mockError);

      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const passwordConfirmInput = screen.getByLabelText(/confirm password/i);

      await user.type(emailInput, 'duplicate@example.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.type(passwordConfirmInput, 'SecurePass123!');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/an account with this email already exists. please log in or use a different email/i)).toBeInTheDocument();
      });
    });

    it('displays generic error message for network errors', async () => {
      const user = userEvent.setup();
      vi.spyOn(authService, 'register').mockRejectedValue(new Error('Network error'));

      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const passwordConfirmInput = screen.getByLabelText(/confirm password/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.type(passwordConfirmInput, 'SecurePass123!');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network error. please check your connection and try again/i)).toBeInTheDocument();
      });
    });

    it('displays validation error message for 400 status', async () => {
      const user = userEvent.setup();
      const mockError = {
        response: {
          status: 400,
          data: {},
        },
      };
      vi.spyOn(authService, 'register').mockRejectedValue(mockError);

      render(
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const passwordConfirmInput = screen.getByLabelText(/confirm password/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.type(passwordConfirmInput, 'SecurePass123!');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password. please check your input/i)).toBeInTheDocument();
      });
    });
  });
});

