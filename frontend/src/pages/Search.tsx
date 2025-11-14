import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStockSearch } from '../hooks/useStockSearch';
import StockSearchResults from '../components/search/StockSearchResults';
import { Input } from '@/components/ui/input';
import { Search as SearchIcon } from 'lucide-react';
import { InfoTooltip, tooltipContent } from '../components/common/EducationalTooltip';

/**
 * Search page component for searching stocks by symbol or company name
 */
export default function Search() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: searchResults, isLoading: searchLoading, isError, error } = useStockSearch(searchQuery);

  // Initialize search query from URL parameter
  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam) {
      setSearchQuery(queryParam);
    }
  }, [searchParams]);

  // Redirect to login if not authenticated
  if (!authLoading && !user) {
    navigate('/login');
    return null;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Search Stocks</h1>
            <InfoTooltip
              content="Search for stocks by symbol (e.g., AAPL) or company name (e.g., Apple). Results show Fortune 500 stocks with real-time market data and AI-powered recommendations."
              placement="right"
            />
          </div>
          <p className="text-gray-400 text-sm sm:text-base">Search for stocks by symbol or company name</p>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search by symbol (e.g., AAPL) or company name (e.g., Apple)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-financial-blue focus:ring-financial-blue text-base min-h-[44px]"
              aria-label="Search stocks"
            />
          </div>
          {searchQuery.length > 0 && searchQuery.length < 2 && (
            <p className="mt-2 text-sm text-gray-400">Enter at least 2 characters to search</p>
          )}
        </div>

        {/* Error State */}
        {isError && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg">
            <p className="text-red-400">
              {error instanceof Error ? error.message : 'Failed to search stocks. Please try again.'}
            </p>
          </div>
        )}

        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <StockSearchResults
            results={searchResults}
            isLoading={searchLoading}
          />
        )}

        {/* Empty State (no search yet) */}
        {searchQuery.length < 2 && !searchLoading && (
          <div className="text-center py-12">
            <SearchIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Start typing to search for stocks</p>
          </div>
        )}
      </div>
    </div>
  );
}

