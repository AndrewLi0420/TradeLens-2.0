# Epic Technical Specification: Recommendations & Dashboard

Date: 2025-11-05
Author: Andrew
Epic ID: 3
Status: Draft

---

## Overview

Epic 3 creates the user-facing recommendation dashboard, search functionality, and educational content that enables users to discover, understand, and act on OpenAlpha's ML-powered recommendations, as outlined in the PRD (FR015-FR020, FR026-FR027). This epic delivers the core user experience where users interact with quantitative trading intelligence, transforming backend-generated recommendations into actionable insights. Per the PRD goals, this epic democratizes quantitative trading by providing clear explanations, transparent data sources, and efficient information access, enabling users to make informed trading decisions rather than emotional trades.

The epic delivers nine sequentially-ordered stories covering recommendation dashboard list view, detail views with explanations, stock search functionality, educational tooltips, filtering and sorting, freemium tier enforcement in UI, user preference integration, and responsive mobile optimization. This epic builds on Epic 1 (Foundation & User Authentication) for user preferences and tier enforcement, and Epic 2 (Data Pipeline & ML Engine) for recommendation data, serving as the prerequisite for Epic 4 (Historical Data & Visualization) which adds historical context and time series charts.

## Objectives and Scope

**In-Scope:**
- Recommendation dashboard displaying current recommendations in list format with key metrics (stock symbol, company name, signal, confidence score, sentiment score, risk level)
- Recommendation detail view with full explanations, transparent data sources, and educational context
- Stock search functionality using PostgreSQL full-text search (symbol and company name)
- Recommendation filtering by holding period, risk level, and confidence threshold
- Recommendation sorting by date, confidence, risk, and sentiment
- Educational tooltips and inline help explaining quantitative concepts (confidence scores, sentiment analysis, R²)
- Freemium tier enforcement in UI (5-stock limit display, upgrade prompts)
- User preference integration (holding period and risk tolerance filtering recommendations)
- Responsive mobile optimization for dashboard and detail views
- React Query integration for server state management and caching
- Axios HTTP client for API communication
- Tailwind CSS styling with black background and financial blue/green accents (per UX Design Specification)
- shadcn/ui component library integration for consistent UI components

**Out-of-Scope:**
- Historical recommendations view (deferred to Epic 4)
- Time series price charts (deferred to Epic 4)
- Payment integration for premium upgrades (UI prompts only, payment processing deferred)
- Advanced analytics or portfolio tracking
- Social features or user communities
- Native mobile apps (web-first responsive only)
- Real-time streaming updates (hourly batch updates from Epic 2)

## System Architecture Alignment

This epic aligns with the architecture document's frontend and API decisions: React 18+ with TypeScript frontend on Vercel, FastAPI backend on Render, React Query 5.x for server state management, Axios for HTTP client, and PostgreSQL FTS for search. The implementation follows the project structure patterns defined in architecture.md with `backend/app/api/v1/endpoints/recommendations.py`, `backend/app/api/v1/endpoints/search.py`, `frontend/src/pages/Dashboard.tsx`, `frontend/src/pages/RecommendationDetail.tsx`, and `frontend/src/components/recommendations/` organizational patterns.

Key architecture patterns applied: Tier-Aware Recommendation Pre-Filtering (Pattern 3) for filtering recommendations based on user tier and tracked stocks, ensuring free tier users see only recommendations for their 5 tracked stocks while premium users see all recommendations. The frontend uses React Query for efficient caching and optimistic updates, aligned with the Technology Stack Details. The UX Design Specification's shadcn/ui component library and color system (black background with financial blue/green/gold accents) are integrated for consistent visual design. Database queries leverage the `recommendations` table from Epic 2, with proper filtering by user preferences (holding period, risk tolerance) and tier limits.

## Detailed Design

### Services and Modules

