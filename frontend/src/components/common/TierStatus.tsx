import { Badge } from '@/components/ui/badge';
import { useTier } from '@/hooks/useTier';

/**
 * TierStatus component displays the user's tier and stock tracking status
 */
export default function TierStatus() {
  const { stockCount, stockLimit, isPremium, isLoading } = useTier();

  if (isLoading) {
    return (
      <div className="text-sm text-gray-400">
        Loading tier status...
      </div>
    );
  }

  if (isPremium) {
    return (
      <Badge className="bg-financial-green text-white">
        Premium - Unlimited
      </Badge>
    );
  }

  return (
    <Badge className="bg-financial-blue text-white">
      Tracking {stockCount}/{stockLimit ?? 5} stocks (Free tier)
    </Badge>
  );
}

