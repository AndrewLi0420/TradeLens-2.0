# OpenAlpha - Epic Breakdown

**Author:** Andrew
**Date:** 2025-10-30
**Project Level:** 3
**Target Scale:** Comprehensive product (Level 3)

---

## Overview

This document provides the detailed epic breakdown for OpenAlpha, expanding on the high-level epic list in the [PRD](./PRD.md).

Each epic includes:

- Expanded goal and value proposition
- Complete story breakdown with user stories
- Acceptance criteria for each story
- Story sequencing and dependencies

**Epic Sequencing Principles:**

- Epic 1 establishes foundational infrastructure and initial functionality
- Subsequent epics build progressively, each delivering significant end-to-end value
- Stories within epics are vertically sliced and sequentially ordered
- No forward dependencies - each story builds only on previous work

---

## Epic 1: Foundation & User Authentication

**Expanded Goal:**
Establish the foundational infrastructure for OpenAlpha, including project setup, database schema, user authentication system, and basic user profile management. This epic creates the core platform that all subsequent features will build upon. By delivering secure authentication and user preference management, users can personalize their experience and the system can enforce freemium tier limits from day one.

**Value Delivery:**
- Secure platform foundation ready for ML and recommendation features
- Users can create accounts and set preferences immediately
- Freemium tier enforcement enables business model validation from launch

---

### Story 1.1: Project Infrastructure Setup

**As a** developer,
**I want** project infrastructure (React frontend, FastAPI backend, PostgreSQL database, Redis cache) set up with Docker Compose and free-tier deployment configuration,
**So that** I have a solid foundation for building features.

**Acceptance Criteria:**
1. React + TypeScript frontend project initialized with Vite
2. FastAPI backend project initialized with Python
3. PostgreSQL and Redis containers configured via Docker Compose
4. Frontend and backend can communicate via API
5. Environment variables configured for development and deployment
6. Free-tier deployment configuration documented (Render, Supabase, Vercel)

**Prerequisites:** None (foundational story)

---

### Story 1.2: Database Schema Design

**As a** developer,
**I want** PostgreSQL database schema designed and implemented for users, stocks, recommendations, and sentiment data,
**So that** data can be stored and retrieved efficiently.

**Acceptance Criteria:**
1. Users table with: id, email, password_hash, tier (free/premium), created_at, updated_at
2. User_preferences table with: user_id, holding_period, risk_tolerance, updated_at
3. Stocks table with: symbol, company_name, sector, fortune_500_rank
4. Market_data table with: stock_id, price, volume, timestamp
5. Sentiment_data table with: stock_id, sentiment_score, source, timestamp
6. Recommendations table with: id, user_id, stock_id, signal, confidence_score, risk_level, explanation, created_at
7. All tables have appropriate indexes for query performance
8. Foreign key relationships properly defined

**Prerequisites:** Story 1.1 (project infrastructure)

---

### Story 1.3: User Registration

**As a** new user,
**I want** to create an account with email and password,
**So that** I can access personalized recommendations and track my preferences.

**Acceptance Criteria:**
1. Registration page with email and password fields
2. Email validation (format check)
3. Password requirements enforced (minimum length, complexity)
4. Password securely hashed before storage
5. Duplicate email detection with user-friendly error message
6. Successful registration redirects to login or onboarding
7. Email verification flow (basic - can be enhanced later)

**Prerequisites:** Story 1.2 (database schema)

---

### Story 1.4: User Authentication & Session Management

**As a** registered user,
**I want** to log in securely and maintain my session,
**So that** I can access my personalized dashboard.

**Acceptance Criteria:**
1. Login page with email and password fields
2. Secure authentication using password hashing
3. Session management (JWT tokens or session cookies)
4. Protected routes require authentication
5. Logout functionality clears session
6. Session persists across browser refreshes
7. Error messages for invalid credentials (without revealing if email exists)

**Prerequisites:** Story 1.3 (user registration)

---

### Story 1.5: User Profile & Preferences Management