| Service/Module | Responsibility | Inputs | Outputs | Owner/Component |
|---------------|---------------|--------|---------|-----------------|
| **Recommendations API Endpoint** | Retrieves user-filtered recommendations with tier enforcement | User ID, query params (holding_period, risk_level, confidence_min) | Array of recommendation objects | `backend/app/api/v1/endpoints/recommendations.py` (GET /recommendations) |
| **Recommendation Detail API Endpoint** | Retrieves single recommendation with full details | Recommendation ID, User ID | Full recommendation object with explanation | `backend/app/api/v1/endpoints/recommendations.py` (GET /recommendations/{id}) |
| **Stock Search API Endpoint** | Searches stocks using PostgreSQL FTS | Search query string | Array of matching stock objects | `backend/app/api/v1/endpoints/search.py` (GET /stocks/search) |
| **Tier-Aware Recommendation Filter** | Filters recommendations by user tier and tracked stocks | User ID, recommendations array | Filtered recommendations (free: 5 stocks max, premium: all) | `backend/app/crud/recommendations.py` (filter_by_tier) |
| **User Preference Filter** | Filters recommendations by holding period and risk tolerance | User preferences, recommendations array | Filtered recommendations matching preferences | `backend/app/crud/recommendations.py` (filter_by_preferences) |
| **Dashboard Page Component** | Displays recommendation list with filtering and sorting | User authentication state | Rendered dashboard UI | `frontend/src/pages/Dashboard.tsx` |
| **Recommendation List Component** | Renders list of recommendations with key metrics | Recommendations array, filter/sort state | Rendered recommendation list | `frontend/src/components/recommendations/RecommendationList.tsx` |
| **Recommendation Card Component** | Renders individual recommendation card | Recommendation object | Rendered recommendation card | `frontend/src/components/recommendations/RecommendationCard.tsx` |
| **Recommendation Detail Page Component** | Displays full recommendation details with explanation | Recommendation ID | Rendered detail view | `frontend/src/pages/RecommendationDetail.tsx` |
| **Stock Search Page Component** | Displays stock search interface and results | Search query | Rendered search results | `frontend/src/pages/Search.tsx` |
| **Filter and Sort Controls Component** | Provides UI controls for filtering and sorting | Filter/sort state, callback functions | Rendered filter/sort UI | `frontend/src/components/recommendations/FilterSortControls.tsx` |
| **Educational Tooltip Component** | Displays tooltips explaining quantitative concepts | Tooltip content, trigger element | Rendered tooltip (shadcn/ui Popover) | `frontend/src/components/common/EducationalTooltip.tsx` |
| **Tier Status Component** | Displays user tier status and stock limit | User tier, tracked stock count | Rendered tier status indicator | `frontend/src/components/common/TierStatus.tsx` |
| **React Query Hook (useRecommendations)** | Manages recommendation data fetching and caching | Query params, user auth | React Query query object | `frontend/src/hooks/useRecommendations.ts` |
| **React Query Hook (useStockSearch)** | Manages stock search data fetching | Search query | React Query query object | `frontend/src/hooks/useStockSearch.ts` |

### Data Models and Contracts

**Database Schema (PostgreSQL via SQLAlchemy):**

**Recommendations Table** (`recommendations`) - From Epic 2, used in Epic 3
- `id`: UUID (primary key)
- `stock_id`: UUID (foreign key → stocks.id), indexed
- `signal`: ENUM('buy', 'sell', 'hold')
- `confidence_score`: DECIMAL(3, 2) (0.0 to 1.0, based on R²)
- `sentiment_score`: DECIMAL(3, 2) (aggregated sentiment, -1.0 to 1.0)
- `risk_level`: ENUM('low', 'medium', 'high')
- `explanation`: TEXT (human-readable explanation with data sources)
- `created_at`: TIMESTAMP, indexed (for sorting/filtering)
- `updated_at`: TIMESTAMP, default now(), on update now()

**User Stock Tracking Table** (`user_stock_tracking`) - From Epic 1, used for tier enforcement
- `id`: UUID (primary key)
- `user_id`: UUID (foreign key → users.id), indexed
- `stock_id`: UUID (foreign key → stocks.id), indexed
- `created_at`: TIMESTAMP, default now()
- Unique constraint: (user_id, stock_id) to prevent duplicates

**Stocks Table** (`stocks`) - From Epic 2, used for search
- `id`: UUID (primary key)
- `symbol`: VARCHAR(10), unique, indexed
- `company_name`: VARCHAR(255), indexed (for FTS)
- `sector`: VARCHAR(100)
- `fortune_500_rank`: INTEGER

**TypeScript Types (Frontend):**

