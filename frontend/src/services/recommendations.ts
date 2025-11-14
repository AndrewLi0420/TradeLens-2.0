import apiClient from './api';

export interface Stock {
  id: string;
  symbol: string;
  company_name: string;
  sector?: string | null;
  fortune_500_rank?: number | null;
}

export interface StockSearch extends Stock {
  has_recommendation: boolean;
}

export interface Recommendation {
  id: string;
  user_id: string;
  stock_id: string;
  stock: Stock;
  signal: 'buy' | 'sell' | 'hold';
  confidence_score: number;
  sentiment_score: number | null;
  risk_level: 'low' | 'medium' | 'high';
  explanation: string | null;
  created_at: string;
}

export interface RecommendationFilters {
  holding_period?: 'daily' | 'weekly' | 'monthly';
  risk_level?: 'low' | 'medium' | 'high';
  confidence_min?: number;
}

export interface RecommendationSort {
  sort_by?: 'date' | 'confidence' | 'risk' | 'sentiment';
  sort_direction?: 'asc' | 'desc';
}

export interface GetRecommendationsParams extends RecommendationFilters, RecommendationSort {}

/**
 * Get recommendations for the current user
 * @param params - Query parameters for filtering and sorting
 * @returns Array of recommendation objects
 */
export async function getRecommendations(
  params?: GetRecommendationsParams
): Promise<Recommendation[]> {
  const queryParams = new URLSearchParams();
  
  if (params?.holding_period) {
    queryParams.append('holding_period', params.holding_period);
  }
  if (params?.risk_level) {
    queryParams.append('risk_level', params.risk_level);
  }
  if (params?.confidence_min !== undefined) {
    queryParams.append('confidence_min', params.confidence_min.toString());
  }
  if (params?.sort_by) {
    queryParams.append('sort_by', params.sort_by);
  }
  if (params?.sort_direction) {
    queryParams.append('sort_direction', params.sort_direction);
  }
  
  const queryString = queryParams.toString();
  const url = `/api/v1/recommendations${queryString ? `?${queryString}` : ''}`;
  
  const response = await apiClient.get<Recommendation[]>(url);
  return response.data;
}

/**
 * Get a single recommendation by ID
 * @param id - Recommendation UUID
 * @returns Recommendation object with full details
 */
export async function getRecommendationDetail(id: string): Promise<Recommendation> {
  const response = await apiClient.get<Recommendation>(`/api/v1/recommendations/${id}`);
  return response.data;
}

/**
 * Search stocks by symbol or company name
 * @param query - Search query (min 2 characters)
 * @returns Array of stock search results with recommendation status
 */
export async function searchStocks(query: string): Promise<StockSearch[]> {
  if (query.length < 2) {
    return [];
  }
  const response = await apiClient.get<StockSearch[]>(`/api/v1/stocks/search?q=${encodeURIComponent(query)}`);
  return response.data;
}

/**
 * Get a single stock by ID
 * @param id - Stock UUID
 * @returns Stock object with recommendation status
 */
export async function getStockById(id: string): Promise<StockSearch> {
  const response = await apiClient.get<StockSearch>(`/api/v1/stocks/${id}`);
  return response.data;
}

/**
 * Generate recommendations for the current user
 * @param userId - User UUID
 * @param count - Number of recommendations to generate (default: 10)
 * @returns Object with count of recommendations created and optional message
 */
export async function generateRecommendations(
  userId: string,
  count: number = 10
): Promise<{ created: number; message?: string }> {
  const response = await apiClient.post<{ created: number; message?: string }>(
    `/api/v1/recommendations/generate?user_id=${userId}&count=${count}`
  );
  return response.data;
}