**As a** logged-in user,
**I want** to set my holding period preference (daily/weekly/monthly) and risk tolerance (low/medium/high),
**So that** recommendations are tailored to my investment style.

**Acceptance Criteria:**
1. User profile page displays current preferences
2. Holding period dropdown: Daily, Weekly, Monthly
3. Risk tolerance dropdown: Low, Medium, High
4. Preferences save to database on update
5. Preferences persist across sessions
6. Preferences are used to filter recommendations (will be implemented in Epic 3)
7. UI clearly shows saved preferences

**Prerequisites:** Story 1.4 (authentication)

---

### Story 1.6: Freemium Tier Enforcement

**As a** system,
**I want** to enforce free tier limits (e.g., 5 stocks) and identify premium users,
**So that** business model can be validated from launch.

**Acceptance Criteria:**
1. User tier field (free/premium) in database
2. Default tier is "free" for new users
3. API endpoints check tier status before allowing actions
4. Free tier users limited to tracking/configuring up to 5 stocks
5. Premium tier check returns unlimited access
6. UI displays tier status (free/premium indicator)
7. Upgrade prompts shown when free tier limit reached (UI only, payment integration deferred)

**Prerequisites:** Story 1.5 (user profile)

---

### Story 1.7: Responsive UI Foundation with Tailwind CSS

**As a** user,
**I want** a responsive web interface with black background and financial blue/green accents,
**So that** I can access OpenAlpha on desktop or mobile devices.

**Acceptance Criteria:**
1. Tailwind CSS configured and integrated
2. Black background color scheme with financial blue/green accents applied
3. Responsive design works on desktop (1920px, 1280px) and mobile (375px, 414px)
4. Navigation structure established (Dashboard, Historical, Profile)
5. Basic layout components created (header, sidebar/nav, main content area)
6. Typography optimized for numerical data display
7. Color scheme accessible (WCAG contrast requirements met)

**Prerequisites:** Story 1.1 (project infrastructure)

---

**Epic 1 Summary:** 7 stories establishing foundation, authentication, user management, and basic UI. All stories are sequentially ordered with no forward dependencies.

---

## Epic 2: Data Pipeline & ML Engine

**Expanded Goal:**
Build the data collection infrastructure and ML prediction engine that powers OpenAlpha's recommendations. This epic establishes hourly (or 5-minute if cost-effective) data processing pipelines for market data and sentiment analysis, trains and deploys ML models (neural networks and Random Forest), and generates predictions with confidence scores. This epic delivers the core intelligence engine that transforms raw data into actionable recommendations.

**Value Delivery:**
- Automated data collection ensures fresh market and sentiment data
- ML models generate statistically-backed predictions
- Confidence scoring based on R² provides transparency users need

---

### Story 2.1: Fortune 500 Stock Data Setup

**As a** system,
**I want** Fortune 500 stock list loaded into database with metadata,
**So that** recommendations can be generated for these stocks.

**Acceptance Criteria:**
1. Fortune 500 stock list imported into stocks table
2. Each stock has: symbol, company_name, sector, fortune_500_rank
3. Data validated for completeness (all 500 stocks present)
4. Stock lookup by symbol or name works efficiently
5. Admin script/endpoint to refresh stock list if needed

**Prerequisites:** Story 1.2 (database schema)

---

### Story 2.2: Market Data Collection Pipeline

**As a** system,
**I want** to collect hourly (or 5-minute if cost-effective) market data (price, volume) for Fortune 500 stocks from free financial APIs,
**So that** ML models have current market data for predictions.

**Acceptance Criteria:**
1. Market data collection script/service using free APIs (Alpha Vantage, Yahoo Finance, or similar)
2. Hourly (or configurable interval) scheduled job runs automatically
3. Data collected: stock price, volume, timestamp
4. Data stored in market_data table with proper timestamps
5. Error handling for API failures (retry logic, logging)
6. Rate limiting respected for free API tiers
7. Data freshness tracked (last_update timestamp per stock)

