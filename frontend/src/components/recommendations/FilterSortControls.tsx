import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { GetRecommendationsParams } from '@/services/recommendations';

interface FilterSortControlsProps {
  filters: GetRecommendationsParams;
  onFiltersChange: (filters: GetRecommendationsParams) => void;
}

/**
 * FilterSortControls component provides filtering and sorting controls for recommendations
 */
export default function FilterSortControls({ filters, onFiltersChange }: FilterSortControlsProps) {
  const [localFilters, setLocalFilters] = useState<GetRecommendationsParams>(filters);

  // Update local state when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = (key: keyof GetRecommendationsParams, value: string | number | undefined) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters: GetRecommendationsParams = {};
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = 
    localFilters.holding_period || 
    localFilters.risk_level || 
    localFilters.confidence_min !== undefined ||
    localFilters.sort_by !== 'date' ||
    localFilters.sort_direction !== 'desc';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:items-end">
        {/* Holding Period Filter */}
        <div className="flex-1 w-full sm:min-w-[150px]">
          <label className="block text-sm text-gray-400 mb-2">Holding Period</label>
          <Select
            value={localFilters.holding_period || 'all'}
            onValueChange={(value) => handleFilterChange('holding_period', value === 'all' ? undefined : value)}
          >
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white min-h-[44px] text-base">
              <SelectValue placeholder="All periods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All periods</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Risk Level Filter */}
        <div className="flex-1 w-full sm:min-w-[150px]">
          <label className="block text-sm text-gray-400 mb-2">Risk Level</label>
          <Select
            value={localFilters.risk_level || 'all'}
            onValueChange={(value) => handleFilterChange('risk_level', value === 'all' ? undefined : value)}
          >
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white min-h-[44px] text-base">
              <SelectValue placeholder="All levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Confidence Threshold */}
        <div className="flex-1 w-full sm:min-w-[150px]">
          <label className="block text-sm text-gray-400 mb-2">Min Confidence</label>
          <Input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={localFilters.confidence_min ?? ''}
            onChange={(e) => {
              const value = e.target.value ? parseFloat(e.target.value) : undefined;
              handleFilterChange('confidence_min', value);
            }}
            placeholder="0.0 - 1.0"
            className="bg-gray-900 border-gray-800 text-white min-h-[44px] text-base"
          />
        </div>

        {/* Sort By */}
        <div className="flex-1 w-full sm:min-w-[150px]">
          <label className="block text-sm text-gray-400 mb-2">Sort By</label>
          <Select
            value={localFilters.sort_by || 'date'}
            onValueChange={(value) => {
              const sortBy = value as 'date' | 'confidence' | 'risk' | 'sentiment';
              handleFilterChange('sort_by', sortBy);
            }}
          >
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white min-h-[44px] text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="confidence">Confidence</SelectItem>
              <SelectItem value="risk">Risk</SelectItem>
              <SelectItem value="sentiment">Sentiment</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort Direction */}
        <div className="flex-1 w-full sm:min-w-[120px]">
          <label className="block text-sm text-gray-400 mb-2">Direction</label>
          <Select
            value={localFilters.sort_direction || 'desc'}
            onValueChange={(value) => {
              const sortDirection = value as 'asc' | 'desc';
              handleFilterChange('sort_direction', sortDirection);
            }}
          >
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white min-h-[44px] text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Descending</SelectItem>
              <SelectItem value="asc">Ascending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={clearFilters}
            className="bg-gray-900 border-gray-800 text-white hover:bg-gray-800 w-full sm:w-auto min-h-[44px] text-base"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-400">Active filters:</span>
          {localFilters.holding_period && (
            <Badge variant="secondary" className="bg-financial-blue text-white">
              Period: {localFilters.holding_period}
            </Badge>
          )}
          {localFilters.risk_level && (
            <Badge variant="secondary" className="bg-financial-blue text-white">
              Risk: {localFilters.risk_level}
            </Badge>
          )}
          {localFilters.confidence_min !== undefined && (
            <Badge variant="secondary" className="bg-financial-blue text-white">
              Confidence ≥ {localFilters.confidence_min}
            </Badge>
          )}
          <Badge variant="secondary" className="bg-financial-blue text-white">
            Sort: {localFilters.sort_by || 'date'} ({localFilters.sort_direction || 'desc'})
          </Badge>
        </div>
      )}
    </div>
  );
}