```typescript
interface Recommendation {
  id: string;
  stock: Stock;
  signal: 'buy' | 'sell' | 'hold';
  confidence_score: number; // 0.0 to 1.0
  sentiment_score: number; // -1.0 to 1.0
  risk_level: 'low' | 'medium' | 'high';
  explanation: string;
  created_at: string;
}

interface Stock {
  id: string;
  symbol: string;
  company_name: string;
  sector: string;
  fortune_500_rank: number;
}

interface UserPreferences {
  holding_period: 'daily' | 'weekly' | 'monthly';
  risk_tolerance: 'low' | 'medium' | 'high';
}

interface User {
  id: string;
  email: string;
  tier: 'free' | 'premium';
  preferences: UserPreferences;
}

interface RecommendationFilters {
  holding_period?: 'daily' | 'weekly' | 'monthly';
  risk_level?: 'low' | 'medium' | 'high';
  confidence_min?: number; // 0.0 to 1.0
}

interface RecommendationSort {
  field: 'date' | 'confidence' | 'risk' | 'sentiment';
  direction: 'asc' | 'desc';
}
```

### APIs and Interfaces

**Recommendation Endpoints:**

`GET /api/v1/recommendations`
- Headers: `Authorization: Bearer {token}` (required)
- Query Params: 
  - `holding_period` (optional): `daily` | `weekly` | `monthly`
  - `risk_level` (optional): `low` | `medium` | `high`
  - `confidence_min` (optional): number (0.0 to 1.0)
  - `sort_by` (optional): `date` | `confidence` | `risk` | `sentiment` (default: `date`)
  - `sort_direction` (optional): `asc` | `desc` (default: `desc`)
- Response 200: `[{ "id": "uuid", "stock": {...}, "signal": "buy", "confidence_score": 0.85, "sentiment_score": 0.7, "risk_level": "medium", "explanation": "...", "created_at": "2024-10-30T14:30:00Z" }]`
- Filtered by user tier (free: only tracked stocks, max 5; premium: all)
- Filtered by user preferences (holding_period, risk_tolerance) if query params not provided
- Response 401: Unauthorized if token invalid
- Response 403: Forbidden if user tier check fails

`GET /api/v1/recommendations/{id}`
- Headers: `Authorization: Bearer {token}` (required)
- Path Params: `id` (recommendation UUID)
- Response 200: Full recommendation object with detailed explanation
- Response 401: Unauthorized if token invalid
- Response 404: Recommendation not found or not accessible to user

**Stock Search Endpoints:**

`GET /api/v1/stocks/search`
- Headers: `Authorization: Bearer {token}` (required)
- Query Params: `q` (search query string, required)
- Response 200: `[{ "id": "uuid", "symbol": "AAPL", "company_name": "Apple Inc.", "sector": "Technology", "fortune_500_rank": 3 }]`
- Uses PostgreSQL full-text search on `symbol` and `company_name`
- Response 401: Unauthorized if token invalid
- Response 400: Bad Request if query param missing

**User Endpoints (from Epic 1, used in Epic 3):**

`GET /api/v1/users/me`
- Headers: `Authorization: Bearer {token}` (required)
- Response 200: `{ "id": "uuid", "email": "user@example.com", "tier": "free", "preferences": { "holding_period": "daily", "risk_tolerance": "medium" } }`
- Used to get user tier and preferences for filtering

**Frontend Components:**

`Dashboard.tsx` - Main dashboard page component
- Props: None (uses React Router)
- State: Recommendations array, filter/sort state, loading state, error state
- Actions: Fetch recommendations, apply filters/sorts, navigate to detail view
- Uses: `useRecommendations` hook, `RecommendationList`, `FilterSortControls`, `TierStatus`

`RecommendationDetail.tsx` - Recommendation detail page component
- Props: `recommendationId` (from route params)
- State: Recommendation object, loading state, error state
- Actions: Fetch recommendation details, display explanation with tooltips
- Uses: `useRecommendations` hook, `EducationalTooltip` components

`Search.tsx` - Stock search page component
- Props: None (uses React Router)
- State: Search query, search results, loading state
- Actions: Perform search, navigate to stock/recommendation detail
- Uses: `useStockSearch` hook

### Workflows and Sequencing

**Dashboard Load Workflow:**
1. User navigates to `/dashboard` (protected route, requires authentication)
2. Frontend `Dashboard.tsx` component mounts
3. `useAuth` hook checks authentication state
4. If authenticated, `useRecommendations` hook fetches recommendations:
   - GET `/api/v1/users/me` to get user tier and preferences
   - GET `/api/v1/recommendations` with user preferences as default filters
5. Backend filters recommendations:
   - If free tier: Filter by `user_stock_tracking` table (max 5 stocks)
   - If premium: Return all recommendations
   - Apply user preference filters (holding_period, risk_tolerance)
   - Apply query param filters if provided
6. Backend sorts recommendations by `sort_by` and `sort_direction` (default: date desc)
7. Frontend receives recommendations array
8. React Query caches response
9. `RecommendationList` component renders recommendations
10. User sees dashboard with current recommendations

