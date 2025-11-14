import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useTier } from '../hooks/useTier';
import { useRecommendations } from '../hooks/useRecommendations';
import { getPreferences } from '../services/userPreferences';
import { generateRecommendations } from '../services/recommendations';
import type { UserPreferences } from '../types/user';
import type { GetRecommendationsParams } from '../services/recommendations';
import RecommendationList from '../components/recommendations/RecommendationList';
import FilterSortControls from '../components/recommendations/FilterSortControls';
import TierStatus from '../components/common/TierStatus';
import PreferenceIndicator from '../components/common/PreferenceIndicator';
import UpgradePrompt from '../components/common/UpgradePrompt';
import InlineHelp, { dashboardHelpContent } from '../components/common/InlineHelp';
import OnboardingTooltips from '../components/common/OnboardingTooltips';
import { Button } from '../components/ui/button';

const PREFERENCES_QUERY_KEY = ['preferences', 'current-user'];

export default function Dashboard() {
  const { user } = useAuth();
  const { isLimitReached, stockLimit, tier } = useTier();
  const [filters, setFilters] = useState<GetRecommendationsParams>({
    sort_by: 'date',
    sort_direction: 'desc',
  });
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Fetch user preferences to check if they're set (for UI messaging)
  const { data: preferences } = useQuery<UserPreferences | null>({
    queryKey: PREFERENCES_QUERY_KEY,
    queryFn: getPreferences,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Automatically show upgrade prompt when limit is reached (once per session)
  useEffect(() => {
    if (isLimitReached) {
      const hasShownThisSession = sessionStorage.getItem('upgrade-prompt-shown');
      if (!hasShownThisSession) {
        setShowUpgradePrompt(true);
        sessionStorage.setItem('upgrade-prompt-shown', 'true');
      }
    }
  }, [isLimitReached]);

  // Fetch recommendations with current filters
  const { data: recommendations, isLoading, isError, error, refetch } = useRecommendations(filters);

  // Generate recommendations mutation
  const generateMutation = useMutation({
    mutationFn: () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return generateRecommendations(user.id, 10);
    },
    onSuccess: (data) => {
      if (data.created > 0) {
        setGenerateMessage(`✅ Successfully generated ${data.created} recommendation${data.created !== 1 ? 's' : ''}! Refreshing list...`);
        // Refetch recommendations after a short delay to allow backend to persist
        setTimeout(() => {
          refetch();
        }, 1000);
        // Clear message after 5 seconds
        setTimeout(() => setGenerateMessage(null), 5000);
      } else {
        // Show diagnostic message if provided, otherwise generic message
        const message = data.message || 'Generated 0 recommendations. Check backend logs for details.';
        setGenerateMessage(`⚠️ ${message}`);
        // Clear message after 10 seconds (longer for diagnostic info)
        setTimeout(() => setGenerateMessage(null), 10000);
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate recommendations';
      setGenerateMessage(
        `Error: ${errorMessage}. Check backend logs for details. Possible causes: no stocks in database, no market data, or ML models not loaded.`
      );
      setTimeout(() => setGenerateMessage(null), 8000);
    },
  });

  // Handle recommendation click (navigate to detail view)
  const handleRecommendationClick = (recommendation: any) => {
    // Navigation is handled by RecommendationCard component
    // This handler is kept for potential future use
  };

  return (
    <div>
      <OnboardingTooltips />
      <UpgradePrompt
        stockLimit={stockLimit ?? 5}
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <InlineHelp
            title="Dashboard Help"
            content={
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-financial-green mb-2">Filtering & Sorting</h4>
                  <p className="text-gray-300">{dashboardHelpContent.filtering}</p>
                  <p className="text-gray-300 mt-2">{dashboardHelpContent.sorting}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-financial-green mb-2">Understanding Metrics</h4>
                  <p className="text-gray-300">{dashboardHelpContent.recommendationMetrics}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-financial-green mb-2">Tier Limits</h4>
                  <p className="text-gray-300">{dashboardHelpContent.tierLimits}</p>
                </div>
              </div>
            }
          />
          <TierStatus />
        </div>
      </div>

      {/* Preference Indicators */}
      {preferences && (
        <div className="mb-4">
          <PreferenceIndicator />
        </div>
      )}

      {/* Message encouraging preference setup when preferences not set */}
      {!preferences && (
        <div className="mb-4 p-4 bg-gray-900 border border-financial-blue rounded-lg">
          <p className="text-gray-300">
            💡 <strong>Personalize your recommendations:</strong> Set your holding period and risk tolerance preferences in your{' '}
            <a href="/profile" className="text-financial-blue hover:text-financial-green underline">
              Profile
            </a>{' '}
            to see recommendations tailored to your investment style.
          </p>
        </div>
      )}

      {/* Filter and Sort Controls */}
      <div className="mb-6">
        <FilterSortControls filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Generate Recommendations Button */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          {generateMessage && (
            <div
              className={`text-sm ${
                generateMessage.includes('Successfully')
                  ? 'text-financial-green'
                  : 'text-red-400'
              }`}
            >
              {generateMessage}
            </div>
          )}
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || !user?.id}
          className="bg-financial-blue hover:bg-financial-blue/80 text-white w-full sm:w-auto min-h-[44px]"
        >
          {generateMutation.isPending ? 'Generating...' : 'Generate Recommendations'}
        </Button>
      </div>

      {/* Recommendations List */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">Loading recommendations...</div>
        </div>
      )}

      {isError && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-400 font-semibold mb-2">Error loading recommendations</p>
          <p className="text-red-300 text-sm">
            {error instanceof Error ? error.message : 'Failed to load recommendations'}
          </p>
          <Button
            onClick={() => refetch()}
            className="mt-4 bg-financial-blue hover:bg-financial-blue/80 text-white"
          >
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Debug info - remove in production */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-2 bg-gray-800 rounded text-xs text-gray-400">
              Debug: {recommendations?.length ?? 0} recommendations loaded | Tier: {tier} | User ID: {user?.id}
            </div>
          )}
          {/* Free tier notice */}
          {tier === 'free' && (!recommendations || recommendations.length === 0) && (
            <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
              <p className="text-yellow-400 text-sm mb-2">
                <strong>Free Tier Notice:</strong> You'll only see recommendations for stocks you're tracking.
              </p>
              <p className="text-yellow-300 text-xs">
                Go to the <a href="/search" className="underline">Search</a> page to find and track stocks (up to 5), then generate recommendations again.
              </p>
            </div>
          )}
          {recommendations && recommendations.length > 0 && (
            <div className="mb-4 text-sm text-gray-400">
              Showing {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
            </div>
          )}
          <RecommendationList
            recommendations={recommendations ?? []}
            onRecommendationClick={handleRecommendationClick}
          />
        </>
      )}
    </div>
  );
}