**Prerequisites:** Story 2.1 (Fortune 500 stocks), Story 1.2 (database schema)

---

### Story 2.3: Twitter Sentiment Collection

**Status: DEFERRED TO V2**

**Decision:** Twitter sentiment collection deferred to v2 due to cost ($200/month for Twitter API Basic tier). For MVP, focus on free sentiment sources (Story 2.4 - web scraping). See ADR-006 in architecture.md for full rationale.

**As a** system,
**I want** to collect sentiment data from Twitter API for Fortune 500 stocks hourly (or 5-minute if cost-effective),
**So that** sentiment scores can inform ML predictions.

**Acceptance Criteria:**
1. Twitter API integration configured (free tier or basic tier)
2. Sentiment collection script searches for tweets mentioning stock symbols or company names
3. Hourly (or configurable) scheduled job collects sentiment data
4. Sentiment scores calculated (positive/negative/neutral) and normalized
5. Data stored in sentiment_data table: stock_id, sentiment_score, source, timestamp
6. Rate limiting handled (Twitter API limits respected)
7. Error handling for API failures with retry logic

**Prerequisites:** Story 2.1 (Fortune 500 stocks), Story 1.2 (database schema)

**Note:** This story will be implemented in v2 after product-market fit validation. Story 2.4 (Web Scraping Sentiment) becomes the primary sentiment source for MVP.

---

### Story 2.4: Additional Sentiment Sources (Web Scraping) - **PRIMARY SENTIMENT SOURCE FOR MVP**

**As a** system,
**I want** to collect sentiment from additional sources (news sites, financial forums) via web scraping,
**So that** sentiment analysis is more comprehensive and reliable.

**Acceptance Criteria:**
1. Web scraping infrastructure (BeautifulSoup/Scrapy) configured
2. Sentiment collected from 2-3 additional sources (e.g., financial news sites)
3. Ethical scraping practices: rate limiting, robots.txt respect
4. Sentiment aggregation: multiple sources combined into unified sentiment score
5. Sentiment data stored with source attribution
6. Error handling for scraping failures (sites down, structure changes)

**Prerequisites:** Story 2.3 (Twitter sentiment)

---

### Story 2.5: ML Model Training Infrastructure

**As a** developer,
**I want** ML model training pipeline set up with PyTorch/TensorFlow and scikit-learn,
**So that** prediction models can be trained on historical data.

**Acceptance Criteria:**
1. Python ML environment configured with PyTorch, TensorFlow, scikit-learn
2. Training data pipeline: historical market data + sentiment → feature vectors
3. Neural network model architecture defined (can be simple initially)
4. Random Forest classifier model defined
5. Training script can run locally or in cloud
6. Model artifacts saved (can use GitHub LFS or cloud storage)
7. Model versioning system in place

**Prerequisites:** Story 2.2 (market data), Story 2.4 (sentiment data)

---

### Story 2.6: ML Model Inference Service

**As a** system,
**I want** ML models to generate predictions (buy/sell/hold) with confidence scores for stocks,
**So that** recommendations can be created with statistical backing.

**Acceptance Criteria:**
1. Model inference service/endpoint in FastAPI
2. Input: current market data + sentiment scores for a stock
3. Models generate: prediction signal (buy/sell/hold) + confidence score
4. Confidence score calculated from R² analysis of model performance
5. Inference completes within <1 minute latency requirement
6. Both neural network and Random Forest models used (ensemble or separate)
7. Model performance metrics logged (R², accuracy)

**Prerequisites:** Story 2.5 (model training)

---

### Story 2.7: Risk Assessment Calculation

**As a** system,
**I want** to calculate risk indicators (low/medium/high) for each recommendation,
**So that** users can understand risk associated with recommendations.

**Acceptance Criteria:**
1. Risk calculation algorithm defined (based on volatility, ML model uncertainty, market conditions)
2. Risk level assigned: Low, Medium, High
3. Risk calculation integrated into recommendation generation
4. Risk indicators stored with recommendations
5. Risk calculation uses recent market volatility data

