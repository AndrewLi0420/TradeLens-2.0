import RecommendationCard from './RecommendationCard';
import type { Recommendation } from '@/services/recommendations';

interface RecommendationListProps {
  recommendations: Recommendation[];
  onRecommendationClick?: (recommendation: Recommendation) => void;
}

/**
 * RecommendationList component displays a list of recommendation cards
 */
export default function RecommendationList({ 
  recommendations, 
  onRecommendationClick 
}: RecommendationListProps) {
  if (recommendations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg mb-2">No recommendations available</p>
        <p className="text-gray-500 text-sm mb-4">
          Recommendations will appear here once they are generated.
        </p>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 max-w-2xl mx-auto text-left">
          <p className="text-gray-400 text-sm mb-2">
            <strong>Free Tier Users:</strong> You'll only see recommendations for stocks you're tracking (up to 5 stocks).
          </p>
          <p className="text-gray-400 text-sm mb-2">
            <strong>Premium Tier Users:</strong> You'll see all recommendations.
          </p>
          <p className="text-gray-500 text-xs mt-3">
            💡 Tip: Use the Search page to find and track stocks, then generate recommendations again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {recommendations.map((recommendation) => (
        <RecommendationCard
          key={recommendation.id}
          recommendation={recommendation}
          onClick={onRecommendationClick ? () => onRecommendationClick(recommendation) : undefined}
        />
      ))}
    </div>
  );
}


