import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface InlineHelpProps {
  title?: string;
  content: string | React.ReactNode;
  trigger?: React.ReactNode;
}

/**
 * InlineHelp component provides contextual help sections
 * - Displays help icon button that opens a help panel
 * - Content can be string or React node for rich formatting
 * - Styled consistently with tooltip components
 */
export default function InlineHelp({
  title = 'Help',
  content,
  trigger,
}: InlineHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  const defaultTrigger = (
    <Button
      variant="ghost"
      size="icon"
      className="text-gray-400 hover:text-financial-blue"
      aria-label="Show help"
    >
      <HelpCircle className="h-5 w-5" />
    </Button>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-96 bg-black border-financial-blue text-white p-6"
        role="dialog"
        aria-label="Help information"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white h-6 w-6"
            aria-label="Close help"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm leading-relaxed text-gray-200 space-y-3">
          {typeof content === 'string' ? (
            <p>{content}</p>
          ) : (
            content
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Help content for Dashboard features
 */
export const dashboardHelpContent = {
  filtering: `Filter recommendations by signal (Buy/Sell/Hold), risk level, or sentiment. Use the filter controls above the recommendation list to narrow down results.`,
  sorting: `Sort recommendations by date (newest first), confidence score (highest first), or risk level. Click the sort dropdown to change the order.`,
  recommendationMetrics: `Each recommendation shows:
- Confidence Score: How reliable the recommendation is (0-100%)
- Risk Level: Potential volatility (Low/Medium/High)
- Sentiment: Market sentiment analysis (Positive/Neutral/Negative)
- Signal: The recommendation action (Buy/Sell/Hold)`,
  tierLimits: `Your tier status determines how many recommendations you can view per day. Free tier: 5 recommendations/day. Premium tier: Unlimited recommendations.`,
};

