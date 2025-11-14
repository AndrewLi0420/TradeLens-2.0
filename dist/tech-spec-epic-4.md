# Epic Technical Specification: Recommendation Generation Reliability & Filtering Fixes

Date: 2025-11-13
Author: Andrew
Epic ID: 4
Status: Draft

---

## Overview

Epic 4 addresses critical reliability and correctness issues in the recommendation generation pipeline that prevent recommendations from being generated successfully or filtered correctly. This epic builds on Epic 2 (Data Pipeline & ML Engine) and Epic 3 (Recommendations & Dashboard) by fixing ML model loading verification, enhancing error handling and diagnostics, correcting filtering logic bugs, verifying sentiment data collection, and establishing comprehensive end-to-end testing. Per the PRD goals (FR010-FR014, NFR001-NFR005), this epic ensures the core recommendation functionality is production-ready and reliable, enabling users to receive accurate, filtered recommendations that match their investment preferences.

The epic delivers six sequentially-ordered stories covering model loading diagnostics, error handling enhancements, filtering logic fixes, sentiment data verification, end-to-end testing, and performance optimization. This epic is critical for ensuring the recommendation system works reliably before moving to Epic 5 (Historical Data & Visualization).

## Objectives and Scope

**In-Scope:**
- Enhanced ML model loading diagnostics in `lifetime.py` startup with verification of model accessibility from both module globals and `app.state`
- Health check endpoint `GET /api/v1/health/ml-models` for model status verification
- Comprehensive error handling in `generate_recommendations()` with stock-level error tracking and categorization
- Diagnostic endpoint `GET /api/v1/admin/recommendations/diagnostics` for generation health monitoring
- Fix holding_period filter mapping to risk levels (daily→high, weekly→medium, monthly→low)
- Fix risk_level filter to correctly filter by RiskLevelEnum values
- Fix confidence_min filter to correctly filter by confidence_score threshold
- Fix sort_by and sort_direction filters for all sort fields (date, confidence, risk, sentiment)
- Combined filter support (holding_period + risk_level + confidence_min working together)
- User preferences correctly applied as default filters when query params not provided
- Sentiment data verification before recommendation generation with coverage logging
- Sentiment data freshness checks (warn if >24 hours stale)
- Diagnostic endpoint for sentiment data status per stock
- End-to-end testing for complete recommendation generation pipeline
- Performance optimization: batch predictions, reduce N+1 queries, caching, timeout configuration
- Performance targets: generate 10 recommendations in <60 seconds

**Out-of-Scope:**
- New feature development (this epic focuses on fixes and reliability)
- Payment integration or premium tier logic changes (established in Epic 1)
- ML model retraining or architecture changes (deferred to future epics)
- Frontend UI changes beyond fixing filter display issues
- Historical data visualization (deferred to Epic 5)
- Real-time streaming data processing (hourly batch processing remains)

## System Architecture Alignment

This epic aligns with the architecture document's reliability and observability patterns: FastAPI backend on Render with enhanced error handling, PostgreSQL 15+ database for diagnostic data storage, and comprehensive logging for troubleshooting. The implementation follows existing project structure patterns in `backend/app/lifetime.py`, `backend/app/services/ml_service.py`, `backend/app/services/recommendation_service.py`, `backend/app/crud/recommendations.py`, and `backend/app/api/v1/endpoints/recommendations.py`.

Key architecture patterns applied: Enhanced Error Handling with Diagnostics (extending Pattern 4 from architecture.md) for graceful degradation and detailed error tracking, Health Check Endpoints for model and service status verification, and Performance Optimization patterns for batch processing and query optimization. The diagnostic endpoints follow the API contract patterns from architecture.md with consistent error response formats and status codes.

## Detailed Design

### Services and Modules

**Backend Services:**

1. **`backend/app/lifetime.py` (Startup Lifecycle)**
   - **Responsibilities:** Initialize ML models at FastAPI startup, verify model accessibility, store models in `app.state`
   - **Enhancements (Story 4.1):** Enhanced diagnostics logging model file paths, versions, metadata; verify models accessible from both module globals (`_neural_network_model`, `_random_forest_model`) and `app.state`; model accessibility test after loading; clear error messages for load failures
   - **Inputs:** Model files from `backend/ml-models/` directory
   - **Outputs:** Models cached in memory, status logged, models stored in `app.state` for dependency injection
   - **Owner:** Backend team

2. **`backend/app/services/ml_service.py` (ML Model Service)**
   - **Responsibilities:** Model loading, inference, training, model version management
   - **Enhancements (Story 4.1):** `are_models_loaded()` function for verification; enhanced error handling in `load_model()` and `initialize_models()`; model metadata logging
   - **Key Functions:** `initialize_models()`, `load_model()`, `predict()`, `are_models_loaded()`
   - **Inputs:** Model artifacts (`.pth` for neural network, `.pkl` for Random Forest), metadata JSON files
   - **Outputs:** Loaded model objects, prediction results, model status
   - **Owner:** ML/Backend team

