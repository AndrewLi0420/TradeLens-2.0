import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { useRecommendations } from '../hooks/useRecommendations';
import { getStockById } from '../services/recommendations';
import { useQuery } from '@tanstack/react-query';
import type { StockSearch } from '../services/recommendations';

/**
 * StockDetail page component
 * Displays detailed information about a single stock
 * - Shows stock information (symbol, company name, sector, etc.)
 * - Shows recommendation if available
 * - Placeholder for Epic 4 features (time series charts, historical context)
 */
export default function StockDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: recommendations } = useRecommendations();

  // Fetch stock data by ID
  const { data: stock, isLoading: stockLoading, isError: stockError } = useQuery<StockSearch>({
    queryKey: ['stock', 'detail', id],
    queryFn: () => getStockById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Find recommendation for this stock if it exists
  const recommendation = recommendations?.find(rec => rec.stock_id === id);

  // Redirect to login if not authenticated
  if (!authLoading && !isAuthenticated) {
    navigate('/login', { replace: true });
    return null;
  }

  // Loading state
  if (authLoading || stockLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading stock information...</div>
      </div>
    );
  }

  // Error state - 404 if stock not found
  if (stockError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Stock Not Found</h1>
          <p className="text-gray-400 mb-6">Unable to load stock information.</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // If stock not loaded yet or not found
  if (!stock) {
    return null;
  }

  return (
    <div>
      {/* Back button */}
      <div className="mb-6">
        <Button
          onClick={() => navigate('/dashboard')}
          variant="ghost"
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      {/* Stock Information Card */}
      <Card className="bg-gray-900 border-gray-800 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-3xl font-bold text-white">{stock.symbol}</div>
              <div className="text-lg text-gray-400 mt-1">{stock.company_name}</div>
              {stock.sector && (
                <div className="text-sm text-gray-500 mt-1">Sector: {stock.sector}</div>
              )}
              {stock.fortune_500_rank && (
                <div className="text-sm text-gray-500">Fortune 500 Rank: #{stock.fortune_500_rank}</div>
              )}
            </div>
            {recommendation && (
              <Badge className="bg-financial-green text-white text-lg px-4 py-2">
                {recommendation.signal.toUpperCase()}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recommendation ? (
            <div className="space-y-4">
              <p className="text-gray-300">
                This stock has an active recommendation. Click below to view full details.
              </p>
              <Button
                onClick={() => navigate(`/recommendations/${recommendation.id}`)}
                className="bg-financial-blue hover:bg-financial-blue/80"
              >
                View Recommendation Details
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-6 border border-yellow-600/30">
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">No Active Recommendation</h3>
                <p className="text-gray-300 mb-4">
                  This stock doesn't have an active recommendation yet. Recommendations are generated daily based on market conditions, sentiment analysis, and ML model predictions.
                </p>
                <p className="text-sm text-gray-400">
                  Check back later or view other stocks with recommendations from the dashboard.
                </p>
              </div>
              
              {/* Placeholder for Epic 4 features */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-2">Coming in Epic 4</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Future features will include:
                </p>
                <ul className="text-gray-400 text-sm space-y-2 list-disc list-inside">
                  <li>Time series price charts</li>
                  <li>Historical recommendations for this stock</li>
                  <li>Historical sentiment visualization</li>
                  <li>Performance context for past recommendations</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

