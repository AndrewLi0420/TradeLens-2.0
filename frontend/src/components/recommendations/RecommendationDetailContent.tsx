import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Recommendation } from '@/services/recommendations';
import EducationalTooltip, { InfoTooltip, tooltipContent } from '../common/EducationalTooltip';

interface RecommendationDetailContentProps {
  recommendation: Recommendation;
}

/**
 * RecommendationDetailContent component displays full recommendation details
 * - Full stock information (symbol, company name, sector, fortune_500_rank)
 * - Prediction signal with color-coded badge
 * - Detailed explanation text
 * - Sentiment analysis results with data source attribution
 * - ML model signals with confidence score explanation
 * - Risk factors with risk level indicator
 * - Data sources with timestamps
 * - Confidence score with R² explanation
 * - Educational context sections
 */
export default function RecommendationDetailContent({
  recommendation,
}: RecommendationDetailContentProps) {
  const {
    stock,
    signal,
    confidence_score,
    sentiment_score,
    risk_level,
    explanation,
    created_at,
  } = recommendation;

  // Format confidence as percentage
  const confidencePercent = Math.round(confidence_score * 100);

  // Format date
  const date = new Date(created_at);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const timeAgo = getTimeAgo(date);

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
    if (score === null) return { text: 'Neutral', color: 'text-gray-400', description: 'No sentiment data available' };
    if (score > 0.1) return { text: 'Positive', color: 'text-financial-green', description: 'Market sentiment is favorable' };
    if (score < -0.1) return { text: 'Negative', color: 'text-red-400', description: 'Market sentiment is unfavorable' };
    return { text: 'Neutral', color: 'text-gray-400', description: 'Market sentiment is neutral' };
  };

  const sentiment = getSentimentIndicator(sentiment_score);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Main Recommendation Card */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-white">{stock.symbol}</div>
              <div className="text-base sm:text-lg text-gray-400 mt-1">{stock.company_name}</div>
              {stock.sector && (
                <div className="text-sm text-gray-500 mt-1">Sector: {stock.sector}</div>
              )}
              {stock.fortune_500_rank && (
                <div className="text-sm text-gray-500">Fortune 500 Rank: #{stock.fortune_500_rank}</div>
              )}
            </div>
            <Badge className={`${signalColors[signal]} text-lg px-4 py-2`}>
              {signal.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs text-gray-500">Confidence Score</div>
                <InfoTooltip content={tooltipContent.confidenceScore} />
              </div>
              <div className="text-2xl font-bold text-white">{confidencePercent}%</div>
              <div className="text-xs text-gray-400 mt-1">
                Based on model R² performance
                <InfoTooltip content={tooltipContent.rSquared} placement="right" />
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs text-gray-500">Risk Level</div>
                <InfoTooltip content={tooltipContent.riskLevel} />
              </div>
              <Badge className={riskColors[risk_level]} variant="secondary">
                {risk_level.toUpperCase()}
              </Badge>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs text-gray-500">Sentiment</div>
                <InfoTooltip content={tooltipContent.sentimentAnalysis} />
              </div>
              <div className={`text-lg font-semibold ${sentiment.color}`}>
                {sentiment.text}
              </div>
              {sentiment_score !== null && (
                <div className="text-sm text-gray-400 mt-1">
                  Score: {sentiment_score > 0 ? '+' : ''}{sentiment_score.toFixed(2)}
                </div>
              )}
            </div>
          </div>

          {/* Detailed Explanation - Prominently Displayed */}
          {explanation && (
            <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border-2 border-financial-blue/50">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4 flex items-center gap-2 flex-wrap">
                Recommendation Explanation
                <InfoTooltip content="This explanation helps you understand the reasoning behind this recommendation, including sentiment trends, ML model signals, and risk factors." />
              </h3>
              <p className="text-gray-200 leading-relaxed text-sm sm:text-base whitespace-pre-wrap mb-4">{explanation}</p>
              
              {/* Parse and display data sources from explanation if structured */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Data Sources & Freshness</h4>
                <div className="space-y-1 text-xs text-gray-500">
                  {explanation.includes('Data sources:') && (
                    <div className="text-gray-400">
                      {explanation.split('Data sources:')[1]?.trim()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sentiment Analysis Section */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              Sentiment Analysis
              <InfoTooltip content={tooltipContent.sentimentAnalysis} />
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Overall Sentiment:</span>
                <span className={`font-medium ${sentiment.color}`}>{sentiment.text}</span>
              </div>
              {sentiment_score !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Sentiment Score:</span>
                  <span className="text-white">{sentiment_score > 0 ? '+' : ''}{sentiment_score.toFixed(3)}</span>
                </div>
              )}
              <div className="text-sm text-gray-500 mt-2">
                Data sources: News articles, web scraping
                <span className="ml-2 text-gray-600">(updated {timeAgo})</span>
              </div>
            </div>
          </div>

          {/* ML Model Signals Section */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              ML Model Signals
              <InfoTooltip content={tooltipContent.mlModelSignals} />
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Confidence Score:</span>
                <span className="text-white font-semibold">{confidencePercent}%</span>
              </div>
              <div className="text-sm text-gray-500 mt-2">
                Based on historical model performance (R²)
                <InfoTooltip content={tooltipContent.rSquared} placement="right" />
              </div>
            </div>
          </div>

          {/* Risk Factors Section */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              Risk Factors
              <InfoTooltip content={tooltipContent.riskLevel} />
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Risk Level:</span>
                <Badge className={riskColors[risk_level]} variant="secondary">
                  {risk_level.toUpperCase()}
                </Badge>
              </div>
              <div className="text-sm text-gray-500 mt-2">
                Risk assessment based on volatility, market conditions, and historical performance
              </div>
            </div>
          </div>

          {/* Data Sources & Timestamps */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3">Data Sources & Transparency</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Recommendation Generated:</span>
                <span className="text-white">{formattedDate} at {formattedTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Sentiment Data:</span>
                <span className="text-gray-300">News articles, web scraping (updated {timeAgo})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Market Data:</span>
                <span className="text-gray-300">Real-time price data (updated {timeAgo})</span>
              </div>
            </div>
          </div>

          {/* Educational Context */}
          <div className="bg-gray-800 rounded-lg p-4 border border-financial-blue/30">
            <h3 className="text-lg font-semibold text-white mb-3">Understanding This Recommendation</h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div>
                <strong className="text-financial-green">What does "{signal.toUpperCase()}" mean?</strong>
                <p className="mt-1 text-gray-400">
                  {signal === 'buy' && 'This recommendation suggests the stock may increase in value based on current market conditions and analysis.'}
                  {signal === 'sell' && 'This recommendation suggests the stock may decrease in value, and you may want to consider selling.'}
                  {signal === 'hold' && 'This recommendation suggests maintaining your current position, as the stock is expected to remain relatively stable.'}
                </p>
              </div>
              <div>
                <strong className="text-financial-green">Why does this matter?</strong>
                <p className="mt-1 text-gray-400">
                  Our AI model analyzes multiple data sources including market trends, sentiment analysis, and historical patterns to provide you with informed recommendations. The confidence score indicates how reliable this prediction is based on the model's past performance.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Helper function to calculate time ago
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}