3. **`backend/app/services/recommendation_service.py` (Recommendation Generation)**
   - **Responsibilities:** Orchestrate recommendation generation, synthesize explanations, calculate risk levels
   - **Enhancements (Story 4.2):** Enhanced error logging with stock-level details; error categorization (model errors, data errors, filtering errors, persistence errors); partial success handling; failure summary tracking; graceful degradation (try individual models if ensemble fails); timeout handling; retry logic with exponential backoff
   - **Key Functions:** `generate_recommendations()`, `synthesize_explanation()`, `calculate_risk_level()`, `calculate_volatility()`
   - **Inputs:** User ID, daily target count, market conditions (optional)
   - **Outputs:** List of persisted Recommendation objects
   - **Owner:** Backend team

4. **`backend/app/crud/recommendations.py` (Recommendation Data Access)**
   - **Responsibilities:** Database queries for recommendations with filtering and sorting
   - **Enhancements (Story 4.3):** Fix holding_period filter mapping (daily→HIGH, weekly→MEDIUM, monthly→LOW); fix risk_level filter enum conversion; fix confidence_min filter threshold; fix sort_by and sort_direction for all fields; combined filter support; user preferences as defaults
   - **Key Functions:** `get_recommendations()`, `get_recommendation_by_id()`
   - **Inputs:** User ID, filter parameters (holding_period, risk_level, confidence_min), sort parameters
   - **Outputs:** Filtered and sorted list of Recommendation objects
   - **Owner:** Backend team

5. **`backend/app/services/sentiment_service.py` (Sentiment Collection)**
   - **Responsibilities:** Collect sentiment from web sources, aggregate sentiment scores
   - **Enhancements (Story 4.4):** Sentiment data verification before generation; coverage logging (which stocks have sentiment); freshness checks; error handling with retry logic; sentiment score validation (ensure [-1, 1] range)
   - **Key Functions:** `collect_marketwatch_sentiment()`, `collect_seekingalpha_sentiment()`, `aggregate_sentiment_scores()`
   - **Inputs:** Stock symbol
   - **Outputs:** Sentiment score dictionaries with source attribution
   - **Owner:** Backend team

6. **`backend/app/tasks/sentiment.py` (Sentiment Collection Job)**
   - **Responsibilities:** Scheduled hourly sentiment collection for all stocks
   - **Enhancements (Story 4.4):** Enhanced error handling and retry logic; collection status tracking; freshness validation
   - **Key Functions:** `collect_sentiment_job()`, `collect_sentiment_for_stocks()`
   - **Inputs:** List of Stock objects
   - **Outputs:** Sentiment data persisted to database
   - **Owner:** Backend team

**API Endpoints:**

1. **`backend/app/api/v1/endpoints/recommendations.py`**
   - **Enhancements (Story 4.2, 4.3):** Enhanced error handling in `generate()` endpoint; diagnostic information in error responses
   - **Existing Endpoints:** `GET /api/v1/recommendations`, `GET /api/v1/recommendations/{id}`, `POST /api/v1/recommendations/generate`
   - **Owner:** Backend team

2. **`backend/app/api/v1/endpoints/health.py` (New - Story 4.1)**
   - **New Endpoint:** `GET /api/v1/health/ml-models`
   - **Responsibilities:** Return ML model loading status, versions, accessibility
   - **Response Format:** `{"neural_network": {"loaded": bool, "version": str, "error": str}, "random_forest": {...}}`
   - **Owner:** Backend team

3. **`backend/app/api/v1/endpoints/admin.py` (New - Story 4.2, 4.4)**
   - **New Endpoint:** `GET /api/v1/admin/recommendations/diagnostics`
   - **Responsibilities:** Return recommendation generation health metrics, error counts by type, sentiment data status
   - **Response Format:** `{"generation_health": {...}, "error_counts": {...}, "sentiment_status": {...}}`
   - **Owner:** Backend team

### Data Models and Contracts

**Existing Models (No Schema Changes):**

1. **`Recommendation` Model** (`backend/app/models/recommendation.py`)
   - Fields: `id`, `user_id`, `stock_id`, `signal` (SignalEnum), `confidence_score` (Numeric), `sentiment_score` (Numeric, nullable), `risk_level` (RiskLevelEnum), `explanation` (Text), `created_at` (DateTime)
   - Indexes: `user_id`, `stock_id`, `created_at`
   - Relationships: `user`, `stock`
   - **Usage:** Stores generated recommendations; filtering uses `risk_level`, `confidence_score`, `sentiment_score`, `created_at`