**Recommendation Detail View Workflow:**
1. User clicks on recommendation card in dashboard
2. Frontend navigates to `/recommendations/{id}`
3. `RecommendationDetail.tsx` component mounts
4. `useRecommendations` hook fetches single recommendation:
   - GET `/api/v1/recommendations/{id}`
5. Backend validates user has access (tier check, tracked stocks check)
6. Backend returns full recommendation with explanation
7. Frontend displays:
   - Stock information (symbol, company name, sector)
   - Signal (buy/sell/hold) with visual indicator
   - Confidence score with tooltip explaining R²
   - Sentiment score with data source attribution
   - Risk level with color coding
   - Full explanation with transparent data sources and timestamps
8. User hovers over tooltips to learn about quantitative concepts
9. User can navigate back to dashboard

**Stock Search Workflow:**
1. User navigates to `/search` or uses search input in navigation
2. User types search query (stock symbol or company name)
3. Frontend debounces search input (500ms delay)
4. `useStockSearch` hook triggers search:
   - GET `/api/v1/stocks/search?q={query}`
5. Backend performs PostgreSQL FTS on `symbol` and `company_name` fields
6. Backend returns matching stocks array
7. Frontend displays search results in list format
8. User clicks on search result
9. Frontend navigates to stock detail or recommendation if available
10. React Query caches search results

**Filter and Sort Workflow:**
1. User interacts with filter/sort controls on dashboard
2. User selects filter (holding_period, risk_level, confidence_min)
3. Frontend updates filter state
4. `useRecommendations` hook refetches with new query params:
   - GET `/api/v1/recommendations?holding_period=daily&risk_level=low&confidence_min=0.7`
5. Backend applies filters to recommendations query
6. Backend returns filtered recommendations
7. Frontend updates `RecommendationList` with filtered results
8. Filter state persists in React Query cache during session

**Tier Enforcement Workflow:**
1. User attempts to view recommendations
2. Backend checks user tier via `GET /api/v1/users/me`
3. If free tier:
   - Backend queries `user_stock_tracking` table for user's tracked stocks
   - Backend filters recommendations to only include tracked stocks (max 5)
   - If user has < 5 tracked stocks, shows recommendations only for those stocks
4. If premium tier:
   - Backend returns all recommendations (no filtering)
5. Frontend displays tier status: "Tracking 3/5 stocks (Free tier)" or "Premium - Unlimited"
6. If free tier user reaches limit, UI shows upgrade prompt when attempting to add more stocks

## Non-Functional Requirements

### Performance

**Target Metrics (per PRD NFR001, Architecture Performance Considerations):**
- Dashboard page load: <3 seconds (per PRD NFR001)
- API endpoints: <500ms for data retrieval endpoints (per Architecture)
- Stock search: <500ms response time (per Story 3.3 acceptance criteria)
- Recommendation list rendering: <1 second after data fetch
- Filter/sort operations: <300ms response time
- React Query cache hit rate: >70% for repeated dashboard visits

**Optimization Strategies:**
- React Query caching: Cache recommendations for 5 minutes, cache user preferences indefinitely
- Database indexes: Index `recommendations.created_at` for sorting, index `user_stock_tracking.user_id` for tier filtering
- Code splitting: Lazy load `RecommendationDetail` and `Search` pages
- Debounced search: 500ms debounce on stock search input to reduce API calls
- Optimistic updates: Update filter/sort state immediately, refetch in background
- Efficient queries: Use SQLAlchemy eager loading for stock relationships, avoid N+1 queries

