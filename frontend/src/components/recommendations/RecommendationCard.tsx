import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Recommendation } from '@/services/recommendations';
import { InfoTooltip, tooltipContent } from '../common/EducationalTooltip';

interface RecommendationCardProps {
  recommendation: Recommendation;
  onClick?: () => void;
}

/**
 * RecommendationCard component displays a single recommendation with all key metrics
 */
export default function RecommendationCard({ recommendation, onClick }: RecommendationCardProps) {
  const navigate = useNavigate();
  const { stock, signal, confidence_score, sentiment_score, risk_level, created_at } = recommendation;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default: navigate to detail view
      navigate(`/recommendations/${recommendation.id}`);
    }
  };

  // Format confidence as percentage
  const confidencePercent = Math.round(confidence_score * 100);

  // Format date
  const date = new Date(created_at);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Signal badge colors
  const signalColors = {
    buy: 'bg-financial-green text-white',
    sell: 'bg-red-600 text-white',
    hold: 'bg-yellow-600 text-white',
  };

  // Risk level colors
  const riskColors = {
    low: 'bg-financial-green text-white',
    medium: 'bg-yellow-600 text-white',
    high: 'bg-red-600 text-white',
  };

  // Sentiment indicator
  const getSentimentIndicator = (score: number | null) => {
    if (score === null) return { text: 'N/A', color: 'text-gray-400' };
    if (score > 0.1) return { text: 'Positive', color: 'text-financial-green' };
    if (score < -0.1) return { text: 'Negative', color: 'text-red-400' };
    return { text: 'Neutral', color: 'text-gray-400' };
  };

  const sentiment = getSentimentIndicator(sentiment_score);

  // Extract explanation preview (first 1-2 sentences, max ~100 characters)
  const getExplanationPreview = (explanation: string | null): string | null => {
    if (!explanation) return null;
    
    // Split by sentences (period followed by space or end of string)
    const sentences = explanation.split(/\.\s+/).filter(s => s.trim().length > 0);
    
    if (sentences.length === 0) return null;
    
    // Take first 1-2 sentences, but limit to ~100 characters
    let preview = sentences[0];
    if (sentences.length > 1 && preview.length < 80) {
      preview += '. ' + sentences[1];
    }
    
    // Truncate if too long
    if (preview.length > 120) {
      preview = preview.substring(0, 117) + '...';
    } else if (preview.length < preview.length && !preview.endsWith('.')) {
      preview += '.';
    }
    
    return preview;
  };

  const explanationPreview = getExplanationPreview(recommendation.explanation);

  return (
    <Card 
      className="bg-gray-900 border-gray-800 cursor-pointer hover:border-financial-blue transition-colors touch-manipulation"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`View recommendation for ${stock.symbol}`}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-white">{stock.symbol}</div>
            <div className="text-sm text-gray-400 mt-1">{stock.company_name}</div>
          </div>
          <Badge className={signalColors[signal]}>{signal.toUpperCase()}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <span>Confidence</span>
              <InfoTooltip content={tooltipContent.confidenceScore} placement="top" />
            </div>
            <div className="text-lg font-semibold text-white">{confidencePercent}%</div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <span>Risk Level</span>
              <InfoTooltip content={tooltipContent.riskLevel} placement="top" />
            </div>
            <Badge className={riskColors[risk_level]} variant="secondary">
              {risk_level.toUpperCase()}
            </Badge>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <span>Sentiment</span>
            <InfoTooltip content={tooltipContent.sentimentAnalysis} placement="top" />
          </div>
          <div className={`text-sm font-medium ${sentiment.color}`}>
            {sentiment.text}
            {sentiment_score !== null && (
              <span className="ml-2 text-gray-400">
                ({sentiment_score > 0 ? '+' : ''}{sentiment_score.toFixed(2)})
              </span>
            )}
          </div>
        </div>
        {explanationPreview && (
          <div className="pt-2 border-t border-gray-800">
            <div className="text-xs text-gray-500 mb-1">Explanation</div>
            <div className="text-sm text-gray-300 leading-relaxed">{explanationPreview}</div>
            <div className="text-xs text-financial-blue mt-1 hover:underline">
              Read more →
            </div>
          </div>
        )}
        <div className="pt-2 border-t border-gray-800">
          <div className="text-xs text-gray-500">
            {formattedDate} at {formattedTime}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

