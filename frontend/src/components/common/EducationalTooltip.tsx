import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Info } from 'lucide-react';

interface EducationalTooltipProps {
  trigger: React.ReactNode;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * EducationalTooltip component displays educational information in a tooltip
 * - Uses shadcn/ui Popover component
 * - Displays on hover (desktop) or click (mobile)
 * - Styled with black background and financial blue/green accents
 * - Explains concepts in simple, non-technical language
 */
export default function EducationalTooltip({
  trigger,
  content,
  placement = 'top',
}: EducationalTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Handle hover for desktop, click for mobile
  const handleMouseEnter = () => {
    if (window.innerWidth >= 768) {
      // Desktop: show on hover
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (window.innerWidth >= 768) {
      // Desktop: hide on leave
      setIsOpen(false);
    }
  };

  const handleClick = () => {
    // Mobile: toggle on click
    if (window.innerWidth < 768) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        asChild
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="inline-flex items-center"
        aria-label="Show more information"
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        side={placement}
        className="w-80 bg-black border-financial-blue text-white p-4"
        role="tooltip"
        aria-live="polite"
      >
        <div className="text-sm leading-relaxed">{content}</div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Pre-defined tooltip content for common financial concepts
 * Each entry follows the structure: title (implicit in first sentence), explanation, and optional calculation details
 */
export const tooltipContent = {
  confidenceScore: `Confidence score (0.0-1.0) indicates how reliable this recommendation is, based on the ML model's R² performance. Higher scores mean the model has been more accurate for similar market conditions.`,
  rSquared: `R² (R-squared) measures how well the ML model explains price movements. Values closer to 1.0 indicate higher model accuracy. This recommendation's confidence is based on R² = 0.85.`,
  sentimentAnalysis: `Sentiment analysis aggregates social media and news sources to gauge market sentiment. Positive sentiment suggests bullish trends, while negative sentiment may indicate bearish signals.`,
  mlModelSignals: `Machine learning signals are patterns the AI model has learned from historical data. These signals help predict future price movements by identifying similar patterns from the past.`,
  riskLevel: `Risk level assesses the potential volatility and downside risk of this recommendation. Calculated from historical price volatility, market conditions, and model confidence. Low risk means more stable, high risk means more volatile.`,
};

/**
 * Helper component for displaying an info icon with educational tooltip
 */
export function InfoTooltip({ content, placement }: { content: string; placement?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <EducationalTooltip
      trigger={
        <button
          type="button"
          className="inline-flex items-center justify-center text-financial-blue hover:text-financial-green transition-colors min-w-[44px] min-h-[44px] p-2"
          aria-label="More information"
        >
          <Info className="h-4 w-4" />
        </button>
      }
      content={content}
      placement={placement}
    />
  );
}