**Prerequisites:** Story 2.6 (ML inference)

---

### Story 2.8: Recommendation Generation Logic

**As a** system,
**I want** to generate approximately 10 recommendations per day by combining ML predictions, sentiment, and risk scores,
**So that** users receive actionable trading insights.

**Acceptance Criteria:**
1. Recommendation generation algorithm: selects top stocks based on ML signals, confidence, sentiment
2. Generates ~10 recommendations daily (configurable)
3. Recommendations include: stock, signal (buy/sell/hold), confidence score, sentiment score, risk level
4. Recommendations filtered by user holding period preference (when user-specific)
5. Recommendations stored in database with timestamp
6. Generation process runs on schedule (hourly or 5-minute if cost-effective)
7. Generation completes within latency requirements

**Prerequisites:** Story 2.6 (ML inference), Story 2.7 (risk assessment), Story 1.5 (user preferences)

---

**Epic 2 Summary:** 8 stories building data collection pipelines, ML models, and recommendation generation. Stories build sequentially from data collection → model training → inference → recommendations.

---

## Epic 3: Recommendations & Dashboard

**Expanded Goal:**
Create the user-facing recommendation dashboard, search functionality, and educational content that enables users to discover, understand, and act on recommendations. This epic delivers the core user experience where users interact with OpenAlpha's ML-powered insights. By providing clear explanations, transparent data sources, and efficient information access, users can make informed trading decisions.

**Value Delivery:**
- Users can view and understand recommendations immediately
- Search functionality enables quick stock discovery
- Educational content builds user confidence in quantitative trading

---

### Story 3.1: Recommendation Dashboard List View

**As a** logged-in user,
**I want** to see current recommendations displayed in a list format on the dashboard,
**So that** I can quickly scan and identify actionable recommendations.

**Acceptance Criteria:**
1. Dashboard page displays recommendations in list format
2. Each recommendation shows: stock symbol, company name, signal (buy/sell/hold), confidence score, sentiment score, risk level
3. List is sortable by: date, confidence, risk, sentiment
4. List is filterable by: holding period, risk level, confidence threshold
5. Recommendations respect user preferences (holding period, tier limits)
6. List updates when new recommendations are generated
7. Empty state shown when no recommendations available
8. Loading state shown while fetching recommendations

**Prerequisites:** Story 2.8 (recommendation generation), Story 1.7 (UI foundation)

---

### Story 3.2: Recommendation Detail View

**As a** user,
**I want** to click on a recommendation to see detailed explanation with transparent data sources,
**So that** I can understand why the recommendation was made.

**Acceptance Criteria:**
1. Clicking recommendation opens detail view/modal
2. Detail view shows: full stock info, prediction signal, detailed explanation
3. Explanation includes: sentiment analysis results, ML model signals, risk factors
4. Transparent data display: data sources shown (Twitter, news sources), timestamps displayed
5. Confidence score explained (based on R², model performance)
6. Educational context provided (what signals mean, why they matter)
7. Back/navigation to return to dashboard

**Prerequisites:** Story 3.1 (dashboard list)

---

### Story 3.3: Stock Search Functionality

**As a** user,
**I want** to search for stocks by symbol or company name,
**So that** I can quickly find specific stocks and their recommendations.

**Acceptance Criteria:**
1. Search input field in navigation or dashboard
2. Search works by stock symbol (e.g., "AAPL") or company name (e.g., "Apple")
3. Search results displayed in list format
4. Results show: symbol, company name, sector, recommendation status (if available)
5. Clicking search result navigates to stock detail or recommendation
6. Search handles partial matches and typos gracefully
7. Search is fast (<500ms response time)

**Prerequisites:** Story 2.1 (Fortune 500 stocks), Story 1.7 (UI foundation)

---

### Story 3.4: Recommendation Explanations with Transparency

**As a** user,
**I want** each recommendation to include brief, clear explanation with transparent data sources,
**So that** I understand the reasoning behind recommendations and can trust them.