2. **`SentimentData` Model** (`backend/app/models/sentiment_data.py`)
   - Fields: `id`, `stock_id`, `sentiment_score` (Numeric), `source` (String), `timestamp` (DateTime)
   - Indexes: `stock_id`, `timestamp`
   - Relationships: `stock`
   - **Usage:** Stores sentiment data from multiple sources; aggregated sentiment used in recommendations

3. **Enums** (`backend/app/models/enums.py`)
   - `RiskLevelEnum`: LOW, MEDIUM, HIGH
   - `SignalEnum`: BUY, SELL, HOLD
   - `HoldingPeriodEnum`: DAILY, WEEKLY, MONTHLY
   - `RiskToleranceEnum`: LOW, MEDIUM, HIGH
   - `TierEnum`: FREE, PREMIUM
   - **Usage:** Type-safe filtering and data validation

**Data Contracts:**

1. **Filtering Logic Mapping:**
   - `holding_period="daily"` → `risk_level == RiskLevelEnum.HIGH`
   - `holding_period="weekly"` → `risk_level == RiskLevelEnum.MEDIUM`
   - `holding_period="monthly"` → `risk_level == RiskLevelEnum.LOW`
   - Rationale: Daily traders prefer higher volatility (high risk), weekly prefer moderate volatility (medium risk), monthly prefer lower volatility (low risk)

2. **Sentiment Score Range:**
   - Valid range: [-1.0, 1.0] (normalized sentiment)
   - Missing sentiment: Use neutral (0.0) if no sentiment available
   - Freshness threshold: Warn if sentiment data >24 hours stale

3. **Confidence Score Range:**
   - Valid range: [0.0, 1.0] (R²-based confidence)
   - Filter: `confidence_score >= confidence_min` (where `confidence_min` is query parameter)

### APIs and Interfaces

**New Health Check Endpoint (Story 4.1):**

```
GET /api/v1/health/ml-models
Response: {
  "neural_network": {
    "loaded": bool,
    "version": str | null,
    "error": str | null,
    "accessible": bool
  },
  "random_forest": {
    "loaded": bool,
    "version": str | null,
    "error": str | null,
    "accessible": bool
  }
}
Status Codes: 200 (OK), 503 (Service Unavailable if no models loaded)
```

**New Diagnostic Endpoint (Story 4.2, 4.4):**

```
GET /api/v1/admin/recommendations/diagnostics
Authentication: Required (admin/internal use)
Response: {
  "generation_health": {
    "last_generation_time": str (ISO 8601),
    "last_generation_success": bool,
    "last_generation_count": int,
    "last_generation_duration_seconds": float
  },
  "error_counts": {
    "model_errors": int,
    "data_errors": int,
    "filtering_errors": int,
    "persistence_errors": int,
    "total_failures": int
  },
  "sentiment_status": {
    "stocks_with_sentiment": int,
    "stocks_without_sentiment": int,
    "stale_sentiment_count": int,  // >24 hours old
    "coverage_percentage": float
  },
  "model_status": {
    "neural_network_loaded": bool,
    "random_forest_loaded": bool
  }
}
Status Codes: 200 (OK)
```

**Enhanced Recommendation List Endpoint (Story 4.3):**

```
GET /api/v1/recommendations?holding_period={daily|weekly|monthly}&risk_level={low|medium|high}&confidence_min={0.0-1.0}&sort_by={date|confidence|risk|sentiment}&sort_direction={asc|desc}
Enhancements:
- Fixed holding_period filter mapping to risk levels
- Fixed risk_level enum conversion
- Fixed confidence_min threshold filtering
- Fixed sort_by and sort_direction for all fields
- Combined filters work together
- User preferences applied as defaults if query params not provided
Response: list[RecommendationRead]
Status Codes: 200 (OK), 500 (Internal Server Error)
```

**Enhanced Generation Endpoint (Story 4.2):**

```
POST /api/v1/recommendations/generate?user_id={uuid}&count={1-100}
Enhancements:
- Enhanced error logging with stock-level details
- Failure summary in response
- Partial success handling (returns count of successful recommendations even if some fail)
Response: {
  "created": int,
  "message": str (optional, if created == 0),
  "failures": {
    "model_errors": int,
    "data_errors": int,
    "total": int
  } (optional, if failures > 0)
}
Status Codes: 202 (Accepted), 500 (Internal Server Error)
```

### Workflows and Sequencing

**Story 4.1: ML Model Loading Verification & Diagnostics**

1. **Startup Sequence:**
   - FastAPI startup event triggers `lifetime.py:startup()`
   - `initialize_models()` called in thread pool executor (non-blocking)
   - Models loaded from `backend/ml-models/` directory
   - Model file paths, versions, metadata logged
   - Models cached in module globals (`_neural_network_model`, `_random_forest_model`)
   - Models stored in `app.state` for dependency injection
   - Model accessibility verified (test inference call)
   - Status logged: success or detailed error message
   - Health check endpoint available: `GET /api/v1/health/ml-models`

