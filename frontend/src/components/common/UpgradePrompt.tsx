import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface UpgradePromptProps {
  stockLimit: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

/**
 * UpgradePrompt component displayed when free tier limit is reached
 * Shows message about limit and provides upgrade button (navigation only, no payment)
 * Uses shadcn/ui Dialog component for modal display
 */
export default function UpgradePrompt({
  stockLimit,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: UpgradePromptProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange || (() => {}) : setInternalOpen;

  const premiumFeatures = [
    'Unlimited stock tracking',
    'Advanced analytics and insights',
    'Priority recommendation generation',
    'Historical data visualization',
    'Custom portfolio tracking',
  ];

  const dialogContent = (
    <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold text-financial-green">
          Upgrade to Premium
        </DialogTitle>
        <DialogDescription className="text-gray-300 pt-2">
          You've reached your free tier limit ({stockLimit} stocks). Upgrade to premium for unlimited access and advanced features.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <h4 className="font-semibold text-white mb-3">Premium Features:</h4>
        <ul className="space-y-2">
          {premiumFeatures.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-gray-300">
              <span className="text-financial-green mt-1">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button
          asChild
          className="bg-financial-green hover:bg-financial-green/80 text-white w-full sm:w-auto"
        >
          <Link to="/upgrade" onClick={() => setOpen(false)}>
            Upgrade to Premium
          </Link>
        </Button>
        <Button
          variant="outline"
          onClick={() => setOpen(false)}
          className="border-gray-700 text-gray-300 hover:bg-gray-800 w-full sm:w-auto"
        >
          Maybe Later
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger}
        {dialogContent}
      </Dialog>
    );
  }

  // If no trigger, render as controlled dialog
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {dialogContent}
    </Dialog>
  );
}