**Acceptance Criteria:**
1. Each recommendation has explanation field populated
2. Explanations are brief (2-3 sentences), clear, non-technical language
3. Explanations reference: sentiment trends, ML model signals, risk factors
4. Data sources displayed: "Sentiment from Twitter (updated 5 min ago)", "ML model confidence: 0.85 R²"
5. Data freshness indicators shown (timestamps)
6. Explanations help users understand quantitative reasoning
7. Language avoids jargon or explains jargon when used

**Prerequisites:** Story 3.2 (detail view)

---

### Story 3.5: Educational Tooltips & Inline Help

**As a** user,
**I want** tooltips and inline help explaining quantitative concepts (confidence scores, sentiment, R²),
**So that** I can learn about quantitative trading as I use the platform.

**Acceptance Criteria:**
1. Tooltips appear on hover/click for key terms: "confidence score", "sentiment analysis", "R²"
2. Tooltip content explains concepts in simple language
3. Educational content emphasizes transparency (how things are calculated)
4. Inline help available throughout interface
5. First-time user sees onboarding tooltips
6. Help content is concise and actionable

**Prerequisites:** Story 3.1 (dashboard), Story 3.2 (detail view)

---

### Story 3.6: Recommendation Filtering & Sorting

**As a** user,
**I want** to filter and sort recommendations by various criteria,
**So that** I can focus on recommendations most relevant to my investment style.

**Acceptance Criteria:**
1. Filter by: holding period (daily/weekly/monthly), risk level (low/medium/high), confidence threshold
2. Sort by: date (newest first), confidence (highest first), risk (lowest first), sentiment (most positive first)
3. Filters and sorts work together (combined filtering)
4. Filter state persists during session
5. Clear filters button to reset
6. Active filters displayed visually
7. Free tier users see filtered results within their stock limit

**Prerequisites:** Story 3.1 (dashboard), Story 1.6 (freemium tier)

---

### Story 3.7: Freemium Tier Stock Limit Enforcement in UI

**As a** free tier user,
**I want** clear indication when I've reached my stock tracking limit and options to upgrade,
**So that** I understand my limitations and can consider premium features.

**Acceptance Criteria:**
1. UI shows stock count indicator: "Tracking 3/5 stocks (Free tier)"
2. When limit reached, user cannot add more stocks
3. Upgrade prompt shown when limit reached: "Upgrade to premium for unlimited stocks"
4. Premium features clearly listed in upgrade prompt
5. Tier status displayed in user profile
6. Recommendations respect tier limits (only show stocks within limit)

**Prerequisites:** Story 1.6 (freemium tier), Story 3.1 (dashboard)

---

### Story 3.8: User Preference Integration with Recommendations

**As a** user,
**I want** recommendations filtered based on my holding period and risk tolerance preferences,
**So that** recommendations match my investment style.

**Acceptance Criteria:**
1. User's holding period preference filters recommendations shown
2. User's risk tolerance preference influences recommendation prioritization
3. Preferences can be updated and recommendations update accordingly
4. Default recommendations shown if preferences not set
5. Clear indication when preferences affect recommendation display

**Prerequisites:** Story 1.5 (user preferences), Story 2.8 (recommendation generation), Story 3.1 (dashboard)

---

### Story 3.9: Responsive Mobile Optimization

**As a** mobile user,
**I want** the dashboard and recommendation views to work well on mobile devices,
**So that** I can check recommendations on the go.

**Acceptance Criteria:**
1. Dashboard responsive on mobile screens (375px, 414px widths)
2. List view optimized for mobile (touch-friendly, readable)
3. Detail view works well on mobile (modal or full page)
4. Navigation accessible on mobile (hamburger menu or bottom nav)
5. Search functionality works on mobile
6. Touch interactions optimized (tap targets large enough)
7. Text readable without zooming

**Prerequisites:** Story 3.1 (dashboard), Story 3.2 (detail view), Story 1.7 (responsive foundation)

---

**Epic 3 Summary:** 9 stories delivering core user experience: dashboard, search, explanations, filtering. All build on Epic 1 and Epic 2 foundations.