[Source: dist/PRD.md#nfr001-performance-requirements, dist/architecture.md#performance-considerations]

### Security

**Authentication & Authorization (per PRD NFR004, Architecture Security):**
- Protected routes: All dashboard and recommendation pages require authentication
- JWT token validation: Validate tokens on every API request
- Tier enforcement: Backend validates user tier before returning recommendations (prevent frontend manipulation)
- User data isolation: Recommendations filtered by user tier and tracked stocks at API level

**Data Protection:**
- HTTPS: All API calls use HTTPS (Vercel and Render provide)
- Input validation: Pydantic schemas validate all API query params and request bodies
- XSS prevention: React escapes user input, shadcn/ui components are XSS-safe
- SQL injection prevention: SQLAlchemy ORM parameterized queries (no raw SQL in search)

**API Security:**
- CORS: Configured for Vercel frontend domain + localhost for development
- Rate limiting: Consider per-user rate limits on search endpoint (defer if not critical for MVP)
- Error messages: Generic error messages for 401/403 (don't reveal user existence)

[Source: dist/PRD.md#nfr004-security--privacy, dist/architecture.md#security-architecture]

### Reliability/Availability

**Availability Targets (per PRD NFR002):**
- System availability: 95%+ during business hours (free-tier infrastructure constraints)
- Dashboard availability: Graceful degradation if recommendations API fails (show cached data or empty state)
- Search availability: Graceful degradation if search API fails (show error message, allow retry)

**Error Handling:**
- API failures: React Query retry logic (3 retries with exponential backoff)
- Network failures: Frontend shows user-friendly error messages, allows retry
- Missing data: Handle empty recommendation lists gracefully (show empty state with helpful message)
- Database connection failures: Backend returns 503 Service Unavailable with retry-after header

**Degradation Behavior:**
- If recommendations API unavailable: Frontend shows cached recommendations (if available) or empty state
- If search API unavailable: Frontend shows error message, allows user to retry
- If user preferences unavailable: Use default filters (daily holding period, medium risk tolerance)

[Source: dist/PRD.md#nfr002-reliability--availability, dist/architecture.md#error-handling]

### Observability

**Logging Requirements (per Architecture Logging Strategy):**
- Backend: Structured JSON logs for Render log aggregation
  - Log API requests: `logger.info("Recommendations fetched", extra={"user_id": user_id, "count": len(recommendations)})`
  - Log search queries: `logger.info("Stock search performed", extra={"query": query, "result_count": len(results)})`
  - Log errors: `logger.error("Recommendation fetch failed", extra={"user_id": user_id, "error": str(e)})`
- Frontend: Console logging for development, error boundaries for production error tracking
- Log levels: DEBUG (development), INFO (production events), ERROR (production errors)

**Metrics to Track:**
- Dashboard load times: Track time to first recommendation display
- API response times: Track p50, p95, p99 for recommendations and search endpoints
- Search performance: Track search query response times, result counts
- Filter/sort usage: Track which filters and sorts are most commonly used
- Tier distribution: Track free vs premium user counts
- Cache hit rates: Track React Query cache effectiveness

**Monitoring:**
- Render dashboard: Backend logs and metrics visible in Render dashboard
- Vercel dashboard: Frontend build logs and deployment status
- Error tracking: Frontend error boundaries log to console (can integrate Sentry later if needed)

[Source: dist/architecture.md#logging-strategy]

## Dependencies and Integrations

**Frontend Dependencies (React/TypeScript):**
- `react` (18+) - UI framework (already installed)
- `react-dom` (18+) - React DOM bindings (already installed)
- `typescript` (5.x) - Type safety (already installed)
- `@tanstack/react-query` (5.x) - Server state management and caching (already installed)
- `axios` (latest) - HTTP client for API requests (already installed)
- `react-router-dom` (latest) - Client-side routing (already installed)
- `tailwindcss` (3.x) - Utility-first CSS framework (already installed)
- `shadcn/ui` (latest) - Component library (NEW - required for Epic 3)
  - Installation: `npx shadcn-ui@latest init` (configures Tailwind, adds components)
  - Components needed: Button, Card, Input, Select, Popover (for tooltips), Badge, Table
- `@radix-ui/react-popover` (latest) - Accessible popover component (installed via shadcn/ui)
- `@radix-ui/react-select` (latest) - Accessible select component (installed via shadcn/ui)
- `lucide-react` (latest) - Icon library (installed via shadcn/ui)

**Backend Dependencies (Python/FastAPI):**
- `fastapi` (latest) - Web framework (already installed)
- `sqlalchemy` (2.0.x) - ORM for database operations (already installed)
- `pydantic` (latest) - Data validation (already installed)
- `psycopg2-binary` (latest) - PostgreSQL database adapter (already installed)
- No new backend dependencies required (uses existing infrastructure)

**External Integrations:**
- **PostgreSQL Full-Text Search** - Stock search functionality
  - Integration point: `backend/app/api/v1/endpoints/search.py`
  - Uses PostgreSQL built-in FTS on `stocks.symbol` and `stocks.company_name` fields
  - No external service required (per ADR-005 in architecture.md)

**Version Constraints:**
- Node.js: 18+ (required for React 18 and Vite)
- Python: 3.11+ (required for FastAPI async support)
- PostgreSQL: 15+ (required for FTS features)

**Integration Points:**
1. Frontend ↔ Backend: REST API via Axios, base URL from `VITE_API_URL` environment variable
2. Backend ↔ Database: SQLAlchemy ORM with async support, FTS queries for search
3. Frontend ↔ React Query: Server state management, caching, optimistic updates
4. Frontend ↔ shadcn/ui: Component library for consistent UI components

[Source: dist/architecture.md#technology-stack-details, dist/architecture.md#integration-points, dist/architecture.md#adr-005-postgresql-fts-for-search]

## Acceptance Criteria (Authoritative)

**Story 3.1: Recommendation Dashboard List View**
1. Dashboard page displays recommendations in list format
2. Each recommendation shows: stock symbol, company name, signal (buy/sell/hold), confidence score, sentiment score, risk level
3. List is sortable by: date, confidence, risk, sentiment
4. List is filterable by: holding period, risk level, confidence threshold
5. Recommendations respect user preferences (holding period, tier limits)
6. List updates when new recommendations are generated
7. Empty state shown when no recommendations available
8. Loading state shown while fetching recommendations

**Story 3.2: Recommendation Detail View**
1. Clicking recommendation opens detail view/modal
2. Detail view shows: full stock info, prediction signal, detailed explanation
3. Explanation includes: sentiment analysis results, ML model signals, risk factors
4. Transparent data display: data sources shown (Twitter, news sources), timestamps displayed
5. Confidence score explained (based on R², model performance)
6. Educational context provided (what signals mean, why they matter)
7. Back/navigation to return to dashboard

**Story 3.3: Stock Search Functionality**
1. Search input field in navigation or dashboard
2. Search works by stock symbol (e.g., "AAPL") or company name (e.g., "Apple")
3. Search results displayed in list format
4. Results show: symbol, company name, sector, recommendation status (if available)
5. Clicking search result navigates to stock detail or recommendation
6. Search handles partial matches and typos gracefully
7. Search is fast (<500ms response time)

**Story 3.4: Recommendation Explanations with Transparency**
1. Each recommendation has explanation field populated
2. Explanations are brief (2-3 sentences), clear, non-technical language
3. Explanations reference: sentiment trends, ML model signals, risk factors
4. Data sources displayed: "Sentiment from Twitter (updated 5 min ago)", "ML model confidence: 0.85 R²"
5. Data freshness indicators shown (timestamps)
6. Explanations help users understand quantitative reasoning
7. Language avoids jargon or explains jargon when used

**Story 3.5: Educational Tooltips & Inline Help**
1. Tooltips appear on hover/click for key terms: "confidence score", "sentiment analysis", "R²"
2. Tooltip content explains concepts in simple language
3. Educational content emphasizes transparency (how things are calculated)
4. Inline help available throughout interface
5. First-time user sees onboarding tooltips
6. Help content is concise and actionable

**Story 3.6: Recommendation Filtering & Sorting**
1. Filter by: holding period (daily/weekly/monthly), risk level (low/medium/high), confidence threshold
2. Sort by: date (newest first), confidence (highest first), risk (lowest first), sentiment (most positive first)
3. Filters and sorts work together (combined filtering)
4. Filter state persists during session
5. Clear filters button to reset
6. Active filters displayed visually
7. Free tier users see filtered results within their stock limit

**Story 3.7: Freemium Tier Stock Limit Enforcement in UI**
1. UI shows stock count indicator: "Tracking 3/5 stocks (Free tier)"
2. When limit reached, user cannot add more stocks
3. Upgrade prompt shown when limit reached: "Upgrade to premium for unlimited stocks"
4. Premium features clearly listed in upgrade prompt
5. Tier status displayed in user profile
6. Recommendations respect tier limits (only show stocks within limit)

**Story 3.8: User Preference Integration with Recommendations**
1. User's holding period preference filters recommendations shown
2. User's risk tolerance preference influences recommendation prioritization
3. Preferences can be updated and recommendations update accordingly
4. Default recommendations shown if preferences not set
5. Clear indication when preferences affect recommendation display

**Story 3.9: Responsive Mobile Optimization**
1. Dashboard responsive on mobile screens (375px, 414px widths)
2. List view optimized for mobile (touch-friendly, readable)
3. Detail view works well on mobile (modal or full page)
4. Navigation accessible on mobile (hamburger menu or bottom nav)
5. Search functionality works on mobile
6. Touch interactions optimized (tap targets large enough)
7. Text readable without zooming

[Source: dist/epics.md#epic-3-recommendations--dashboard]

## Traceability Mapping

| Acceptance Criteria | PRD Reference | Architecture Reference | Component/API | Test Idea |
|-------------------|---------------|------------------------|---------------|-----------|
| AC 3.1.1-3.1.8: Dashboard list view | FR015 | Epic 3 Architecture Mapping, Pattern 3 (Tier-Aware) | `Dashboard.tsx`, `GET /api/v1/recommendations` | Test dashboard loads, displays recommendations, empty/loading states |
| AC 3.2.1-3.2.7: Recommendation detail view | FR016 | Epic 3 Architecture Mapping | `RecommendationDetail.tsx`, `GET /api/v1/recommendations/{id}` | Test detail view displays explanation, data sources, navigation |
| AC 3.3.1-3.3.7: Stock search | FR007a | ADR-005 (PostgreSQL FTS), Epic 3 Architecture Mapping | `Search.tsx`, `GET /api/v1/stocks/search` | Test search by symbol/name, partial matches, response time <500ms |
| AC 3.4.1-3.4.7: Recommendation explanations | FR016 | Pattern 2 (Confidence-Scored Recommendation Generation) | `RecommendationDetail.tsx`, explanation field | Test explanations display data sources, timestamps, clarity |
| AC 3.5.1-3.5.6: Educational tooltips | FR019 | UX Design Specification | `EducationalTooltip.tsx` (shadcn/ui Popover) | Test tooltips appear on hover, explain concepts clearly |
| AC 3.6.1-3.6.7: Filtering & sorting | FR018 | Epic 3 Architecture Mapping | `FilterSortControls.tsx`, query params | Test filters/sorts work together, state persists, tier limits respected |
| AC 3.7.1-3.7.6: Tier enforcement UI | FR003 | Pattern 3 (Tier-Aware), Epic 1 tier enforcement | `TierStatus.tsx`, tier filtering logic | Test tier status display, upgrade prompts, limit enforcement |
| AC 3.8.1-3.8.5: User preference integration | FR002, FR018 | Epic 1 preferences, Epic 3 filtering | `useRecommendations` hook, preference filters | Test preferences filter recommendations, updates reflect immediately |
| AC 3.9.1-3.9.7: Responsive mobile | FR026 | UX Design Specification, Tailwind responsive | `Dashboard.tsx`, `RecommendationDetail.tsx` | Test mobile breakpoints, touch interactions, readability |

## Risks, Assumptions, Open Questions

**Risks:**
1. **Risk: React Query cache invalidation complexity** - Cache invalidation when recommendations update may be complex, leading to stale data
   - Mitigation: Use React Query's `staleTime` and `cacheTime` appropriately, implement manual cache invalidation on recommendation updates
   - Next step: Test cache behavior during Story 3.1 implementation, adjust cache settings if needed

2. **Risk: PostgreSQL FTS performance with 500 stocks** - Full-text search may be slow if not properly indexed
   - Mitigation: Ensure proper indexes on `stocks.symbol` and `stocks.company_name`, test search performance with 500 stocks
   - Next step: Test search performance during Story 3.3 implementation, optimize indexes if needed

3. **Risk: shadcn/ui component customization complexity** - Customizing shadcn/ui components to match black/gold theme may require significant CSS overrides
   - Mitigation: Use Tailwind CSS custom colors, leverage shadcn/ui's theming system, test component appearance early
   - Next step: Install and customize shadcn/ui components during Story 3.1 setup, verify theme consistency

4. **Risk: Tier enforcement bypass** - Frontend-only tier enforcement could be bypassed by API manipulation
   - Mitigation: Enforce tier limits at backend API level (not just frontend), validate user tier on every recommendation request
   - Next step: Implement backend tier filtering during Story 3.1, test API security

5. **Risk: Mobile responsive design complexity** - Dashboard and detail views may be complex to make fully responsive
   - Mitigation: Use Tailwind responsive utilities, test on multiple mobile devices, leverage shadcn/ui's responsive components
   - Next step: Test responsive design during Story 3.9 implementation, iterate based on device testing

**Assumptions:**
1. **Assumption: React Query caching sufficient** - Assume React Query's default caching strategy is sufficient for recommendations
   - Validation: Monitor cache hit rates, adjust `staleTime` and `cacheTime` if needed during Story 3.1

2. **Assumption: PostgreSQL FTS sufficient for 500 stocks** - Assume PostgreSQL FTS is fast enough for MVP search requirements
   - Validation: Test search performance with 500 stocks during Story 3.3, consider Algolia upgrade if needed (per ADR-005)

3. **Assumption: shadcn/ui components accessible** - Assume shadcn/ui components meet WCAG accessibility requirements
   - Validation: Test keyboard navigation and screen reader compatibility during Story 3.5

4. **Assumption: User preferences sufficient for filtering** - Assume holding period and risk tolerance preferences are sufficient for recommendation filtering
   - Validation: Monitor user feedback during Epic 3, adjust filtering logic if needed

**Open Questions:**
1. **Question: Recommendation refresh frequency?** - How often should dashboard refresh recommendations? (Real-time polling vs. manual refresh)
   - Resolution needed: Define refresh strategy during Story 3.1 implementation
   - Current approach: React Query refetches on window focus, manual refresh button available

2. **Question: Search result pagination?** - Should stock search results be paginated or show all results?
   - Resolution needed: Decide pagination strategy during Story 3.3 implementation
   - Current approach: Show all results (500 stocks max, manageable for MVP)

3. **Question: Tooltip trigger mechanism?** - Should tooltips appear on hover, click, or both?
   - Resolution needed: Define tooltip UX during Story 3.5 implementation
   - Current approach: Hover for desktop, click for mobile (shadcn/ui default)

4. **Question: Filter persistence across sessions?** - Should filter/sort preferences persist across browser sessions?
   - Resolution needed: Define persistence strategy during Story 3.6 implementation
   - Current approach: Persist in React Query cache during session only, reset on page reload

## Test Strategy Summary

**Test Levels:**

1. **Unit Tests (Frontend):**
   - Component rendering: Test `Dashboard`, `RecommendationList`, `RecommendationCard` render correctly
   - Filter/sort logic: Test filter and sort state management
   - React Query hooks: Test `useRecommendations` and `useStockSearch` hooks
   - Tooltip component: Test `EducationalTooltip` displays content correctly
   - Framework: React Testing Library, Vitest

2. **Unit Tests (Backend):**
   - API endpoints: Test `GET /api/v1/recommendations` with various query params
   - Tier filtering: Test tier-aware recommendation filtering logic
   - Preference filtering: Test user preference filtering logic
   - Search endpoint: Test PostgreSQL FTS search functionality
   - Framework: pytest, pytest-asyncio, FastAPI TestClient

3. **Integration Tests (API):**
   - Dashboard workflow: Test full dashboard load workflow (auth → fetch recommendations → render)
   - Recommendation detail: Test recommendation detail view workflow
   - Search workflow: Test stock search workflow
   - Tier enforcement: Test free tier vs premium tier recommendation access
   - Framework: pytest with FastAPI TestClient (AsyncClient), verify database state changes

4. **End-to-End Tests (UI):**
   - Dashboard journey: Navigate to dashboard, view recommendations, apply filters
   - Detail view journey: Click recommendation, view details, navigate back
   - Search journey: Perform stock search, view results, navigate to detail
   - Mobile responsive: Test dashboard and detail views on mobile breakpoints
   - Framework: Playwright (already configured in frontend)

**Test Coverage Targets:**
- Frontend components: 70%+ coverage (critical paths: Dashboard, RecommendationList, Search)
- Backend API endpoints: 80%+ coverage (critical paths: recommendations, search, tier filtering)
- React Query hooks: 80%+ coverage (critical paths: data fetching, caching, error handling)

**Edge Cases to Test:**
- Empty recommendation list (no recommendations available)
- Search with no results
- Free tier user with 5 tracked stocks (limit reached)
- Free tier user with < 5 tracked stocks (partial recommendations)
- Network failures during recommendation fetch (error handling, retry)
- Invalid recommendation ID (404 handling)
- Filter/sort with no matching results
- Mobile viewport edge cases (375px, 414px widths)
- Tooltip display on mobile (touch vs hover)

**Performance Tests:**
- Dashboard load time: Verify <3 seconds (per NFR001)
- API response times: Verify <500ms for recommendations and search endpoints
- Search performance: Verify <500ms for stock search (per Story 3.3)
- React Query cache effectiveness: Verify cache hit rate >70%

**Accessibility Tests:**
- Keyboard navigation: Test all interactive elements accessible via keyboard
- Screen reader: Test tooltips and explanations readable by screen readers
- WCAG contrast: Verify text contrast meets WCAG AA requirements (per UX Design Specification)
- Touch targets: Verify mobile touch targets are large enough (44x44px minimum)

[Source: dist/tech-spec-epic-1.md#test-strategy-summary, dist/tech-spec-epic-2.md#test-strategy-summary]

