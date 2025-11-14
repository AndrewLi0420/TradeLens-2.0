import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRecommendations } from '@/hooks/useRecommendations';
import { trackStock, untrackStock } from '@/services/recommendations';
import { useTier } from '@/hooks/useTier';
import type { StockSearch } from '@/services/recommendations';

interface StockSearchResultsProps {
  results: StockSearch[];
  isLoading?: boolean;
}

/**
 * StockSearchResults component displays search results in a list format
 * Shows symbol, company name, sector, fortune_500_rank, recommendation status, and tracking status
 */
export default function StockSearchResults({ results, isLoading }: StockSearchResultsProps) {
  const navigate = useNavigate();
  const { data: recommendations } = useRecommendations();
  const { isLimitReached } = useTier();
  const queryClient = useQueryClient();
  const [trackingStates, setTrackingStates] = useState<Record<string, boolean>>({});
  const [processingStockId, setProcessingStockId] = useState<string | null>(null);

  // Update tracking states when results change
  useEffect(() => {
    setTrackingStates(Object.fromEntries(results.map(r => [r.id, r.is_tracked])));
  }, [results]);

  // Track stock mutation
  const trackMutation = useMutation({
    mutationFn: (stockId: string) => {
      setProcessingStockId(stockId);
      return trackStock(stockId);
    },
    onSuccess: (_, stockId) => {
      setTrackingStates(prev => ({ ...prev, [stockId]: true }));
      setProcessingStockId(null);
      queryClient.invalidateQueries({ queryKey: ['tier-status'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      // Invalidate search results to update tracking status
      queryClient.invalidateQueries({ queryKey: ['stock-search'] });
    },
    onError: (error) => {
      console.error('Failed to track stock:', error);
      setProcessingStockId(null);
      // Show error message (could add toast notification here)
    },
  });

  // Untrack stock mutation
  const untrackMutation = useMutation({
    mutationFn: (stockId: string) => {
      setProcessingStockId(stockId);
      return untrackStock(stockId);
    },
    onSuccess: (_, stockId) => {
      setTrackingStates(prev => ({ ...prev, [stockId]: false }));
      setProcessingStockId(null);
      queryClient.invalidateQueries({ queryKey: ['tier-status'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      // Invalidate search results to update tracking status
      queryClient.invalidateQueries({ queryKey: ['stock-search'] });
    },
    onError: (error) => {
      console.error('Failed to untrack stock:', error);
      setProcessingStockId(null);
    },
  });

  const handleTrackClick = (e: React.MouseEvent, stock: StockSearch) => {
    e.stopPropagation(); // Prevent card click
    const isTracked = trackingStates[stock.id] ?? stock.is_tracked;
    if (isTracked) {
      untrackMutation.mutate(stock.id);
    } else {
      trackMutation.mutate(stock.id);
    }
  };

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
      {results.map((stock) => {
        const isTracked = trackingStates[stock.id] ?? stock.is_tracked;
        // Check if this specific stock is being tracked/untracked
        const isTracking = processingStockId === stock.id;
        
        return (
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
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-xl font-bold text-white">{stock.symbol}</div>
                    {stock.has_recommendation && (
                      <Badge className="bg-financial-green text-white text-xs">
                        Has Recommendation
                      </Badge>
                    )}
                    {isTracked && (
                      <Badge className="bg-financial-blue text-white text-xs">
                        Tracked
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
                <div className="flex flex-col items-end gap-1">
                  <Button
                    onClick={(e) => handleTrackClick(e, stock)}
                    disabled={isTracking || (isLimitReached && !isTracked)}
                    className={`min-w-[100px] ${
                      isTracked
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-financial-blue hover:bg-financial-blue/80 text-white'
                    }`}
                    size="sm"
                    title={
                      isLimitReached && !isTracked
                        ? 'Free tier limit reached (5 stocks). Upgrade to premium for unlimited tracking.'
                        : undefined
                    }
                  >
                    {isTracking
                      ? '...'
                      : isTracked
                      ? 'Untrack'
                      : 'Track'}
                  </Button>
                  {isLimitReached && !isTracked && (
                    <span className="text-xs text-yellow-400 text-right max-w-[100px]">
                      Limit reached
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}