---

## Epic 4: Recommendation Generation Reliability & Filtering Fixes

**Expanded Goal:**
Fix critical issues preventing recommendation generation from working correctly. This epic addresses ML model loading verification, recommendation generation error handling, filtering logic fixes, sentiment data verification, and end-to-end testing to ensure recommendations are generated successfully and filters work as expected. This epic ensures the core recommendation functionality is reliable and production-ready.

**Value Delivery:**
- Recommendation generation works reliably with proper error handling
- ML models load correctly and are accessible during generation
- Filtering logic works correctly for all filter combinations
- Sentiment data is properly gathered and used in recommendations
- Comprehensive diagnostics help identify and fix issues quickly
- End-to-end testing validates the complete recommendation pipeline

---

### Story 4.1: ML Model Loading Verification & Diagnostics

**As a** developer,
**I want** comprehensive diagnostics and verification for ML model loading at startup,
**So that** I can identify and fix model loading issues before recommendation generation fails.

**Acceptance Criteria:**
1. Enhanced model loading diagnostics in `lifetime.py` startup
2. Verify models are accessible from both module globals and app.state
3. Log model file paths, versions, and metadata during loading
4. Health check endpoint: `GET /api/v1/health/ml-models` returns model status
5. Model accessibility test: verify models can be used for inference after loading
6. Clear error messages when models fail to load (file not found, version mismatch, etc.)
7. Fallback mechanism: if models fail to load, log detailed error and prevent generation
8. Model loading status persisted and queryable (for debugging)
9. Startup fails gracefully if models required but not available (configurable)

**Prerequisites:** Story 2.6 (ML model inference service)

---

### Story 4.2: Recommendation Generation Error Handling & Diagnostics

**As a** developer,
**I want** comprehensive error handling and diagnostics in recommendation generation,
**So that** I can identify why recommendations are failing and fix issues quickly.

**Acceptance Criteria:**
1. Enhanced error logging in `generate_recommendations()` with stock-level details
2. Track failure reasons: model errors, data missing, prediction failures, etc.
3. Diagnostic endpoint: `GET /api/v1/admin/recommendations/diagnostics` shows generation health
4. Error categorization: model errors, data errors, filtering errors, persistence errors
5. Partial success handling: generate recommendations for stocks that succeed even if others fail
6. Failure summary returned in generation response (counts by error type)
7. Detailed error logs include: stock_id, symbol, error type, error message, stack trace
8. Graceful degradation: if ensemble fails, try individual models
9. Timeout handling for long-running predictions
10. Retry logic for transient failures (with exponential backoff)

**Prerequisites:** Story 2.8 (recommendation generation logic)

---

### Story 4.3: Fix Recommendation Filtering Logic

**As a** user,
**I want** recommendation filters to work correctly for all filter combinations,
**So that** I can find recommendations matching my criteria.

**Acceptance Criteria:**
1. Fix holding_period filter: correctly maps to risk levels (daily→high, weekly→medium, monthly→low)
2. Fix risk_level filter: correctly filters by RiskLevelEnum values
3. Fix confidence_min filter: correctly filters by confidence_score threshold
4. Fix sort_by filters: date, confidence, risk, sentiment all work correctly
5. Fix sort_direction: asc/desc works for all sort fields
6. Combined filters work together (holding_period + risk_level + confidence_min)
7. User preferences correctly applied as default filters when query params not provided
8. Tier-aware filtering works correctly (free tier sees only tracked stocks)
9. Filter edge cases handled: null values, empty results, invalid inputs
10. Unit tests for all filter combinations

**Prerequisites:** Story 3.6 (recommendation filtering & sorting), Story 2.8 (recommendation generation)

---

### Story 4.4: Sentiment Data Verification & Collection Fixes

**As a** system,
**I want** sentiment data to be properly collected and verified before recommendation generation,
**So that** recommendations include accurate sentiment scores.

