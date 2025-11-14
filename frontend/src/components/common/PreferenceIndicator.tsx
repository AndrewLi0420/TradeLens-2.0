import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { getPreferences } from '@/services/userPreferences';
import type { UserPreferences } from '@/types/user';

const PREFERENCES_QUERY_KEY = ['preferences', 'current-user'];

/**
 * PreferenceIndicator component displays the user's active preference filters
 * Shows holding period and risk tolerance preferences that affect recommendation display
 */
export default function PreferenceIndicator() {
  const { data: preferences, isLoading } = useQuery<UserPreferences | null>({
    queryKey: PREFERENCES_QUERY_KEY,
    queryFn: getPreferences,
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return null; // Don't show anything while loading
  }

  if (!preferences) {
    return null; // Don't show indicator if preferences not set
  }

  const holdingPeriodLabel = preferences.holding_period.charAt(0).toUpperCase() + preferences.holding_period.slice(1);
  const riskToleranceLabel = preferences.risk_tolerance.charAt(0).toUpperCase() + preferences.risk_tolerance.slice(1);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge className="bg-financial-blue text-white">
        Showing {holdingPeriodLabel} recommendations
      </Badge>
      <Badge className="bg-financial-green text-white">
        Prioritizing {riskToleranceLabel} risk
      </Badge>
    </div>
  );
}