2. **Error Handling:**
   - If model file not found: Log error with file path, continue startup (graceful degradation)
   - If version mismatch: Log warning, use available version
   - If model load fails: Log detailed error, mark as not loaded, prevent generation if required

**Story 4.2: Recommendation Generation Error Handling & Diagnostics**

1. **Generation Sequence:**
   - `generate_recommendations()` called with user_id and target count
   - Check models loaded via `are_models_loaded()`; if not, return empty list with error logged
   - For each stock candidate:
     - Try: Load market data, get sentiment, call ML prediction, calculate risk, synthesize explanation
     - Catch: Log error with stock_id, symbol, error type, error message, stack trace
     - Categorize error: model_error, data_error, filtering_error, persistence_error
     - Continue to next stock (partial success)
   - Track failure counts by category
   - Return successful recommendations + failure summary
   - Diagnostic endpoint aggregates error counts from recent generations

2. **Graceful Degradation:**
   - If ensemble prediction fails: Try neural network only, then Random Forest only
   - If prediction timeout: Log timeout, skip stock, continue
   - If sentiment missing: Use neutral (0.0), continue generation

**Story 4.3: Fix Recommendation Filtering Logic**

1. **Filter Application Sequence:**
   - `get_recommendations()` called with filter parameters
   - Load user preferences if query params not provided (defaults)
   - Apply tier-aware filtering (free tier: tracked stocks only)
   - Apply holding_period filter: Map to risk_level (daily→HIGH, weekly→MEDIUM, monthly→LOW)
   - Apply risk_level filter: Convert string to RiskLevelEnum, filter by enum value
   - Apply confidence_min filter: Filter by `confidence_score >= confidence_min`
   - Apply sorting: Use CASE statement for risk enum ordering, handle NULL sentiment scores
   - Execute query, return filtered and sorted results

2. **Filter Combination:**
   - All filters applied as SQL WHERE clauses (AND logic)
   - Filters work together: holding_period + risk_level + confidence_min
   - User preferences override query params if both provided (query params take precedence)

**Story 4.4: Sentiment Data Verification & Collection Fixes**

1. **Collection Sequence:**
   - Scheduled job `collect_sentiment_job()` runs hourly
   - For each stock: Collect from multiple sources (MarketWatch, SeekingAlpha)
   - Aggregate sentiment scores from sources
   - Validate sentiment score range: [-1, 1]
   - Persist per-source and aggregated sentiment to database
   - Log collection status: success/failure per stock

2. **Verification Before Generation:**
   - Before `generate_recommendations()`: Check sentiment data availability
   - Log sentiment coverage: which stocks have sentiment, which don't
   - Check freshness: warn if sentiment >24 hours stale
   - Handle missing sentiment: use neutral (0.0) if not available

**Story 4.5: End-to-End Recommendation Generation Testing**

1. **Test Sequence:**
   - Setup: Load test data (stocks, market data, sentiment data), ensure models loaded
   - Test model loading: Verify models accessible
   - Test prediction pipeline: Generate predictions for test stocks
   - Test filtering: Verify all filter combinations work
   - Test error handling: Simulate failures, verify graceful degradation
   - Test sentiment integration: Verify sentiment scores included
   - Test persistence: Verify recommendations saved to database
   - Test tier filtering: Verify free tier users see only tracked stocks
   - Performance test: Measure generation time, verify <60 seconds for 10 recommendations

**Story 4.6: Recommendation Generation Performance & Reliability**

1. **Optimization Sequence:**
   - Batch predictions: Group stocks, call ML service in batches
   - Reduce N+1 queries: Eager load relationships, batch database queries
   - Cache user preferences: Store in memory, refresh on update
   - Cache stock metadata: Reduce repeated database lookups
   - Configure timeouts: Set reasonable timeouts for predictions and DB queries
   - Resource limits: Prevent memory exhaustion during large batch generation
   - Progress tracking: Log progress for long-running generations
   - Rate limiting: Prevent excessive concurrent generations
   - Monitoring: Track success rate, latency, error rates
   - Alerting: Alert on high failure rates or performance degradation

## Non-Functional Requirements

### Performance

**Targets:**
- Recommendation generation: Generate 10 recommendations in <60 seconds (per PRD NFR001)
- Health check endpoint: Respond within <100ms
- Diagnostic endpoint: Respond within <500ms
- Filtering queries: Execute within <200ms for typical user datasets
- Model loading: Complete within <30 seconds at startup (non-blocking)