**Acceptance Criteria:**
1. Verify sentiment collection job runs successfully and collects data
2. Check sentiment data availability before generating recommendations
3. Log sentiment data coverage: which stocks have sentiment, which don't
4. Handle missing sentiment gracefully: use neutral (0.0) if no sentiment available
5. Verify aggregated sentiment calculation works correctly
6. Sentiment data freshness check: warn if sentiment data is stale (>24 hours)
7. Diagnostic endpoint shows sentiment data status per stock
8. Sentiment collection error handling: retry failed collections, log errors
9. Sentiment data validation: ensure scores are in [-1, 1] range
10. Integration test: verify sentiment is included in generated recommendations

**Prerequisites:** Story 2.4 (sentiment collection), Story 2.8 (recommendation generation)

---

### Story 4.5: End-to-End Recommendation Generation Testing

**As a** developer,
**I want** comprehensive end-to-end tests for recommendation generation,
**So that** I can verify the complete pipeline works correctly.

**Acceptance Criteria:**
1. E2E test: generate recommendations with all components (models, data, sentiment)
2. Test model loading: verify models accessible during generation
3. Test prediction pipeline: verify predictions succeed for test stocks
4. Test filtering: verify all filter combinations work correctly
5. Test error handling: verify graceful failures when components unavailable
6. Test sentiment integration: verify sentiment scores included in recommendations
7. Test persistence: verify recommendations saved to database correctly
8. Test tier filtering: verify free tier users see only tracked stocks
9. Performance test: verify generation completes within latency targets
10. Integration test script: run full pipeline and validate results

**Prerequisites:** Story 4.1 (model loading), Story 4.2 (error handling), Story 4.3 (filtering), Story 4.4 (sentiment)

---

### Story 4.6: Recommendation Generation Performance & Reliability

**As a** system,
**I want** recommendation generation to be performant and reliable,
**So that** recommendations are generated successfully within latency targets.

**Acceptance Criteria:**
1. Optimize prediction calls: batch where possible, parallelize where safe
2. Database query optimization: reduce N+1 queries in generation loop
3. Caching: cache user preferences, stock metadata to reduce DB calls
4. Timeout configuration: set reasonable timeouts for predictions and DB queries
5. Resource limits: prevent memory exhaustion during large batch generation
6. Progress tracking: log progress for long-running generations
7. Rate limiting: prevent excessive concurrent generations
8. Monitoring: track generation success rate, latency, error rates
9. Alerting: alert on high failure rates or performance degradation
10. Performance targets: generate 10 recommendations in <60 seconds

**Prerequisites:** Story 4.2 (error handling), Story 4.5 (E2E testing)

---

**Epic 4 Summary:** 6 stories fixing critical recommendation generation issues: model loading verification, error handling, filtering fixes, sentiment verification, E2E testing, and performance optimization. This epic ensures recommendation generation is reliable and production-ready.

---

## Epic 5: Historical Data & Visualization

**Expanded Goal:**
Enable users to view historical recommendations, see time series visualizations of stock prices and recommendation patterns, and build confidence through understanding past performance. This epic adds the analytical and educational depth that transforms OpenAlpha from a recommendation tool into a comprehensive quantitative trading intelligence platform. By providing transparent historical context and visual data representation, users can learn from past recommendations and validate the platform's value.

**Value Delivery:**
- Historical context helps users understand recommendation patterns
- Time series visualizations make data trends clear and actionable
- Users can track recommendation performance over time to build trust

---

### Story 5.1: Historical Recommendations View

**As a** user,
**I want** to view my past recommendations with dates and outcomes,
**So that** I can learn from past recommendations and track patterns.

**Acceptance Criteria:**
1. Historical recommendations page/list view
2. Shows past recommendations with: date, stock, signal, confidence, sentiment, risk
3. Recommendations sortable by date (newest/oldest first)
4. Filterable by: date range, stock symbol, signal type
5. Search functionality to find specific historical recommendations
6. Historical data loads efficiently (pagination if needed)
7. Empty state if no historical data

**Prerequisites:** Story 2.8 (recommendations stored), Story 3.1 (dashboard foundation)

