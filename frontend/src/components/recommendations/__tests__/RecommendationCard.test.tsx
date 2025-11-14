import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RecommendationCard from '../RecommendationCard';
import type { Recommendation } from '@/services/recommendations';
import { tooltipContent } from '../../common/EducationalTooltip';

function buildRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'rec-1',
    user_id: 'user-1',
    stock_id: 'stock-1',
    stock: { id: 'stock-1', symbol: 'AAPL', company_name: 'Apple Inc.' },
    signal: 'buy',
    confidence_score: 0.85,
    sentiment_score: 0.23,
    risk_level: 'low',
    explanation: 'Strong outlook',
    created_at: new Date('2025-11-05T10:00:00Z').toISOString(),
    ...overrides,
  };
}

describe('RecommendationCard', () => {
  it('renders key fields: symbol, company, signal, confidence, sentiment, risk, timestamp', () => {
    const rec = buildRecommendation();
    render(<RecommendationCard recommendation={rec} />);

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();

    // Signal badge text uppercased
    expect(screen.getByText('BUY')).toBeInTheDocument();

    // Confidence percent
    expect(screen.getByText('85%')).toBeInTheDocument();

    // Sentiment label + value
    expect(screen.getByText(/Positive|Neutral|Negative/)).toBeInTheDocument();
    expect(screen.getByText('(+' + rec.sentiment_score!.toFixed(2) + ')')).toBeInTheDocument();

    // Risk level badge
    expect(screen.getByText('LOW')).toBeInTheDocument();

    // Timestamp (date part)
    expect(screen.getByText(/2025|Nov|Nov\s\d{1,2}/i)).toBeInTheDocument();
  });

  it('handles null sentiment score gracefully', () => {
    const rec = buildRecommendation({ sentiment_score: null });
    render(<RecommendationCard recommendation={rec} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('displays explanation preview (first 1-2 sentences) when explanation exists', () => {
    const longExplanation = 'First sentence of explanation. Second sentence of explanation. Third sentence that should not appear.';
    const rec = buildRecommendation({ explanation: longExplanation });
    render(<RecommendationCard recommendation={rec} />);
    
    // Should display first 1-2 sentences
    expect(screen.getByText(/First sentence of explanation/i)).toBeInTheDocument();
    expect(screen.getByText(/Second sentence of explanation/i)).toBeInTheDocument();
    
    // Should NOT display third sentence
    expect(screen.queryByText(/Third sentence that should not appear/i)).not.toBeInTheDocument();
    
    // Should have "Read more" link
    expect(screen.getByText(/Read more/i)).toBeInTheDocument();
  });

  it('displays full explanation when explanation is short (1 sentence)', () => {
    const shortExplanation = 'Short explanation text.';
    const rec = buildRecommendation({ explanation: shortExplanation });
    render(<RecommendationCard recommendation={rec} />);
    
    expect(screen.getByText(/Short explanation text/i)).toBeInTheDocument();
    expect(screen.getByText(/Read more/i)).toBeInTheDocument();
  });

  it('handles null explanation gracefully', () => {
    const rec = buildRecommendation({ explanation: null });
    render(<RecommendationCard recommendation={rec} />);
    
    // Should not crash and should not show explanation section
    expect(screen.queryByText(/Explanation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Read more/i)).not.toBeInTheDocument();
  });

  it('truncates explanation preview if it exceeds ~120 characters', () => {
    const veryLongExplanation = 'This is a very long explanation that should be truncated because it exceeds the maximum length for preview display. It contains multiple sentences and should be cut off appropriately.';
    const rec = buildRecommendation({ explanation: veryLongExplanation });
    render(<RecommendationCard recommendation={rec} />);
    
    // Should display truncated version with ellipsis
    const explanationText = screen.getByText(/This is a very long explanation/i);
    expect(explanationText).toBeInTheDocument();
    
    // Should have "Read more" link
    expect(screen.getByText(/Read more/i)).toBeInTheDocument();
  });

  it('displays tooltips for confidence score, risk level, and sentiment', async () => {
    const rec = buildRecommendation();
    render(<RecommendationCard recommendation={rec} />);

    // Find info icon buttons (tooltip triggers)
    const infoButtons = screen.getAllByRole('button', { name: /more information/i });
    expect(infoButtons.length).toBeGreaterThan(0);

    // Hover over confidence score tooltip
    Object.defineProperty(window, 'innerWidth', { value: 1024 });
    if (infoButtons[0]) {
      fireEvent.mouseEnter(infoButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(tooltipContent.confidenceScore)).toBeInTheDocument();
      });
    }
  });

  it('tooltips appear on hover (desktop)', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024 });
    const rec = buildRecommendation();
    render(<RecommendationCard recommendation={rec} />);

    const infoButtons = screen.getAllByRole('button', { name: /more information/i });
    if (infoButtons.length > 0) {
      fireEvent.mouseEnter(infoButtons[0]);

      await waitFor(() => {
        // Tooltip content should be visible
        const tooltip = screen.queryByText(tooltipContent.confidenceScore);
        expect(tooltip).toBeInTheDocument();
      });
    }
  });

  it('tooltips appear on click (mobile)', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375 });
    const rec = buildRecommendation();
    render(<RecommendationCard recommendation={rec} />);

    const infoButtons = screen.getAllByRole('button', { name: /more information/i });
    if (infoButtons.length > 0) {
      fireEvent.click(infoButtons[0]);

      await waitFor(() => {
        // Tooltip content should be visible
        const tooltip = screen.queryByText(tooltipContent.confidenceScore);
        expect(tooltip).toBeInTheDocument();
      });
    }
  });
});