**Optimization Strategies (Story 4.6):**
- Batch ML predictions: Group stocks into batches (e.g., 10-20 stocks per batch) to reduce overhead
- Database query optimization: Use eager loading (`selectinload`) to reduce N+1 queries; batch stock metadata lookups
- Caching: Cache user preferences and stock metadata in memory (refresh on update); cache model objects (already implemented)
- Timeout configuration: Set 30-second timeout for ML predictions, 10-second timeout for database queries
- Resource limits: Limit concurrent generations to prevent memory exhaustion; use connection pooling for database
- Progress tracking: Log progress every 10 stocks processed for long-running generations

**Performance Monitoring:**
- Track generation duration, success rate, error rates via diagnostic endpoint
- Log performance metrics: stocks processed per second, average prediction time, database query time
- Alert on performance degradation: if generation exceeds 60 seconds or success rate drops below 80%

### Security

**Authentication & Authorization:**
- Health check endpoint: Public (no authentication required) for monitoring
- Diagnostic endpoint: Require authentication (admin/internal use only) to prevent information disclosure
- Generation endpoint: Require user authentication; users can only generate recommendations for themselves (or admin can generate for any user)

**Data Protection:**
- Error logs: Sanitize sensitive data (user IDs, stock symbols OK; no passwords or API keys)
- Diagnostic data: Aggregate error counts only; no sensitive user data in diagnostic responses
- Sentiment data: No PII in sentiment collection; web scraping respects robots.txt and rate limits

**Input Validation:**
- Filter parameters: Validate enum values (holding_period, risk_level); validate confidence_min range [0.0, 1.0]
- User ID: Validate UUID format in generation endpoint
- Sentiment scores: Validate range [-1.0, 1.0] before persistence

### Reliability/Availability

