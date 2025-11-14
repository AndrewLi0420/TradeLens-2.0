import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import StockSearchResults from '../StockSearchResults';
import { useRecommendations } from '@/hooks/useRecommendations';
import type { StockSearch } from '@/services/recommendations';

// Mock the hooks
vi.mock('@/hooks/useRecommendations');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('StockSearchResults', () => {
  const mockNavigate = vi.fn();
  const mockRecommendations = [
    {
      id: 'rec-1',
      stock_id: 'stock-1',
      stock: {
        id: 'stock-1',
        symbol: 'AAPL',
        company_name: 'Apple Inc.',
      },
      signal: 'buy' as const,
      confidence_score: 0.85,
      sentiment_score: 0.7,
      risk_level: 'medium' as const,
      explanation: 'Test explanation',
      created_at: '2025-01-27T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRecommendations).mockReturnValue({
      data: mockRecommendations,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  const renderComponent = (props: { results: StockSearch[]; isLoading?: boolean }) => {
    return render(
      <BrowserRouter>
        <StockSearchResults {...props} />
      </BrowserRouter>
    );
  };

  it('renders loading state correctly', () => {
    renderComponent({ results: [], isLoading: true });
    
    // Check for loading skeleton cards
    const skeletonCards = screen.getAllByRole('generic').filter(
      el => el.className.includes('animate-pulse')
    );
    expect(skeletonCards.length).toBeGreaterThan(0);
  });

  it('renders empty state when no results', () => {
    renderComponent({ results: [], isLoading: false });
    
    expect(screen.getByText('No stocks found matching your search.')).toBeInTheDocument();
  });

  it('renders search results correctly', () => {
    const mockResults: StockSearch[] = [
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

    renderComponent({ results: mockResults, isLoading: false });

    // Check symbols are displayed
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();

    // Check company names are displayed
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    expect(screen.getByText('Microsoft Corporation')).toBeInTheDocument();

    // Check sectors are displayed
    expect(screen.getByText(/Sector: Technology/)).toBeInTheDocument();

    // Check Fortune 500 ranks are displayed
    expect(screen.getByText(/Fortune 500: #1/)).toBeInTheDocument();
    expect(screen.getByText(/Fortune 500: #2/)).toBeInTheDocument();
  });

  it('displays recommendation badge when stock has recommendation', () => {
    const mockResults: StockSearch[] = [
      {
        id: 'stock-1',
        symbol: 'AAPL',
        company_name: 'Apple Inc.',
        sector: 'Technology',
        fortune_500_rank: 1,
        has_recommendation: true,
      },
    ];

    renderComponent({ results: mockResults, isLoading: false });

    expect(screen.getByText('Has Recommendation')).toBeInTheDocument();
  });

  it('does not display recommendation badge when stock has no recommendation', () => {
    const mockResults: StockSearch[] = [
      {
        id: 'stock-2',
        symbol: 'MSFT',
        company_name: 'Microsoft Corporation',
        sector: 'Technology',
        fortune_500_rank: 2,
        has_recommendation: false,
      },
    ];

    renderComponent({ results: mockResults, isLoading: false });

    expect(screen.queryByText('Has Recommendation')).not.toBeInTheDocument();
  });

  it('handles missing optional fields gracefully', () => {
    const mockResults: StockSearch[] = [
      {
        id: 'stock-1',
        symbol: 'AAPL',
        company_name: 'Apple Inc.',
        sector: null,
        fortune_500_rank: null,
        has_recommendation: false,
      },
    ];

    renderComponent({ results: mockResults, isLoading: false });

    // Should still render symbol and company name
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();

    // Sector and Fortune 500 should not be displayed
    expect(screen.queryByText(/Sector:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fortune 500:/)).not.toBeInTheDocument();
  });

  it('makes results clickable with proper styling', () => {
    const mockResults: StockSearch[] = [
      {
        id: 'stock-1',
        symbol: 'AAPL',
        company_name: 'Apple Inc.',
        sector: 'Technology',
        fortune_500_rank: 1,
        has_recommendation: true,
      },
    ];

    renderComponent({ results: mockResults, isLoading: false });

    // Find the card element
    const card = screen.getByText('AAPL').closest('[class*="cursor-pointer"]');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('cursor-pointer');
  });
});


