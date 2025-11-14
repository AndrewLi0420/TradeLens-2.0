import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecommendationDetailContent from '../RecommendationDetailContent';
import type { Recommendation } from '@/services/recommendations';

function buildRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'rec-1',
    user_id: 'user-1',
    stock_id: 'stock-1',
    stock: {
      id: 'stock-1',
      symbol: 'AAPL',
      company_name: 'Apple Inc.',
      sector: 'Technology',
      fortune_500_rank: 1,
    },
    signal: 'buy',
    confidence_score: 0.85,
    sentiment_score: 0.23,
    risk_level: 'low',
    explanation: 'Strong outlook based on positive sentiment and low risk factors.',
    created_at: new Date('2025-11-05T10:00:00Z').toISOString(),
    ...overrides,
  };
}

describe('RecommendationDetailContent', () => {
  it('renders full stock information: symbol, company name, sector, fortune_500_rank', () => {
    const rec = buildRecommendation();
    render(<RecommendationDetailContent recommendation={rec} />);

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    expect(screen.getByText(/Sector: Technology/i)).toBeInTheDocument();
    expect(screen.getByText(/Fortune 500 Rank: #1/i)).toBeInTheDocument();
  });

  it('displays prediction signal with color-coded badge', () => {
    const rec = buildRecommendation({ signal: 'buy' });
    render(<RecommendationDetailContent recommendation={rec} />);
    expect(screen.getByText('BUY')).toBeInTheDocument();

    const { rerender } = render(<RecommendationDetailContent recommendation={rec} />);
    rerender(<RecommendationDetailContent recommendation={{ ...rec, signal: 'sell' }} />);
    expect(screen.getByText('SELL')).toBeInTheDocument();
  });

  it('displays detailed explanation text prominently', () => {
    const rec = buildRecommendation({ explanation: 'Test explanation text' });
    render(<RecommendationDetailContent recommendation={rec} />);
    
    // Check that explanation is displayed
    expect(screen.getByText('Test explanation text')).toBeInTheDocument();
    
    // Check that explanation section has prominent styling (heading exists)
    expect(screen.getByText(/Recommendation Explanation/i)).toBeInTheDocument();
  });

  it('displays explanation with data sources section when explanation includes data sources', () => {
    const explanationWithSources = 'Our model suggests buying. Data sources: Sentiment from News articles (updated 5 min ago), Market data (updated 1 hour ago).';
    const rec = buildRecommendation({ explanation: explanationWithSources });
    render(<RecommendationDetailContent recommendation={rec} />);
    
    // Check that explanation is displayed
    expect(screen.getByText(/Our model suggests buying/i)).toBeInTheDocument();
    
    // Check that data sources section exists
    expect(screen.getByText(/Data Sources & Freshness/i)).toBeInTheDocument();
    
    // Check that data sources content is parsed and displayed
    const dataSourcesSection = screen.getByText(/Data Sources & Freshness/i).closest('div');
    expect(dataSourcesSection).toBeInTheDocument();
  });

  it('displays educational context section explaining quantitative reasoning', () => {
    const rec = buildRecommendation({ explanation: 'Test explanation' });
    render(<RecommendationDetailContent recommendation={rec} />);
    
    // Check for educational context section
    expect(screen.getByText(/Understanding This Recommendation/i)).toBeInTheDocument();
    expect(screen.getByText(/What does/i)).toBeInTheDocument();
    expect(screen.getByText(/Why does this matter/i)).toBeInTheDocument();
  });

  it('displays sentiment analysis results with data source attribution', () => {
    const rec = buildRecommendation({ sentiment_score: 0.23 });
    render(<RecommendationDetailContent recommendation={rec} />);

    // Find the sentiment section heading
    const sentimentHeading = screen.getAllByText(/Sentiment Analysis/i)[0];
    expect(sentimentHeading).toBeInTheDocument();
    expect(screen.getByText(/Positive/i)).toBeInTheDocument();
    expect(screen.getByText(/Data sources: News articles, web scraping/i)).toBeInTheDocument();
  });

  it('displays ML model signals with confidence score explanation', () => {
    const rec = buildRecommendation({ confidence_score: 0.85 });
    render(<RecommendationDetailContent recommendation={rec} />);

    // Find the ML signals section heading (may appear multiple times)
    const mlSignalsHeading = screen.getAllByText(/ML Model Signals/i)[0];
    expect(mlSignalsHeading).toBeInTheDocument();
    // Confidence score appears in multiple places, check for at least one
    const confidenceScores = screen.getAllByText('85%');
    expect(confidenceScores.length).toBeGreaterThan(0);
    expect(screen.getByText(/Based on historical model performance/i)).toBeInTheDocument();
  });

  it('displays risk factors with risk level indicator', () => {
    const rec = buildRecommendation({ risk_level: 'low' });
    render(<RecommendationDetailContent recommendation={rec} />);

    expect(screen.getByText(/Risk Factors/i)).toBeInTheDocument();
    expect(screen.getByText('LOW')).toBeInTheDocument();
  });

  it('displays data sources with timestamps', () => {
    const rec = buildRecommendation();
    render(<RecommendationDetailContent recommendation={rec} />);

    expect(screen.getByText(/Data Sources & Transparency/i)).toBeInTheDocument();
    expect(screen.getByText(/Recommendation Generated:/i)).toBeInTheDocument();
    expect(screen.getByText(/Sentiment Data:/i)).toBeInTheDocument();
    expect(screen.getByText(/Market Data:/i)).toBeInTheDocument();
  });

  it('displays confidence score with R² explanation', () => {
    const rec = buildRecommendation({ confidence_score: 0.85 });
    render(<RecommendationDetailContent recommendation={rec} />);

    // Confidence Score label appears in the metrics grid
    expect(screen.getByText(/Confidence Score/i)).toBeInTheDocument();
    // 85% appears multiple times, check for at least one
    const confidenceScores = screen.getAllByText('85%');
    expect(confidenceScores.length).toBeGreaterThan(0);
    expect(screen.getByText(/Based on model R² performance/i)).toBeInTheDocument();
  });

  it('adds educational context sections explaining what signals mean', () => {
    const rec = buildRecommendation({ signal: 'buy' });
    render(<RecommendationDetailContent recommendation={rec} />);

    expect(screen.getByText(/Understanding This Recommendation/i)).toBeInTheDocument();
    expect(screen.getByText(/What does "BUY" mean\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Why does this matter\?/i)).toBeInTheDocument();
  });

  it('handles null sentiment score gracefully', () => {
    const rec = buildRecommendation({ sentiment_score: null });
    render(<RecommendationDetailContent recommendation={rec} />);

    // Neutral may appear multiple times, check for at least one
    const neutralTexts = screen.getAllByText(/Neutral/i);
    expect(neutralTexts.length).toBeGreaterThan(0);
    // Sentiment section should still be visible
    expect(screen.getAllByText(/Sentiment Analysis/i).length).toBeGreaterThan(0);
  });

  it('handles missing optional stock fields', () => {
    const rec = buildRecommendation({
      stock: {
        id: 'stock-1',
        symbol: 'AAPL',
        company_name: 'Apple Inc.',
        sector: null,
        fortune_500_rank: null,
      },
    });
    render(<RecommendationDetailContent recommendation={rec} />);

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    // Should not crash when sector/fortune_500_rank are null
  });
});

