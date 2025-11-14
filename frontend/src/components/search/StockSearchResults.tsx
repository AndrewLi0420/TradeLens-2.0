import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRecommendations } from '@/hooks/useRecommendations';
import type { StockSearch } from '@/services/recommendations';

interface StockSearchResultsProps {
  results: StockSearch[];
  isLoading?: boolean;
}

/**
 * StockSearchResults component displays search results in a list format
 * Shows symbol, company name, sector, fortune_500_rank, and recommendation status
 */
export default function StockSearchResults({ results, isLoading }: StockSearchResultsProps) {
  const navigate = useNavigate();
  const { data: recommendations } = useRecommendations();

  const handleResultClick = (stock: StockSearch) => {
    if (stock.has_recommendation) {
      // Find the recommendation for this stock
      const recommendation = recommendations.find(rec => rec.stock_id === stock.id);
      if (recommendation) {
        navigate(`/recommendations/${recommendation.id}`);
      } else {
        // Fallback: navigate to dashboard if recommendation not found
        navigate('/dashboard');
      }
    } else {
      // No recommendation: navigate to stock detail page
      navigate(`/stocks/${stock.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No stocks found matching your search.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((stock) => (
        <Card
          key={stock.id}
          className="bg-gray-900 border-gray-800 cursor-pointer hover:border-financial-blue transition-colors touch-manipulation"
          onClick={() => handleResultClick(stock)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleResultClick(stock);
            }
          }}
          aria-label={`View ${stock.symbol} - ${stock.company_name}`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-xl font-bold text-white">{stock.symbol}</div>
                  {stock.has_recommendation && (
                    <Badge className="bg-financial-green text-white text-xs">
                      Has Recommendation
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-gray-300 mb-1">{stock.company_name}</div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  {stock.sector && (
                    <span>Sector: {stock.sector}</span>
                  )}
                  {stock.fortune_500_rank && (
                    <span>Fortune 500: #{stock.fortune_500_rank}</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}


