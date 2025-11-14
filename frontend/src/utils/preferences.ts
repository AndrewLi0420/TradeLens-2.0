import type { UserPreferences } from '../types/user';
import type { GetRecommendationsParams } from '../services/recommendations';

/**
 * Merges user preferences with explicit query parameters.
 * Explicit parameters take precedence over user preferences.
 * 
 * @param preferences - User preferences (holding_period, risk_tolerance)
 * @param params - Explicit query parameters (optional)
 * @returns Merged parameters with explicit params overriding preferences
 */
export function mergePreferencesWithParams(
  preferences: UserPreferences | null | undefined,
  params?: GetRecommendationsParams
): GetRecommendationsParams | undefined {
  if (!preferences && !params) {
    return undefined; // No preferences and no params - backend will return defaults
  }
  
  if (!preferences) {
    return params; // No preferences, use explicit params only
  }
  
  if (!params) {
    // Use preferences as defaults
    return {
      holding_period: preferences.holding_period,
      risk_level: preferences.risk_tolerance,
    };
  }
  
  // Merge: explicit params override preferences
  return {
    holding_period: params.holding_period ?? preferences.holding_period,
    risk_level: params.risk_level ?? preferences.risk_tolerance,
    confidence_min: params.confidence_min,
    sort_by: params.sort_by,
    sort_direction: params.sort_direction,
  };
}