**Availability Targets:**
- Recommendation generation: 95%+ success rate (per PRD NFR002)
- Model loading: Graceful degradation if models fail to load (log error, prevent generation, but don't crash startup)
- Partial success: Generate recommendations for stocks that succeed even if others fail (graceful degradation)

**Error Recovery:**
- Model loading failures: Log detailed error, mark models as not loaded, prevent generation (fail-safe)
- Prediction failures: Try ensemble, then individual models (neural network, then Random Forest); if all fail, skip stock and continue
- Database errors: Retry with exponential backoff (3 retries); if persistent, log error and skip
- Sentiment collection failures: Retry failed collections on next cycle; use neutral (0.0) if sentiment unavailable

**Monitoring & Alerting:**
- Health check endpoint: Monitor model loading status; alert if no models loaded
- Diagnostic endpoint: Monitor generation health; alert on high failure rates (>20%) or performance degradation
- Log aggregation: Structured JSON logs for Render log aggregation; include error context (stock_id, error type, message)

### Observability

**Logging Requirements:**
- Model loading: Log file paths, versions, metadata, accessibility status, errors
- Recommendation generation: Log stock-level errors with stock_id, symbol, error type, error message, stack trace
- Error categorization: Log errors by category (model_error, data_error, filtering_error, persistence_error)
- Sentiment collection: Log collection status per stock (success/failure), coverage statistics, freshness warnings
- Performance metrics: Log generation duration, stocks processed, success/failure counts

**Diagnostic Endpoints:**
- `GET /api/v1/health/ml-models`: Model loading status, versions, accessibility
- `GET /api/v1/admin/recommendations/diagnostics`: Generation health, error counts, sentiment status, model status

**Metrics to Track:**
- Generation success rate: (successful recommendations / total stocks processed) * 100
- Error rates by category: model_errors, data_errors, filtering_errors, persistence_errors
- Sentiment coverage: (stocks with sentiment / total stocks) * 100
- Sentiment freshness: count of stocks with sentiment >24 hours stale
- Generation latency: time to generate 10 recommendations
- Model loading status: neural_network_loaded, random_forest_loaded

## Dependencies and Integrations

**Internal Dependencies:**
- Epic 1 (Foundation): User authentication, user preferences, database schema
- Epic 2 (Data Pipeline & ML Engine): ML models, market data collection, sentiment collection, recommendation generation logic
- Epic 3 (Recommendations & Dashboard): Recommendation API endpoints, filtering logic (to be fixed)

**External Dependencies:**
- **PyTorch** (latest): Neural network model inference
- **scikit-learn** (latest): Random Forest model inference
- **FastAPI** (^0.109.2): Web framework for API endpoints
- **SQLAlchemy** (2.0.x): ORM for database queries
- **PostgreSQL** (15+): Database for recommendations, sentiment data, diagnostic data
- **APScheduler** (3.x): Scheduled sentiment collection jobs

**No New External Dependencies:**
- This epic enhances existing functionality without adding new external services or libraries
- All enhancements use existing dependencies from `backend/pyproject.toml` and `frontend/package.json`

**Integration Points:**
- ML Model Service: `backend/app/services/ml_service.py` - model loading, inference
- Sentiment Service: `backend/app/services/sentiment_service.py` - sentiment collection, aggregation
- Recommendation Service: `backend/app/services/recommendation_service.py` - generation orchestration
- Database: PostgreSQL via SQLAlchemy - persistence, queries
- Frontend: No changes required (filtering fixes are backend-only)

## Acceptance Criteria (Authoritative)

**Story 4.1: ML Model Loading Verification & Diagnostics**

1. Enhanced model loading diagnostics in `lifetime.py` startup logs model file paths, versions, and metadata during loading
2. Verify models are accessible from both module globals (`_neural_network_model`, `_random_forest_model`) and `app.state`
3. Health check endpoint `GET /api/v1/health/ml-models` returns model status (loaded, version, error, accessible)
4. Model accessibility test: verify models can be used for inference after loading (test prediction call)
5. Clear error messages when models fail to load (file not found, version mismatch, etc.) with file paths
6. Fallback mechanism: if models fail to load, log detailed error and prevent generation (don't crash startup)
7. Model loading status persisted and queryable via health check endpoint
8. Startup fails gracefully if models required but not available (configurable; default: log warning, continue)

**Story 4.2: Recommendation Generation Error Handling & Diagnostics**

1. Enhanced error logging in `generate_recommendations()` with stock-level details (stock_id, symbol, error type, error message, stack trace)
2. Track failure reasons: model errors, data errors, prediction failures, filtering errors, persistence errors
3. Diagnostic endpoint `GET /api/v1/admin/recommendations/diagnostics` shows generation health (last generation time, success, count, duration)
4. Error categorization: model errors, data errors, filtering errors, persistence errors tracked separately
5. Partial success handling: generate recommendations for stocks that succeed even if others fail
6. Failure summary returned in generation response (counts by error type)
7. Detailed error logs include: stock_id, symbol, error type, error message, stack trace
8. Graceful degradation: if ensemble fails, try individual models (neural network, then Random Forest)
9. Timeout handling for long-running predictions (30-second timeout)
10. Retry logic for transient failures (3 retries with exponential backoff)

**Story 4.3: Fix Recommendation Filtering Logic**

1. Fix holding_period filter: correctly maps to risk levels (daily→HIGH, weekly→MEDIUM, monthly→LOW)
2. Fix risk_level filter: correctly filters by RiskLevelEnum values (convert string to enum)
3. Fix confidence_min filter: correctly filters by confidence_score threshold (`confidence_score >= confidence_min`)
4. Fix sort_by filters: date, confidence, risk, sentiment all work correctly
5. Fix sort_direction: asc/desc works for all sort fields
6. Combined filters work together (holding_period + risk_level + confidence_min applied as AND logic)
7. User preferences correctly applied as default filters when query params not provided
8. Tier-aware filtering works correctly (free tier sees only tracked stocks)
9. Filter edge cases handled: null values, empty results, invalid inputs (return empty list, don't crash)
10. Unit tests for all filter combinations (holding_period × risk_level × confidence_min × sort_by × sort_direction)

**Story 4.4: Sentiment Data Verification & Collection Fixes**

1. Verify sentiment collection job runs successfully and collects data (check job execution logs)
2. Check sentiment data availability before generating recommendations (log coverage statistics)
3. Log sentiment data coverage: which stocks have sentiment, which don't
4. Handle missing sentiment gracefully: use neutral (0.0) if no sentiment available
5. Verify aggregated sentiment calculation works correctly (test aggregation logic)
6. Sentiment data freshness check: warn if sentiment data is stale (>24 hours)
7. Diagnostic endpoint shows sentiment data status per stock (coverage, freshness)
8. Sentiment collection error handling: retry failed collections, log errors
9. Sentiment data validation: ensure scores are in [-1, 1] range before persistence
10. Integration test: verify sentiment is included in generated recommendations

**Story 4.5: End-to-End Recommendation Generation Testing**

1. E2E test: generate recommendations with all components (models, data, sentiment)
2. Test model loading: verify models accessible during generation
3. Test prediction pipeline: verify predictions succeed for test stocks
4. Test filtering: verify all filter combinations work correctly
5. Test error handling: verify graceful failures when components unavailable (models not loaded, missing data)
6. Test sentiment integration: verify sentiment scores included in recommendations
7. Test persistence: verify recommendations saved to database correctly
8. Test tier filtering: verify free tier users see only tracked stocks
9. Performance test: verify generation completes within latency targets (<60 seconds for 10 recommendations)
10. Integration test script: run full pipeline and validate results

**Story 4.6: Recommendation Generation Performance & Reliability**

1. Optimize prediction calls: batch where possible (group stocks into batches of 10-20), parallelize where safe
2. Database query optimization: reduce N+1 queries in generation loop (use eager loading, batch queries)
3. Caching: cache user preferences, stock metadata to reduce DB calls (in-memory cache, refresh on update)
4. Timeout configuration: set reasonable timeouts for predictions (30s) and DB queries (10s)
5. Resource limits: prevent memory exhaustion during large batch generation (limit concurrent generations)
6. Progress tracking: log progress for long-running generations (every 10 stocks)
7. Rate limiting: prevent excessive concurrent generations (max 2 concurrent generations per user)
8. Monitoring: track generation success rate, latency, error rates (via diagnostic endpoint)
9. Alerting: alert on high failure rates (>20%) or performance degradation (generation >60s)
10. Performance targets: generate 10 recommendations in <60 seconds (measured and validated)

## Traceability Mapping

| AC ID | Acceptance Criteria | Spec Section | Component/API | Test Idea |
|-------|---------------------|--------------|---------------|-----------|
| 4.1.1 | Enhanced model loading diagnostics | Detailed Design > Services > lifetime.py | `lifetime.py:startup()` | Unit test: verify logging includes file paths, versions, metadata |
| 4.1.2 | Verify models accessible from globals and app.state | Detailed Design > Services > lifetime.py | `lifetime.py:startup()`, `ml_service.py:initialize_models()` | Integration test: verify models accessible after startup |
| 4.1.3 | Health check endpoint returns model status | APIs > Health Check Endpoint | `GET /api/v1/health/ml-models` | E2E test: call endpoint, verify response format and status |
| 4.1.4 | Model accessibility test | Detailed Design > Workflows > Story 4.1 | `ml_service.py:initialize_models()` | Unit test: verify test prediction call succeeds |
| 4.2.1 | Enhanced error logging with stock-level details | Detailed Design > Services > recommendation_service.py | `generate_recommendations()` | Unit test: verify error logs include stock_id, symbol, error type |
| 4.2.3 | Diagnostic endpoint shows generation health | APIs > Diagnostic Endpoint | `GET /api/v1/admin/recommendations/diagnostics` | E2E test: call endpoint, verify response includes generation health |
| 4.2.4 | Error categorization | Detailed Design > Services > recommendation_service.py | `generate_recommendations()` | Unit test: verify errors categorized correctly |
| 4.2.5 | Partial success handling | Detailed Design > Workflows > Story 4.2 | `generate_recommendations()` | Integration test: generate with some stocks failing, verify partial success |
| 4.3.1 | Fix holding_period filter mapping | Detailed Design > Data Contracts > Filtering Logic | `crud/recommendations.py:get_recommendations()` | Unit test: verify daily→HIGH, weekly→MEDIUM, monthly→LOW |
| 4.3.2 | Fix risk_level filter enum conversion | Detailed Design > Services > crud/recommendations.py | `get_recommendations()` | Unit test: verify risk_level string converted to RiskLevelEnum |
| 4.3.3 | Fix confidence_min filter | Detailed Design > Services > crud/recommendations.py | `get_recommendations()` | Unit test: verify `confidence_score >= confidence_min` filter |
| 4.3.4-5 | Fix sort_by and sort_direction | Detailed Design > Services > crud/recommendations.py | `get_recommendations()` | Unit test: verify all sort fields and directions work |
| 4.3.6 | Combined filters work together | Detailed Design > Workflows > Story 4.3 | `get_recommendations()` | Integration test: apply multiple filters, verify AND logic |
| 4.4.1 | Verify sentiment collection job runs | Detailed Design > Services > tasks/sentiment.py | `collect_sentiment_job()` | Integration test: run job, verify data collected |
| 4.4.2 | Check sentiment data availability | Detailed Design > Workflows > Story 4.4 | `generate_recommendations()` | Integration test: verify sentiment coverage logged |
| 4.4.6 | Sentiment freshness check | Detailed Design > Workflows > Story 4.4 | `generate_recommendations()` | Unit test: verify warning logged if sentiment >24h stale |
| 4.4.7 | Diagnostic endpoint shows sentiment status | APIs > Diagnostic Endpoint | `GET /api/v1/admin/recommendations/diagnostics` | E2E test: verify sentiment_status in response |
| 4.5.1 | E2E test: generate recommendations | Test Strategy | Full pipeline test | Integration test: run complete generation pipeline |
| 4.5.9 | Performance test: <60s for 10 recommendations | Non-Functional > Performance | `generate_recommendations()` | Performance test: measure generation time |
| 4.6.1 | Optimize prediction calls (batching) | Non-Functional > Performance | `generate_recommendations()` | Performance test: verify batching reduces overhead |
| 4.6.2 | Reduce N+1 queries | Non-Functional > Performance | `generate_recommendations()`, `get_recommendations()` | Performance test: verify query count reduced |

## Risks, Assumptions, Open Questions

**Risks:**

1. **Risk: Model Loading Failures Block Startup**
   - **Mitigation:** Implement graceful degradation: log error, mark models as not loaded, continue startup. Health check endpoint allows monitoring. Generation will fail gracefully if models not loaded.

2. **Risk: Performance Degradation with Enhanced Logging**
   - **Mitigation:** Use structured logging with appropriate log levels (DEBUG for detailed, INFO for summaries). Batch log writes where possible. Monitor performance impact.

3. **Risk: Filtering Logic Changes Break Existing Functionality**
   - **Mitigation:** Comprehensive unit tests for all filter combinations. Integration tests with real data. Gradual rollout with monitoring.

4. **Risk: Sentiment Collection Failures Prevent Generation**
   - **Mitigation:** Use neutral (0.0) sentiment if unavailable. Log coverage statistics. Retry failed collections on next cycle.

5. **Risk: Diagnostic Endpoint Exposes Sensitive Information**
   - **Mitigation:** Require authentication (admin/internal use only). Aggregate error counts only; no sensitive user data. Sanitize error messages.

**Assumptions:**

1. Models are stored in `backend/ml-models/` directory with naming pattern `{model_type}_{version}.{ext}`
2. Model metadata JSON files exist alongside model artifacts
3. User preferences exist in database (from Epic 1)
4. Market data and sentiment data collection jobs run successfully (from Epic 2)
5. Existing recommendation generation logic works (needs fixes, not rewrite)
6. PostgreSQL database supports CASE statements for risk enum ordering
7. Frontend will continue to work with fixed filtering (no frontend changes required)

**Open Questions:**

1. **Q: Should model loading failures prevent startup entirely?**
   - **Decision:** No, graceful degradation preferred. Log error, mark models as not loaded, continue startup. Generation will fail gracefully.

2. **Q: How should diagnostic data be persisted?**
   - **Decision:** Aggregate error counts in memory (last N generations). No persistent storage needed for MVP. Can add database table later if needed.

3. **Q: What is the acceptable sentiment data staleness threshold?**
   - **Decision:** 24 hours (per Story 4.4 AC). Warn if stale, but don't prevent generation (use neutral if unavailable).

4. **Q: Should filtering fixes be backward compatible?**
   - **Decision:** Yes, maintain existing API contract. Fix bugs without changing response format.

## Test Strategy Summary

**Test Levels:**

1. **Unit Tests:**
   - Model loading: `initialize_models()`, `are_models_loaded()`, `load_model()`
   - Filtering logic: `get_recommendations()` with all filter combinations
   - Error handling: `generate_recommendations()` error categorization
   - Sentiment validation: sentiment score range validation, aggregation logic
   - **Framework:** pytest
   - **Location:** `backend/tests/test_services/`, `backend/tests/test_crud/`

2. **Integration Tests:**
   - Model loading at startup: verify models accessible after `lifetime.py:startup()`
   - Recommendation generation: full pipeline with real data
   - Filtering: test with database queries
   - Sentiment collection: test collection job with real sources
   - **Framework:** pytest with async test fixtures
   - **Location:** `backend/tests/test_services/`, `backend/tests/test_tasks/`

3. **End-to-End Tests:**
   - Complete recommendation generation: models → data → sentiment → generation → persistence
   - Health check endpoint: verify model status
   - Diagnostic endpoint: verify generation health, error counts, sentiment status
   - Filtering: test API endpoint with all filter combinations
   - **Framework:** pytest with FastAPI TestClient
   - **Location:** `backend/tests/test_api/`

4. **Performance Tests:**
   - Generation latency: measure time to generate 10 recommendations (target: <60s)
   - Query performance: measure filtering query execution time (target: <200ms)
   - Model loading: measure startup time (target: <30s, non-blocking)
   - **Framework:** pytest with timing assertions
   - **Location:** `backend/tests/test_performance/` (new directory)

**Test Coverage Goals:**
- Unit tests: 90%+ code coverage for new/enhanced functions
- Integration tests: Cover all error paths and success paths
- E2E tests: Cover complete generation pipeline
- Performance tests: Validate all performance targets

**Test Data:**
- Use test fixtures: `backend/tests/conftest.py` for database setup
- Mock external services: ML models (use test models), sentiment sources (mock responses)
- Test stocks: Use subset of Fortune 500 (10-20 stocks for performance tests)

**Test Execution:**
- Run unit tests: `pytest backend/tests/test_services/ backend/tests/test_crud/ -v`
- Run integration tests: `pytest backend/tests/test_services/ backend/tests/test_tasks/ -v`
- Run E2E tests: `pytest backend/tests/test_api/ -v`
- Run performance tests: `pytest backend/tests/test_performance/ -v --benchmark-only`
- Run all tests: `pytest backend/tests/ -v`

**Continuous Integration:**
- Run all tests on PR: unit, integration, E2E tests
- Run performance tests on main branch: validate performance targets
- Fail CI if unit test coverage drops below 90%

