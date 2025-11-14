import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './Layout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('Layout', () => {
  it('renders header and main content area', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Layout>Test Content</Layout>
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Header should be present (via Layout component) with current branding
    expect(screen.getByText('Trade')).toBeInTheDocument();
    expect(screen.getByText('Lens')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('applies black background and responsive classes', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Layout>Content</Layout>
        </BrowserRouter>
      </QueryClientProvider>
    );

    const main = container.querySelector('main');
    expect(main).toHaveClass('flex-1', 'p-4', 'md:p-6', 'lg:p-8');
  });
});

