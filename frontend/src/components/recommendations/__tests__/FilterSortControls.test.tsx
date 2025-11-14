import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import FilterSortControls from '../FilterSortControls';
import type { GetRecommendationsParams } from '@/services/recommendations';

describe('FilterSortControls', () => {
  const defaultFilters: GetRecommendationsParams = {
    sort_by: 'date',
    sort_direction: 'desc',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders all filter controls correctly', () => {
      render(
        <FilterSortControls filters={defaultFilters} onFiltersChange={vi.fn()} />
      );

      expect(screen.getByText('Holding Period')).toBeInTheDocument();
      expect(screen.getByText('Risk Level')).toBeInTheDocument();
      expect(screen.getByText('Min Confidence')).toBeInTheDocument();
      expect(screen.getByText('Sort By')).toBeInTheDocument();
      expect(screen.getByText('Direction')).toBeInTheDocument();
    });

    it('does not show clear filters button when no active filters', () => {
      render(
        <FilterSortControls filters={defaultFilters} onFiltersChange={vi.fn()} />
      );

      expect(screen.queryByText('Clear Filters')).not.toBeInTheDocument();
      expect(screen.queryByText('Active filters:')).not.toBeInTheDocument();
    });

    it('shows active filter badges when filters are applied', () => {
      const filters: GetRecommendationsParams = {
        holding_period: 'weekly',
        risk_level: 'medium',
        confidence_min: 0.7,
        sort_by: 'confidence',
        sort_direction: 'asc',
      };

      render(
        <FilterSortControls filters={filters} onFiltersChange={vi.fn()} />
      );

      expect(screen.getByText('Active filters:')).toBeInTheDocument();
      expect(screen.getByText('Period: weekly')).toBeInTheDocument();
      expect(screen.getByText('Risk: medium')).toBeInTheDocument();
      expect(screen.getByText('Confidence ≥ 0.7')).toBeInTheDocument();
      expect(screen.getByText(/Sort: confidence \(asc\)/i)).toBeInTheDocument();
    });
  });

  describe('Filter State Management', () => {
    it('applies holding period filter', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();

      render(
        <FilterSortControls filters={defaultFilters} onFiltersChange={onFiltersChange} />
      );

      // Find the holding period select by finding the label and then the adjacent combobox
      const holdingPeriodLabel = screen.getByText('Holding Period');
      const holdingPeriodSelect = holdingPeriodLabel.parentElement?.querySelector('button[role="combobox"]');
      expect(holdingPeriodSelect).toBeInTheDocument();
      await user.click(holdingPeriodSelect!);
      await user.click(screen.getByText('Weekly'));

      expect(onFiltersChange).toHaveBeenCalled();
      const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0];
      expect(lastCall.holding_period).toBe('weekly');
    });

    it('applies risk level filter', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();

      render(
        <FilterSortControls filters={defaultFilters} onFiltersChange={onFiltersChange} />
      );

      const riskLevelLabel = screen.getByText('Risk Level');
      const riskLevelSelect = riskLevelLabel.parentElement?.querySelector('button[role="combobox"]');
      expect(riskLevelSelect).toBeInTheDocument();
      await user.click(riskLevelSelect!);
      await user.click(screen.getByText('Low'));

      expect(onFiltersChange).toHaveBeenCalled();
      const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0];
      expect(lastCall.risk_level).toBe('low');
    });

    it('applies confidence threshold filter', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();

      render(
        <FilterSortControls filters={defaultFilters} onFiltersChange={onFiltersChange} />
      );

      const confidenceInput = screen.getByPlaceholderText('0.0 - 1.0');
      await user.clear(confidenceInput);
      await user.type(confidenceInput, '0.8');

      expect(onFiltersChange).toHaveBeenCalled();
      const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0];
      expect(lastCall.confidence_min).toBeCloseTo(0.8);
    });

    it('supports combined filtering (multiple filters)', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();

      render(
        <FilterSortControls filters={defaultFilters} onFiltersChange={onFiltersChange} />
      );

      // Apply holding period
      const holdingPeriodLabel = screen.getByText('Holding Period');
      const holdingPeriodSelect = holdingPeriodLabel.parentElement?.querySelector('button[role="combobox"]');
      await user.click(holdingPeriodSelect!);
      await user.click(screen.getByText('Daily'));

      // Apply risk level
      const riskLevelLabel = screen.getByText('Risk Level');
      const riskLevelSelect = riskLevelLabel.parentElement?.querySelector('button[role="combobox"]');
      await user.click(riskLevelSelect!);
      await user.click(screen.getByText('High'));

      // Apply confidence
      const confidenceInput = screen.getByPlaceholderText('0.0 - 1.0');
      await user.clear(confidenceInput);
      await user.type(confidenceInput, '0.75');

      // Verify all filters are applied together
      const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0];
      expect(lastCall.holding_period).toBe('daily');
      expect(lastCall.risk_level).toBe('high');
      expect(lastCall.confidence_min).toBeCloseTo(0.75);
    });

    it('clears all filters when clear button is clicked', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();
      const filters: GetRecommendationsParams = {
        holding_period: 'weekly',
        risk_level: 'medium',
        confidence_min: 0.7,
        sort_by: 'confidence',
        sort_direction: 'asc',
      };

      render(
        <FilterSortControls filters={filters} onFiltersChange={onFiltersChange} />
      );

      const clearButton = screen.getByText('Clear Filters');
      await user.click(clearButton);

      expect(onFiltersChange).toHaveBeenCalled();
      const clearedFilters = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0];
      expect(clearedFilters.holding_period).toBeUndefined();
      expect(clearedFilters.risk_level).toBeUndefined();
      expect(clearedFilters.confidence_min).toBeUndefined();
      expect(clearedFilters.sort_by).toBeUndefined();
      expect(clearedFilters.sort_direction).toBeUndefined();
    });
  });

  describe('Sort State Management', () => {
    it('changes sort field', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();

      render(
        <FilterSortControls filters={defaultFilters} onFiltersChange={onFiltersChange} />
      );

      const sortByLabel = screen.getByText('Sort By');
      const sortBySelect = sortByLabel.parentElement?.querySelector('button[role="combobox"]');
      await user.click(sortBySelect!);
      await user.click(screen.getByText('Confidence'));

      expect(onFiltersChange).toHaveBeenCalled();
      const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0];
      expect(lastCall.sort_by).toBe('confidence');
    });

    it('toggles sort direction', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();

      render(
        <FilterSortControls filters={defaultFilters} onFiltersChange={onFiltersChange} />
      );

      const directionLabel = screen.getByText('Direction');
      const directionSelect = directionLabel.parentElement?.querySelector('button[role="combobox"]');
      await user.click(directionSelect!);
      await user.click(screen.getByText('Ascending'));

      expect(onFiltersChange).toHaveBeenCalled();
      const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0];
      expect(lastCall.sort_direction).toBe('asc');
    });

    it('supports all sort fields (date, confidence, risk, sentiment)', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();

      render(
        <FilterSortControls filters={defaultFilters} onFiltersChange={onFiltersChange} />
      );

      const sortByLabel = screen.getByText('Sort By');
      const sortBySelect = sortByLabel.parentElement?.querySelector('button[role="combobox"]');
      
      const sortFields = ['date', 'confidence', 'risk', 'sentiment'];
      for (const field of sortFields) {
        await user.click(sortBySelect!);
        await user.click(screen.getByText(field.charAt(0).toUpperCase() + field.slice(1)));
        
        const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0];
        expect(lastCall.sort_by).toBe(field);
      }
    });
  });

  describe('Active Filter Indicators', () => {
    it('displays badges for all active filters', () => {
      const filters: GetRecommendationsParams = {
        holding_period: 'monthly',
        risk_level: 'low',
        confidence_min: 0.9,
        sort_by: 'sentiment',
        sort_direction: 'desc',
      };

      render(
        <FilterSortControls filters={filters} onFiltersChange={vi.fn()} />
      );

      expect(screen.getByText('Period: monthly')).toBeInTheDocument();
      expect(screen.getByText('Risk: low')).toBeInTheDocument();
      expect(screen.getByText('Confidence ≥ 0.9')).toBeInTheDocument();
      expect(screen.getByText(/Sort: sentiment \(desc\)/i)).toBeInTheDocument();
    });

    it('updates badges when filters change', () => {
      const { rerender } = render(
        <FilterSortControls filters={defaultFilters} onFiltersChange={vi.fn()} />
      );

      expect(screen.queryByText('Period: weekly')).not.toBeInTheDocument();

      rerender(
        <FilterSortControls
          filters={{ ...defaultFilters, holding_period: 'weekly' }}
          onFiltersChange={vi.fn()}
        />
      );

      expect(screen.getByText('Period: weekly')).toBeInTheDocument();
    });
  });
});


