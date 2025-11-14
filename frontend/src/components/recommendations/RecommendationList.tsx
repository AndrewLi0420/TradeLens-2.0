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
        <p className="text-gray-400 text-lg">No recommendations available</p>
        <p className="text-gray-500 text-sm mt-2">
          Recommendations will appear here once they are generated.
        </p>
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