---

### Story 5.2: Time Series Price Charts

**As a** user,
**I want** to see time series charts showing stock price history,
**So that** I can visualize price trends and understand recommendation timing.

**Acceptance Criteria:**
1. Time series chart component integrated (Chart.js, Recharts, or similar)
2. Chart shows: stock price over time (line chart)
3. Time range selector: 1 day, 1 week, 1 month, 3 months
4. Chart displays in recommendation detail view
5. Chart responsive for mobile devices
6. Chart styling matches black background with blue/green accents
7. Data points clearly labeled with dates and prices

**Prerequisites:** Story 2.2 (market data stored), Story 3.2 (detail view)

---

### Story 5.3: Recommendation History Visualization

**As a** user,
**I want** to see recommendations overlaid on price charts,
**So that** I can see how recommendations aligned with price movements.

**Acceptance Criteria:**
1. Recommendations displayed as markers/annotations on price chart
2. Markers show: recommendation date, signal type (buy/sell/hold), confidence score
3. Different marker colors/styles for buy vs sell vs hold
4. Chart shows multiple recommendations over time for a stock
5. Interactive markers: hover shows recommendation details
6. Chart integrated into stock detail or historical view
7. Visualization helps users understand recommendation timing

**Prerequisites:** Story 5.1 (historical view), Story 5.2 (price charts)

---

### Story 5.4: Historical Sentiment Visualization

**As a** user,
**I want** to see sentiment trends over time on charts,
**So that** I can understand how sentiment changes relate to price movements and recommendations.

**Acceptance Criteria:**
1. Sentiment data displayed as line chart or area chart
2. Chart shows sentiment scores over time (positive/negative scale)
3. Sentiment chart can be overlaid or shown alongside price chart
4. Chart shows data freshness (last update timestamp)
5. Multiple sentiment sources aggregated visually
6. Chart helps users understand sentiment's role in recommendations

**Prerequisites:** Story 2.4 (sentiment data), Story 5.2 (charts foundation)

---

### Story 5.5: Performance Context for Historical Recommendations

**As a** user,
**I want** to see how past recommendations performed relative to actual market movements,
**So that** I can validate the platform's value and build confidence.

**Acceptance Criteria:**
1. Historical recommendations show outcome context (if trackable)
2. Visual indication: recommendation aligned with price movement (positive/negative)
3. Performance summary: "X recommendations aligned with price trends"
4. Confidence score correlation: higher confidence recommendations tended to align better
5. Performance metrics displayed transparently
6. Helps users understand recommendation reliability

**Prerequisites:** Story 5.1 (historical view), Story 5.3 (visualization)

---

### Story 5.6: Advanced Filtering for Historical Data

**As a** user,
**I want** to filter and analyze historical recommendations by various criteria,
**So that** I can discover patterns and insights.

**Acceptance Criteria:**
1. Historical view filterable by: date range, stock, signal type, confidence threshold, risk level
2. Filter combinations work together
3. Filter results update chart visualizations
4. Export or share filtered results (optional - can defer)
5. Saved filter presets (optional - can defer)
6. Performance metrics calculated for filtered subsets

**Prerequisites:** Story 5.1 (historical view), Story 5.5 (performance context)

---

**Epic 5 Summary:** 6 stories adding historical analysis, time series visualizations, and performance tracking. Completes the MVP feature set.

---

## Story Sequencing Summary

**Epic 1 (Foundation):** 7 stories - All foundational, sequential order
**Epic 2 (Data & ML):** 8 stories - Sequential: data → models → recommendations
**Epic 3 (Dashboard):** 9 stories - Build on Epics 1 & 2, mostly parallelizable within epic
**Epic 4 (Data & Training Improvements):** 6 stories - Infrastructure improvements for scalability and reliability
**Epic 5 (History & Viz):** 6 stories - Build on Epics 1-3, sequential visualization building

**Total Stories: 36** (within Level 3 range of 15-40)

---

**For implementation:** Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown.

