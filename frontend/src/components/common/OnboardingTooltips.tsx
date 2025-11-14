import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Info, X } from 'lucide-react';

const ONBOARDING_STORAGE_KEY = 'onboarding_complete';

interface OnboardingStep {
  id: string;
  title: string;
  content: string;
  targetSelector?: string; // CSS selector for element to highlight
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'recommendation-list',
    title: 'Welcome to Your Dashboard',
    content: 'This is your recommendation list. Here you\'ll see AI-powered stock recommendations based on market analysis, sentiment, and ML model predictions.',
  },
  {
    id: 'confidence-score',
    title: 'Confidence Score',
    content: 'The confidence score (0-100%) shows how reliable each recommendation is. Higher scores mean the model has been more accurate in similar market conditions. Hover over the info icon to learn more.',
  },
  {
    id: 'filter-sort',
    title: 'Filter & Sort Controls',
    content: 'Use these controls to filter recommendations by signal (Buy/Sell/Hold), risk level, or sentiment. You can also sort by date, confidence, or risk level.',
  },
  {
    id: 'tier-status',
    title: 'Tier Status',
    content: 'Your tier determines how many recommendations you can view per day. Free tier: 5/day. Premium tier: Unlimited. Click to learn more about upgrading.',
  },
];

interface OnboardingTooltipsProps {
  onComplete?: () => void;
}

/**
 * OnboardingTooltips component displays sequential tooltips for first-time users
 * - Tracks completion in localStorage
 * - Shows one tooltip at a time
 * - Allows skip or next/complete
 * - Non-intrusive design
 */
export default function OnboardingTooltips({ onComplete }: OnboardingTooltipsProps) {
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if onboarding is already complete
    const isComplete = localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
    
    if (!isComplete) {
      // Start onboarding sequence
      setCurrentStep(0);
      setIsOpen(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep === null) return;
    
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setIsOpen(false);
    setCurrentStep(null);
    onComplete?.();
  };

  if (currentStep === null || !isOpen) {
    return null;
  }

  const step = onboardingSteps[currentStep];
  const isLastStep = currentStep === onboardingSteps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-black border-2 border-financial-blue rounded-lg p-6 max-w-md w-full mx-4 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Info className="h-5 w-5 text-financial-blue" />
            {step.title}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSkip}
            className="text-gray-400 hover:text-white h-6 w-6"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-gray-300 mb-6 leading-relaxed">
          {step.content}
        </p>
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-gray-400 hover:text-white"
          >
            Skip Tour
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {currentStep + 1} of {onboardingSteps.length}
            </span>
            <Button
              onClick={handleNext}
              className="bg-financial-blue hover:bg-financial-green text-white"
            >
              {isLastStep ? 'Get Started' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if onboarding is complete
 */
export function useOnboardingComplete(): boolean {
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setIsComplete(localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true');
  }, []);

  return isComplete;
}

/**
 * Function to reset onboarding (for testing or admin use)
 */
export function resetOnboarding(): void {
  localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}

